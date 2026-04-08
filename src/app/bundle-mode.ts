/**
 * Bundle-mode detection and helpers for bun-compiled binaries.
 *
 * When may-agent is compiled via `bun build --compile`, the binary embeds
 * all source into a virtual filesystem ($bunfs). This module detects that
 * and adjusts spawning + path resolution accordingly.
 */

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Detect if we're running inside a bun-compiled binary.
 * In compiled mode, import.meta.url starts with "file:///$bunfs/".
 */
export function isBundled(): boolean {
  return import.meta.url.startsWith("file:///$bunfs/");
}

/**
 * Get the command to spawn a worker process.
 * In bundled mode: spawn self (the compiled binary).
 * In dev mode: spawn bun with .ts path directly.
 */
export function getWorkerCommand(args: string[], mayTsPath: string) {
  if (isBundled()) {
    return {
      cmd: process.execPath,
      args: args,
      env: process.env,
    };
  } else {
    return {
      cmd: process.execPath,
      args: [mayTsPath, ...args],
      env: process.env,
    };
  }
}

/**
 * Resolve PROJECT_ROOT safely.
 * In bundled mode: use env var or cwd, but validate agents/ exists.
 * In dev mode: use import.meta.url-based resolution as before.
 */
export function resolveProjectRoot(importMetaUrl: string): string {
  if (process.env.PROJECT_ROOT) {
    return resolve(process.env.PROJECT_ROOT);
  }

  if (isBundled()) {
    const cwd = process.cwd();
    if (!existsSync(resolve(cwd, "agents"))) {
      console.error(
        "Error: 'agents/' directory not found in current working directory.\n" +
          "Please run from the project root or set PROJECT_ROOT environment variable.",
      );
      process.exit(1);
    }
    return cwd;
  }

  // Dev mode: derive from import.meta.url
  return resolve(dirname(fileURLToPath(importMetaUrl)), "../..");
}
