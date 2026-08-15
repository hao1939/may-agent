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
  installAppTaskRuntimes,
  readLoadedAppTaskView,
} from "./app-task-runtime.js";

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
});
