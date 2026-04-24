# Persistent-Task Workflow — Pilot Feedback

**Date**: 2026-04-15
**Workflow run**: `wr_1776243028526_16sm`
**Task**: Fix verify-wrap ctx.agent bug (already fixed — intentional pilot test)
**Config**: owner=tech-lead, worker=coder, maxIterations=3, reviewEvery=1

## Summary

The persistent-task workflow ran successfully for 3 iterations (6 child sessions), hit the maxIterations=3 cap, and paused cleanly. Total wall clock: ~26 minutes. Total ops: 90 (59 coder, 31 tech-lead). The coder produced a test file on a review branch. The project markdown file was correctly maintained as audit log.

## What Worked

1. **Project file as audit log** — The markdown file was updated after each worker and review phase. Status, Updated, Iteration fields all tracked correctly. The crash-recovery design (write worker output before review) is sound.

2. **Iteration loop mechanics** — Worker → Review → Worker cycle executed correctly 3 times. The review prompt correctly asked for DONE/BLOCKED/CONTINUE and the extractDecision parser handled the responses.

3. **Clean cap handling** — When maxIterations=3 was reached, status was set to "paused" and Current State was updated with a clear message. The workflow returned a done result (not an error), which is the right call.

4. **Worker actually did work** — The coder found the fix already existed, wrote new tests (48 lines in `test/workflow-tool.test.ts`), committed to a review branch. This is reasonable behavior for a "fix bug that's already fixed" task.

5. **Session isolation** — Each iteration got its own session. No state leakage between iterations.

## What Broke / Needs Fixing

1. **Worker result truncation loses all useful info** — The `workerResult` saved to the project file is `workerResult.lastAssistantText` truncated to 500 chars. But `lastAssistantText` is often the agent's final internal monologue ("Let me run TSC one final time and finish up."), NOT a summary of what it did. The `ctx.summarize()` call exists on line ~340 but its result (`workerSummary`) is never used — it's computed and thrown away. **This is the biggest bug: the audit log records garbage instead of meaningful summaries.**

2. **Files touched is always "(see worker session)"** — The `filesTouched` parameter is hardcoded to `"(see worker session)"` on every call. The workflow has no mechanism to extract which files the worker actually modified. This defeats the purpose of the audit log. Should use `ctx.summarize()` output or parse `workerResult.deliverables` if available.

3. **Review agent fought the verification gate** — The tech-lead review sessions (14, 7, 10 ops) spent most of their ops fighting the verification/finish gate. The reviewer's job is to say DONE/BLOCKED/CONTINUE, but the gate expected file modifications or verification commands. The reviewer should probably be a lightweight call (maybe even non-agent — just extract the decision), or the review prompt should explicitly tell the agent it's a review-only task with no file changes expected.

4. **Guidance propagation is weak** — The review agent's "Owner assessment" text in the project file was polluted with gate-fighting text ("The gate seems to be triggering..."). The actual review decision got lost. The `getLastGuidance()` function extracts previous assessment text, but since the assessment was gate-fighting noise, the worker got no useful guidance in iterations 2-3.

5. **No verification step** — The workflow doesn't verify that the worker's changes actually work (no `tsc --noEmit`, no test run). For code tasks, there should be an optional verification command. The existing `verify-wrap` and `implement-and-verify` workflows handle this — persistent-task should support it too.

## What Felt Awkward

1. **Overkill for a simple bug fix** — 90 ops and 26 minutes for a task that was already done. The persistent-task workflow is designed for multi-session, multi-day tasks. Using it for a single-fix task feels like driving a semi-truck to the corner store. The design doc envisions this for "refactor entire module" or "migrate test framework" — tasks with genuine iteration. The pilot would be more meaningful with a task that actually needs 10+ iterations.

2. **Review-every-1 doubles the cost** — With reviewEvery=1, every worker iteration triggers a full agent review session. At 7-14 ops per review, this is expensive. For low-stakes iterations, reviewEvery=3 or reviewEvery=5 would be more efficient. The review agent adds latency but doesn't add much value when the worker is making incremental progress.

3. **Owner and worker prompts don't include enough file context** — The worker prompt shows "Recent Progress" (previous iteration summaries) but those summaries are the truncated garbage from point #1. The worker doesn't know what files exist, what the current code looks like, or what changes were already made. Each iteration is almost starting from scratch.

4. **No early termination by worker** — If the worker realizes "this is already done" (as happened in iteration 1), there's no way for it to signal completion. Only the reviewer can say DONE. This means we waste at least one full review cycle even when the worker knows it's finished.

## Concrete Recommendations

### Must Fix (before using in production)
- **Use `ctx.summarize()` output** for the worker result in the audit log, not `lastAssistantText`
- **Extract deliverables/files** from worker result (parse `finish()` output if available)
- **Make review agent lightweight** — either use a cheaper model, or skip the agent and use JS-based heuristics for simple continue/done decisions

### Should Fix
- Add optional `verifyCommand` to config — run after each worker iteration
- Allow worker to signal DONE in its output (check for DONE prefix before going to review)
- Add `context_files` to config — files the worker should always read for context

### Nice to Have
- Dashboard view: show iteration count, total ops, status in a summary table
- Cost tracking per iteration (ops + tokens if available)
- Ability to resume from a specific iteration (not just "continue from where you left off")

## Verdict

The persistent-task workflow is **structurally sound** — the iteration loop, crash recovery, owner intervention, and project-file-as-state design all work. But it has a **critical observability bug** (discarding summarize output) and a **cost problem** (review sessions are too heavyweight). Fix these two issues and it becomes usable for real multi-day tasks. As-is, it's a 90-op demo of the plumbing working correctly but the content being garbage.
