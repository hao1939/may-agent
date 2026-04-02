# Finding: Evaluator Re-evaluation Infinite Loop

**Date:** 2026-03-18
**Severity:** HIGH — causes 94% wasted evaluation work
**Status:** ✅ FIXED — commit e7c1cb9 (2026-03-18) — added 48h age cutoff using `session.startedAt`

## Problem

The `writeHeuristicEvaluations()` function in `src/lib/evaluator.ts` (line 750) has a re-evaluation loop:

1. Checks existing eval: if `usage.totalTokens === 0 && usage.turns === 0` → re-evaluate
2. Reads transcript, calls `extractUsage()` → transcript has no usage data → writes `totalTokens: 0`
3. Next run: same eval still has `totalTokens: 0` → re-evaluates again
4. **Loop repeats every cron cycle, forever**

This was introduced by tech-lead's fix (commit 1671974) which intended to re-evaluate sessions that had the zero-usage bug. But it creates an infinite loop for sessions that genuinely have zero usage in their transcripts (very old sessions, error sessions, etc.).

## Evidence

### Measurement 1 (2026-03-18 01:50 UTC)
- **10,584 evaluations modified** in last 12h
- Only **610 were for genuinely new sessions** (created in same period)
- **9,974 old sessions re-evaluated** (94.2% waste)
- 10,400 of 10,584 evals are heuristic with `totalTokens: 0`
- Only 169 LLM-evaluated, only 54 have real usage data

### Measurement 2 (2026-03-18 01:55 UTC — same day reconfirmed)
- **13,896 total eval files** — 13,866 session evals, 13,862 unique session IDs
- **10,747 modified in last 24h** — 77% of ALL eval files rewritten daily
- 49 out of 50 most recent evals have `totalTokens: 0` (98% zero-usage)
- Session timestamps range Feb 28 – Mar 14, but 290 "created" in last 6h = re-eval writes
- Root cause confirmed at `src/lib/evaluator.ts` line 752: `if (existing.usage?.totalTokens > 0 || existing.usage?.turns > 0) continue;` — inverted logic re-evaluates zeros forever

## Impact

- Evaluator runs 22 sessions/12h, each processing 481 evals on average
- Each run reads thousands of transcript files from disk for sessions that will never have usage data
- I/O overhead: ~10K file reads + ~10K file writes per 12h cycle
- Masks real evaluation work in metrics (10K noise vs 600 signal)

## Recommended Fix

In `writeHeuristicEvaluations()` at line 750, add an age cutoff:

```typescript
// Only re-evaluate recent sessions (last 48h). Older sessions with zero 
// usage genuinely lack data — re-evaluating won't help.
if (existsSync(evalPath)) {
  try {
    const existing = JSON.parse(readFileSync(evalPath, "utf-8"));
    if (existing.usage?.totalTokens > 0 || existing.usage?.turns > 0) continue;
    // Only re-evaluate if session is recent (usage data might arrive late)
    const sessionAge = Date.now() - (session.createdAt || 0);
    if (sessionAge > 48 * 60 * 60 * 1000) continue; // Skip sessions older than 48h
  } catch {
    continue;
  }
}
```

Alternative: Mark evaluated sessions with a `reeval_attempted: true` flag to prevent infinite retry.

## Savings

- Reduces heuristic eval work from ~10K to ~600 per 12h cycle (94% reduction)
- Reduces evaluator I/O by ~20K file operations per 12h
- Makes evaluation metrics meaningful (currently 98.3% noise)
