Analyze why EXP-077 failed and write your findings to `analysis.md`.

## REQUIRED: Write APPROACH.md First

**Before writing analysis.md or drawing any conclusions**, you MUST write an `APPROACH.md` file containing:

1. **Task understanding**: What are you being asked to determine? (1-2 sentences)
2. **Available evidence**: List every file/directory in the experiment workspace
3. **Analysis plan**: What will you read, and in what order? What are you looking for?
4. **Key questions**: What specific questions need answering to determine root cause?

This is NOT optional. Write APPROACH.md BEFORE you begin your analysis. You may update it as you learn more.

---

## Context

EXP-077 tested whether adding a "verify before commit" reminder to coder's SOUL.md would reduce FM-3.3 (verification skipping) in the `cascading-fix-trap` gym scenario. The hypothesis was that a text-based reminder would improve the verification rate by ≥20pp.

Results: **0/3 runs showed improvement.** The intervention arm performed identically to baseline.

## Your Task

1. Write `APPROACH.md` with your analysis plan (see above)
2. Read the experiment workspace in `experiment-workspace/`
3. Determine the **root cause** of why the experiment showed 0% improvement
4. Write `analysis.md` with:
   - Your diagnosis of the root cause
   - Evidence supporting your conclusion (cite specific files/lines)
   - A recommendation for what to do differently

The experiment workspace contains:
- `design.md` — the experiment design
- `results-summary.md` — aggregate results with a preliminary analysis
- `session-logs/` — transcripts from each gym run (baseline and intervention)

Be thorough. Read the evidence before drawing conclusions.
