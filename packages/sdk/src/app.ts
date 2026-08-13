import type { TSchema } from "@earendil-works/pi-ai";
import type { EventSelector, ProjectAppTaskIntent } from "./project-app.js";

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

/** Author-visible request. Host lifecycle and lease fields stay private. */
export type AppRequest<TData = unknown> = {
  id: string;
  source: AppInputSource;
  parentId?: string;
  input: AppInput<TData>;
};

export type TaskIntent = ProjectAppTaskIntent;

export type AppTaskAttachment =
  | { kind: "existing"; taskId: string }
  | { kind: "desired"; intent: TaskIntent };

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

export function defineApp<TInputSchema extends TSchema>(
  app: AppDefinition<TInputSchema>,
): AppDefinition<TInputSchema> {
  return app;
}
