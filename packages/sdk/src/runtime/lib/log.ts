/**
 * log.ts — Global logging for may-agent.
 *
 * One function: log(level, message). Usable from anywhere in the codebase
 * (lib, app, handlers). No dependency on EventBus.
 *
 * Subscribers can be added via addLogSubscriber(). Console output is always
 * on by default. Additional subscribers (web UI, socket UI, etc.) are added
 * at startup. This is a separate channel from EventBus — no circular
 * dependency possible.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSubscriber = (level: LogLevel, message: string) => void;

const consoleSubscriber: LogSubscriber = (level, msg) => {
  if (level === "error") console.error(msg);
  else if (level === "warn") console.warn(msg);
  else if (level === "debug") {
    /* silent by default */
  } else console.log(msg);
};

let _subscribers: LogSubscriber[] = [consoleSubscriber];

/** Add a log subscriber. Returns an unsubscribe function. */
export function addLogSubscriber(fn: LogSubscriber): () => void {
  _subscribers.push(fn);
  return () => {
    _subscribers = _subscribers.filter((s) => s !== fn);
  };
}

/** Log a message to all subscribers. */
export function log(level: LogLevel, message: string): void {
  for (const fn of _subscribers) {
    try {
      fn(level, message);
    } catch {
      /* subscriber errors never break logging */
    }
  }
}
