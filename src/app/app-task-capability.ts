import type { AppDependencyObservation } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { readRuntimeExecutionView } from "./app-read.js";
import type { AppTaskAttacher } from "./app-inbox-host.js";
import type { EventBus } from "./event-bus.js";
import type { AppRegistrySnapshot } from "./app-registry.js";
import {
  attachLoadedProjectAppTask,
  describeLoadedProjectAppActions,
  installProjectApps,
  invokeLoadedProjectAppAction,
  readLoadedProjectAppTaskView,
  runWithProjectAppRuntimeCapacity,
  startProjectAppWatcher,
  type ProjectAppLoaderOptions,
} from "./loader/project-app-loader.js";

export type AppTaskGenerationResult = { apps: number; entries: number };

export type AppTaskCapability = {
  runOwner<T>(work: () => Promise<T>): Promise<T>;
  attach(input: Parameters<AppTaskAttacher>[0] & { appDir: string }): ReturnType<AppTaskAttacher>;
  readDependency(input: {
    appDir: string;
    dependency: { kind: "task" | "session"; id: string };
  }): Promise<AppDependencyObservation | null>;
  publishGeneration(input: { snapshot: AppRegistrySnapshot; publish: () => void }): Promise<AppTaskGenerationResult>;
  watchGenerations(reload: () => Promise<void>): { close(): void } | null;
  describeActions(projectId: string): ReturnType<typeof describeLoadedProjectAppActions>;
  invokeAction(input: {
    projectId: string;
    actionId: string;
    params: unknown;
    idempotencyKey?: string;
    ingressSource?: string;
  }): ReturnType<typeof invokeLoadedProjectAppAction>;
};

/**
 * Host-private boundary around the existing task-resource engine.
 *
 * The canonical App host depends on this capability, never on Project App
 * loader/storage/controller details. The implementation can therefore be
 * extracted and renamed without changing inbox ownership semantics.
 */
export function createAppTaskCapability(options: {
  bus: EventBus;
  getDb: () => SqliteDb;
  compatibility?: ProjectAppLoaderOptions;
}): AppTaskCapability {
  return {
    runOwner: (work) => runWithProjectAppRuntimeCapacity(options.bus, work),
    attach: async (input) => attachLoadedProjectAppTask({ ...input, bus: options.bus }),
    async publishGeneration({ snapshot, publish }) {
      if (!options.compatibility) {
        publish();
        return { apps: 0, entries: 0 };
      }
      const result = await installProjectApps({
        ...options.compatibility,
        appRegistrySnapshot: snapshot,
        afterCommit: () => publish(),
      });
      return { apps: result.installed.length, entries: result.entries };
    },
    watchGenerations(reload) {
      if (!options.compatibility) return null;
      return startProjectAppWatcher(options.compatibility, { reload });
    },
    describeActions: (projectId) => describeLoadedProjectAppActions(options.bus, projectId),
    invokeAction: (input) => invokeLoadedProjectAppAction({ bus: options.bus, ...input }),
    async readDependency({ appDir, dependency }) {
      if (dependency.kind === "task") {
        const task = readLoadedProjectAppTaskView({ bus: options.bus, appDir, taskId: dependency.id });
        return task
          ? {
              kind: "task",
              id: task.id,
              status: task.status,
              summary: task.summary,
              evidence: task.evidence,
            }
          : null;
      }
      const execution = readRuntimeExecutionView({ getDb: options.getDb }, dependency.id);
      return execution
        ? {
            kind: "session",
            id: execution.id,
            status: execution.status === "blocked" ? "waiting" : execution.status,
            summary: execution.summary,
          }
        : null;
    },
  };
}
