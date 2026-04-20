# Reviewer Effectiveness — Journal

## 2026-04-20 — Project Created
- Reviewer is the weakest link in persistent-task workflow
- Projects stall because reviewer gives up, rubber-stamps, or repeats failed guidance
- Evidence: context-learning (13 iterations stuck), agent-autonomy (DONE at 0/5), workflow-first (DONE at 19%)
- Need to investigate reviewer failures, redesign the prompt, experiment, measure
### Iteration 1 (comment) — 2026-04-20T19:16:50.096Z
**Comment**: - [2026-04-20 hao] This is P0 — the reviewer is the critical control point for project success. A bad reviewer means projects stall, waste iterations, and need human intervention. Investigate deeply: read the actual reviewer prompts, read the reviewer responses that led to stalls, understand WHY the reviewer fails. Then fix the prompt.
**Reviewer**: CONTINUE — The worker produced no actual work in iteration 1 — it just echoed the comments. The first milestone (Investigate) needs to be done. Here's exactly what iteration 2 should do:

**Investigate the reviewer system thoroughly:**

1. **Read the reviewer prompt code**: Find and read `buildReviewPrompt` (likely in the persistent-task infrastructure). Search for it with `grep -r "buildReviewPrompt\|review.*prompt\|reviewer" --include="*.ts" -l` in the project. Read the full prompt template.

2. **Read recent reviewer outputs**: Look in `.state/` or task output directories for actual reviewer responses from recent persistent tasks. Find 10+ examples. Look for patterns of:
   - **Rubber-stamping**: saying DONE when milestones aren't actually complete
   - **Giving up**: saying BLOCKED when the worker could have been redirected
   - **Repeat loops**: giving the same guidance that already failed
   - **Wrong guidance**: telling the worker to do something unhelpful

3. **Produce a structured analysis file** at `.state/reviewer-investigation.md` containing:
   - The current reviewer prompt (quoted)
   - 10+ categorized examples of reviewer failures with excerpts
   - Root cause analysis: WHY does the prompt produce these failures?
   - Specific prompt weaknesses identified

This is purely a read-and-analyze task. No code changes yet. The output must be concrete evidence, not vague observations.

