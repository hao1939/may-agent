import type { AppEvent } from "@may-agent/sdk";

/**
 * App-local collector boundary. Legacy hosting and the canonical observer
 * adapter can both supply it while collectors remain unaware of inbox/task
 * runtime mechanics.
 */
export type AksObserverEvent = AppEvent<Record<string, unknown>> &
  Record<string, unknown>;

export type AksObserverContext = {
  appPath(path: string): string;
  emit(event: AksObserverEvent): unknown;
  noop(reason: string): unknown;
};
