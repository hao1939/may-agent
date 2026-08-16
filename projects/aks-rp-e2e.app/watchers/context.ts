import type { AppEvent } from "@may-agent/sdk";

/**
 * App-local collector boundary. The canonical observer adapter supplies it
 * while collectors remain unaware of task-runtime mechanics.
 */
export type AksObserverEvent = AppEvent<Record<string, unknown>> &
  Record<string, unknown>;

export type AksObserverContext = {
  appPath(path: string): string;
  /** Add a fact to the observer result; the host publishes only after success. */
  record(event: AksObserverEvent): unknown;
  noop(reason: string): unknown;
};
