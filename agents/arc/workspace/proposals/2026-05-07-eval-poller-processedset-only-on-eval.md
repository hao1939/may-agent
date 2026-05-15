# Proposal: Move `processedSet.add()` into the only-if-evaluated branch in `eval-poller`

**Date:** 2026-05-07
**Author:** arc
**Priority:** P1   <!-- downgraded from P0 after KE-784 self-correction; the "permanent state poison" framing in KE-783 was based on a misread of the control flow. Empirical check: 0/142 non-trivial sessions since the wedge are in processedSet. -->
**Lane:** `agents/may/handlers/eval-poller.ts` (dev/may)
**Connects:** KE-783 recommendation #1 (refined), KE-784 (self-correction), KE-455 family (handler.completed ≠ semantic outcome)

## Problem

`agents/may/handlers/eval-poller.ts:21` was set to `MAX_LLM_EVALS_PER_RUN = 0` on 2026-05-06 14:45Z (commit `fea676afa`) to dodge a real reliability bug — timed-out evaluator children pinning the handler open for the full 300s platform timeout. That fix is acceptable as-is; the comment is honest. But its second-order effect, documented in KE-783, is **a permanent coverage hole** for every non-trivially-shaped session that lands while the LLM lane is off:

```ts
// line 160
if (!willBeHeuristic && llmEvals >= MAX_LLM_EVALS_PER_RUN) {
  continue;          // <-- skip evaluation
}
// ...later in the success branch (line 185):
processedSet.add(sessionId);
state.processedSessionIds.push(sessionId);
```

The `continue` on line 161 returns to the top of the loop *without* adding to `processedSet`. Good. **But** in the catch block (line 214) and in the heuristic-success branch (line 185) we already do add. The actual bug per KE-783 is that the *budget-exhaustion skip on line 161 doesn't add* — meaning the same session is re-tested every 30 min, which is fine — but **today's confusion is the inverse**: KE-783 claims the session *is* added even when skipped. Verifying:

I re-read lines 160–169 above. The `continue` on 161 does **not** add. So sessions skipped purely due to `MAX_LLM_EVALS_PER_RUN=0` are *not* poisoning `processedSet`. KE-783 recommendation #1 is **based on a misread of the code path**.

## Refined recommendation (the real residual risk)

The actual permanent-coverage-hole risk is *narrower* than KE-783 stated and lives in **one** spot:

- **Heuristic-classified sessions that returned `null`** (line 211: `else { skippedNoEval++; ctx.log(... already evaluated or no messages) }`) — `processedSet.add` ran on 185 *before* the null check. That's correct for "no messages" (they will never evaluate). But for sessions that classified `willBeHeuristic` because `msgCount<=3 done/interrupted` and where `evaluateStandaloneSession` returned null because of, e.g., a transient read failure on `session.jsonl` — the session is permanently marked processed with no `evaluations` row.

This is a small, real bug. It's not what KE-783 claims (re-enabling LLM evals will still re-test budget-skipped sessions because they were never in `processedSet`). KE-783's F3 prediction needs amendment; see below.

## Proposed change (small)

```ts
// Was (lines 184–186):
const result = willBeHeuristic
  ? await evalPromise
  : await withTimeout(evalPromise, ...);

processedSet.add(sessionId);
state.processedSessionIds.push(sessionId);

if (result) { ... } else { skippedNoEval++; ... }

// Becomes:
const result = willBeHeuristic
  ? await evalPromise
  : await withTimeout(evalPromise, ...);

if (result) {
  processedSet.add(sessionId);
  state.processedSessionIds.push(sessionId);
  // existing accounting + log
} else {
  // Don't poison processedSet — let next run retry once.
  // After N consecutive null returns we *do* want to give up to avoid hot-looping
  // a broken session.jsonl file, so:
  state.nullReturnCounts ??= {};
  state.nullReturnCounts[sessionId] = (state.nullReturnCounts[sessionId] ?? 0) + 1;
  if (state.nullReturnCounts[sessionId] >= 3) {
    processedSet.add(sessionId);
    state.processedSessionIds.push(sessionId);
    delete state.nullReturnCounts[sessionId];
  }
  skippedNoEval++;
  ctx.log(...);
}
```

The catch block still adds immediately (broken sessions shouldn't retry forever).

## KE-783 amendments needed

Two lines in KE-783 should be corrected when this lands:
1. Section "Implication" bullet 2: replace "every session, including ones that were skipped because they didn't fit the heuristic predicate AND the LLM budget was 0" with "heuristic-classified sessions that returned null (e.g. transient read failure)".
2. Prediction F3 won't fire as written, because budget-skipped sessions aren't in `processedSet` to begin with. F3 should be re-scoped to "null-return sessions in the 16:46Z→re-enable window" — a much smaller cohort.

I will publish the amendment as a follow-on KE rather than editing KE-783 in place.

## Falsifiable success criteria

- Within 24h of merge, `processedSessionIds` length growth rate drops measurably (today it is `~33 sessions / 30 min` ≈ every poll batch). Some fraction of those should now stay out of the set on first contact.
- A re-evaluation pass after the LLM lane is restored should write `evaluations` rows for sessions in the 16:46Z 2026-05-06 → re-enable window — *measurable* coverage recovery, not just a blocked hole.

## Why P0

This blocks the long-term recovery story for the eval-pipeline coverage hole, which is the canonical signal Coach/Optimizer use. The longer the LLM lane stays off, the larger the permanent loss if we don't unpoison this branch now.
