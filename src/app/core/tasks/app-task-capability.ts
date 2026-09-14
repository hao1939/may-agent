import type {
  TaskDetail,
  TaskIntent,
  TaskListOptions,
  TaskOutcomePage,
  TaskOutcomeProjection,
  TaskPage,
} from "@may-agent/sdk";
import type { AppTaskAttacher } from "../inbox/app-inbox-host.js";
import type { TaskInputObservation } from "../inbox/input-context.js";
import type { EventBus } from "../events/bus.js";
import type { AppRegistrySnapshot } from "../apps/registry.js";
import type { ConversationTaskChangeRef } from "../state/conversation-task-turns.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  admitLoadedConversationInput,
  admitLoadedConversationChange,
  attachLoadedAppTask,
  cancelLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  getLoadedAppTaskView,
  hasLoadedAppTask,
  listLoadedAppTaskOutcomeViews,
  listLoadedAppTaskViews,
  previewLoadedCanonicalAppTaskEvent,
  previewLoadedCanonicalAppTaskEventRoutes,
  prepareAppTaskRuntimeGeneration,
  publishPreparedAppTaskRuntimeGeneration,
  readLoadedAppTaskView,
  readLoadedAppTaskInputResult,
  retryLoadedFailedAppTask,
  stopLoadedConversationTurn,
  wakeLoadedAppTasks,
  type PreparedAppTaskRuntimeGeneration,
} from "./app-task-runtime.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";

export type AppTaskGenerationResult = { apps: number; recover(): void };
export type PreparedAppTaskGeneration = Readonly<{
  runtime: PreparedAppTaskRuntimeGeneration | null;
  quiesce(): Promise<void>;
  rollback(): void;
}>;

