import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type AppDefinition, type AppRequest } from "@may-agent/sdk";
import { openDatabase } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { EventBus } from "./event-bus.js";
import { EVENT_ROW_ID } from "./event-bus.js";
import { startAppInboxRuntime } from "./app-inbox-runtime.js";
import { AppRegistry } from "./app-registry.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  admitTaskAppDependencies,
  attachLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  consumePersistedTerminalOwnerResult,
  installAppTaskRuntimes,
  previewLoadedCanonicalAppTaskEvent,
  projectAppTaskReconciliationEvents,
  readLoadedAppTaskView,
} from "./app-task-runtime.js";
import {
  claimObservedAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskAttemptSession,
  taskReconciliationConfig,
} from "./app-task-reconciler.js";
import { readTaskState, saveTaskState } from "./app-task-store.js";
import { HostCapacity } from "./host-capacity.js";
import { writeSessionMeta } from "../lib/persistence.js";

const roots: string[] = [];
const buses: EventBus[] = [];

function eventBus(): EventBus {
  const bus = new EventBus();
  buses.push(bus);
  return bus;
}

function fixture() {
  const root = join(tmpdir(), `app-task-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const projectsRoot = join(root, "projects");
  const appDir = join(projectsRoot, "sample.app");
  mkdirSync(join(appDir, "agents", "owner"), { recursive: true });
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    JSON.stringify({
      root_task_id: "root",
      groups: {
        root: {
          id: "root",
          parent_id: null,
          state: "backlog",
          owner: "sample-owner",
          children: ["operations"],
        },
        operations: {
          id: "operations",
          parent_id: "root",
          state: "backlog",
          children: [],
        },
      },
    }),
  );
  return { root, projectsRoot, appDir };
}

function definition(): AppDefinition {
  return defineApp({
    id: "sample",
    version: 1,
    owner: "sample-owner",
    inputSchema: Type.Object({}, { additionalProperties: true }),
    workspace: { kind: "local", localPath: "." },
    tasks: {
      subscriptions: ["sample.work"],
      resolve(event) {
        const itemId = String(event.data.itemId ?? "");
        return itemId
          ? {
              id: `work/${itemId}`,
              parentId: "operations",
              outcome: `Process ${itemId}`,
              acceptance: ["Work converges"],
              mode: "achieve",
              owner: "sample-owner",
            }
          : null;
      },
    },
  });
}

function options(f: ReturnType<typeof fixture>, bus: EventBus) {
  return {
    projectsRoot: f.projectsRoot,
    projectRoot: f.root,
    manager: { hasAgent: () => true } as never,
    bus,
    hostCapacity: new HostCapacity(2),
  };
}

afterEach(async () => {
  await Promise.all(buses.splice(0).map((bus) => closeInstalledAppTaskRuntimes(bus)));
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("canonical App task runtime", () => {
  it("carries a deterministic cross-App result back as the parent's next Event", async () => {
    const f = fixture();
    const bus = eventBus();
    const evaluationDir = join(f.projectsRoot, "evaluation.app");
    mkdirSync(evaluationDir, { recursive: true });
    writeFileSync(
      join(f.appDir, "app.js"),
      `export default {
        id: "sample", version: 1, owner: "sample-owner",
        inputSchema: { type: "object", properties: {} },
        tasks: {}
      };\n`,
    );
    writeFileSync(
      join(evaluationDir, "app.js"),
      `export default {
        id: "evaluation", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", additionalProperties: false, required: ["kind", "data"],
          properties: {
            kind: { const: "deep-scan" },
            data: { type: "object", additionalProperties: false, required: ["reason"], properties: { reason: { type: "string" } } }
          }
        },
        task(input) {
          return {
            kind: "desired",
            intent: {
              id: "review/" + input.id,
              parentId: "root",
              outcome: "Complete independent review",
              acceptance: ["Review accepted"],
              mode: "achieve"
            }
          };
        },
        tasks: {}
      };\n`,
    );

    const stateDir = join(f.appDir, ".state", "tasks");
    mkdirSync(stateDir, { recursive: true });
    const seed = JSON.parse(readFileSync(join(f.appDir, "tasks", "seed.json"), "utf8"));
    writeFileSync(join(stateDir, "state.json"), JSON.stringify({ ...seed, project_lifecycle: "paused" }));

    const registry = new AppRegistry(f.projectsRoot);
    await registry.reload();
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir: join(f.root, "state"),
      appRegistrySnapshot: registry.snapshot(),
    });

    let nextEventId = 1;
    const dependencyEvents: Array<Record<string, unknown>> = [];
    const conditionPreviews: string[][] = [];
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
    });
    bus.subscribe((event) => {
      if (event.type === "app.dependency.completed" && event.data.kind === "app") {
        dependencyEvents.push(event as unknown as Record<string, unknown>);
      }
    });
    const db = openDatabase(":memory:");
    applyDbSchema(db);
    const dependencyResults = new Map<string, { summary: string; response: string; evidence: string[] }>();
    let attachedDependencyTaskId: string | undefined;
    const inbox = await startAppInboxRuntime({
      registry,
      db,
      bus,
      attachTask: async ({ attachment }) => {
        attachedDependencyTaskId = attachment.kind === "existing" ? attachment.taskId : attachment.intent.id;
        return { taskId: attachedDependencyTaskId };
      },
      readDependency: async ({ dependency }) => {
        const result = dependencyResults.get(dependency.id);
        return result ? { kind: "task", id: dependency.id, status: "done", ...result } : null;
      },
      previewTaskEvent: ({ appId, event, targetedTaskId }) => {
        const taskIds = previewLoadedCanonicalAppTaskEvent({ bus, appId, event, targetedTaskId });
        if (event.type === "app.dependency.completed") conditionPreviews.push(taskIds);
        return taskIds;
      },
      admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
        admitLoadedCanonicalAppTaskEvent({ bus, appId, event, intent, targetedTaskId, conditionTaskIds }),
      scanIntervalMs: 10_000,
    });

    try {
      const config = taskReconciliationConfig({
        appDir: f.appDir,
        projectDir: f.appDir,
        owner: "sample-owner",
        maxConcurrent: 1,
      });
      observeAppTaskIntent(config, {
        intent: {
          id: "work/cross-app-roundtrip",
          parentId: "operations",
          outcome: "Use one independent review",
          acceptance: ["The review result is considered"],
          mode: "achieve",
          owner: "sample-owner",
        },
        appOwner: "sample-owner",
      });
      const initial = claimObservedAppTask(config, {
        taskId: "work/cross-app-roundtrip",
        appOwner: "sample-owner",
        handler: "owner:sample-owner",
        reason: "test",
      });
      if (initial.kind !== "claimed") throw new Error("expected initial claim");
      const descriptor = {
        id: "sample",
        appDir: f.appDir,
        projectDir: f.appDir,
        owner: "sample-owner",
        app: definition(),
        reconciliationPaused: true,
      };
      const conditions = admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir: join(f.root, "state") },
        descriptor,
        claim: initial,
        dependencies: [
          {
            id: "review",
            appId: "evaluation",
            input: { kind: "deep-scan", data: { reason: "parent-needs-review" } },
          },
        ],
      });
      expect(deferAppTask(config, initial, {
        disposition: "waiting",
        summary: "Waiting for the independent review",
        conditions,
      }).status).toBe("applied");

      const requestId = conditions[0]!.subject.slice("id:".length);
      const attachmentDeadline = Date.now() + 1_000;
      while (!attachedDependencyTaskId && Date.now() < attachmentDeadline) await Bun.sleep(5);
      if (!attachedDependencyTaskId) throw new Error("expected child App request to attach to a Task");
      dependencyResults.set(attachedDependencyTaskId, {
        summary: "Independent review completed",
        response: "The dependency result is ready for the parent.",
        evidence: ["review:accepted"],
      });
      bus.emit({
        type: "app.dependency.completed",
        source: "test:evaluation-task",
        owner: "app:evaluation",
        data: { kind: "task", id: attachedDependencyTaskId },
      });
      const deadline = Date.now() + 1_000;
      while (!readTaskState(config).taskTriggers?.[initial.taskId] && Date.now() < deadline) {
        await Bun.sleep(5);
      }
      expect(dependencyEvents).toHaveLength(1);
      expect(conditionPreviews).toContainEqual([initial.taskId]);
      expect(inbox.host.get(requestId)).toMatchObject({
        status: "done",
        result: {
          summary: "Independent review completed",
          response: "The dependency result is ready for the parent.",
          evidence: ["review:accepted"],
        },
      });

      const resumed = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appOwner: "sample-owner",
        handler: "owner:sample-owner",
        reason: "dependency-completed",
      });
      if (resumed.kind !== "claimed") throw new Error(`expected resumed claim, got ${resumed.kind}`);
      expect(resumed.events).toHaveLength(1);
      expect(resumed.events[0]?.event).toMatchObject({
        type: "app.dependency.completed",
        kind: "app",
        id: requestId,
        status: "done",
        summary: "Independent review completed",
        response: "The dependency result is ready for the parent.",
        evidence: ["review:accepted"],
      });
    } finally {
      inbox.close();
      db.close();
    }
  });

  it("turns a typed child App dependency into deterministic input and an exact completion Condition", () => {
    const f = fixture();
    const bus = eventBus();
    const emitted: Array<Record<string, unknown>> = [];
    bus.subscribe((event) => {
      emitted.push(event as unknown as Record<string, unknown>);
    });
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/cross-app",
        parentId: "operations",
        outcome: "Use one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appOwner: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/cross-app",
      appOwner: "sample-owner",
      handler: "owner:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
    };

    const conditions = admitTaskAppDependencies({
      opts: options(f, bus),
      descriptor,
      claim,
      dependencies: [
        {
          id: "review",
          appId: "evaluation",
          input: { kind: "deep-scan", data: { reason: "sample-review" } },
        },
      ],
    });
    const requested = emitted.find((event) => event.type === "app.input.requested");
    expect(requested).toMatchObject({
      source: "app-task:sample",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        input: { kind: "deep-scan", data: { reason: "sample-review" } },
        source: { kind: "app", id: "sample" },
      },
    });
    const requestId = (requested?.data as { requestId?: string } | undefined)?.requestId;
    expect(requestId).toMatch(/^appdep_[a-f0-9]{24}$/);
    expect(conditions).toEqual([
      {
        id: `app-request:${requestId}`,
        type: "app.dependency.completed",
        subject: `id:${requestId}`,
        expected: { field: "status", equals: "done" },
      },
    ]);
  });

  it("projects the exact ordered claimed event batch into workflow context", () => {
    const f = fixture();
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      maxConcurrent: 1,
    });
    const observedAt = ["2026-08-19T00:00:01.000Z", "2026-08-19T00:00:02.000Z"];
    const intent = {
      id: "work/event-context",
      parentId: "operations",
      outcome: "Receive the exact event context",
      acceptance: ["The workflow sees the ordered events"],
      mode: "maintain" as const,
      owner: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appOwner: "sample-owner" });
    const initial = claimObservedAppTask(config, {
      taskId: intent.id,
      appOwner: "sample-owner",
      handler: "workflow:sample",
      reason: "test",
    });
    if (initial.kind !== "claimed") throw new Error("expected initial claim");

    const tree = readTaskState(config);
    tree.taskTriggers = {
      [intent.id]: {
        taskId: intent.id,
        taskGeneration: initial.generation,
        resourceVersion: 2,
        event: { type: "sample.second", eventId: 12, data: { value: "second" } },
        events: [
          {
            event: { type: "sample.first", eventId: 11, data: { value: "first" } },
            observedAt: observedAt[0]!,
          },
          {
            event: { type: "sample.second", eventId: 12, data: { value: "second" } },
            observedAt: observedAt[1]!,
          },
        ],
        observedAt: observedAt[1]!,
      },
    };
    tree.attempts![initial.attemptId]!.state = "completed";
    tree.resources![intent.id]!.status = {
      ...tree.resources![intent.id]!.status,
      phase: "pending",
      currentAttemptId: undefined,
    };
    saveTaskState(config, tree);

    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appOwner: "sample-owner",
      handler: "workflow:sample",
      reason: "event",
    });
    if (claim.kind !== "claimed") throw new Error("expected event claim");

    expect(projectAppTaskReconciliationEvents(claim)).toEqual({
      items: [
        {
          eventId: 11,
          observedAt: observedAt[0],
          event: { type: "sample.first", data: { value: "first" } },
        },
        {
          eventId: 12,
          observedAt: observedAt[1],
          event: { type: "sample.second", data: { value: "second" } },
        },
      ],
      throughEventId: 12,
      truncated: false,
    });
  });

  it("does not rewrite App task state for high-volume session progress", async () => {
    const f = fixture();
    const bus = eventBus();
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:progress",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/progress",
        parentId: "operations",
        outcome: "Process progress",
        acceptance: ["Work converges"],
        mode: "achieve",
        owner: "sample-owner",
      },
      appOwner: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/progress",
      appOwner: "sample-owner",
      handler: "owner:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-progress")).toBe(true);

    const before = readFileSync(config.statePath, "utf8");
    for (let index = 0; index < 100; index += 1) {
      bus.emit({
        type: "tool_call",
        sessionId: "session-progress",
        agent: "sample-owner",
        tool: "read",
        args: { index },
      });
    }
    expect(readFileSync(config.statePath, "utf8")).toBe(before);
  });

  it("does not discover or import App definitions independently", async () => {
    const f = fixture();
    const bus = eventBus();
    writeFileSync(join(f.appDir, "app.ts"), `throw new Error("the task runtime must not import app.ts");`);

    expect(await installAppTaskRuntimes(options(f, bus))).toEqual({
      installed: [],
      claimedSessionIds: new Set(),
    });

    const result = await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    expect(result.installed).toHaveLength(1);
    expect(result.installed[0]).toMatchObject({
      id: "sample",
      appDir: f.appDir,
      owner: "sample-owner",
    });
  });

  it("returns fresh task-session fences from the initial recovery pass", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const runtimeOptions = {
      ...options(f, bus),
      persistDir,
      manager: { hasAgent: () => true, hasActiveSession: () => false } as never,
      appRegistrySnapshot: {
        id: "boot:fresh-session",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    };
    await installAppTaskRuntimes(runtimeOptions);
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      maxConcurrent: 1,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/resumable",
        parentId: "operations",
        outcome: "Resume exact task session",
        acceptance: ["Session is fenced once"],
        mode: "achieve",
        owner: "sample-owner",
      },
      appOwner: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/resumable",
      appOwner: "sample-owner",
      handler: "owner:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-resumable")).toBe(true);
    const previousRuntimeTree = readTaskState(config);
    const previousAttempt = previousRuntimeTree.attempts?.[claim.attemptId];
    if (!previousAttempt?.lease) throw new Error("expected leased attempt");
    previousAttempt.runtimeId = "previous-runtime";
    previousAttempt.lease.runtimeId = "previous-runtime";
    saveTaskState(config, previousRuntimeTree);
    writeSessionMeta(persistDir, "session-resumable", {
      agent: "sample-owner",
      task: "resume",
      status: "running",
      startedAt: Date.now(),
      source: "app-task-owner",
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
      kind: "call",
    });

    const recovered = await installAppTaskRuntimes(runtimeOptions, { includeFreshLeases: true });

    expect(recovered.claimedSessionIds).toEqual(new Set(["session-resumable"]));
    expect(readTaskState(config).resources?.["work/resumable"]?.status.phase).toBe("running");
  });

  it("admits desired attachments and resolved events through the one loaded generation", async () => {
    const f = fixture();
    const bus = eventBus();
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const request: Readonly<AppRequest> = {
      id: "request-1",
      source: { kind: "human", id: "operator" },
      input: { kind: "sample", data: {} },
    };
    const attached = await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/attached",
          parentId: "operations",
          outcome: "Process attached work",
          acceptance: ["Work converges"],
          mode: "achieve",
          owner: "sample-owner",
        },
      },
      idempotencyKey: "attach:request-1",
      request,
    });
    expect(attached.taskId).toBe("work/attached");
    expect(
      readLoadedAppTaskView({
        bus,
        appDir: f.appDir,
        taskId: "work/attached",
      }),
    ).toMatchObject({ id: "work/attached", status: "pending" });

    const intent = definition().tasks!.resolve!({
      type: "sample.work",
      data: { itemId: "event" },
    })!;
    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: {
          type: "sample.work",
          source: "test",
          owner: "agent:sample-owner",
          data: { itemId: "event" },
        },
        intent,
      }),
    ).toMatchObject({ accepted: true, route: "direct" });
    expect(
      readLoadedAppTaskView({
        bus,
        appDir: f.appDir,
        taskId: "work/event",
      }),
    ).toMatchObject({ id: "work/event", status: "pending" });
  });

  it("keeps task admission durable while paused without starting reconciliation", async () => {
    const f = fixture();
    const bus = eventBus();
    const seedPath = join(f.appDir, "tasks", "seed.json");
    const seed = JSON.parse(await Bun.file(seedPath).text());
    const stateDir = join(f.appDir, ".state", "tasks");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, "state.json"), JSON.stringify({ ...seed, project_lifecycle: "paused" }));
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:paused",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const request: Readonly<AppRequest> = {
      id: "request-paused",
      source: { kind: "human", id: "operator" },
      input: { kind: "sample", data: {} },
    };
    const attached = await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/paused-attachment",
          parentId: "operations",
          outcome: "Retain work while paused",
          acceptance: ["Work runs after resume"],
          mode: "achieve",
        },
      },
      idempotencyKey: "attach:paused",
      request,
    });
    expect(attached.taskId).toBe("work/paused-attachment");

    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: {
          type: "sample.work",
          source: "test",
          owner: "agent:sample-owner",
          data: { itemId: "paused-event" },
        },
        intent: {
          id: "work/paused-event",
          parentId: "operations",
          outcome: "Retain event work while paused",
          acceptance: ["Work runs after resume"],
          mode: "achieve",
        },
      }),
    ).toMatchObject({ accepted: true, route: "direct" });
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: attached.taskId })).toMatchObject({
      id: "work/paused-attachment",
      status: "pending",
    });
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: "work/paused-event" })).toMatchObject({
      id: "work/paused-event",
      status: "pending",
    });
  });

  it("recovers one persisted terminal direct-owner result despite a fresh renewed lease", () => {
    const f = fixture();
    const persistDir = join(f.root, ".state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      maxConcurrent: 1,
    });
    const intent = {
      id: "work/terminal",
      parentId: "operations",
      outcome: "Recover terminal owner result",
      acceptance: ["Result is applied once"],
      mode: "achieve" as const,
      owner: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appOwner: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appOwner: "sample-owner",
      handler: "auto",
      reason: "test",
      isOwnerRunnable: () => true,
    });
    if (claim.kind !== "claimed") throw new Error("expected direct-owner claim");
    recordAppTaskAttemptSession(config, claim, "session-terminal");
    const attempt = readTaskState(config).attempts![claim.attemptId];
    expect(attempt.handler).toBe("owner:sample-owner");
    expect(Date.parse(attempt.lease!.expiresAt)).toBeGreaterThan(Date.now());

    mkdirSync(join(persistDir, "sessions", "session-terminal"), { recursive: true });
    writeFileSync(
      join(persistDir, "sessions", "session-terminal", "result.json"),
      JSON.stringify({
        status: "done",
        finishParams: {
          status: "success",
          result: {
            state: "waiting",
            summary: "one child remains",
            evidence: ["session:session-terminal"],
            actions: [
              {
                kind: "create-task",
                id: "work/terminal-child",
                parentId: intent.id,
                outcome: "Complete recovered child",
                acceptance: ["Child converges"],
              },
            ],
          },
        },
      }),
    );
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
    };
    expect(
      consumePersistedTerminalOwnerResult({
        persistDir,
        config,
        descriptor,
        taskId: intent.id,
        sessionId: "session-terminal",
      }),
    ).toMatchObject({ state: "waiting", actionsApplied: ["created work/terminal-child"] });
    expect(
      consumePersistedTerminalOwnerResult({
        persistDir,
        config,
        descriptor,
        taskId: intent.id,
        sessionId: "session-terminal",
      }),
    ).toBeNull();
    expect(readTaskState(config)).toMatchObject({
      resources: { [intent.id]: { status: { phase: "waiting" } } },
      attempts: { [claim.attemptId]: { state: "completed", sessionId: "session-terminal" } },
      tasks: { "work/terminal-child": { parent_id: intent.id } },
    });
  });

  it("rejects an invalid persisted terminal result without crashing recovery", () => {
    const f = fixture();
    const persistDir = join(f.root, ".state");
    const config = taskReconciliationConfig({
      appDir: f.appDir,
      projectDir: f.appDir,
      owner: "sample-owner",
      maxConcurrent: 1,
    });
    const intent = {
      id: "work/invalid-terminal",
      parentId: "operations",
      outcome: "Recover safely",
      acceptance: ["Invalid terminal output is retried"],
      mode: "achieve" as const,
      owner: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appOwner: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appOwner: "sample-owner",
      handler: "auto",
      reason: "test",
      isOwnerRunnable: () => true,
    });
    if (claim.kind !== "claimed") throw new Error("expected direct-owner claim");
    recordAppTaskAttemptSession(config, claim, "session-invalid-terminal");

    mkdirSync(join(persistDir, "sessions", "session-invalid-terminal"), { recursive: true });
    const duplicateAction = {
      kind: "create-task",
      id: "work/duplicate-child",
      parentId: intent.id,
      outcome: "Complete child",
      acceptance: ["Child converges"],
    };
    writeFileSync(
      join(persistDir, "sessions", "session-invalid-terminal", "result.json"),
      JSON.stringify({
        status: "done",
        finishParams: {
          status: "success",
          result: {
            state: "waiting",
            summary: "invalid duplicate actions",
            evidence: ["session:session-invalid-terminal"],
            actions: [duplicateAction, duplicateAction],
          },
        },
      }),
    );

    let rejection = "";
    expect(
      consumePersistedTerminalOwnerResult({
        persistDir,
        config,
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          owner: "sample-owner",
          app: definition(),
          reconciliationPaused: false,
        },
        taskId: intent.id,
        sessionId: "session-invalid-terminal",
        onRejected: (error) => {
          rejection = error instanceof Error ? error.message : String(error);
        },
      }),
    ).toBeNull();
    expect(rejection).toContain("multiple actions for work/duplicate-child");
    expect(readTaskState(config)).toMatchObject({
      resources: { [intent.id]: { status: { phase: "running" } } },
      attempts: { [claim.attemptId]: { state: "running", sessionId: "session-invalid-terminal" } },
    });
  });
});
