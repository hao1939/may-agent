// Host kernels can be compiled while App commands are dynamically imported.
// Carry ownership on their shared signal, rather than in module-local state.
const scopeKey = Symbol.for("@may-agent/sdk/command-scope");
const cleanupErrorKey = Symbol.for("@may-agent/sdk/command-cleanup-error");
type CommandSignal = AbortSignal & { [scopeKey]?: (command: Promise<unknown>) => void };

export class CommandCleanupError extends Error {
  readonly [cleanupErrorKey] = true;
  constructor(message: string) {
    super(message);
    this.name = "CommandCleanupError";
  }
}

export function trackCommand<T>(signal: AbortSignal, command: Promise<T>): Promise<T> {
  (signal as CommandSignal)[scopeKey]?.(command);
  return command;
}

export function openCommandScope(signal: AbortSignal): () => Promise<string[]> {
  const pending = new Set<Promise<unknown>>();
  const unconfirmed: string[] = [];
  const track = (command: Promise<unknown>) => {
    pending.add(command);
    void command.then(
      () => pending.delete(command),
      (error) => {
        pending.delete(command);
        // Retain uncertainty even when authored code catches the rejection.
        if (error?.[cleanupErrorKey] === true) unconfirmed.push(String(error.message));
      },
    );
  };
  Object.defineProperty(signal, scopeKey, { value: track, configurable: true });
  return async () => {
    // The owner aborts the signal before joining; no new command can start.
    await Promise.allSettled([...pending]);
    delete (signal as CommandSignal)[scopeKey];
    return unconfirmed;
  };
}
