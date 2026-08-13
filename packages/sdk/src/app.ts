import type { TSchema } from "@earendil-works/pi-ai";
import type { EventSelector } from "./event.js";
import type { TaskIntent } from "./task.js";

export { Type } from "@earendil-works/pi-ai";
export type { Static, TSchema } from "@earendil-works/pi-ai";
export type { AppEvent, AppEventTarget, EventSelector } from "./event.js";
export type { Condition, TaskIntent, TaskMode, TaskPriority } from "./task.js";
export type {
  AppRead,
  ExecutionResult,
  ExecutionView,
  Logger,
  MetricView,
  ObserverContext,
  TaskView,
  WorkflowContext,
  WorkflowInput,
} from "./workflow.js";

/** Canonical envelope for durable input addressed to an App. */
export type AppInput<TData = unknown> = {
  kind: string;
  data: TData;
};

export type AppInputSource = {
  kind: "human" | "app" | "system";
  id: string;
};

export type AppResult = {
  summary: string;
  response?: string;
  evidence?: string[];
};

/**
 * Read-only current observation of the exact dependency linked by the host.
 * It gives a reawakened owner enough evidence to review the dependency without
 * exposing inbox leases, task storage, or runtime query capabilities.
 */
export type AppDependencyObservation = {
  kind: "app" | "task" | "session";
  id: string;
  status: "pending" | "running" | "waiting" | "attention" | "done" | "error" | "interrupted" | "unknown";
  summary?: string;
  response?: string;
  evidence?: string[];
};

/** Author-visible request. Host lifecycle and lease fields stay private. */
export type AppRequest<TData = unknown> = {
  id: string;
  source: AppInputSource;
  parentId?: string;
  input: AppInput<TData>;
  dependency?: AppDependencyObservation;
};

export type AppTaskAttachment = { kind: "existing"; taskId: string } | { kind: "desired"; intent: TaskIntent };

/** The complete lifecycle vocabulary returned by an App owner. */
export type AppDisposition =
  | { type: "complete"; summary: string; response?: string; evidence?: string[] }
  | {
      type: "delegate";
      appId: string;
      input: AppInput;
      reviewAfterMs?: number;
    }
  | { type: "task"; task: AppTaskAttachment };

export type AppInboxBatchMode = "single" | "coalesce-compatible";

/** Minimal declaration used by the App host. Domain payloads remain App-owned. */
export type AppDefinition<TInputSchema extends TSchema = TSchema> = {
  id: string;
  version: 1;
  owner: string;
  description?: string;
  inputSchema: TInputSchema;
  subscriptions?: EventSelector[];
  inbox?: { batch?: AppInboxBatchMode };
};

export function defineApp<TInputSchema extends TSchema>(app: AppDefinition<TInputSchema>): AppDefinition<TInputSchema> {
  return app;
}
