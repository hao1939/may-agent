import { afterEach, expect, setSystemTime } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type AppDefinition } from "@may-agent/sdk";
import { EventBus } from "../../src/app/core/events/bus.js";
import {
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes as installCoreTaskRuntimes,
} from "../../src/app/core/tasks/app-task-runtime.js";
import { admitTaskAppRequests } from "../../src/app/core/tasks/dependency-admission.js";
import { createTaskExecutionBackends } from "../../src/app/composition/task-execution.js";
import { appTaskContext } from "../../src/app/core/tasks/app-task-reconciler.js";
import { readTaskSnapshot, type AppTaskContext } from "../../src/app/core/tasks/app-task-store.js";
import { HostCapacity } from "../../src/app/core/scheduling/host-capacity.js";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { appTaskTestContext as createTaskContext } from "../../src/app/core/tasks/app-task-test-support.js";

/** Fresh runtime state and teardown for each owning contract suite. */
export function appTaskRuntimeTestSuite() {
  const roots: string[] = [];

  const buses: EventBus[] = [];

  const stores: AppTaskResourceStore[] = [];

  // Existing wait fixtures select every Condition returned by ordinary admission.
  function admitTaskAppDependencies(
    input: Omit<Parameters<typeof admitTaskAppRequests>[0], "requests"> & {
      dependencies: Parameters<typeof admitTaskAppRequests>[0]["requests"];
    },
  ) {
    return [...admitTaskAppRequests({ ...input, requests: input.dependencies }).values()];
  }

  // Install the shipped backends explicitly; absence checks use the core entry point.
  function installAppTaskRuntimes(
    opts: Parameters<typeof installCoreTaskRuntimes>[0] & Parameters<typeof createTaskExecutionBackends>[0],
    recovery?: Parameters<typeof installCoreTaskRuntimes>[1],
  ) {
    const { manager, registerLocalAgent, drainPersistedBashProcessGroups, ...runtime } = opts;
    return installCoreTaskRuntimes(
      {
        ...createTaskExecutionBackends({ manager, registerLocalAgent, drainPersistedBashProcessGroups, ...runtime }),
        ...runtime,
      },
      recovery,
    );
  }

  function appTaskTestContext(input: Parameters<typeof createTaskContext>[0]) {
    const config = createTaskContext({ databasePath: ":memory:", ...input });
    stores.push(config.resourceStore);
    return config;
  }

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
            agent: "sample-owner",
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
      agent: "sample-owner",
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
                agent: "sample-owner",
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
      persistDir: join(f.root, "state"),
      // Code-only fixtures do not install a runnable model agent. Tests exercising
      // agent execution supply their own runner or manager explicitly.
      manager: { hasAgent: () => false } as never,
      bus,
      hostCapacity: new HostCapacity(2),
    };
  }

  function loadedTaskConfig(f: ReturnType<typeof fixture>, persistDir = join(f.root, "state")) {
    const resourceStore = AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample");
    if (!resourceStore) {
      // Bootstrap the intended authority once, not a temporary DB plus a copy.
      return createTaskContext({
        appDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        resourceStore: AppTaskResourceStore.fromDb(getDb(persistDir), "sample"),
      });
    }
    return appTaskContext({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
      resourceStore,
    });
  }

  function readAcceptedRuntimeAttempt(config: AppTaskContext, taskId: string) {
    const id = config.resourceStore.readTask(taskId)?.status.observedAttemptId;
    return id ? config.resourceStore.readAttempt(id) : null;
  }

  function advanceRuntimeTaskRetry(config: AppTaskContext, taskId: string) {
    const deadline = config.resourceStore.readTask(taskId)!.status.executionRetryAt!;
    expect(deadline).toBeGreaterThan(Date.now());
    setSystemTime(new Date(deadline));
  }

  function mutateRuntimeAttemptFixture(
    config: ReturnType<typeof loadedTaskConfig>,
    taskId: string,
    attemptId: string,
    mutate: (attempt: NonNullable<ReturnType<typeof readTaskSnapshot>["attempts"]>[string]) => void,
  ): void {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const resource = tree.resources?.[taskId];
    const attempt = tree.attempts?.[attemptId];
    if (!resource || !attempt) throw new Error("expected resource-backed attempt fixture");
    mutate(attempt);
    attempt.metadata.resourceVersion += 1;
    expect(
      config.resourceStore.commit({
        fences: [
          {
            taskId,
            resourceVersion: resource.metadata.resourceVersion,
            generation: resource.metadata.generation,
            currentAttemptId: resource.status.currentAttemptId ?? null,
          },
        ],
        attempts: [attempt],
      }),
    ).toBe(true);
  }

  afterEach(async () => {
    setSystemTime();
    await Promise.all(buses.splice(0).map((bus) => closeInstalledAppTaskRuntimes(bus)));
    for (const store of stores.splice(0)) store.close();
    for (const root of roots.splice(0)) {
      closeDb(join(root, "state"));
      closeDb(join(root, ".state"));
      rmSync(root, { recursive: true, force: true });
    }
  });
  return {
    roots,
    installAppTaskRuntimes,
    admitTaskAppDependencies,
    appTaskTestContext,
    eventBus,
    fixture,
    definition,
    options,
    loadedTaskConfig,
    readAcceptedRuntimeAttempt,
    advanceRuntimeTaskRetry,
    mutateRuntimeAttemptFixture,
  };
}
