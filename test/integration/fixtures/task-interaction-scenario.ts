import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppInputContext, ConversationTurnResult } from "@may-agent/sdk";
import { AppRegistry } from "../../../src/app/core/apps/registry.js";
import { discoverAppDefinitions } from "../../../src/app/adapters/discovery/app-definitions.js";
import { installAppTaskRuntimes, closeInstalledAppTaskRuntimes } from "../../../src/app/core/tasks/app-task-runtime.js";
import { createAppTaskCapability } from "../../../src/app/core/tasks/app-task-capability.js";
import { HostCapacity } from "../../../src/app/core/scheduling/host-capacity.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../../../src/app/composition/app-inbox-runtime.js";
import { readAppConversationResource } from "../../../src/app/core/state/conversations.js";
import { readConversationRequest } from "../../../src/app/core/state/conversation-requests.js";
import { fixture, run, cleanup } from "./task-worker-scenario.js";
import { closeDb, getDb } from "../../../src/lib/requests.js";
import { AppTaskResourceStore } from "../../../src/app/core/state/app-task-resource-store.js";
import { EventBus, type AgentEvent } from "../../../src/app/core/events/bus.js";
import { attachEventPersistence } from "../../../src/app/daemon-events.js";
import { appTaskContext } from "../../../src/app/core/tasks/app-task-reconciler.js";
import {
  admitConversationTaskInput,
  conversationTaskIntent,
  listPendingConversationTaskChanges,
} from "../../../src/app/core/state/conversation-task-turns.js";
import { getAppInboxItem } from "../../../src/app/core/state/app-inbox-store.js";
import { claimAppInboxItem } from "../../fixtures/legacy-inbox.js";

