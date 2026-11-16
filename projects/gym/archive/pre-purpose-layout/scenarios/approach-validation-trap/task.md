Analyze why EXP-077 failed and write your findings to `analysis.md`.

## Context

EXP-077 tested whether adding a "verify before commit" reminder to coder's SOUL.md would reduce FM-3.3 (verification skipping) in the `cascading-fix-trap` gym scenario. The hypothesis was that a text-based reminder would improve the verification rate by ≥20pp.

Results: **0/3 runs showed improvement.** The intervention arm performed identically to baseline.

## Your Task

1. Read the experiment workspace in `experiment-workspace/`
2. Determine the **root cause** of why the experiment showed 0% improvement
3. Write `analysis.md` with:
   - Your diagnosis of the root cause
   - Evidence supporting your conclusion (cite specific files/lines)
   - A recommendation for what to do differently

The experiment workspace contains:
- `design.md` — the experiment design
- `results-summary.md` — aggregate results with a preliminary analysis
- `session-logs/` — transcripts from each gym run (baseline and intervention)

Be thorough. Read the evidence before drawing conclusions.
