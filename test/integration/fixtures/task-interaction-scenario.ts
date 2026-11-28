import type { TaskAttempt, TaskReconcileResult } from "@may-agent/sdk/app";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { daemonSocketPath, sendSocketCommand } from "../../../packages/control/src/client.js";
import { attachControlSocket } from "../../../packages/control/src/server.js";
import { discoverAppDefinitions } from "../../../src/app/adapters/discovery/app-definitions.js";
import { attachCommandRouter } from "../../../src/app/command-router.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../../../src/app/composition/app-inbox-runtime.js";
import { AppRegistry } from "../../../src/app/core/apps/registry.js";
import { EventBus, type AgentEvent } from "../../../src/app/core/events/bus.js";
import { createEventInterface } from "../../../src/app/core/events/interface.js";
import { readExecutionStatus } from "../../../src/app/core/reads/execution-status.js";
import { HostCapacity } from "../../../src/app/core/scheduling/host-capacity.js";
import { getAppInboxItem } from "../../../src/app/core/state/app-inbox-store.js";
import { AppTaskResourceStore } from "../../../src/app/core/state/app-task-resource-store.js";
import { readConversationRequest } from "../../../src/app/core/state/conversation-requests.js";
import {
  admitConversationTaskInput,
  conversationTaskIntent,
} from "../../../src/app/core/state/conversation-task-turns.js";
import { readAppConversationResource } from "../../../src/app/core/state/conversations.js";
import { createAppTaskCapability } from "../../../src/app/core/tasks/app-task-capability.js";
import { appTaskContext } from "../../../src/app/core/tasks/app-task-reconciler.js";
import { closeInstalledAppTaskRuntimes, installAppTaskRuntimes } from "../../../src/app/core/tasks/app-task-runtime.js";
import { attachEventPersistence } from "../../../src/app/daemon-events.js";
import { observeDaemonLiveness } from "../../../src/app/modes/maintenance.js";
import { openDatabase } from "../../../src/lib/db.js";
import { SubagentManager } from "../../../src/lib/manager.js";
import { readActiveSessionProcessId } from "../../../src/lib/persistence.js";
import { closeDb, getDb } from "../../../src/lib/db/connection.js";
import { claimAppInboxItem } from "../../fixtures/legacy-inbox.js";
import { cleanup, fixture, run } from "./task-worker-scenario.js";

type ProviderContext = Pick<TaskAttempt, "events" | "waits">;

