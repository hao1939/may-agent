import type { AppDependencyObservation, TaskIntent } from "@may-agent/sdk";
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
  startAppTaskRuntimeWatcher,
  type AppTaskRuntimeOptions,
} from "./app-task-runtime.js";

export type AppTaskGenerationResult = { apps: number };

export type AppTaskCapability = {
  close(): Promise<void>;
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
    dependency: { kind: "task"; id: string };
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
  runtime?: AppTaskRuntimeOptions;
}): AppTaskCapability {
  return {
    close: () => closeInstalledAppTaskRuntimes(options.bus),
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
      const task = readLoadedAppTaskView({ bus: options.bus, appDir, taskId: dependency.id });
      return task
        ? {
            kind: "task",
            id: task.id,
            status: task.status,
            summary: task.summary,
            response: task.response,
            evidence: task.evidence,
          }
        : null;
    },
  };
}
