/**
 * Bundle-mode detection and helpers for bun-compiled binaries.
 *
 * When may-agent is compiled via `bun build --compile`, the binary embeds
 * all source into a virtual filesystem ($bunfs). This module detects that
 * and adjusts project path resolution accordingly.
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
 * Resolve PROJECT_ROOT safely.
 * In bundled mode: use env var or cwd, but validate app/agents or agents exists.
 * In dev mode: use import.meta.url-based resolution as before.
 */
export function resolveProjectRoot(importMetaUrl: string): string {
  if (process.env.PROJECT_ROOT) {
    return resolve(process.env.PROJECT_ROOT);
  }

  if (isBundled()) {
    const cwd = process.cwd();
    if (!existsSync(resolve(cwd, "app", "agents")) && !existsSync(resolve(cwd, "agents"))) {
      console.error(
        "Error: app/agents or agents directory not found in current working directory.\n" +
          "Please run from the repo root, app root, or set PROJECT_ROOT.",
      );
      process.exit(1);
    }
    return cwd;
  }

  // Dev mode: derive from import.meta.url
  return resolve(dirname(fileURLToPath(importMetaUrl)), "../..");
}
