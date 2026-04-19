# Coder Task Pipeline — 2026-04-15 22:35 UTC

Queued by tech-lead. Coder is at 20 sessions/24h, 19.6 avg ops, 0 errors, 0.63 quality.
Focus: bounded tasks with clear verification to improve quality score.

---

## Task 1: Remove dead `maxTurns` field across 7 files (~30 lines)

**What**: The turn budget enforcement was removed in commit 8df485ec, but the `maxTurns` field survived as dead weight in 7 files. It flows through the entire session lifecycle (type definitions → creation → persistence → event bus → crash recovery) but is never read for any decision. Remove it.

**Files to modify** (ONLY these):
- `src/lib/manager-utils.ts` — Remove `maxTurns: number` from `ActiveSession` interface (L229), `maxTurns?: number` from `RunOptions` interface (L267), delete `RESTORED_MAX_TURNS_FALLBACK` constant (L158)
- `src/lib/manager.ts` — Remove `maxTurns: opts?.maxTurns ?? 0` from session creation (L980), `maxTurns: session.maxTurns || undefined` from persistence (L1015), `maxTurns: persisted.maxTurns ?? RESTORED_MAX_TURNS_FALLBACK` from restore (L1415), and the `RESTORED_MAX_TURNS_FALLBACK` import (L12)
- `src/lib/persistence.ts` — Remove `maxTurns?: number` from `PersistedSession` interface (L60)
- `src/app/event-bus.ts` — Remove `maxTurns?: number` from fork event opts (L22)
- `src/app/may.ts` — Remove `maxTurns: event.opts?.maxTurns` from fork handler (L818)
- `src/lib/types.ts` — Remove deprecated `turnBudget` field (L71)

**Do NOT modify**: `turnCount` (this is LIVE and used by auto-resume, digests, and shallow heartbeat detection). Also do NOT modify `test/cron.test.ts` (tests handlerConfig.maxTurns which maps to opBudget — different flow).

**Verify**: `./node_modules/.bin/tsc --noEmit && npx vitest run --reporter=verbose 2>&1 | tail -5`
**Success criteria**: TSC clean, all tests pass, zero references to `maxTurns` in src/ except any in cron.test.ts or run-agent-task.ts (which maps maxTurns→opBudget for handler configs).

---

## Task 2: Fix bidirectional regression detection in metrics-snapshot.ts

**What**: The `checkRegression()` function (L146-169) in `agents/may/handlers/metrics-snapshot.ts` only detects **drops** (current below 7-day average). For metrics with `alert_direction='above'` (e.g., error counts), a regression is an upward **spike** — which the current code misses because `changeRatio` is negative for upward moves.

**File to modify**: `agents/may/handlers/metrics-snapshot.ts` — ONLY the `checkRegression()` function (lines ~146-169).

**Fix**: Make regression detection bidirectional based on `alert_direction`:
```typescript
function checkRegression(db, metric, currentValue, now) {
  const sensitivity = metric.sensitivity ?? DEFAULT_SENSITIVITY;
  const avg7d = db.prepare(
    "SELECT avg(value) as avg_val FROM metric_snapshots WHERE metric_id = ? AND measured_at > ?"
  ).get(metric.id, now - MS_7D);

  if (avg7d?.avg_val != null && avg7d.avg_val > 0) {
    const alertAbove = metric.alert_direction === 'above';
    // For "below" metrics (e.g., quality): regression = value drops below avg
    // For "above" metrics (e.g., error rate): regression = value rises above avg
    const changeRatio = alertAbove
      ? (currentValue - avg7d.avg_val) / avg7d.avg_val  // positive when value rises
      : (avg7d.avg_val - currentValue) / avg7d.avg_val; // positive when value drops
    
    if (changeRatio > sensitivity) {
      recordAlertWithDedup(db, metric.id, "yellow",
        `${metric.id} regressed ${(changeRatio * 100).toFixed(1)}% vs 7d avg (${avg7d.avg_val.toFixed(2)} → ${currentValue.toFixed(2)})`,
        currentValue, avg7d.avg_val, now);
    }
  }
}
```

**Also**: Extract the duplicated threshold check logic (lines ~286-299 and ~340-365) into a helper function `checkThresholdAlert(db, metric, value, now)` to reduce ~15 lines of duplication.

**Verify**: `./node_modules/.bin/tsc --noEmit` (no tests exist for this handler yet — TSC is the gate).
**Success criteria**: TSC clean, `checkRegression` handles both alert_direction='above' and 'below', threshold check code exists only once (in the helper).

---

## Task 3: Delete 3 dead model definitions from may.ts (~21 lines)

**What**: Three model definitions in `src/app/may.ts` have zero agent consumers: `gpt54` (L168-174), `gemini3pro` (L175-181), `gemini3flash` (L182-189). No agent config in `agents/` references them. They are dead weight.

**File to modify**: `src/app/may.ts` — ONLY the model definitions object (lines ~168-189). Remove the three model entries.

**Do NOT modify**: Any other model definitions (gpt52, kimi, etc. are in active use).

**Verify**: `./node_modules/.bin/tsc --noEmit && npx vitest run --reporter=verbose 2>&1 | tail -5`
**Success criteria**: TSC clean, all tests pass, `grep -rn 'gpt54\|gemini3pro\|gemini3flash' src/` returns no results.

---

## Task 4: Delete dead CLI metrics script (307 lines)

**What**: `src/app/cli/metrics.ts` (307 lines) is a standalone CLI script with zero consumers. It duplicates functionality now available via web.ts `/api/stats` endpoint and the new metrics-snapshot system. No import references it from anywhere in src/.

**File to delete**: `src/app/cli/metrics.ts`

**Also check**: If there's an entry in package.json scripts or any import/require referencing it — remove those too.

**Verify**: `./node_modules/.bin/tsc --noEmit && npx vitest run --reporter=verbose 2>&1 | tail -5` and `grep -rn "cli/metrics" src/ package.json`
**Success criteria**: TSC clean, all tests pass, file deleted, no dangling references.

---

## Dispatch Status
- [x] Task 1: DONE — branch `review/remove-dead-maxturns` (commit 75c87687). 5 src files changed, ~11 lines removed.
- [x] Task 2: DONE — branch `review/metrics-regression-fix` (commit 3dd874ee). 1 file, +26/-35 lines.
- [x] Task 3+4: Combined — branch `review/dead-code-cleanup-models-cli` (commit 9c96cc6e). 2 files, -328 lines.

All 4 tasks completed via implement-and-verify workflow. TSC clean + 1968 tests pass on all branches.
