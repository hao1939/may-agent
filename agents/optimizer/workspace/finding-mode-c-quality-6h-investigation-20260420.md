# Mode C Quality Investigation — 6h Window (2026-04-20)

## Summary

System-wide quality drop confirmed. Coach avg 0.360 is the worst, down from 0.845 baseline 24h ago. This is a **regression, not steady state** — quality has been declining in steps over 24h. Root cause: persistent-task iterations producing low-value work that evaluator correctly flags.

## Q1: Are coach zeros false-positives from evaluator bugs?

**No.** All 8 coach zeros have `evaluatedByHeuristic=0, skippedByJs=0` — they were evaluated by the LLM evaluator, not skipped or heuristic-only. The issues are substantive:

- 4 zeros are **REVIEW ONLY** sessions (coach reviewing persistent-task iterations) — these produced 0 ops and issued BLOCKED/CONTINUE verdicts. The evaluator scored them zero because the reviews contained no structural evidence of actual audit work.
- 4 zeros are **worker** sessions — these completed (status=done) with 0–22 ops but the evaluator found them lacking deliverables or doing wrong work (scope mismatch, verification failures).

All 8 zeros have `verdict: "needs_improvement"` with detailed issue lists. **These are genuine quality problems, not evaluator misfires.**

## Q2: Top verdicts/issues for low-quality coach sessions

All 11 low-quality sessions (0 < q < 0.5) have `verdict: "needs_improvement"`. Top issue patterns:

| Pattern | Count | Description |
|---------|-------|-------------|
| SCOPE_MISMATCH | ~5 | Agent does wrong work — audits wrong agents, switches to milestone work during review-only |
| VERIFICATION_GAP | ~4 | Claims work done without tool evidence (no reads, no grep, no file verification) |
| PROCESS_ERROR | ~3 | Violates REVIEW ONLY constraint by editing files, making commits |
| MILESTONE_CONFUSION | ~3 | Incorrect assessment of which milestones are complete, doesn't reconcile prompt state |
| NO_TOOL_EVIDENCE | ~3 | Makes assertions about completion without any tool calls to verify |

**7 of 11 low-quality sessions are REVIEW ONLY iterations** (0 ops typical). The persistent-task review pattern is the dominant source of low scores.

## Q3: Common patterns

1. **Persistent-task loop is the root cause**: Nearly all zeros and low-quality sessions come from persistent-task iterations (heartbeat audit project). The task has been spinning for 7–9 iterations without meaningful progress.
2. **Review-only sessions score poorly**: 0-op review sessions that just output CONTINUE/BLOCKED get scored low because they don't demonstrate analytical rigor.
3. **Worker sessions have scope confusion**: Workers audit wrong agents, write to /tmp instead of workspace, can't query DB properly.
4. **No timeout/budget issues**: All sessions have status=done. Op counts range 0–22 — well within budget. This is a quality-of-work problem, not an infrastructure problem.

## Q4: Regression analysis (24h trend)

| Window | Sessions | Zeros | Low | Good | Avg Quality |
|--------|----------|-------|-----|------|-------------|
| 24-18h ago | 19 | 0 | 2 | 17 | **0.845** |
| 18-12h ago | 55 | 6 | 4 | 45 | **0.725** |
| 12-6h ago | 19 | 6 | 2 | 11 | **0.518** |
| 6-0h ago | 31 | 8 | 11 | 12 | **0.360** |

**Clear regression**: Quality dropped from 0.845 → 0.360 over 24h. The inflection started 12-18h ago when zeros first appeared, and accelerated in the last 6h with both more zeros AND more low-quality sessions.

## Cross-agent comparison (last 6h)

| Agent | Avg | Zeros | Low | Good | Total |
|-------|-----|-------|-----|------|-------|
| coach | 0.360 | 8 | 11 | 12 | 31 |
| optimizer | 0.485 | 4 | 9 | 15 | 28 |
| tech-lead | 0.533 | 0 | 4 | 8 | 12 |
| bob | 0.601 | 2 | 8 | 22 | 32 |
| evaluator | 0.000 | 257 | 0 | 0 | 257 (expected — zero-op eval sessions) |

## Root Cause & Recommendations

**Primary root cause**: A persistent-task (heartbeat audit) is stuck in a non-productive loop. Each iteration generates 2 sessions (worker + reviewer) that both score poorly. Over 9 iterations, this has produced ~18 low/zero sessions dragging down coach's average.

**Recommendations**:
1. **Kill or reset the stuck persistent task** — it's been spinning for 9 iterations without meaningful progress
2. **Investigate why persistent-task reviews score low** — review-only sessions that produce CONTINUE/BLOCKED may need different evaluation criteria, OR the reviews genuinely need to be more rigorous
3. **The evaluator is working correctly** — no evidence of heuristic misfires or skippedByJs bugs causing false zeros
