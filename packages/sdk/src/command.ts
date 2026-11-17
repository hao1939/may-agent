import { execFile, type ExecFileException } from "node:child_process";
import { CommandCleanupError, trackCommand } from "./command-scope.js";
import { drainBashProcessGroup } from "./runtime/lib/tools/bash.js";

export type CommandReceipt = {
  argv: string[];
  cwd: string;
  startedAt: string;
  endedAt: string;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  error?: string;
};

/** Run an argv command on Linux, retaining bounded output and joining its owned
 * process group on exit or cancellation. Use the execution's signal to join
 * workflow cleanup. Cancellation never becomes a passing check. */
export function runCommand(
  root: string,
  argv: string[],
  signal: AbortSignal,
): Promise<CommandReceipt> {
  signal.throwIfAborted();
  if (!argv.length || !argv[0]) throw new Error("Command argv must not be empty");
  const startedAt = new Date().toISOString();
  const command = new Promise<CommandReceipt>((resolve, reject) => {
    type Completion = {
      error: ExecFileException | null;
      stdout: string;
      stderr: string;
    };
    let complete!: (value: Completion) => void;
    const completed = new Promise<Completion>((resolve) => { complete = resolve; });
    let cleanup: Promise<void> | undefined;
    const beginCleanup = () => {
      cleanup ??= (async () => {
        let closeTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          if (child.pid && !await drainBashProcessGroup(child.pid)) {
            throw new CommandCleanupError("Command process cleanup is unconfirmed");
          }
          // A descendant outside the owned group may retain a pipe. Never let
          // that prevent bounded settlement or claim its cleanup is confirmed.
          const { error, stdout, stderr } = await Promise.race([
            completed,
            new Promise<never>((_, fail) => {
              closeTimer = setTimeout(() => fail(new CommandCleanupError(
                "Command output closure is unconfirmed after process cleanup",
              )), 1_000);
            }),
          ]);
          const cancelled = signal.aborted;
          resolve({
            argv: [...argv],
            cwd: root,
            startedAt,
            endedAt: new Date().toISOString(),
            exitCode: cancelled ? null : error
              ? typeof error.code === "number" ? error.code : null
              : 0,
            signal: error?.signal ?? child.signalCode ?? null,
            stdout,
            stderr,
            ...(cancelled
              ? { error: String(signal.reason ?? "Command cancelled") }
              : error ? { error: error.message } : {}),
          });
        } catch (error) {
          // Without confirmed cleanup the workflow must not permit replacement.
          reject(error instanceof CommandCleanupError ? error : new CommandCleanupError(String(error)));
        } finally {
          clearTimeout(closeTimer);
          signal.removeEventListener("abort", beginCleanup);
          child.stdout?.destroy();
          child.stderr?.destroy();
        }
      })();
    };
    // Do not pass signal to execFile: its abort callback runs before exit.
    const child = execFile(
      "/usr/bin/setsid",
      ["--", ...argv],
      { cwd: root, maxBuffer: 2 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        complete({ error, stdout, stderr });
        beginCleanup();
      },
    );
    child.once("exit", beginCleanup);
    signal.addEventListener("abort", beginCleanup, { once: true });
    if (signal.aborted) beginCleanup();
  });
  return trackCommand(signal, command);
}
