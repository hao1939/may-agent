import type {
  AppDependencyObservation,
  TaskDetail,
  TaskIntent,
  TaskListOptions,
  TaskOutcomePage,
  TaskOutcomeProjection,
  TaskPage,
} from "@may-agent/sdk";
import type { AppTaskAttacher } from "./app-inbox-host.js";
import type { EventBus } from "./event-bus.js";
import type { AppRegistrySnapshot } from "./app-registry.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  attachLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  getLoadedAppTaskView,
  listLoadedAppTaskOutcomeViews,
  listLoadedAppTaskViews,
  previewLoadedCanonicalAppTaskEvent,
  previewLoadedCanonicalAppTaskEventRoutes,
  readLoadedAppTaskView,
  retryLoadedFailedAppTask,
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
  previewEventRoutes(input: {
    event: Parameters<typeof previewLoadedCanonicalAppTaskEventRoutes>[0]["event"];
  }): Array<{ appId: string; taskIds: string[] }>;
  readDependency(input: {
    appDir: string;
    dependency: { kind: "task"; id: string };
  }): Promise<AppDependencyObservation | null>;
  list(input: { appId: string; options?: TaskListOptions }): TaskPage;
  outcomes(input: { appId: string; projection?: TaskOutcomeProjection }): TaskOutcomePage;
  get(input: { appId: string; taskId: string }): TaskDetail | null;
  retry(input: {
    appId: string;
    taskId: string;
    expectedGeneration: number;
  }): ReturnType<typeof retryLoadedFailedAppTask>;
  publishGeneration(input: {
    snapshot: AppRegistrySnapshot;
    definitionSource: Pick<AppTaskRuntimeOptions, "projectsRoot" | "agentsRoot" | "sharedRoot">;
    publish: () => void;
  }): Promise<AppTaskGenerationResult>;
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
    close: async () => {
      await closeInstalledAppTaskRuntimes(options.bus);
    },
    attach: async (input) => attachLoadedAppTask({ ...input, bus: options.bus }),
    admitEvent: (input) => admitLoadedCanonicalAppTaskEvent({ ...input, bus: options.bus }),
    previewEvent: (input) => previewLoadedCanonicalAppTaskEvent({ ...input, bus: options.bus }),
    previewEventRoutes: (input) => previewLoadedCanonicalAppTaskEventRoutes({ ...input, bus: options.bus }),
    async publishGeneration({ snapshot, definitionSource, publish }) {
      if (!options.runtime) {
        publish();
        return { apps: 0 };
      }
      const result = await installAppTaskRuntimes({
        ...options.runtime,
        ...definitionSource,
        appRegistrySnapshot: snapshot,
        afterCommit: () => publish(),
      });
      return { apps: result.installed.length };
    },
    async readDependency({ appDir, dependency }) {
      const task = readLoadedAppTaskView({ bus: options.bus, appDir, taskId: dependency.id });
      return task
        ? {
            kind: "task",
            ...task,
          }
        : null;
    },
    list: ({ appId, options: taskOptions }) =>
      listLoadedAppTaskViews({
        bus: options.bus,
        appId,
        ...(taskOptions ? { options: taskOptions } : {}),
      }),
    outcomes: ({ appId, projection }) =>
      listLoadedAppTaskOutcomeViews({
        bus: options.bus,
        appId,
        ...(projection ? { projection } : {}),
      }),
    get: ({ appId, taskId }) => getLoadedAppTaskView({ bus: options.bus, appId, taskId }),
    retry: ({ appId, taskId, expectedGeneration }) =>
      retryLoadedFailedAppTask({ bus: options.bus, appId, taskId, expectedGeneration }),
  };
}
