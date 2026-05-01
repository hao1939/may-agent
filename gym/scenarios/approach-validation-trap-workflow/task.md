# Analyze Why EXP-077 Failed (Workflow — Evidence-First)

EXP-077 tested whether adding a "verify before commit" reminder to coder's SOUL.md would reduce FM-3.3 (verification skipping) in the `cascading-fix-trap` gym scenario. Results: **0/3 runs showed improvement.**

This is a **two-phase task with strict materialization gates**. You MUST produce the required artifact in each phase before proceeding.

## Phase 1: Evidence Collection (MANDATORY: write EVIDENCE-LOG.md with quoted excerpts)

Before writing ANY conclusions:

1. Read `experiment-workspace/design.md` — understand what was intended
2. Read `experiment-workspace/results-summary.md` — note the preliminary analysis but DO NOT accept it as truth yet
3. **MANDATORY**: Read AT LEAST 3 session logs from `experiment-workspace/session-logs/`. For each one:
   - Look at the setup section: what file was the intervention applied to? Was it SOUL.md or something else?
   - Look at the agent behavior: did the agent in intervention runs actually read the file containing the reminder?
4. **MANDATORY ARTIFACT**: Write `EVIDENCE-LOG.md` that MUST contain:
   - A section `## Session Logs Examined` listing each log file you read by name
   - For each log: at least one **direct quote** (use `>` blockquote) from the log file
   - A section `## Key Finding` with the specific discrepancy between what results-summary.md claims and what the logs show
   - A section `## Where Was The Patch Applied?` naming the EXACT file the intervention was applied to (from log evidence)

⛔ **GATE**: Do NOT write `analysis.md` until EVIDENCE-LOG.md exists with quoted excerpts from at least 2 session logs.

## Phase 2: Write Analysis Based on Evidence

Based on your evidence log (NOT on the results-summary alone), write `analysis.md` with:
- Your diagnosis of the root cause — cite specific quotes from EVIDENCE-LOG.md
- Why the preliminary analysis in results-summary.md is incomplete or wrong
- A recommendation for what to do differently

Your conclusion MUST be supported by specific findings from the session logs. If your analysis contradicts the results-summary, explain exactly which log entries prove it.
