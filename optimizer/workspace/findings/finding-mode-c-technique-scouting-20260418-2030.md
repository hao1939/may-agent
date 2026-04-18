# Finding: Quality Preserved Failure Modes (Mode C — 6h Scan)
**Date**: 2026-04-18 ~20:30 UTC
**Metric**: quality_preserved = 0.895 (target: 0.9)

## Method
Queried all sessions with evaluations in last 6h, grouped by agent×verdict to identify quality drags.

## Key Findings

### 1. Evaluator "skipped" sessions dominate (131 sessions, q=0)
The evaluator agent itself generates 131 sessions in 6h, all verdict="skipped", quality=0. These sessions are self-evaluations that get auto-skipped. If included in the quality_preserved metric, they massively drag the average down. **This was identified in the previous C session** — the recommendation to exclude evaluator sessions from the metric still stands.

### 2. "parse_error" verdicts are the second-largest quality drag
| Agent | parse_error count | avg quality | Notes |
|-------|------------------|-------------|-------|
| coach | 12 | 0.66 | Largest contributor |
| bob | 5 | 0.74 | |
| tech-lead | 4 | 0.85 | |
| scout | 3 | 0.50 | Worst per-session |
| optimizer | 3 | 0.83 | |
| qa | 3 | 0.85 | |

**30 total parse_error sessions** with avg quality 0.72. These are sessions where the evaluator couldn't cleanly parse its own output, resulting in degraded scores. This is an evaluator output-format bug, not an agent quality issue.

### 3. Low-quality sessions (q < 0.9) breakdown
Sampled 10 worst non-zero sessions:
- **bob heartbeat** (q=0.25, parse_error) — evaluator parsing failure
- **scout heartbeat** (q=0.25, parse_error) — evaluator parsing failure  
- **tech-lead "Dead Weight" audit** (q=0.35, needs_improvement) — legitimate low quality
- **coach persistent-task design** (q=0.35, parse_error) — evaluator parsing failure
- **scout heartbeat** (q=0.38, parse_error) — evaluator parsing failure

**Pattern**: 4 of 5 worst sessions are parse_error — the evaluator is failing to parse its own output, assigning artificially low scores.

### 4. Agents without evaluator artifacts
- **bob**: 5 needs_improvement sessions at q=0 — these appear to be evaluation failures (0 quality + needs_improvement verdict is suspicious)
- **may**: Clean — 11 good sessions, all q=1.0

## Root Cause Analysis

The 0.895 quality_preserved metric is dragged down by TWO systematic issues, not agent behavior:

1. **Evaluator skipped sessions (q=0)**: 131 sessions × q=0 destroys the average if included
2. **Evaluator parse errors**: 30 sessions get artificially low scores (avg 0.72 vs their likely true ~0.85-0.9)

Excluding evaluator self-sessions and fixing the parse_error scoring would likely push quality_preserved above 0.9 without any agent behavioral changes.

## Recommendations

1. **[REPEAT from prior C]** Exclude evaluator agent sessions from quality_preserved metric
2. **[NEW]** Investigate evaluator parse_error root cause — 30 sessions in 6h is a high rate. The evaluator's output format is likely drifting or the parser is too strict.
3. **[LOW-PRI]** Tech-lead has 6 "acceptable" sessions at avg q=0.578 — the only legitimate quality concern among non-evaluator agents.

## Dispatch Decision: NO_DISPATCH
Both recommendations are evaluator infrastructure issues, not agent technique/skill gaps. The tech-lead acceptable rate is known (32% low-q from prior C session). No new actionable intervention identified.
