import { afterEach, expect, test } from "bun:test";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream, Type, type Context } from "@earendil-works/pi-ai";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineApp, taskAgentResultSchema } from "@may-agent/sdk";
import { prepareAgentExecution, executePreparedAgent } from "./agent-execution.js";
import { createAgentRun } from "./agent-runner.js";
import { currentAgentSessionId } from "./agent-session-context.js";
import { SubagentManager } from "./manager.js";
import { createFinishTool } from "./tools/lifecycle.js";
import { closeDb, getDb } from "./db/connection.js";
import { fakeModel } from "../../test/fixtures/model.js";
import { usageReply } from "../../test/fixtures/execution-usage.js";
import { EventBus } from "../app/core/events/bus.js";
import { HostCapacity } from "../app/core/scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { createTaskAgentRunner } from "../app/adapters/executors/managed-agent.js";
import { createTaskSessionRecovery } from "../app/adapters/executors/session-recovery.js";
import {
  attachLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../app/core/tasks/app-task-runtime.js";

const roots: string[] = [];
const buses: EventBus[] = [];
afterEach(() => {
  for (const bus of buses.splice(0)) closeInstalledAppTaskRuntimes(bus);
  for (const root of roots.splice(0)) {
    closeDb(join(root, "state"));
    rmSync(root, { recursive: true, force: true });
  }
});

function root() {
  const dir = mkdtempSync(join(tmpdir(), "may-graceful-finish-"));
  roots.push(dir);
  return dir;
}

function call(name: string, args: Record<string, unknown>, id = name) {
  const stream = createAssistantMessageEventStream();
  stream.push({
    type: "done",
    reason: "toolUse",
    message: usageReply({
      stopReason: "toolUse",
      content: [{ type: "toolCall", id, name, arguments: args }],
    }),
  });
  return stream;
}

function abortedReply() {
  const stream = createAssistantMessageEventStream();
  stream.push({
    type: "error",
    reason: "aborted",
    error: usageReply({ stopReason: "aborted", errorMessage: "Aborted" }),
  });
  return stream;
}

const progress = {
  state: "waiting",
  continue: true,
  summary: "Draft retained; review remains",
  facts: ["draft:retained"],
};
const partial = {
  status: "partial",
  summary: progress.summary,
  next_steps: "Finish the review",
  result: progress,
};

function stalledTool(onStopped: () => void = () => {}): AgentTool {
  return {
    name: "hold",
    label: "hold",
    description: "Hold a cooperative operation",
    parameters: Type.Object({}),
    async execute(_id, _params, signal) {
      if (!signal) throw new Error("Missing execution cancellation");
      if (!signal.aborted)
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      onStopped();
      return { content: [{ type: "text", text: "Draft retained. Review interrupted; completion unknown." }] };
    },
  };
}

test("direct execution interrupts work, rejects further effects, and admits a corrected partial finish", async () => {
  const dir = root();
  let effects = 0;
  let stopped = false;
  const prepared = prepareAgentExecution({
    definition: {
      name: "owner",
      description: "fixture",
      domain: "test",
      model: fakeModel(),
      systemPrompt: "Use supplied results.",
      tools: [
        stalledTool(() => {
          stopped = true;
        }),
        {
          name: "effect",
          label: "effect",
          description: "New work",
          parameters: Type.Object({}),
          async execute() {
            effects++;
            return { content: [{ type: "text", text: "new effect" }] };
          },
        },
        createFinishTool({ agentName: "owner", projectRoot: dir }),
      ],
    },
    sessionId: "direct-wrap-up",
    projectRoot: dir,
    task: "Implement and review",
    outputSchema: taskAgentResultSchema,
  });
  const contexts: Context[] = [];
  prepared.runner.streamFn = (_model, context, options) => {
    contexts.push(JSON.parse(JSON.stringify(context)) as Context);
    if (contexts.length > 4) throw new Error(`Unexpected corrective turn: ${JSON.stringify(context.messages.at(-1))}`);
    expect(options?.signal?.aborted).toBe(false);
    if (contexts.length === 1) return call("hold", {});
    expect(stopped).toBe(true);
    if (contexts.length === 2) return call("effect", {});
    // The ordinary result validator must still reject a missing continuation route.
    if (contexts.length === 3)
      return call("finish", { ...partial, result: { ...progress, continue: false } }, "invalid");
    return call("finish", partial, "valid");
  };
  const result = await executePreparedAgent(prepared, { timeoutMs: 2_000 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe("done");
  expect(result.structuredResult).toMatchObject(progress);
  expect(effects).toBe(0);
  expect(contexts).toHaveLength(4);
  expect(JSON.stringify(contexts[1])).toContain("Review interrupted; completion unknown");
  const messages = result.messages as Array<{ role: string; content?: unknown; isError?: boolean }>;
  expect(
    messages.filter(
      (message) => message.role === "user" && JSON.stringify(message.content).includes("Bounded completion guardrail"),
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(contexts[2])).toContain("Execution work allowance ended");
  expect(JSON.stringify(contexts[3].messages)).toContain("Validation failed for tool");
});

test("a stalled finalization still reaches the original hard stop without an invented result", async () => {
  const dir = root();
  let calls = 0;
  const prepared = prepareAgentExecution({
    definition: {
      name: "owner",
      description: "fixture",
      domain: "test",
      model: fakeModel(),
      systemPrompt: "Return evidence.",
      tools: [stalledTool(), createFinishTool({ agentName: "owner", projectRoot: dir })],
    },
    sessionId: "stalled-finish",
    projectRoot: dir,
    task: "Implement and review",
    outputSchema: taskAgentResultSchema,
  });
  prepared.runner.streamFn = (_model, context, options) => {
    if (++calls === 1) return call("hold", {});
    expect(JSON.stringify(context.messages)).toContain("Bounded completion guardrail");
    const stream = createAssistantMessageEventStream();
    const abort = () =>
      stream.push({
        type: "error",
        reason: "aborted",
        error: usageReply({ stopReason: "aborted", errorMessage: "Aborted" }),
      });
    if (options?.signal?.aborted) abort();
    else options?.signal?.addEventListener("abort", abort, { once: true });
    return stream;
  };
  const result = await executePreparedAgent(prepared, { timeoutMs: 1_000 });
  expect(calls).toBe(2);
  expect(result.status).toBe("interrupted");
  expect(result.error).toBe("Agent timed out after 1000ms");
  expect(result.finishResult).toBeUndefined();
  expect(result.structuredResult).toBeUndefined();
});

test("a managed Task accepts progress after helper cancellation and continues from it on the same Task", async () => {
  const dir = root();
  const persistDir = join(dir, "state");
  const projectsRoot = join(dir, "projects");
  const appDir = join(projectsRoot, "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    JSON.stringify({
      root_task_id: "operations",
      groups: { operations: { id: "operations", parent_id: null, state: "backlog", children: [] } },
    }),
  );
  const bus = new EventBus();
  buses.push(bus);
  let helperStopped = false;
  let ownerRuns = 0;
  let helperRuns = 0;
  let continuationContext = "";
  const manager = new SubagentManager({
    persistDir,
    projectRoot: dir,
    bus,
    agentRunFactory: (config) => {
      const owner = config.initialState?.model?.id === "owner";
      const attempt = owner ? ++ownerRuns : 0;
      if (!owner) helperRuns++;
      let replies = 0;
      return createAgentRun({
        ...config,
        streamFn: (_model, context, options) => {
          if (options?.signal?.aborted) return abortedReply();
          replies++;
          if (replies > 8) throw new Error("Fixture exceeded its bounded corrective turns");
          if (!owner) {
            return call("hold", {});
          }
          if (attempt === 2) {
            continuationContext = JSON.stringify(context);
            return call("finish", {
              status: "success",
              summary: "Reviewed retained draft",
              verification_facts: ["draft:reviewed"],
              result: { state: "converged", summary: "Reviewed retained draft", facts: ["draft:reviewed"] },
            });
          }
          if (!helperStopped) return call("agents", { action: "call", agent: "helper", task: "Review the draft" });
          // The helper's inherited deadline may fire just before the caller's
          // wrap-up timer. Either ordering must preserve its result. Feedback
          // can also steer between a proposed finish and tool dispatch.
          const text = JSON.stringify(context);
          expect(text).toContain("interrupted");
          expect(text).toContain("sessionId");
          return call("finish", partial);
        },
      });
    },
  });
  manager.register({
    name: "owner",
    description: "fixture",
    domain: "test",
    model: { ...fakeModel(), id: "owner" },
    systemPrompt: "Use the supplied Task contract.",
    tools: [
      manager.createAgentsTool({
        getCallerSessionId: () => currentAgentSessionId("owner"),
        getCallerAgentName: () => "owner",
      }),
    ],
  });
  manager.register({
    name: "helper",
    description: "fixture",
    domain: "test",
    model: { ...fakeModel(), id: "helper" },
    systemPrompt: "Review the draft",
    tools: [
      stalledTool(() => {
        helperStopped = true;
      }),
    ],
  });
  const runner = createTaskAgentRunner({ manager });
  const boundedRunner: typeof runner = {
    ...runner,
    snapshot: () => boundedRunner,
    execute: (input) => runner.execute({ ...input, executionTimeoutMs: 3_000 }),
  };
  try {
    await installAppTaskRuntimes({
      projectRoot: dir,
      projectsRoot,
      persistDir,
      bus,
      hostCapacity: new HostCapacity(1),
      // Keep dispatch explicit while exercising the ordinary admission path.
      startAfter: new Promise<void>(() => {}),
      // Exercise the production managed adapter with a short invocation allowance.
      agents: boundedRunner,
      sessions: createTaskSessionRecovery({ manager, persistDir, bus }),
      appRegistrySnapshot: {
        id: "wrap-up-fixture",
        generation: 1,
        entries: [
          {
            appDir,
            definition: defineApp({
              id: "sample",
              version: 1,
              agent: "owner",
              inputSchema: Type.Object({}),
              workspace: { kind: "local", localPath: "." },
              tasks: {},
            }),
          },
        ],
      },
    });
    await attachLoadedAppTask({
      bus,
      appDir,
      appId: "sample",
      idempotencyKey: "task:review",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/review",
          parentId: "operations",
          outcome: "Implement and review",
          acceptance: ["Reviewed"],
          agent: "owner",
        },
      },
      inputContext: { id: "review", source: { kind: "human", id: "fixture" }, input: { kind: "request", data: {} } },
    });
    const run = () =>
      reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId: "work/review",
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
    await run();
    const store = AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample")!;
    const task = store.readTask("work/review")!;
    expect(task.status.phase).toBe("pending");
    expect(task.status.inputWaits).toMatchObject({ "task:review": { pending: true } });
    const attempt = store.readAttempt(task.status.observedAttemptId!);
    expect(attempt?.acceptedResult, task.status.summary).toMatchObject(progress);
    expect(task.status.executionFailures ?? 0).toBe(0);
    expect(manager.status()).toEqual([]);
    await run();
    expect(ownerRuns).toBe(2);
    expect(helperRuns).toBe(1);
    expect(continuationContext).toContain("Draft retained; review remains");
    expect(continuationContext).toContain("draft:retained");
    expect(store.readTask("work/review")?.status.phase).toBe("converged");
    expect(store.readTask("work/review")?.status.inputWaits ?? {}).toEqual({});
  } finally {
    const sessions = manager.status();
    for (const session of sessions) manager.cancel(session.sessionId);
    await Promise.allSettled(sessions.map((session) => manager.waitFor(session.sessionId)));
  }
});
