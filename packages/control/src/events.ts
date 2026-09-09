/** Public event data shared by control clients and Host adapters. */
export type EventTarget = {
  appId?: string;
  taskId?: string;
  sessionId?: string;
};

/** Caller input. The Host supplies event identity, time, and trusted provenance. */
export type EventInput = {
  type: string;
  target?: EventTarget;
  data: Record<string, unknown>;
  idempotencyKey?: string;
};

export type EventLink = {
  kind: "request" | "task" | "session" | "delivery" | "operation";
  id: string;
  state?: string;
  summary?: string;
};

/** Admission acknowledgement; neither delivery value means work has completed. */
export type EventReceipt = {
  eventId: number;
  eventType: string;
  delivery: "recorded" | "accepted";
  links?: EventLink[];
};

/** An observed event. Ephemeral notifications may have no durable id or time. */
export type PublicEvent = {
  id?: number;
  type: string;
  source?: string;
  owner?: string;
  target?: EventTarget;
  data: Record<string, unknown>;
  timestamp?: number;
};

/** Current admission and linked outcomes read from a persisted event. */
export type EventView = {
  event: PublicEvent & { id: number; timestamp: number };
  delivery: {
    state: "recorded" | "accepted" | "unhandled" | "failed";
    acceptedBy?: string;
    note?: string;
  };
  links: EventLink[];
};
