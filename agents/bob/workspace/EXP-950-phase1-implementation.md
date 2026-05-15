# EXP-950 Phase 1: Retry Budget Guard — Implementation Spec

**Date**: 2025-09-03 (bob heartbeat)
**Status**: READY FOR HANDOFF
**Target**: `agents/may/handlers/` or equivalent dispatch integration point

## Summary

This document provides a complete, copy-paste-ready implementation for the retry budget guard. It prevents zombie task loops by tracking dispatch attempts per task hash and blocking after 3 failures within 24 hours.

## Key Findings (this session)

- **Evaluation DB is empty** — `agents/may.db` has no tables/data, so EXP-900 (DAF analysis) remains blocked
- **No retry logic exists anywhere** in dispatch handlers (confirmed Phase 0)
- **EXP-950 is the highest-impact next experiment** — directly prevents the zombie pattern that wasted 45+ sessions

## Implementation

### File: `agents/shared/utils/retry-budget.ts`

```typescript
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
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
  // Normalize: trim, lowercase, remove timestamps/session IDs
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
    // Update last "dispatched" to "failed"
    for (let i = state[hash].length - 1; i >= 0; i--) {
      if (state[hash][i].outcome === "dispatched") {
        state[hash][i].outcome = "failed";
        break;
      }
    }
  }
  saveState(state);
}
```

### Integration Point

In whatever function dispatches tasks (likely in `may`'s fork/call logic):

```typescript
import { checkRetryBudget, recordDispatch } from "../shared/utils/retry-budget.js";

// Before dispatching:
const budget = checkRetryBudget(task, targetAgent);
if (!budget.allowed) {
  // Escalate instead of dispatching
  escalate(`Task hit retry budget (${budget.attempts}/${MAX_ATTEMPTS} in 24h)`, {
    hash: budget.hash,
    history: budget.history,
    task: task.slice(0, 200),
    agent: targetAgent,
  });
  return; // Do NOT dispatch
}
recordDispatch(task, targetAgent);
```

## Testing

```typescript
// Unit test sketch
describe("retry-budget", () => {
  it("allows first 3 attempts", () => {
    recordDispatch("fix bug", "tech-lead");
    recordCompletion("fix bug", "tech-lead", false);
    recordDispatch("fix bug", "tech-lead");
    recordCompletion("fix bug", "tech-lead", false);
    const check = checkRetryBudget("fix bug", "tech-lead");
    expect(check.allowed).toBe(true); // 2 failed, 1 more allowed
  });

  it("blocks after 3 failures", () => {
    // ... 3 dispatch+fail cycles
    const check = checkRetryBudget("fix bug", "tech-lead");
    expect(check.allowed).toBe(false);
  });

  it("clears on success", () => {
    recordCompletion("fix bug", "tech-lead", true);
    const check = checkRetryBudget("fix bug", "tech-lead");
    expect(check.allowed).toBe(true);
  });
});
```

## Measurement Plan

After deployment, measure over 7 days:
1. **Zombie elimination**: Count tasks dispatched 5+ times → should be 0
2. **False positive rate**: Count tasks blocked that a human would have retried → target < 5%
3. **Escalation quality**: Are blocked-task escalations actionable?

## Handoff Notes

- This is self-contained — no external deps beyond Node stdlib
- The normalization regex strips UUIDs and timestamps to match semantically-identical tasks
- Budget resets on success, so legitimate "retry after fix" still works
- File-based state is fine for single-process; if multi-process, switch to DB
