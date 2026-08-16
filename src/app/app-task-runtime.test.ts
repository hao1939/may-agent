import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type AppDefinition, type AppRequest } from "@may-agent/sdk";
import { EventBus } from "./event-bus.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  attachLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  consumePersistedTerminalOwnerResult,
  installAppTaskRuntimes,
  readLoadedAppTaskView,
} from "./app-task-runtime.js";
import {
  claimObservedAppTask,
  observeAppTaskIntent,
  recordAppTaskAttemptSession,
  taskReconciliationConfig,
} from "./app-task-reconciler.js";
import { readTaskState } from "./app-task-store.js";

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
      attach: true,
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
  };
}

afterEach(async () => {
  await Promise.all(buses.splice(0).map((bus) => closeInstalledAppTaskRuntimes(bus)));
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("canonical App task runtime", () => {
  it("does not discover or import App definitions independently", async () => {
    const f = fixture();
    const bus = eventBus();
    writeFileSync(join(f.appDir, "app.ts"), `throw new Error("the task runtime must not import app.ts");`);

    expect(await installAppTaskRuntimes(options(f, bus))).toEqual({ installed: [] });

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
});
