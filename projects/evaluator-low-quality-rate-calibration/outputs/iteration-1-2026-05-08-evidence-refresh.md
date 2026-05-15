# Iteration 1 evidence refresh (2026-05-08)

This note refreshes the DB evidence for the `evaluator.low-quality-rate-24h` spike and updates/validates the working hypothesis.

## 1) Time window + row freshness
- `evaluations` timestamps are stored as **milliseconds since epoch** (INTEGER).
- Min/Max in table:
  - min: 2026-04-23 07:44:14 UTC
  - max: 2026-05-08 17:59:15 UTC

Evidence (SQL):
- `SELECT datetime(MAX(createdAt)/1000,'unixepoch') maxTs, datetime(MIN(createdAt)/1000,'unixepoch') minTs FROM evaluations;`

## 2) Last-24h sample size + scorer mode
In the last 24h (ms cutoff):
- total evaluations: **446**
- `evaluatedByHeuristic=1`: **446/446**
- `skippedByJs=0`: **446/446**

Evidence (SQL):
- `SELECT evaluatedByHeuristic, skippedByJs, COUNT(*) c FROM evaluations WHERE createdAt >= (strftime('%s','now','-24 hours')*1000) GROUP BY evaluatedByHeuristic, skippedByJs;`

Interpretation:
- This is consistent with **evaluation pipeline mode drift**: heuristic scoring is running, but there is **no LLM-based evaluator signal** present in the DB schema/window.

## 3) Verdict mix (last 24h)
- `good`: **225**
- `needs_improvement`: **221**
- needs_improvement rate: **221/446 = 0.4955**

Evidence (SQL):
- `SELECT verdict, COUNT(*) c FROM evaluations WHERE createdAt >= (strftime('%s','now','-24 hours')*1000) GROUP BY verdict ORDER BY c DESC;`

## 4) Agent spread (last 24h)
Counts are elevated across multiple agents (not a single-agent collapse):
- may: 121 needs_improvement / (121+139) total = **0.465**
- scout: 51 / (51+45) = **0.531**
- dev: 32 / (32+23) = **0.582**
- arc: 16 / (16+18) = **0.471**

Evidence (SQL):
- `SELECT agent, verdict, COUNT(*) c FROM evaluations WHERE createdAt >= (strftime('%s','now','-24 hours')*1000) GROUP BY agent, verdict ORDER BY c DESC;`

## 5) A strong “step-function” signature in score values
In the last 24h:
- **efficiency is constant** at 0.8 for essentially all sessions (447 rows when grouped; small 446 vs 447 discrepancy likely boundary timing).
- quality takes **only three values**:
  - 0.85 (225)
  - 0.55 (186)
  - 0.2  (35)

Evidence (SQL):
- `SELECT efficiency, COUNT(*) c FROM evaluations WHERE createdAt >= (strftime('%s','now','-24 hours')*1000) GROUP BY efficiency;`
- `SELECT quality, COUNT(*) c FROM evaluations WHERE createdAt >= (strftime('%s','now','-24 hours')*1000) GROUP BY quality ORDER BY c DESC;`

Interpretation:
- This is a hallmark of a **pure heuristic rubric** (coarse bucket scores), not fine-grained LLM judging.
- The high needs_improvement rate is therefore very likely driven by **heuristic thresholding** (e.g., any quality <= 0.55 => needs_improvement) and/or a heuristic rule that maps many sessions into the 0.55 bucket.

## 6) Missing issue codes in DB (diagnostic)
The `issues` field does **not** expose structured fields like `code`/`pattern` (at least at `$[0].code`), returning NULL for all needs_improvement rows sampled.

Evidence (SQL):
- `SELECT json_extract(issues,'$[0].code') code, COUNT(*) c FROM evaluations WHERE createdAt >= (strftime('%s','now','-24 hours')*1000) AND verdict='needs_improvement' GROUP BY code ORDER BY c DESC;`

Interpretation:
- Any deeper root-cause breakdown will need to look at either:
  - the raw `issues` string itself (group exact strings), or
  - the underlying session transcripts / workflow logs.

## Updated assessment vs the initial hypotheses
Most consistent with a combination of:
- **(c) evaluation mode drift**: heuristic is the only scorer operating (no LLM evaluation contributing), and
- **(b) heuristic calibration issue**: the heuristic buckets (0.55 / 0.2) are being assigned frequently enough to push needs_improvement to ~0.50.

Not consistent with:
- a sudden universal collapse in actual agent performance (the step-function scoring + cross-agent uniformity suggests scoring behavior dominates).

## Concrete next steps (for iteration 2)
1. **Confirm why LLM scoring is absent** (design vs outage): locate the evaluation pipeline code/config that gates LLM evaluation and determine if it is disabled intentionally.
2. **Inspect the heuristic scoring rule** mapping transcripts -> {0.85, 0.55, 0.2} and identify the trigger that places ~42% of sessions into 0.55.
3. Improve DB observability:
   - store a structured `issues` array with stable `code` fields (or a separate `issue_codes` column), so we can track which heuristic rules drive needs_improvement without transcript spelunking.