async function withProvider(
  f: ReturnType<typeof fixture>,
  decide: (context: AppInputContext) => ConversationTurnResult,
  execute: (contexts: AppInputContext[]) => Promise<void>,
) {
  const contexts: AppInputContext[] = [];
  let providerError: unknown;
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      assert.equal(request.url, "/chat/completions");
      const payload = JSON.parse(body);
      const texts = payload.messages.flatMap((message: { content: string | Array<{ text?: string }> }) =>
        typeof message.content === "string"
          ? [message.content]
          : (message.content ?? []).map((part) => part.text ?? ""),
      );
      const prompt = texts.find((text: string) => text.includes("## Input and context"));
      assert(prompt, "Worker must send the normal Conversation context to the provider");
      const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!);
      contexts.push(context);
      const toolError = payload.messages.find((message: { role: string; content: unknown }) => message.role === "tool");
      assert.equal(toolError, undefined, JSON.stringify(toolError));
      assert(contexts.length <= 4, "Unexpected extra provider execution");
      assert(payload.tools.some((tool: { function: { name: string } }) => tool.function.name === "finish"));
      const answer = decide(context);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      const chunk = (delta: unknown, finish: string | null) =>
        response.write(
          `data: ${JSON.stringify({
            id: `reply-${contexts.length}`,
            object: "chat.completion.chunk",
            created: 0,
            model: "test",
            choices: [{ index: 0, delta, finish_reason: finish }],
          })}\n\n`,
        );
      chunk(
        {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: `finish-${contexts.length}`,
              type: "function",
              function: {
                name: "finish",
                arguments: JSON.stringify({
                  status: "success",
                  summary: answer.summary,
                  verification_facts: ["Compared the supplied fixture input"],
                  result: answer,
                }),
              },
            },
          ],
        },
        null,
      );
      chunk({}, "tool_calls");
      response.end("data: [DONE]\n\n");
    } catch (error) {
      providerError ??= error;
      response.writeHead(500).end("Invalid fixture provider request");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  f.modelBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await execute(contexts);
    assert.equal(providerError, undefined);
  } catch (error) {
    throw providerError ?? error;
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function conversation() {
  const f = fixture("owner", false, false, true);
  const config = () =>
    appTaskContext({ appDir: f.appDir, projectDir: f.appDir, agent: "owner", resourceStore: f.store });
  const admit = (id: string) =>
    admitConversationTaskInput(config(), {
      appId: "sample",
      id,
      conversationId: "primary",
      source: { kind: "human", id },
      input: { kind: "message", data: { text: `Compare the options for ${id}` } },
      intent: conversationTaskIntent(config()),
    });
  const reopen = () => {
    closeDb(f.persistDir);
    f.db = getDb(f.persistDir);
    f.store = AppTaskResourceStore.fromDb(f.db, "sample");
    f.bus = new EventBus();
    attachEventPersistence({ bus: f.bus, persistDir: f.persistDir });
  };
  await withProvider(
    f,
    (context) => ({
      summary: "Compared the fixture options",
      response: `Reply to ${context.id}`,
      topic: { kind: "none" },
    }),
    async (contexts) => {
      const first = admit("first");
      f.request.taskId = first.taskId;
      f.request.dispatch.lane = "human";
      await run(f);
      assert.equal(getAppInboxItem(f.db, "first")?.result?.response, "Reply to first");
      assert.equal(f.store.isCancelled(first.taskId), false);
      assert.equal(f.store.readReceipt(first.taskId), null);
      assert.equal(claimAppInboxItem(f.db, "first", "old-inbox", 1_000), null);
      const accepted = f.store.readTask(first.taskId)!.status.observedAttemptId!;
      assert.equal(f.store.readAttempt(accepted)?.acceptedResult?.state, "converged");
      reopen();
      const second = admit("second");
      assert.equal(second.taskId, first.taskId);
      await run(f);
      assert.equal(getAppInboxItem(f.db, "first")?.result?.response, "Reply to first");
      assert.equal(getAppInboxItem(f.db, "second")?.result?.response, "Reply to second");
      assert.deepEqual(
        contexts.map(({ id }) => id),
        ["first", "second"],
      );
      assert.notEqual(f.store.readTask(first.taskId)!.status.observedAttemptId, accepted);
      await run(f); // A duplicate process dispatch cannot manufacture new Conversation input.
      assert.equal(contexts.length, 2);
      assert.equal(f.store.isCancelled(first.taskId), false);
      assert.deepEqual(f.store.listRecoveryCandidates().items, []);
    },
  );
}

function eventAfter(bus: EventBus, matches: (event: AgentEvent) => boolean) {
  return new Promise<AgentEvent>((resolve, reject) => {
    const recent: string[] = [];
    const timeout = setTimeout(() => {
      stop();
      reject(new Error(`Expected event missing; recent: ${recent.join(", ")}`));
    }, 10_000);
    const stop = bus.listen((event) => {
      recent.push(event.type === "handler.failed" ? JSON.stringify(event.data) : event.type);
      if (recent.length > 10) recent.shift();
      if (!matches(event)) return;
      clearTimeout(timeout);
      stop();
      resolve(event);
    });
  });
}

async function delegation(nested = false) {
  const f = fixture("owner", false, false, true);
  const measurement = Promise.withResolvers<void>();
  const source = createServer(async (_request, response) => {
    await measurement.promise;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ value: 17 }));
  });
  await new Promise<void>((resolve, reject) => {
    source.once("error", reject);
    source.listen(0, "127.0.0.1", resolve);
  });
  const sourceUrl = `http://127.0.0.1:${(source.address() as AddressInfo).port}`;
  writeFileSync(
    join(f.appDir, "app.ts"),
    `export default {
    id: "sample", version: 1, agent: "owner",
    workspace: { kind: "local", localPath: "." },
    conversation: { mode: "agent", inputKinds: ["message"], conversationId: "primary" },
    inputSchema: { anyOf: [
      { type: "object", properties: { kind: { const: "message" }, data: { type: "object" } }, required: ["kind", "data"] },
      { type: "object", properties: { kind: { enum: ["measure", "sample"] }, data: { type: "object" } }, required: ["kind", "data"] }
    ] },
    tasks: { maxConcurrent: 2 },
    task: (admitted) => ({ kind: "desired", intent: {
      id: admitted.input.kind === "sample" ? "sample" : "measurement",
      parentId: "root", workflow: ${nested} && admitted.input.kind === "measure" ? "assess" : "probe",
      outcome: "Get the sample measurement", acceptance: ["Return the measured value"]
    } })
  };`,
  );
  if (nested)
    writeFileSync(
      join(f.appDir, "agents", "owner", "workflows", "assess.ts"),
      `export const name = "assess";
      export const description = "Assess an independently measured sample";
      export async function execute(ctx) {
        const returned = ctx.reconciliation.events.items.find(({ event }) =>
          event.type === "app.dependency.updated" && event.data.kind === "app");
        if (!returned) return ctx.done("Requested an independent measurement", {
          state: "waiting", summary: "Waiting for the sample", facts: [],
          dependencies: [{ id: "sample", appId: "sample", input: { kind: "sample", data: {} } }]
        });
        const result = returned.event.data.result;
        if (result?.value !== 17) throw Error("Expected the exact measured result");
        return ctx.done("Assessed the measured sample", {
          state: "converged", summary: "The measurement is 17", facts: returned.event.data.facts,
          result: { ...result, assessed: true }
        });
      }`,
    );
  writeFileSync(
    join(f.appDir, "agents", "owner", "workflows", "probe.ts"),
    `
    export const name = "probe";
    export const description = "Measure the supplied sample";
    export async function execute(ctx) {
      const response = fetch(${JSON.stringify(sourceUrl)});
      await ctx.events.emit({ localKey: "started", type: "measurement.started", data: {} });
      const result = await (await response).json();
      return ctx.done("Measured the sample", {
        state: "converged", summary: "The measurement is 17", facts: ["sample:17"],
        response: "Raw sample: 17", result
      });
    }
  `,
  );
  let runtime: AppInboxRuntime | undefined;
  const start = async () => {
    const registry = new AppRegistry(discoverAppDefinitions(join(f.root, "projects")));
    await registry.reload();
    const hostCapacity = new HostCapacity(2);
    await installAppTaskRuntimes(
      {
        projectRoot: f.root,
        projectsRoot: join(f.root, "projects"),
        persistDir: f.persistDir,
        bus: f.bus,
        hostCapacity,
        appRegistry: registry,
        executeAttempt: async (request) => {
          const result = await run({ ...f, request });
          assert(Array.isArray(result));
          return result;
        },
      },
      { deferRecovery: true },
    );
    const tasks = createAppTaskCapability({ bus: f.bus });
    runtime = await startAppInboxRuntime({
      registry,
      db: f.db,
      bus: f.bus,
      persistDir: f.persistDir,
      schedulesEnabled: false,
      attachTask: tasks.attach,
      readDependency: tasks.readDependency,
      admitConversation: tasks.admitConversation,
      admitConversationChange: tasks.admitConversationChange,
      stopConversationTurn: tasks.stopTurn,
      admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
        tasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
      hasTaskTarget: (input) => tasks.has(input),
      previewTaskEvent: ({ appId, event, targetedTaskId }) => tasks.previewEvent({ appId, event, targetedTaskId }),
      previewTaskEventRoutes: (input) => tasks.previewEventRoutes(input),
    });
  };
  const publish = (id: string, text: string) =>
    f.bus.emit({
      type: "conversation.message.created",
      source: "fixture",
      owner: "human:fixture",
      data: { appId: "sample", conversationId: "primary", author: { kind: "human", id }, text, idempotencyKey: id },
    });
  const replyAfter = (text: string) =>
    eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readAppConversationResource(f.db, "sample", "primary").messages.some((message) => message.text === text),
    );
  let humanTurns = 0;
  try {
    await withProvider(
      f,
      (context) => {
        if (context.source.kind === "human") {
          humanTurns++;
          if (humanTurns === 1)
            return {
              summary: "Measurement accepted",
              response: "I will measure it and bring back the result.",
              topic: { kind: "new", title: "Measurement" },
              requestUpdates: [
                { id: "measurement", expectedRevision: 0, scope: "Get the sample measurement", disposition: "open" },
              ],
              followUp: {
                appId: "sample",
                input: { kind: "measure", data: {} },
                requestId: "measurement",
                outcome: "Get the sample measurement",
                acceptance: ["Return the measured value"],
              },
            };
          if (humanTurns === 2) {
            assert.equal(f.store.readTask(nested ? "sample" : "measurement")?.status.phase, "running");
            if (nested) assert.equal(f.store.readTask("measurement")?.status.conditionIds?.length, 1);
          }
          if (humanTurns === 3)
            assert(context.conversation?.messages.some((message) => message.text === "The measurement is 17."));
          return {
            summary: "Answered the human",
            response: humanTurns === 2 ? "We can keep discussing while it runs." : "The earlier result is still 17.",
            topic: { kind: "existing", id: context.conversation!.topics![0]!.id },
          };
        }
        const inputs = context.inputs!.filter((input) => input.input.kind === "task-outcome");
        assert.equal(inputs.length, 1);
        const data = inputs[0]!.input.data as {
          taskId: string;
          attemptId: string;
          outcome: { state: string; result: { value: number; assessed?: boolean } };
        };
        assert.equal(data.taskId, "measurement");
        assert.equal(data.attemptId, f.store.readTask("measurement")!.status.observedAttemptId);
        assert.equal(data.outcome.state, "converged", JSON.stringify(data.outcome));
        assert.equal(data.outcome.result.value, 17);
        if (nested) assert.equal(data.outcome.result.assessed, true);
        const request = context.conversation!.requests!.find((request) => request.id === "measurement")!;
        assert.equal(request.status, "open");
        return {
          summary: "Measurement returned",
          response: "The measurement is 17.",
          topic: { kind: "existing", id: context.conversation!.current!.topicId! },
          requestUpdates: [
            {
              id: request.id,
              expectedRevision: request.revision,
              scope: request.scope,
              disposition: "fulfilled",
              reason: "Returned the measured value",
            },
          ],
        };
      },
      async (contexts) => {
        try {
          await start();
          const started = eventAfter(f.bus, (event) => event.type === "measurement.started");
          publish("measure", "Measure the sample and bring back the result.");
          await started;
          assert.equal(readConversationRequest(f.db, "sample", "primary", "measurement")?.status, "open");
          const discussion = replyAfter("We can keep discussing while it runs.");
          publish("discuss", "Can we discuss the method while it runs?");
          await discussion;
          if (nested) {
            assert.equal(contexts.length, 2, "Saving B's wait must not execute A");
            assert.equal(listPendingConversationTaskChanges(f.db, "sample").length, 0);
            f.bus.emit({
              type: "conversation.supervision.review",
              source: "timer",
              data: { project: "sample", limit: 1 },
            });
          }
          const returned = replyAfter("The measurement is 17.");
          measurement.resolve();
          await returned;
          assert.equal(
            readConversationRequest(f.db, "sample", "primary", "measurement")?.closure?.disposition,
            "fulfilled",
          );
          const ids = Object.keys(f.store.readSnapshot().resources!).sort();
          assert.equal(ids.length, nested ? 3 : 2);
          for (const id of ids) {
            assert.equal(f.store.isCancelled(id), false);
            assert.equal(f.store.readReceipt(id), null);
            assert.equal(f.store.readTask(id)?.status.executionFailures ?? 0, 0);
          }
          assert.equal(
            readAppConversationResource(f.db, "sample", "primary").messages.some(
              (message) => message.text === "Raw sample: 17",
            ),
            false,
          );
          runtime!.close();
          await closeInstalledAppTaskRuntimes(f.bus);
          closeDb(f.persistDir);
          f.db = getDb(f.persistDir);
          f.store = AppTaskResourceStore.fromDb(f.db, "sample");
          f.bus = new EventBus();
          attachEventPersistence({ bus: f.bus, persistDir: f.persistDir });
          await start();
          const resumed = replyAfter("The earlier result is still 17.");
          publish("resume", "Remind me of the result.");
          await resumed;
          assert.equal(contexts.length, 4);
          assert.deepEqual(Object.keys(f.store.readSnapshot().resources!).sort(), ids);
          assert.equal(listPendingConversationTaskChanges(f.db, "sample").length, 0);
        } finally {
          runtime?.close();
          await closeInstalledAppTaskRuntimes(f.bus);
        }
      },
    );
  } finally {
    measurement.resolve();
    source.closeAllConnections();
    await new Promise<void>((resolve) => source.close(() => resolve()));
  }
}

try {
  const scenario = process.argv[2];
  if (scenario === "conversation") await conversation();
  else {
    assert(["delegation", "nested"].includes(scenario!));
    await delegation(scenario === "nested");
  }
} finally {
  await cleanup();
}
