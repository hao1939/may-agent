/**
 * log.ts — Global logging for may-agent.
 *
 * One function: log(level, message). Usable from anywhere in the codebase
 * (lib, app, handlers). No dependency on EventBus.
 *
 * At startup, may.ts calls setLogHandler() to route logs through the EventBus.
 * Before that (and in standalone tools), logs go to console.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogHandler = (level: LogLevel, message: string) => void;

const defaultHandler: LogHandler = (level, msg) => {
  if (level === "error") console.error(msg);
  else if (level === "warn") console.warn(msg);
  else if (level === "debug") { /* silent by default */ }
  else console.log(msg);
};

let _handler: LogHandler = defaultHandler;

/** Set the global log handler. Called once at startup. */
export function setLogHandler(handler: LogHandler): void {
  _handler = handler;
}

/** Reset to default console handler (for testing). */
export function resetLogHandler(): void {
  _handler = defaultHandler;
}

/** Log a message. */
export function log(level: LogLevel, message: string): void {
  _handler(level, message);
}
