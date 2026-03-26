/**
 * Default guard set — wraps existing guard creators as Guard objects.
 */

import type { Guard, GuardRegistry } from "./index.js";
import { createFinishGuard } from "../tools/finish-guard.js";
import { createReadDedupGuard } from "../tools/read-dedup-guard.js";
import { createSessionReadGuard } from "../tools/session-read-guard.js";
import { createScrapeDedupGuard } from "../tools/scrape-dedup-guard.js";
import { createEmptyArgsGuard } from "../tools/empty-args-guard.js";
import { createPathAssumptionGuard } from "../tools/path-assumption-guard.js";
import { createBinaryGuard } from "./binary-guard.js";
import { createWorkVerifyGuard } from "./work-verify-guard.js";
import { createToolSyntaxGuard } from "./tool-syntax-guard.js";

/** Wrap an existing beforeToolCall hook as a named Guard */
function wrapHook(name: string, hook: ReturnType<typeof createFinishGuard>): Guard {
  return { name, beforeToolCall: hook };
}

/** Create and register all default guards */
export function registerDefaultGuards(registry: GuardRegistry): void {
  registry.register(wrapHook("empty-args", createEmptyArgsGuard()));
  registry.register(wrapHook("path-assumption", createPathAssumptionGuard()));
  registry.register(wrapHook("finish-evidence", createFinishGuard()));
  registry.register(wrapHook("read-dedup", createReadDedupGuard()));
  registry.register(wrapHook("session-read", createSessionReadGuard()));
  registry.register(wrapHook("scrape-dedup", createScrapeDedupGuard()));
  // Harness-level guards (Batch 2 — req:0eef8ef9)
  registry.register(wrapHook("binary-file", createBinaryGuard()));
  registry.register(wrapHook("work-verify", createWorkVerifyGuard()));
  registry.register(wrapHook("tool-syntax", createToolSyntaxGuard()));
}
