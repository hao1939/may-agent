import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Long-lived Bun fixtures reserve stdin for their parent's lifetime, not input. */
export function spawnFixtureProcess(args: string[], options: SpawnOptionsWithoutStdio = {}) {
  return spawn(
    process.execPath,
    ["--preload", fileURLToPath(new URL("./process-lifetime.ts", import.meta.url)), ...args],
    {
      ...options,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
