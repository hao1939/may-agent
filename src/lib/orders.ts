/**
 * Order persistence ledger (P209).
 *
 * Provides a JSONL-backed order system.  Appends for new orders;
 * rewrites the file when mutating existing entries (e.g. completeOrder).
 * Orders are stored in `.state/orders.jsonl` by default, but every
 * function accepts an optional `basePath` for testability.
 *
 * Uses only Node.js built-in modules — no external dependencies.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ── Interfaces ────────────────────────────────────────────────────────

/** A single order in the ledger. */
export interface Order {
  id: string;
  text: string;
  from: string;
  createdAt: string;
  completedAt?: string;
  status: "active" | "completed";
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Default base path for the JSONL file. */
const DEFAULT_BASE = join(process.cwd(), ".state");

/** Resolve the full path to the orders JSONL file. */
function filePath(basePath: string): string {
  return join(basePath, "orders.jsonl");
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
 * Read and parse every valid JSON line from the orders file.
 * Silently skips empty or corrupt lines.
 */
function readAll(basePath: string): Order[] {
  const fp = filePath(basePath);
  if (!existsSync(fp)) return [];

  const raw = readFileSync(fp, "utf-8");
  const orders: Order[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      orders.push(JSON.parse(trimmed) as Order);
    } catch {
      // Log corrupt lines to stderr so they're visible in diagnostics
      process.stderr.write(`[orders] skipping corrupt line in ${fp}: ${trimmed.slice(0, 80)}\n`);
    }
  }

  return orders;
}

/**
 * Rewrite the entire JSONL file from an array of orders.
 */
function writeAll(orders: Order[], basePath: string): void {
  ensureDir(basePath);
  const content = orders.map((o) => JSON.stringify(o)).join("\n") + "\n";
  writeFileSync(filePath(basePath), content, "utf-8");
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Create a new active order and append it to the ledger.
 *
 * @param text  Human-readable description of the order.
 * @param from  Who issued the order (e.g. "human", "bob").
 * @param basePath  Directory containing `orders.jsonl` (default `.state/`).
 * @returns The newly created Order.
 */
export function addOrder(
  text: string,
  from: string,
  basePath: string = DEFAULT_BASE,
): Order {
  ensureDir(basePath);

  const order: Order = {
    id: randomUUID(),
    text,
    from,
    createdAt: new Date().toISOString(),
    status: "active",
  };

  appendFileSync(filePath(basePath), JSON.stringify(order) + "\n", "utf-8");
  return order;
}

/**
 * Retrieve orders from the ledger, optionally filtering by status.
 *
 * @param filter  `"active"` (default), `"completed"`, or `"all"`.
 * @param basePath  Directory containing `orders.jsonl` (default `.state/`).
 * @returns Matching orders (empty array if file doesn't exist).
 */
export function getOrders(
  filter: "active" | "completed" | "all" = "active",
  basePath: string = DEFAULT_BASE,
): Order[] {
  const all = readAll(basePath);
  if (filter === "all") return all;
  return all.filter((o) => o.status === filter);
}

/**
 * Mark an active order as completed.
 *
 * @param id  The UUID of the order to complete.
 * @param basePath  Directory containing `orders.jsonl` (default `.state/`).
 * @returns The updated Order, or `null` if no matching active order exists.
 */
export function completeOrder(
  id: string,
  basePath: string = DEFAULT_BASE,
): Order | null {
  const all = readAll(basePath);
  const target = all.find((o) => o.id === id && o.status === "active");

  if (!target) return null;

  target.status = "completed";
  target.completedAt = new Date().toISOString();

  writeAll(all, basePath);
  return target;
}
