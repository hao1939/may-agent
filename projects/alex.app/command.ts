import { execFile } from "node:child_process";

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

/** Workflow cancellation and deadlines bound execution; output is bounded below.
 * Capture success and failure alike. An error never becomes a passing check,
 * even if no numeric exit code is available. */
export function commandReceipt(
  root: string,
  argv: string[],
  signal: AbortSignal,
): Promise<CommandReceipt> {
  signal.throwIfAborted();
  const startedAt = new Date().toISOString();
  return new Promise((resolve) => {
    execFile(
      argv[0]!,
      argv.slice(1),
      {
        cwd: root,
        signal,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdout, stderr) =>
        resolve({
          argv: [...argv],
          cwd: root,
          startedAt,
          endedAt: new Date().toISOString(),
          exitCode: error
            ? typeof error.code === "number"
              ? error.code
              : null
            : 0,
          signal: error?.signal ?? null,
          stdout,
          stderr,
          ...(error ? { error: error.message } : {}),
        }),
    );
  });
}
