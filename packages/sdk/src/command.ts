import { execFile } from "node:child_process";
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

/** Await an argv command on Linux using the enclosing cancellation signal.
 * Stop its process group on cancellation or leader exit before returning a
 * bounded output receipt. Detached sessions and crash recovery are out of scope. */
export function runCommand(
  root: string,
  argv: string[],
  signal: AbortSignal,
): Promise<CommandReceipt> {
  signal.throwIfAborted();
  if (!argv.length || !argv[0]) throw new Error("Command argv must not be empty");
  const startedAt = new Date().toISOString();
  return new Promise((resolve, reject) => {
    let cleanup: Promise<boolean> | undefined;
    const drain = () => cleanup ??= child.pid
      ? drainBashProcessGroup(child.pid)
      : Promise.resolve(true);
    const beginCleanup = () => {
      void drain().then((stopped) => {
        if (!stopped) reject(new Error("Command process group did not stop"));
      }, reject);
    };
    // execFile's signal option can invoke its callback before the process exits.
    // Handle cancellation ourselves and wait for the existing SDK group cleanup.
    const child = execFile(
      "/usr/bin/setsid",
      ["--", ...argv],
      { cwd: root, maxBuffer: 2 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        signal.removeEventListener("abort", beginCleanup);
        void drain().then((stopped) => {
          if (!stopped) throw new Error("Command process group did not stop");
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
        }).catch(reject);
      },
    );
    child.once("exit", beginCleanup);
    signal.addEventListener("abort", beginCleanup, { once: true });
    if (signal.aborted) beginCleanup();
  });
}
