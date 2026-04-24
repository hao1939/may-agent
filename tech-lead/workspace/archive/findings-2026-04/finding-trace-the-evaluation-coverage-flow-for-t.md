# Finding — Top-Level Session Evaluation Coverage (Lens B)

**Date:** 2026-04-18
**Question:** Do top-level heartbeat sessions (coach/qa/scout/tech-lead/bob/optimizer/may) get LLM-evaluated, or only heuristic?

## Summary

**Already fixed.** Top-level sessions DO get LLM-sampled — the gap noted in the 54h-old checkpoint was closed when `evaluation-sync.ts` was consolidated into `evaluator-heartbeat.ts`. The new handler explicitly samples heuristic-only top-level sessions and upgrades them via `evaluateStandaloneSession()`.

No action required. (Follow-up: verify the sampling is actually producing LLM evals in the `evaluations` table — see §5.)

## 1. Current Flow

Two evaluation paths exist:

- **Child sessions** (have `parentSessionId`): evaluated by `evaluateTask()` on `session_end` event — `src/app/may.ts:423` skips when `!info.parentSessionId`, then calls `evaluateTask({ parentSessionId: info.parentSessionId })` at `src/app/may.ts:429-433`. LLM-based.
- **Top-level sessions** (no parent, e.g. heartbeats): heuristic-evaluated by default, then a subset is upgraded to LLM by the evaluator-heartbeat cron — `agents/may/handlers/evaluator-heartbeat.ts:52` calls `sampleAndEvaluateTopLevel()` each run.

The standalone LLM path is implemented at `src/lib/evaluator.ts:797` (`evaluateStandaloneSession`) — docstring (`src/lib/evaluator.ts:791-792`): "This fills the gap where evaluateTask() only handles child sessions."

## 2. Coverage Gap

The 54h-old checkpoint's root cause ("top-level heartbeat sessions never get LLM-evaluated") **is no longer accurate**. Evidence:

- `evaluator-heartbeat.ts:19-20` header comment explicitly calls out the fix: *"Top-level LLM sampling (new): Picks a small batch of heuristic-only top-level sessions and upgrades them to LLM evaluations via `evaluateStandaloneSession()`. This fixes the gap where `evaluateTask()` only fires for child sessions."*
- Candidate query filters for `s.parentSessionId IS NULL` and `e.evaluatedByHeuristic = 1` — `evaluator-heartbeat.ts:201-208`.
- Sampling is fairness-weighted: agents with the lowest LLM-eval rate go first — `evaluator-heartbeat.ts:183-189` (ORDER BY rate ascending via sort at `:189`) and round-robin selection at `:226-233`.
- Skip list excludes meta agents: `SKIP_LLM_EVAL_AGENTS = Set(["evaluator", "may"])` — `evaluator-heartbeat.ts:38`.

Residual gap (minor): `coach/qa/scout/tech-lead/bob/optimizer` are all eligible; only `evaluator` and `may` are skipped (`evaluator-heartbeat.ts:38`).

## 3. Minimal Fix Sketch

No code change needed. The "minimal fix" described in the checkpoint (`agents/may/handlers/evaluation-sync.ts` + sampling) has already been implemented — just in the consolidated handler rather than the old file. The old `evaluation-sync.ts` no longer exists (consolidated into `evaluator-heartbeat.ts`, 313 lines per `wc -l`).

## 4. Cost Estimate

Cron interval: 30 min (`agents/may/cron.json:107` — `"intervalMs": 1800000`).
Budget per run: `MAX_LLM_EVALS_PER_RUN = 3` (`evaluator-heartbeat.ts:32`).

- Runs/day: 86400000 / 1800000 = **48**.
- Upper-bound LLM evals/day: 48 × 3 = **144 sessions/day**.
- At ~$0.03–0.05 per eval (per header comment `evaluator-heartbeat.ts:22`): **$4.30–$7.20/day** worst case.
- Real usage will be lower: query LIMIT is 50 candidates, and many runs will find <3 agents with fresh heuristic-only top-level sessions.

For comparison, 20% sampling of ~7 top-level agents × ~2 heartbeats/hr × 24h ≈ 67 sessions/day ≈ $2-3/day — the current 3/run cap effectively implements ~20-30% sampling once the backlog is cleared.

## 5. Follow-Up (separate session)

Verify in the DB that the handler is actually producing LLM evals for top-level sessions:

```sql
SELECT agent, COUNT(*) total,
       SUM(CASE WHEN evaluatedByHeuristic = 0 AND skippedByJs = 0 THEN 1 ELSE 0 END) llm
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE s.parentSessionId IS NULL
  AND e.createdAt > strftime('%s', 'now', '-3 days') * 1000
GROUP BY agent;
```

If `llm` is 0 for all top-level agents after 3+ days, the sampler is silently failing (cron disabled? query exception caught at `evaluator-heartbeat.ts:195`?). Check logs for `[evaluator-heartbeat] LLM-evaluating` lines.

Also consider: `parentSessionId IS NULL` filter (`evaluator-heartbeat.ts:205`) — confirm the `sessions` table actually stores NULL (not empty string) for heartbeat roots, else the query returns 0 candidates.
