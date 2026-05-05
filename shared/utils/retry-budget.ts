/**
 * Retry Budget Guard (EXP-950)
 * Prevents zombie task loops by tracking dispatch attempts per task hash
 * and blocking after MAX_ATTEMPTS failures within a 24h window.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

interface AttemptRecord {
  timestamp: number;
  outcome: "dispatched" | "failed" | "success";
}

interface BudgetState {
  [taskHash: string]: AttemptRecord[];
}

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const STATE_FILE = ".state/retry-budget.json";

function loadState(): BudgetState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state: BudgetState): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function hashTask(task: string, agent: string): string {
  const normalized = `${agent}::${task.trim().toLowerCase().replace(/\b[a-f0-9-]{36}\b/g, "ID").replace(/\d{10,}/g, "TS")}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function pruneOld(records: AttemptRecord[]): AttemptRecord[] {
  const cutoff = Date.now() - WINDOW_MS;
  return records.filter(r => r.timestamp > cutoff);
}

export interface BudgetCheckResult {
  allowed: boolean;
  attempts: number;
  history: AttemptRecord[];
  hash: string;
}

/**
 * Check if a task dispatch should proceed.
 * Returns { allowed: false } if budget exhausted.
 */
export function checkRetryBudget(task: string, agent: string): BudgetCheckResult {
  const state = loadState();
  const hash = hashTask(task, agent);
  const records = pruneOld(state[hash] || []);
  const failedAttempts = records.filter(r => r.outcome === "failed" || r.outcome === "dispatched").length;

  return {
    allowed: failedAttempts < MAX_ATTEMPTS,
    attempts: failedAttempts,
    history: records,
    hash,
  };
}

/**
 * Record a dispatch attempt.
 */
export function recordDispatch(task: string, agent: string): void {
  const state = loadState();
  const hash = hashTask(task, agent);
  state[hash] = pruneOld(state[hash] || []);
  state[hash].push({ timestamp: Date.now(), outcome: "dispatched" });
  saveState(state);
}

/**
 * Record task completion. Clears budget on success.
 */
export function recordCompletion(task: string, agent: string, success: boolean): void {
  const state = loadState();
  const hash = hashTask(task, agent);
  if (success) {
    delete state[hash];
  } else {
    state[hash] = pruneOld(state[hash] || []);
    for (let i = state[hash].length - 1; i >= 0; i--) {
      if (state[hash][i].outcome === "dispatched") {
        state[hash][i].outcome = "failed";
        break;
      }
    }
  }
  saveState(state);
}
