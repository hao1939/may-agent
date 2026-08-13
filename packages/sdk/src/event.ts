export type AppEventTarget = {
  appId?: string;
  project?: string;
  taskId?: string;
  executionId?: string;
  sessionId?: string;
  metricId?: string;
  owner?: string;
  human?: boolean;
};

/** Canonical fact published by App-authored observers and workflows. */
export type AppEvent<TData = unknown> = {
  type: string;
  data: TData;
  target?: AppEventTarget;
  urgency?: "low" | "normal" | "high" | "immediate";
};

/** Declarative event subscription. Matching and durable delivery belong to the host. */
export type EventSelector =
  | string
  | {
      type: string;
      target?: AppEventTarget;
      project?: string;
      owner?: string;
      urgency?: AppEvent["urgency"];
      actions?: string[];
      metricIds?: string[];
      agents?: string[];
      lanes?: string[];
      verdicts?: string[];
      intents?: string[];
    };
