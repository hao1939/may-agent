# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778259768883_10
- **Status:** partial
- **When:** 2026-05-08T17:04:12.849Z

## What Happened
Investigated the repeated red metric evaluator.low-quality-rate-24h and found it is driven by heuristic-only evaluations with a ~46% needs_improvement base rate across multiple agents (not storm-only contamination). Updated the shared calibration project markdown with DB evidence and a concrete plan, and notified May; however, committing is blocked because /app/agents git ignores agents/shared/projects/.

## Files Modified
- agents/shared/projects/evaluator-low-quality-rate-calibration/project.md

## Still Open / Next Steps
1) May/tech-lead: un-ignore agents/shared/projects (or confirm alternate canonical repo/path) so shared project files are versioned. 2) Once unblocked, proceed with project plan: locate heuristic eval rubric and audit 40 samples (20 NI/20 good) to adjust mapping or restore LLM eval.

## Blockers
- Cannot commit shared project updates — `git add shared/projects/evaluator-low-quality-rate-calibration/project.md` failed: `shared/projects` is ignored by .gitignore in /app/agents. Needs repo/config decision to track shared projects or use correct repository/path.
