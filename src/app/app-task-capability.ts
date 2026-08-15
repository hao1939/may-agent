import type { AppDependencyObservation, TaskIntent } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";
import { readRuntimeExecutionView } from "./app-read.js";
import type { AppTaskAttacher } from "./app-inbox-host.js";
import type { EventBus } from "./event-bus.js";
import type { AppRegistrySnapshot } from "./app-registry.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  attachLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  previewLoadedCanonicalAppTaskEvent,
  readLoadedAppTaskView,
  runWithAppTaskRuntimeCapacity,
  startAppTaskRuntimeWatcher,
  type AppTaskRuntimeOptions,
} from "./app-task-runtime.js";

export type AppTaskGenerationResult = { apps: number };

export type AppTaskCapability = {
  close(): Promise<void>;
  runOwner<T>(work: () => Promise<T>): Promise<T>;
  attach(input: Parameters<AppTaskAttacher>[0] & { appDir: string }): ReturnType<AppTaskAttacher>;
  admitEvent(input: {
    appId: string;
    event: Parameters<typeof admitLoadedCanonicalAppTaskEvent>[0]["event"];
    intent: TaskIntent | null;
    targetedTaskId?: string;
    conditionTaskIds?: string[];
  }): ReturnType<typeof admitLoadedCanonicalAppTaskEvent>;
  previewEvent(input: {
    appId: string;
    event: Parameters<typeof previewLoadedCanonicalAppTaskEvent>[0]["event"];
    targetedTaskId?: string;
  }): string[];
  readDependency(input: {
    appDir: string;
    dependency: { kind: "task" | "session"; id: string };
  }): Promise<AppDependencyObservation | null>;
  publishGeneration(input: { snapshot: AppRegistrySnapshot; publish: () => void }): Promise<AppTaskGenerationResult>;
  watchGenerations(reload: () => Promise<void>): { close(): void } | null;
};

/**
 * Host-private boundary around App task reconciliation.
 *
 * The canonical App host depends on this capability, never on task
 * store/controller details. App Inbox remains unaware of task mechanics.
 */
export function createAppTaskCapability(options: {
  bus: EventBus;
  getDb: () => SqliteDb;
  runtime?: AppTaskRuntimeOptions;
}): AppTaskCapability {
  return {
    close: () => closeInstalledAppTaskRuntimes(options.bus),
    runOwner: (work) => runWithAppTaskRuntimeCapacity(options.bus, work),
    attach: async (input) => attachLoadedAppTask({ ...input, bus: options.bus }),
    admitEvent: (input) => admitLoadedCanonicalAppTaskEvent({ ...input, bus: options.bus }),
    previewEvent: (input) => previewLoadedCanonicalAppTaskEvent({ ...input, bus: options.bus }),
    async publishGeneration({ snapshot, publish }) {
      if (!options.runtime) {
        publish();
        return { apps: 0 };
      }
      const result = await installAppTaskRuntimes({
        ...options.runtime,
        appRegistrySnapshot: snapshot,
        afterCommit: () => publish(),
      });
      return { apps: result.installed.length };
    },
    watchGenerations(reload) {
      if (!options.runtime) return null;
      return startAppTaskRuntimeWatcher(options.runtime, { reload });
    },
    async readDependency({ appDir, dependency }) {
      if (dependency.kind === "task") {
        const task = readLoadedAppTaskView({ bus: options.bus, appDir, taskId: dependency.id });
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
