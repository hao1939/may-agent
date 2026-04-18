# Optimizer Metrics — Definitions & Fates (2026-04-18)

Pass per `/tmp/own-your-metrics.md`. All three metrics were `current=null, target=0`.

## Fate table

| Metric | Fate | Target | Threshold | Direction | How measured |
|---|---|---|---|---|---|
| `optimizer.tool-adoption` | **B** — collector added | 0.7 | 0.5 (health) | below = bad | `SUM(evaluatedByHeuristic) / COUNT(*)` over `evaluations` last 7d |
| `optimizer.analysis-accuracy` | **C** — deactivated | — | — | — | No cheap proxy; would need human audit loop |
| `optimizer.quality-preserved` | **A+B** — defined + collector | 0.9 | 0.85 (health) | below = bad | `AVG(e.quality)` from `evaluations e JOIN sessions s` where `s.agent='optimizer' AND e.skippedByJs=0` last 7d |

## Rationale

### 1. `optimizer.tool-adoption` → B

**Tool** = the heuristic evaluator. Optimizer has repeatedly advocated for and iterated on it (recent findings on T2 guards, evaluation rubrics). The natural adoption signal is: of all evaluations produced, how many are heuristic-scored vs `skippedByJs`? A falling ratio means the tool is being bypassed — the exact failure mode "are agents using what I build?" is asking about.

- **Type promoted to `health`** so the threshold is enforced by `metrics-snapshot.ts` (`checkThresholdAlert`), not just by 7d-regression sensitivity. Continuous semantics weren't quite right here: I want a red alert when adoption drops, not just a "moved relative to 7d avg".
- **Target 0.7**: current baseline is ~0.49 — aspirational but achievable (recent weeks were higher).
- **Threshold 0.5**: below that, the heuristic is a minority path and the tool is effectively optional.
- **Initial measurement**: 0.493 (right at threshold — this will fire on the next snapshot cycle, which is correct signal).
- **Alert direction**: `below` (default) — adoption too low = problem.

### 2. `optimizer.analysis-accuracy` → C (deactivated)

"Are my diagnoses correct?" requires either:
- Human audit loop (expensive, not scheduled), or
- Post-hoc ground-truth comparison (requires labeled outcomes we don't have).

Per spec: "default to deactivation". Marking `status='inactive'`, setting `closed_at=now`. Can be reactivated when a concrete collector exists — e.g., once we have an intervention-hit-rate tracker for optimizer's recommendations.

### 3. `optimizer.quality-preserved` → A+B

Interpret "am I preserving quality?" as: **my own session quality stays high**. If optimizer starts producing mediocre sessions, something drifted (prompt, skills, convention checker, etc.) and I should notice. This is the most direct reading of the metric that also has a trivially available signal.

- **Query**: average `e.quality` over optimizer's heuristic-scored sessions in last 7d.
- **Target 0.9, threshold 0.85** (health). Current 7d avg is 0.89 — just under target but above threshold, which means the direction of travel is the interesting signal.
- **Scope choice**: filtered to `skippedByJs=0` so we only count sessions the heuristic actually evaluated (LLM-evaluated sessions have different scales; excluding them is cleaner).

## No-op on collector code

The existing `agents/may/handlers/metrics-snapshot.ts` already auto-measures any metric with `source='auto' AND source_query IS NOT NULL`. By filling those columns in the DB, both active optimizer metrics are now on the hourly snapshot loop with zero handler changes. No new handler file needed — collector code == the SQL string.

## Verification

```
optimizer.tool-adoption      current=0.493  target=0.7  threshold=0.5   active
optimizer.quality-preserved  current=0.890  target=0.9  threshold=0.85  active
optimizer.analysis-accuracy  current=null   target=0    threshold=null  inactive
```

Tool-adoption is sitting 0.007 under threshold — expect a yellow alert at next `metrics-snapshot` run. That's the metric doing its job.

## Files

- `agents/optimizer/scripts/refine-metrics-2026-04-18.ts` — idempotent re-runnable UPDATE script
- `agents/optimizer/workspace/metrics-definitions.md` — this file

## Flags for Hao

None. All three decided.
