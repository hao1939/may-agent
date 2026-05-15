# EXP-301: Evidence Quality Audit — Results

**Date**: 2025-05-02
**Status**: COMPLETED
**Hypothesis**: H-300 — Agents cargo-cult verification_evidence

## Sample (8 finish() calls across 4 agents)

### Scoring (1-5 scale per EXP-301 design)

| # | Agent | Session | Evidence Items | Score | Notes |
|---|-------|---------|---------------|-------|-------|
| 1 | coach | s_..._366 | 7 | 4.0 | Specific tools + outcomes per step. Good. |
| 2 | may | s_..._0 | 3 | 4.0 | Quotes line numbers, specific counts. Concrete. |
| 3 | optimizer | s_..._3576 | 2 | 3.5 | Names file + test result. Slightly terse. |
| 4 | optimizer | s_..._3572 | 5 | 3.5 | Mix of specific (git hash) and vague ("confirmed finding file written correctly"). |
| 5 | optimizer | s_..._2893 | 2 | 2.0 | "write() confirmed... written (174 bytes)" + "git commit successful" — minimal effort. |
| 6 | optimizer | s_..._2489 | 2 | 2.0 | Just "git commit of N files" × 2. No verification of correctness. |
| 7 | arc | s_..._2324 | 4 | 5.0 | Multi-step chain with db queries, git logs, lane checks, read verification. Exemplary. |
| 8 | optimizer (worker) | s_..._2893 | 2 | 2.0 | Boilerplate completion evidence. |

### Summary Statistics

- **Overall mean**: 3.25
- **By agent**:
  - arc: 5.0 (n=1) — exemplary
  - coach: 4.0 (n=1) — good
  - may: 4.0 (n=1) — good
  - optimizer: 2.6 (n=4) — below threshold, driven by worker sessions
  - bob: not sampled (would be self-grading)
- **Worker sessions**: Mean 2.5 (workers produce minimal evidence)
- **Heartbeat/direct sessions**: Mean 4.0

### Patterns Identified

1. **Worker sessions produce worst evidence** (mean 2.5). Workers are told to finish fast; evidence is an afterthought. The "git commit successful" pattern appears repeatedly.
2. **Arc is the gold standard** — multi-step verification chains with specific tool outputs quoted.
3. **Step numbering helps** — sessions that reference "Step N:" tend to be more specific.
4. **Quantity ≠ quality** — optimizer s_..._3572 has 5 items but some are vague.

## Decision (per design)

Mean 3.25 ≥ 3.0 → **No intervention needed overall.**

However, worker sessions specifically score 2.5 (in the 2.5-3.0 "monitor" range). This is expected — workers have truncated prompts and tight budgets.

## Recommendation

- **No new rules** (per KE-091, stacking interventions causes regression)
- **Monitor**: Re-audit in 2 weeks focusing on worker sessions
- **Optional**: Add one arc-style evidence example to worker prompts as a few-shot (per KE-133)

## Relationship to Hypotheses

- **H-300**: PARTIALLY SUPPORTED — evidence quality is adequate overall (3.25) but workers specifically cargo-cult (2.5). The problem exists in a subset, not system-wide.
- Update scorecard: H-300 P=0.45 (was unscored)
