import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Keep real process/pipe lifetimes outside Bun's reused test VM. */
export async function runTaskWorkerProbe(script: string, scenario: string): Promise<void> {
  const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), scenario], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const killGroup = () => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const timeout = setTimeout(killGroup, 15_000);
  try {
    const exit = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    if (exit !== 0) throw new Error(`${scenario} exited with ${exit}:\n${output}`);
  } finally {
    clearTimeout(timeout);
    killGroup();
  }
}