async function withProvider(
  f: ReturnType<typeof fixture>,
  decide: (context: ProviderContext) => TaskReconcileResult | Promise<TaskReconcileResult>,
  execute: (contexts: ProviderContext[]) => Promise<void>,
) {
  const contexts: ProviderContext[] = [];
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
      const prompt = texts.find((text: string) => text.startsWith("Task decision brief (source data)."));
      assert(prompt, "Worker must send the common Task decision brief to the provider");
      const preview = JSON.parse(prompt.slice(prompt.indexOf('\n{"binding":') + 1));
      // Follow the same detail link available to an agent when the brief is bounded.
      const brief = JSON.parse(readFileSync(preview.coverage.detail, "utf8"));
      const context: ProviderContext = { events: brief.events.attemptInput, waits: brief.waitsAtAttemptStart };
      contexts.push(context);
      const toolError = payload.messages.find((message: { role: string; content: unknown }) => message.role === "tool");
      assert.equal(toolError, undefined, JSON.stringify(toolError));
      assert(contexts.length <= 4, "Unexpected extra provider execution");
      assert(payload.tools.some((tool: { function: { name: string } }) => tool.function.name === "finish"));
      const answer = await decide(context);
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
                  status: "done",
                  summary: answer.summary,
                  facts: ["Compared the supplied fixture input"],
                  output: answer,
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
  const socketPath = daemonSocketPath(f.persistDir, {
    instance: process.env.INSTANCE || "default",
    interfaceAgent: process.env.AGENT || process.env.DAEMON_AGENT || "host",
  });
  const control = await attachControlSocket({
    socketPath,
    getStatus: () => readExecutionStatus(f.persistDir),
    emitEvent: () => {},
    subscribeEvents: () => () => {},
    agentName: "owner",
    instance: "fixture",
  });
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
  try {
    await withProvider(
      f,
      async (context) => {
        // The provider request is an exact checkpoint: the real child agent is running.
        const started = performance.now();
        const status = await sendSocketCommand(socketPath, { type: "status" });
        console.log(JSON.stringify({ probe: "worker-status", durationMs: performance.now() - started }));
        const sessions = status.activeAgents as Array<{ sessionId: string }>;
        assert.equal(status.activeWork, true);
        assert.equal(sessions.length, 1);
        assert.equal(readActiveSessionProcessId(f.persistDir, sessions[0]!.sessionId), f.child!.pid);
        assert.notEqual(f.child!.pid, process.pid);
        assert.deepEqual(await observeDaemonLiveness(f.persistDir, socketPath), { responsive: true, activeWork: true });
        // Public session controls must not bypass the Task that owns this child.
        const manager = new SubagentManager({ persistDir: f.persistDir });
        const router = attachCommandRouter({
          bus: f.bus,
          reload: () => ({ ok: true, summary: "fixture" }),
          restart: () => {},
          shutdown: () => {},
        });
        const events = createEventInterface({
          bus: f.bus,
          db: f.db,
          validateAppInput: () => { throw new Error("invalid App input"); },
          hasApp: () => true,
        });
        const sessionId = sessions[0]!.sessionId;
        const binding = manager.registryStore.getSession(sessionId)!.taskBinding;
        assert(binding);
        try {
          for (const type of ["session.cancel.requested", "session.steer.requested"] as const) {
            assert.throws(
              () =>
                events.publish(
                  {
                    type,
                    target: { sessionId },
                    data: type === "session.steer.requested" ? { message: "continue" } : {},
                  },
                  { source: "fixture" },
                ),
              (error) => error instanceof Error && error.message.includes("not admitted"),
            );
          }
          assert.deepEqual(manager.registryStore.getSession(sessionId)!.taskBinding, binding);
          assert.deepEqual(manager.status(), []);
          assert.equal(f.store.isCancelled(binding.taskId), false);
        } finally {
          router.close();
        }
        return { state: "converged", summary: "Compared the fixture options", facts: [],
          communication: [{ id: `reply-${context.events.inputs![0]!.id}`, inputId: context.events.inputs![0]!.id,
            message: `Reply to ${context.events.inputs![0]!.id}`, topic: { kind: "none" } }] };
      },
      async (contexts) => {
        const first = admit("first");
        f.request.taskId = first.taskId;
        f.request.dispatch.lane = "human";
        await run(f);
        assert.deepEqual(readExecutionStatus(f.persistDir), { sessions: [], activeWork: false });
        assert.equal((await sendSocketCommand(socketPath, { type: "status" })).activeWork, false);
        assert.equal(getAppInboxItem(f.db, "first")?.status, "done");
        assert(readAppConversationResource(f.db, "sample", "primary").messages.some(({text}) => text === "Reply to first"));
        assert.equal(f.store.isCancelled(first.taskId), false);
        assert.equal(claimAppInboxItem(f.db, "first", "old-inbox", 1_000), null);
        const accepted = f.store.readTask(first.taskId)!.status.observedAttemptId!;
        assert.equal(f.store.readAttempt(accepted)?.acceptedResult?.state, "converged");
        reopen();
        const second = admit("second");
        assert.equal(second.taskId, first.taskId);
        await run(f);
        assert.equal(getAppInboxItem(f.db, "first")?.status, "done");
        assert(readAppConversationResource(f.db, "sample", "primary").messages.some(({text}) => text === "Reply to first"));
        assert.equal(getAppInboxItem(f.db, "second")?.status, "done");
        assert(readAppConversationResource(f.db, "sample", "primary").messages.some(({text}) => text === "Reply to second"));
        assert.deepEqual(
          contexts.map(({ events }) => events.inputs![0]!.id),
          ["first", "second"],
        );
        assert.notEqual(f.store.readTask(first.taskId)!.status.observedAttemptId, accepted);
        await run(f); // A duplicate process dispatch cannot manufacture new Conversation input.
        assert.equal(contexts.length, 2);
        assert.equal(f.store.isCancelled(first.taskId), false);
        assert.deepEqual(f.store.listRecoveryCandidates().items, []);
      },
    );
  } finally {
    control.close();
  }
}

