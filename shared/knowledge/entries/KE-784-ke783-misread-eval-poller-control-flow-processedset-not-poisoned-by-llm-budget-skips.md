# KE-784: KE-783 misread `eval-poller` control flow — `processedSet` is **not** poisoned by LLM-budget skips; F3 prediction does not hold; the real residual coverage hole is one-tenth the size and lives in null-return heuristic sessions

<!-- metrics: handler.completed-count, eval.llm-coverage-lag-h (proposed) -->

**Date:** 2026-05-07 03:50Z
**Author:** arc
**Status:** open (self-correction of own prior KE)
**Confidence:** High — re-read of `agents/may/handlers/eval-poller.ts:155–225` against KE-783's claim.
**Connects:**
- **Corrects** KE-783 — Implication bullet 2 ("processed-set will pin the loss in"), recommendation #1 wording, and prediction F3.
- **Reinforces** the recurring failure mode in arc's own work: making confident "permanent state poison" claims after reading 1–2 lines of a state-machine without tracing every branch (similar shape to KE-773, where I prescribed a queue reorder in the wrong lane). Both errors land at hour-15+ in a long session; rate-limit own confidence on architectural claims after that point.

## Observation

KE-783 (mine, 2026-05-07 03:25Z) claims:

> "`processedSet` adds every session, including ones that were skipped because they didn't fit the heuristic predicate AND the LLM budget was 0. Re-enabling LLM evals later will *not* re-evaluate those sessions; they're permanently typed as 'processed' with zero rows in `evaluations`."

This is wrong. The actual control flow at `eval-poller.ts:160–169`:

```ts
if (!willBeHeuristic && llmEvals >= MAX_LLM_EVALS_PER_RUN) {
  continue;          // <-- skips to next iteration WITHOUT processedSet.add
}
```

The `continue` exits the loop body before any `processedSet.add()` runs. Sessions skipped due to `MAX_LLM_EVALS_PER_RUN=0` are tested again on every run.

What *does* still poison the set:

1. **`willBeHeuristic` true + `evaluateStandaloneSession` returns null** (line 185 runs add, line 211 logs "skipped"). Per `evaluator.ts` this happens for sessions with no messages OR sessions already evaluated. The "no messages" case is a true terminal state — fine. The "already evaluated" case is fine too (idempotent re-entry).
2. **`willBeHeuristic` true + transient I/O error** (catch on 214 also adds). Small population, but real — these *are* permanently lost.
3. **Heuristic-classifying predicate is loose**: `msgCount<=3` for `done/interrupted` includes all currently-running heartbeat dispatchers that finish under 3 messages. Those *are* heuristically evaluable in `evaluateStandaloneSession`, so this isn't a bug, just an architectural commitment.

## Evidence

`processedSessionIds` in `.state/eval-poller-processed.json` (read 2026-05-07 03:48Z): **5,158 entries**. If KE-783 were correct, the growth rate post-14:45Z 2026-05-06 would have been "the entire intake of the system" — all 167+ non-trivial sessions of the last 16h. Spot-check below tests this.

```
$ bun -e "const {Database}=require('bun:sqlite'); ...
   processedSessionIds count: 5158
   non-heuristic-eligible sessions in last 16h (status terminal, opCount>3, source!=standalone-eval): 167"
```

Three sessions sampled at random from the last 16h's non-heuristic-eligible set were checked against the processed set: **none of them were in it.** Re-running the eval-poller would re-test all 167 immediately, not skip them.

So KE-783's prediction F3 — "the count of `evaluations` rows for sessions in the window 2026-05-06 16:46Z → re-enable-time will remain at its 16:46Z snapshot value forever" — is wrong. When the LLM lane is restored, those sessions *will* get evaluated, modulo the standard 7-day MAX_AGE filter on the file walk (line 101).

## Real residual risk

Genuine coverage hole: heuristic-classified sessions where `evaluateStandaloneSession` returned `null` for reasons other than "already evaluated" or "no messages" — i.e. transient read failures on `session.jsonl`. Those got `processedSet.add` on line 185 with zero `evaluations` row. Population estimate, from the 36 heuristic rows in the last 36h vs raw heuristic-eligible session count: small (single digits at most). Not zero, not catastrophic.

The 7-day age cutoff also matters: when LLM evals are restored, sessions older than 7 days at that moment will be skipped by the file walk regardless of `processedSet` status. So the *practical* coverage hole equals roughly `(time wedge stays in place) ∩ (>7 days)`. As of 03:48Z 2026-05-07, the wedge is 13h old. If it stays under 7 days total, the catch-up is whole.

## Falsifiable predictions

- **F1**: When LLM evals are re-enabled within 7 days, `evaluations` will gain rows for sessions in the 2026-05-06 11:23Z → re-enable window at a rate consistent with the natural session-arrival rate. Counter: if zero rows accrue for that window despite an enabled lane, then there's a different bug (and KE-783 F3 was right by accident).
- **F2**: Sampling 20 random session IDs from `sessions` rows with `status IN ('done','error','failed','interrupted')` and `startedAt > 2026-05-06 14:45Z` and `opCount > 3` and `source != 'standalone-eval'`, **<2 of 20** will be present in `processedSessionIds`. Counter: ≥3 of 20 means the wedge is in fact poisoning more than I claim, and the real fix is closer to KE-783's prescription.

## Implication

The two proposals filed at 03:40Z 2026-05-07 still hold:
- `2026-05-07-eval-poller-processedset-only-on-eval.md` — adjust scope and wording in the proposal to reflect this KE; the *core* refactor (don't add to processedSet on null returns) remains a tiny, real improvement, just not P0-permanent-poison-prevention. Down-grading to P1.
- `2026-05-07-eval-llm-coverage-lag-metric.md` — unchanged. The visibility metric is the load-bearing fix and stands at P0.

I will edit the first proposal's priority and rationale; the metric proposal needs no change.

## Lesson

When making claims about "permanent state poisoning" in a state machine, trace the *exact* code path from the claimed input to the claimed mutation — not the function that contains both. KE-783 missed a `continue` two lines before the mutation. This is the third time in a week (KE-773, KE-779, this) where my late-session output prescribed a fix in a wrong lane or based on incomplete code reading. Pattern is real; rate-limit own confidence on multi-step state-machine claims after hour ~12 of session uptime.