export type AppTaskCapability = {
  close(): Promise<void>;
  admitConversation(
    item: Parameters<typeof admitLoadedConversationInput>[0]["item"],
  ): ReturnType<typeof admitLoadedConversationInput>;
  admitConversationChange(input: ConversationTaskChangeRef): ReturnType<typeof admitLoadedConversationChange>;
  stopTurn(
    target: Parameters<typeof stopLoadedConversationTurn>[0]["target"],
  ): ReturnType<typeof stopLoadedConversationTurn>;
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
    admissionKey?: string;
  }): Promise<TaskInputObservation | null>;
  list(input: { appId: string; options?: TaskListOptions }): TaskPage;
  outcomes(input: { appId: string; projection?: TaskOutcomeProjection }): TaskOutcomePage;
  get(input: { appId: string; taskId: string }): TaskDetail | null;
  has(input: { appId: string; taskId: string }): boolean;
  wake(input: { appId: string; taskIds: string[]; supersededSessionIds?: string[] }): void;
  retry(input: {
    appId: string;
    taskId: string;
    expectedGeneration: number;
    expectedResourceVersion: number;
    controlKey?: string;
  }): ReturnType<typeof retryLoadedFailedAppTask>;
  cancel(input: {
    appId: string;
    taskId: string;
    expectedGeneration: number;
    expectedResourceVersion: number;
    reason: string;
    controlKey?: string;
  }): ReturnType<typeof cancelLoadedAppTask>;
  prepareGeneration(input: {
    snapshot: AppRegistrySnapshot;
    definitionSource: Pick<AppTaskRuntimeOptions, "projectsRoot" | "agentsRoot" | "sharedRoot">;
  }): Promise<PreparedAppTaskGeneration>;
  publishGeneration(input: {
    prepared: PreparedAppTaskGeneration;
    publish: () => void;
    rollback?: () => void;
    finalize?: () => void;
  }): AppTaskGenerationResult;
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
    attach: (input) => attachLoadedAppTask({ ...input, bus: options.bus }),
    admitConversation: (item) => admitLoadedConversationInput({ bus: options.bus, item }),
    admitConversationChange: (input) => admitLoadedConversationChange({ ...input, bus: options.bus }),
    stopTurn: (target) => stopLoadedConversationTurn({ bus: options.bus, target }),
    admitEvent: (input) => admitLoadedCanonicalAppTaskEvent({ ...input, bus: options.bus }),
    previewEvent: (input) => previewLoadedCanonicalAppTaskEvent({ ...input, bus: options.bus }),
    previewEventRoutes: (input) => previewLoadedCanonicalAppTaskEventRoutes({ ...input, bus: options.bus }),
    async prepareGeneration({ snapshot, definitionSource }) {
      if (!options.runtime) {
        return Object.freeze({ runtime: null, async quiesce() {}, rollback() {} });
      }
      const runtime = await prepareAppTaskRuntimeGeneration({
        ...options.runtime,
        ...definitionSource,
        appRegistrySnapshot: snapshot,
      });
      return Object.freeze({
        runtime,
        quiesce: () => runtime.quiesceIdentityRenames(),
        rollback: () => runtime.resumePreviousControllers(),
      });
    },
    publishGeneration({ prepared, publish, rollback, finalize }) {
      if (!prepared.runtime) {
        try {
          publish();
          finalize?.();
          return { apps: 0, recover() {} };
        } catch (error) {
          rollback?.();
          throw error;
        }
      }
      const result = publishPreparedAppTaskRuntimeGeneration(
        {
          ...prepared.runtime,
          opts: { ...prepared.runtime.opts, afterCommit: () => publish() },
        },
        { deferRecovery: true },
        { rollback, finalize },
      );
      return { apps: result.installed.length, recover: result.recover };
    },
    async readDependency({ appDir, dependency, admissionKey }) {
      const task = readLoadedAppTaskView({ bus: options.bus, appDir, taskId: dependency.id });
      if (admissionKey) {
        const accepted = readLoadedAppTaskInputResult({
          bus: options.bus,
          appDir,
          taskId: dependency.id,
          admissionKey,
        });
        if (accepted)
          return {
            kind: "task",
            id: dependency.id,
            status: accepted.state === "converged" ? "done" : "attention",
            ...(task?.closed ? { closed: true } : {}),
            summary: accepted.summary,
            response: accepted.response,
            result: accepted.result,
            facts: accepted.facts,
          };
        // A later cycle or an unrelated retained wait cannot answer this input.
        const report = readLoadedAppTaskInputResult({
          bus: options.bus,
          appDir,
          taskId: dependency.id,
          admissionKey,
          kind: "report",
        });
        return {
          kind: "task",
          id: dependency.id,
          ...(report && !task?.closed ? { report } : {}),
          ...(task?.closed ? { closed: true } : {}),
          status: task?.closed ? "attention" : "pending",
          summary: task?.closed
            ? "The Task closed without an accepted outcome for this input"
            : "This input has no accepted outcome yet",
        };
      }
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
    has: ({ appId, taskId }) => hasLoadedAppTask({ bus: options.bus, appId, taskId }),
    wake: ({ appId, taskIds, supersededSessionIds }) =>
      wakeLoadedAppTasks({
        bus: options.bus,
        appId,
        taskIds,
        ...(supersededSessionIds ? { supersededSessionIds } : {}),
      }),
    retry: ({ appId, taskId, expectedGeneration, expectedResourceVersion, controlKey }) =>
      retryLoadedFailedAppTask({
        bus: options.bus,
        appId,
        taskId,
        expectedGeneration,
        expectedResourceVersion,
        ...(controlKey ? { controlKey } : {}),
      }),
    cancel: ({ appId, taskId, expectedGeneration, expectedResourceVersion, reason, controlKey }) =>
      cancelLoadedAppTask({
        bus: options.bus,
        appId,
        taskId,
        expectedGeneration,
        expectedResourceVersion,
        reason,
        ...(controlKey ? { controlKey } : {}),
      }),
  };
}
