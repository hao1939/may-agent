import { execFile, type ExecFileException } from "node:child_process";
import { join } from "node:path";

/** Execute only the workflow/observer's fixed XHS adapter commands. */
export async function runXhsCommand(
  appDir: string,
  command: ["status"] | ["prepare"] | ["search", string],
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  signal?.throwIfAborted();
  const completed = Promise.withResolvers<{
    error: ExecFileException | null;
    stdout: string;
    stderr: string;
  }>();
  const child = execFile(
    "node",
    [join(appDir, "agents", "scout", "tools", "xhs-browse.mjs"), ...command],
    {
      encoding: "utf8",
      signal,
      timeout: timeoutMs ?? (command[0] === "search" ? 60_000 : 30_000),
      maxBuffer: 1024 * 1024,
      killSignal: "SIGKILL",
    },
    (error, stdout, stderr) => completed.resolve({ error, stdout, stderr }),
  );
  // AbortError can arrive before exit. Do not return while the adapter still runs.
  await new Promise<void>((resolve) => child.once("close", () => resolve()));
  signal?.throwIfAborted();
  const { error, stdout, stderr } = await completed.promise;
  if (error && (error.killed || typeof error.code !== "number")) throw error;
  // Normal nonzero exits still carry the provider's structured failure output.
  return {
    stdout,
    stderr,
    exitCode: typeof error?.code === "number" ? error.code : 0,
  };
}
