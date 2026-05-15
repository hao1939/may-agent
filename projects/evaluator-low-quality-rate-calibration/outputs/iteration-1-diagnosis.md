# Iteration 1 — diagnosis for `evaluator.low-quality-rate-24h`

## Metric status (what is breaching)
- Metric: `evaluator.low-quality-rate-24h`
- Current: **0.3915** (breaching)
- Threshold: **0.3**
- Target: **0.1**
- Sample size (24h window): **447** evaluations

Evidence:
- `metrics` row shows `current=0.3915 threshold=0.3 target=0.1`.
- Recent `metric_snapshots` are stable around **0.38–0.39** with sample sizes **~407→447**.

## Is this calibration/rubric vs real system-wide quality drop?
### Finding A — the 24h breach is dominated by heuristic scoring, and the heuristic changed
All evaluations in the last 24h are **heuristic-evaluated**:
- `evaluatedByHeuristic=1` for **449/449** rows in the last 24h.
- `skippedByJs=0` for all rows (so this is not a JS-eval skip artifact).

There is a strong split by `heuristicVersion`:
- `heuristicVersion = null`:
  - n=260
  - needs_improvement rate = **0.165**
  - quality distribution: mostly **0.85 good** (217), some **0.2 needs_improvement** (38), very few **0.55 needs_improvement** (5)
- `heuristicVersion = 2`:
  - n=189
  - needs_improvement rate = **0.704**
  - quality distribution: **0.55 needs_improvement (117)**, **0.2 needs_improvement (16)**, **0.85 good (56)**

Interpretation:
- The breach is primarily explained by the rollout/use of **heuristicVersion=2**, which classifies a large fraction of sessions as **needs_improvement** at quality=0.55.
- This points more to **rubric/threshold calibration and/or heuristic rule sensitivity** than to an across-the-board collapse in agent performance.

### Finding B — “needs_improvement” sessions are frequently caused by process/guard failures, not task-quality
Top issues among `verdict='needs_improvement'` in the last 24h:
- `"schema/query error in transcript"`: **41**
- `"terminal status: interrupted","error: Clean start (fresh)"`: **39**
- `"finish blocked by uncommitted changes"`: **25**
- combinations of the above (notably: finish blocked + schema/query error): **21**

Interpretation:
- A sizable fraction of low-quality classifications appear tied to **workflow hygiene / environment / guard failures** rather than substantive solution quality.
- If heuristic v2 was designed to penalize these more aggressively (or is producing more false positives), it will increase the low-quality rate without necessarily implying worse “core reasoning quality.”

### Finding C — agent-level rates are elevated broadly, consistent with a scoring/heuristic shift
Within the last 24h (agents with n>=10):
- dev: ni_rate **0.50** (n=72)
- arc: ni_rate **0.49** (n=49)
- may: ni_rate **0.36** (n=247)
- scout: ni_rate **0.33** (n=75)

Within heuristicVersion=2 specifically:
- arc: ni_rate **0.91** (n=11)
- dev: ni_rate **0.79** (n=33)
- may: ni_rate **0.67** (n=109)
- scout: ni_rate **0.66** (n=35)

Interpretation:
- The elevation is **cross-agent** in the v2 slice, which supports “scorer sensitivity change” rather than one agent/regression.

## Conclusion (iteration 1)
Most evidence supports **(a) evaluator rubric/threshold/heuristic calibration** as the primary driver of the breach, not (b) a true system-wide reasoning quality collapse.

More specifically:
- The metric is computed from evaluations in the last 24h (sample size ~447) and is stable ~0.39.
- The **heuristicVersion=2** subset has an extremely high needs_improvement rate (**~0.70**), which is sufficient to keep the overall metric breaching.
- The most common reasons for needs_improvement are **process/guard failures** (uncommitted changes, schema/query errors, interrupted runs), which may or may not be intended to count as “low quality” for this metric.

## Recommended next actions (for iteration 2)
1. Inspect heuristic v2 implementation/rules (where `heuristicVersion=2` is produced) and verify it is not over-triggering on common, recoverable workflow states.
2. Decide whether the metric definition should:
   - exclude certain “hygiene failures” from *quality* (track them separately), or
   - keep them but adjust threshold/target to match reality, or
   - fix the underlying process issues (uncommitted changes / query errors) so they stop happening.
3. Break down `schema/query error in transcript` and `finish blocked by uncommitted changes` to identify the exact guard conditions and which workflows/agents are producing them.

---

## Query snippets (evidence)
- Metric row: `SELECT ... FROM metrics WHERE id='evaluator.low-quality-rate-24h'`
- Snapshots: `SELECT measured_at,value,sample_size FROM metric_snapshots WHERE metric_id='evaluator.low-quality-rate-24h' ORDER BY measured_at DESC LIMIT 20`
- 24h window stats and agent splits:
  - `WITH w AS (...) SELECT COUNT(*), AVG(...) ...`
  - `SELECT agent, COUNT(*), ... GROUP BY agent`
- Heuristic split:
  - `SELECT json_extract(overall,'$.heuristicVersion') hv, COUNT(*), ... GROUP BY hv`
- Top issues:
  - `SELECT issues, COUNT(*) ... WHERE verdict='needs_improvement' GROUP BY issues ORDER BY n DESC`