function eventAfter(bus: EventBus, matches: (event: AgentEvent) => boolean, timeoutMs = 10_000) {
  return new Promise<AgentEvent>((resolve, reject) => {
    const recent: string[] = [];
    const timeout = setTimeout(() => {
      stop();
      reject(new Error(`Expected event missing; recent: ${recent.join(", ")}`));
    }, timeoutMs);
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

async function delegation(nested = false, contendAdmission = false, unblock = false) {
  const f = fixture("owner", false, false, true);
  const observationDeadline = Date.now() + 40_000;
  const observeEvent = (matches: Parameters<typeof eventAfter>[1]) =>
    eventAfter(f.bus, matches, unblock ? Math.max(1, observationDeadline - Date.now()) : 10_000);
  const finalMessage = unblock ? "The cached measurement is 17." : "The measurement is 17.";
  const interimMessage = unblock ? "I will include the cached source in the result." : "We can keep discussing while it runs.";
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
    conversation: { mode: "task", inputKinds: ["message"], conversationId: "primary" },
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
          event.type === "app.dependency.updated" && event.data.kind === "app" && event.data.status === "done");
        if (!returned) return ctx.done("Requested an independent measurement", {
          state: "waiting", summary: "Waiting for the sample", facts: [],
          requests: [{ id: "sample", appId: "sample", input: { kind: "sample", data: {} } }],
          conditions: [{ requestId: "sample" }]
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
      const decisions = ctx.reconciliation.events.items.filter(({event}) =>
        event.type === "app.task.requested" && event.data.request.input.data.useOffline === true);
      if (${unblock} && !decisions.length) return ctx.done("Live source unavailable", {
        state: "waiting", report: true, summary: "Live source unavailable; an approved cached sample is available",
        facts: ["source:unavailable", "cached-sample:approved"],
        conditions: [{id:"source-choice",type:"fixture.source.chosen",subject:"id:measurement",
          expected:{field:"useOffline",equals:true},owner:"app:sample"}]
      });
      const response = fetch(${JSON.stringify(sourceUrl)});
      await ctx.events.emit({ localKey: "started", type: "measurement.started", data: {} });
      const result = await (await response).json();
      return ctx.done("Measured the sample", {
        state: "converged", summary: "The measurement is 17", facts: ["sample:17"],
        response: "Raw sample: 17", result: ${unblock} ? {...result, source: "cache"} : result,
        ...(${unblock} ? {inputKeys:[...new Set([
          ...(ctx.reconciliation.previousAttempt?.acceptedResult?.inputKeys ?? []),
          ...(ctx.reconciliation.events.inputs ?? []).map(input=>input.key)
        ])],actions:[{kind:"retire-condition",conditionId:"source-choice",expectedConditionGeneration:1,
          reason:"The caller selected the approved cached source"}]} : {})
      });
    }
  `,
  );
  let runtime: AppInboxRuntime | undefined;
  const competingWriter = contendAdmission ? openDatabase(join(f.persistDir, "may.db")) : undefined;
  let contended = false;
  let admissionFailed = false;
  let writerLocked = false;
  // The worker has already persisted this input. Contend only its parent-side
  // admission, just as another SQLite writer can after the IPC event arrives.
  if (competingWriter) {
    f.bus.subscribeDurableRoute((event) => {
      if (contended || event.type !== "app.input.requested" || event.data.input?.kind !== "sample") return;
      contended = true;
      competingWriter.exec("BEGIN IMMEDIATE");
      writerLocked = true;
    });
    f.bus.listen((event) => {
      if (
        event.type === "subscriber.failed" &&
        event.data.originalEventType === "app.input.requested" &&
        event.data.error.includes("database is locked")
      )
        admissionFailed = true;
    });
  }
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
          // This scenario deliberately holds a real workflow while additional
          // human/worker turns execute; it is not the worker-timeout regression.
          const result = await run({ ...f, request }, false, 15_000);
          assert(Array.isArray(result));
          // The passive input-recovery scan has a 60-second floor. Advance the
          // same recovery methods at this process boundary within the fixture.
          await runtime!.host.recoverAdmissions();
          await runtime!.host.recoverTaskResults();
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
      // Retry durable routing plans promptly; passive inbox recovery stays bounded separately.
      scanIntervalMs: 100,
      attachTask: tasks.attach,
      readDependency: tasks.readDependency,
      admitConversation: tasks.admitConversation,
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
    observeEvent(
      (event) =>
        event.type === "conversation.message.created" &&
        readAppConversationResource(f.db, "sample", "primary").messages.some((message) => message.text === text),
    );
  let humanTurns = 0;
  try {
    await withProvider(
      f,
      ({ events }) => {
        const returned = events.items.find(
          ({ event }) => event.type === "app.dependency.updated" && event.data.status === "done",
        );
        const conversation = events.communication![0]!;
        const blocked = events.items.find(
          ({ event }) => event.type === "app.dependency.updated" && event.data.facts?.includes("source:unavailable"),
        );
        if (unblock && blocked && !returned) {
          assert.equal(blocked.event.data.taskId, "measurement");
          assert.equal(readConversationRequest(f.db, "sample", "primary", "measurement")?.status, "open");
          return {
            state: "waiting",
            summary: "Use the approved cached source",
            facts: [],
            requests: [
              {
                id: "use-approved-cache",
                appId: "sample",
                taskId: "measurement",
                input: { kind: "measure", data: { useOffline: true } },
              },
            ],
            conditions: [{ requestId: "use-approved-cache" }],
          };
        }
        if (returned) {
          const data = returned.event.data;
          assert.equal(data.taskId, "measurement");
          assert.equal((data.result as { value: number }).value, 17);
          if (nested) assert.equal((data.result as { assessed: boolean }).assessed, true);
          if (unblock) assert.equal((data.result as {source:string}).source, "cache");
          assert(events.continuedInputs?.length, "The exact original input must continue on the returned result");
          const request = conversation.requests!.find(({ id }) => id === "measurement")!;
          assert.equal(request.status, "open");
          return {
            state: "converged", summary: "Measurement returned", facts: ["sample:17"],
            communication: [{ id: "measurement-result", inputId: events.inputs![0]!.id,
              message: finalMessage, topic: { kind: "existing", id: conversation.topics![0]!.id },
              requestUpdates: [{ id: request.id, expectedRevision: request.revision,
                disposition: "fulfilled", reason: "Returned the measured value" }],
            }],
          };
        }
        const input = events.inputs!.filter(({ source }) => source.kind === "human").at(-1)!;
        assert(input, "The common Task must retain its admitted human input");
        humanTurns++;
        if (humanTurns === 1) return {
          state: "waiting", summary: "Measurement accepted", facts: [],
          communication: [{ id: "accept-measurement", inputId: input.id,
            message: "I will measure it and bring back the result.", topic: { kind: "new", title: "Measurement" },
            requestUpdates: [{ id: "measurement", expectedRevision: 0, scope: "Get the sample measurement",
              disposition: "open", reason: "Delegating the measurement and waiting for its result" }],
          }],
          requests: [{ id: "measurement", appId: "sample", input: { kind: "measure", data: {} } }],
          conditions: [{ requestId: "measurement", ...(unblock ? {progress:"immediate" as const} : {}) }],
        };
        if (humanTurns === 2) {
          assert.equal(f.store.readTask(nested ? "sample" : "measurement")?.status.phase, "running");
          if (nested) assert.equal(f.store.readTask("measurement")?.status.conditionIds?.length, 1);
        }
        if (humanTurns === 3) assert(conversation.messages.some(({ text }) => text === "The measurement is 17."));
        return {
          state: unblock && humanTurns === 2 ? "waiting" : "converged", summary: "Answered the human", facts: [],
          communication: [{ id: `answer-${input.id}`, inputId: input.id,
            message: humanTurns === 2 ? interimMessage : "The earlier result is still 17.",
            ...(unblock && humanTurns === 2 ? {requestUpdates:[{id:"measurement",
              expectedRevision:conversation.requests!.find(({id})=>id==="measurement")!.revision,
              scope:"Get the sample measurement and identify the cached source in the final answer",
              disposition:"open" as const,reason:"The human refined the existing request"}]} : {}),
            topic: { kind: "existing", id: conversation.topics![0]!.id },
          }],
        };
      },
      async (contexts) => {
        try {
          await start();
          if (competingWriter)
            f.bus.subscribeDurableRoute(() => {
              if (!writerLocked) return;
              competingWriter.exec("ROLLBACK");
              writerLocked = false;
            });
          const started = observeEvent((event) => event.type === "measurement.started");
          const decisionAccepted = unblock ? observeEvent(event =>
            event.type === "project.task.reconciled" && event.data.summary === "Use the approved cached source") : Promise.resolve();
          void decisionAccepted.catch(()=>{});
          publish("measure", unblock ? "Measure the sample and bring back the result; using the cached source is approved if live access is unavailable." : "Measure the sample and bring back the result.");
          await started;
          await decisionAccepted;
          if (competingWriter) {
            assert(contended, "The recovery case must encounter a real competing writer");
            assert(admissionFailed, "The input must recover after a confirmed SQLite admission failure");
          }
          assert.equal(readConversationRequest(f.db, "sample", "primary", "measurement")?.status, "open");
          const refinementAccepted = unblock ? observeEvent(event =>
            event.type === "project.task.reconciled" && event.data.summary === "Answered the human") : Promise.resolve();
          void refinementAccepted.catch(()=>{});
          const discussion = replyAfter(interimMessage);
          publish(
            "discuss",
            unblock
              ? "When the measurement returns, also identify that it came from the approved cached source."
              : "Can we discuss the method while it runs?",
          );
          await discussion;
          await refinementAccepted;
          if (nested) {
            assert.equal(contexts.length, 2, "Saving B's wait must not execute A");
          }
          if (unblock) {
            assert.equal(
              Object.keys(f.store.readSnapshot().resources!).length,
              2,
              "Decision must reuse the existing worker Task",
            );
            const worker = f.store.readTask("measurement")!;
            assert.equal(worker.metadata.generation, 1);
            const attempts = Object.values(f.store.readTaskContext({ taskIds: ["measurement"] }).attempts ?? {});
            assert(
              attempts.some((attempt) => attempt.acceptedResult?.state === "waiting"),
              "The blocker must be a saved worker result",
            );
            assert(readConversationRequest(f.db, "sample", "primary", "measurement")!.scope.includes("cached source"));
          }
          const returned = replyAfter(finalMessage);
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
            assert.equal(f.store.readTask(id)?.status.executionFailures ?? 0, 0);
          }
          assert.equal(
            readAppConversationResource(f.db, "sample", "primary").messages.some(
              (message) => message.text === "Raw sample: 17",
            ),
            false,
          );
          if (unblock) {
            assert.equal(contexts.length, 4, "Initial ask, blocker decision, human refinement and final answer");
            return;
          }
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
        } finally {
          // Release the fixture's HTTP barrier before draining its workers,
          // including when an assertion or event wait fails while it is held.
          measurement.resolve();
          runtime?.close();
          await closeInstalledAppTaskRuntimes(f.bus);
        }
      },
    );
  } finally {
    measurement.resolve();
    if (writerLocked) competingWriter!.exec("ROLLBACK");
    competingWriter?.close();
    source.closeAllConnections();
    await new Promise<void>((resolve) => source.close(() => resolve()));
  }
}

try {
  const scenario = process.argv[2];
  if (scenario === "conversation") await conversation();
  else {
    assert(["delegation", "nested", "nestedRecovery", "unblock"].includes(scenario!));
    await delegation(
      scenario === "nested" || scenario === "nestedRecovery",
      scenario === "nestedRecovery",
      scenario === "unblock",
    );
  }
} finally {
  await cleanup();
}
