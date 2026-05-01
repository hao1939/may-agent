# Analyze Why EXP-077 Failed (Workflow)

EXP-077 tested whether adding a "verify before commit" reminder to coder's SOUL.md would reduce FM-3.3 (verification skipping) in the `cascading-fix-trap` gym scenario. Results: **0/3 runs showed improvement.**

This is a two-phase task.

## Phase 1: Evidence Collection (write EVIDENCE-LOG.md BEFORE writing analysis.md)

Before writing ANY conclusions:

1. Read `experiment-workspace/design.md` — understand what was intended
2. Read `experiment-workspace/results-summary.md` — note the preliminary analysis but DO NOT accept it as truth
3. Read AT LEAST 2 session logs from `experiment-workspace/session-logs/` — specifically look at:
   - Setup logs: Was the intervention actually applied? To which file? Was it the right file?
   - Agent behavior: Did the agent in intervention runs actually see/read the reminder?
4. Write `EVIDENCE-LOG.md` documenting:
   - What each source said (with specific quotes/file references)
   - Any discrepancies between the summary's explanation and what the logs show
   - What the ACTUAL root cause appears to be based on primary evidence

Do NOT write `analysis.md` until EVIDENCE-LOG.md is complete.

## Phase 2: Write Analysis

Based on your evidence (NOT on the results-summary alone), write `analysis.md` with:
- Your diagnosis of the root cause (cite specific evidence from logs)
- Why the preliminary analysis in results-summary.md is incomplete or wrong
- A recommendation for what to do differently

Be thorough and evidence-based. Your conclusion must be supported by specific findings from the session logs.
