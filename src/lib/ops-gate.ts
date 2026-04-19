/**
 * Ops Gate Logging (P61).
 *
 * Provides append-only JSONL-backed ops-receipt logging.
 * Receipts are stored in `.state/ops-receipts.jsonl` by default, but every
 * function accepts an optional `basePath` for testability.
 *
 * Uses only Node.js built-in modules — no external dependencies.
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ── Interfaces ────────────────────────────────────────────────────────

/** A single ops receipt entry. */
export interface OpsReceipt {
  id: string;
  action: string;
  result: string;
  context: Record<string, unknown>;
  timestamp: string;
  agent?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Default base path for the JSONL file. */
const DEFAULT_BASE = join(process.cwd(), ".state");

/** Resolve the full path to the ops-receipts JSONL file. */
function filePath(basePath: string): string {
  return join(basePath, "ops-receipts.jsonl");
}

/**
 * Ensure the target directory exists (creates it recursively if needed).
 */
function ensureDir(basePath: string): void {
  if (!existsSync(basePath)) {
    mkdirSync(basePath, { recursive: true });
  }
}

/**
 * Read and parse every valid JSON line from the receipts file.
 * Silently skips empty or corrupt lines.
 */
function readAll(basePath: string): OpsReceipt[] {
  const fp = filePath(basePath);
  if (!existsSync(fp)) return [];

  const raw = readFileSync(fp, "utf-8");
  const receipts: OpsReceipt[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      receipts.push(JSON.parse(trimmed) as OpsReceipt);
    } catch {
      // skip corrupt lines
    }
  }

  return receipts;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Log an ops receipt and append it to the ledger.
 *
 * @param action   The action performed (e.g. "deploy", "rollback").
 * @param result   Outcome description (e.g. "success", "failed").
 * @param context  Arbitrary metadata object. If it contains an `agent`
 *                 property (string), that value is promoted to the
 *                 top-level `agent` field on the receipt.
 * @param basePath Directory containing `ops-receipts.jsonl` (default `.state/`).
 */
export function logOpsReceipt(
  action: string,
  result: string,
  context: Record<string, unknown>,
  basePath: string = DEFAULT_BASE,
): void {
  ensureDir(basePath);

  const receipt: OpsReceipt = {
    id: randomUUID(),
    action,
    result,
    context,
    timestamp: new Date().toISOString(),
  };

  // Promote agent from context if available
  if (typeof context.agent === "string") {
    receipt.agent = context.agent;
  }

  appendFileSync(filePath(basePath), JSON.stringify(receipt) + "\n", "utf-8");
}

/**
 * Retrieve receipts from the ledger, optionally filtering.
 *
 * @param filter    Optional filter: `action` matches exact action string,
 *                  `since` keeps only receipts whose timestamp >= the value.
 * @param basePath  Directory containing `ops-receipts.jsonl` (default `.state/`).
 * @returns Matching receipts (empty array if file doesn't exist).
 */
export function getReceipts(
  filter?: { action?: string; since?: string },
  basePath: string = DEFAULT_BASE,
): OpsReceipt[] {
  let receipts = readAll(basePath);

  if (filter?.action) {
    receipts = receipts.filter((r) => r.action === filter.action);
  }

  if (filter?.since) {
    receipts = receipts.filter((r) => r.timestamp >= filter.since);
  }

  return receipts;
}
