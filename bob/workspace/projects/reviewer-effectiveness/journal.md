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

### Iteration 2 — 2026-04-20T19:18:48.442Z
**Worker**: Now I have comprehensive data. Let me write the analysis.
**Reviewer**: CONTINUE — — The **Investigate** milestone is complete. The analysis in `.state/reviewer-investigation.md` is excellent — 13 categorized examples, clear root causes, and a weakness table. **Check off the Investigate milestone.**

**Next iteration should complete the Design milestone:**

Produce `.state/reviewer-prompt-design.md` with a concrete new `buildReviewPrompt` template. The design must directly address each of the 6 root causes identified:

1. **Problem-solver framing**: Replace the evaluator frame with instructions like "Your job is to unblock the worker. If something isn't working, propose an alternative approach." Add explicit instruction: "Never give the same guidance twice. If your previous guidance failed, try a different strategy."

2. **Show all previous reviewer guidance**: Change from "last 2 journal entries" to showing all previous reviewer CONTINUE messages (or at least a summary). The reviewer must see what it already told the worker.

3. **Infrastructure awareness section**: Add a permanent section explaining: how `checkOffMilestones()` works (text matching on milestone names), what the evaluator checks, what the auto-check override does, and what tools the worker has available.

4. **Fix the DONE trap**: Add guidance like "Before saying DONE, verify: (a) milestone names in your response match exactly, (b) deliverable files exist, (c) quality is sufficient to pass a score ≥7/10 evaluation."

5. **Escalation options**: Add PIVOT as a fourth option — "the current approach isn't working, here's a fundamentally different strategy." Make BLOCKED require a specific unresolvable external dependency, not just "this is hard."

6. **Constrain CONTINUE guidance**: Require the reviewer to state (a) what specific output the next iteration should produce, (b) what's different from previous guidance, (c) a single concrete first step.

The deliverable should include the full new prompt template ready to be implemented, with `{placeholder}` variables matching the current ones. Include a before/after comparison for each weakness.

