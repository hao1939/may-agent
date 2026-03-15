/**
 * orders.ts — Durable Order Persistence (P209: Intent Persistence)
 *
 * Ensures human intent survives session crashes. Every direct human order
 * is persisted to `.state/orders.jsonl` BEFORE any session is spawned.
 * On completion/failure, the order is updated in-place (append-only log
 * with status transitions).
 *
 * Flow:
 *   Console/Socket → logOrder(PENDING) → manager.run() → session
 *   Session completes → updateOrderStatus(COMPLETED|FAILED)
 *   Session crashes → order stays PENDING/IN_PROGRESS → recovery reads it
 */

import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export type OrderStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface OrderTicket {
  id: string;
  ts: number;
  text: string;
  status: OrderStatus;
  assignedTo: string;
  sessionId: string | null;
  source: string;
  error?: string;
  completedAt?: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const ORDERS_FILE = "orders.jsonl";

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Generate a unique order ID from timestamp + counter.
 */
let _orderSeq = 0;
function generateOrderId(): string {
  return `ord_${Date.now()}_${_orderSeq++}`;
}

/**
 * Log a new order BEFORE spawning a session. Returns the order ticket.
 * This is the persist-first pattern: write to disk, THEN act.
 */
export function logOrder(
  persistDir: string,
  opts: {
    text: string;
    assignedTo: string;
    source: string;
    sessionId?: string;
  },
): OrderTicket {
  const ticket: OrderTicket = {
    id: generateOrderId(),
    ts: Date.now(),
    text: opts.text,
    status: opts.sessionId ? "IN_PROGRESS" : "PENDING",
    assignedTo: opts.assignedTo,
    sessionId: opts.sessionId ?? null,
    source: opts.source,
  };

  try {
    const logPath = join(persistDir, ORDERS_FILE);
    appendFileSync(logPath, JSON.stringify(ticket) + "\n", "utf-8");
  } catch {
    /* best-effort — don't block session start over logging */
  }

  return ticket;
}

/**
 * Update an order's status. Appends a status-change record to the log.
 * The log is append-only — latest entry for a given ID wins.
 */
export function updateOrderStatus(
  persistDir: string,
  orderId: string,
  update: {
    status: OrderStatus;
    sessionId?: string;
    error?: string;
  },
): void {
  try {
    const logPath = join(persistDir, ORDERS_FILE);
    const record = {
      id: orderId,
      ts: Date.now(),
      status: update.status,
      ...(update.sessionId && { sessionId: update.sessionId }),
      ...(update.error && { error: update.error }),
      ...(update.status === "COMPLETED" || update.status === "FAILED"
        ? { completedAt: Date.now() }
        : {}),
    };
    appendFileSync(logPath, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    /* best-effort */
  }
}

/**
 * Get all pending/in-progress orders. Reads orders.jsonl and returns
 * the latest state of each order (append-only log → last write wins).
 */
export function getPendingOrders(persistDir: string): OrderTicket[] {
  const logPath = join(persistDir, ORDERS_FILE);
  if (!existsSync(logPath)) return [];

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Build latest state for each order ID (last entry wins)
    const orderMap = new Map<string, OrderTicket>();

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (!entry.id) continue;

        const existing = orderMap.get(entry.id);
        if (existing) {
          // Merge update into existing ticket
          orderMap.set(entry.id, { ...existing, ...entry });
        } else {
          orderMap.set(entry.id, entry);
        }
      } catch {
        /* skip malformed lines */
      }
    }

    // Return only PENDING or IN_PROGRESS orders
    return [...orderMap.values()].filter(
      (o) => o.status === "PENDING" || o.status === "IN_PROGRESS",
    );
  } catch {
    return [];
  }
}

/**
 * Mark stale IN_PROGRESS orders as PENDING (for recovery).
 * An order is stale if it's been IN_PROGRESS for longer than maxAge ms.
 * Uses the timestamp from when the order was first created.
 */
export function resetStaleOrders(
  persistDir: string,
  maxAgeMs: number = 30 * 60 * 1000, // 30 minutes default
): number {
  const logPath = join(persistDir, ORDERS_FILE);
  if (!existsSync(logPath)) return 0;

  let resetCount = 0;

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Build per-order: original creation ts + latest status
    const orderCreatedAt = new Map<string, number>();
    const orderMap = new Map<string, OrderTicket>();

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (!entry.id) continue;

        // Track earliest ts for this order (creation time)
        if (!orderCreatedAt.has(entry.id)) {
          orderCreatedAt.set(entry.id, entry.ts);
        }

        const existing = orderMap.get(entry.id);
        if (existing) {
          orderMap.set(entry.id, { ...existing, ...entry });
        } else {
          orderMap.set(entry.id, entry);
        }
      } catch {
        /* skip malformed lines */
      }
    }

    const now = Date.now();
    for (const [id, order] of orderMap) {
      if (order.status === "IN_PROGRESS") {
        const createdAt = orderCreatedAt.get(id) ?? order.ts;
        if (now - createdAt > maxAgeMs) {
          updateOrderStatus(persistDir, id, { status: "PENDING" });
          resetCount++;
        }
      }
    }
  } catch {
    /* best-effort */
  }

  return resetCount;
}
