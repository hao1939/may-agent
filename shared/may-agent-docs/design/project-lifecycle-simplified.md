# Design: Simplified Project Lifecycle — Agents Push or Stop, Never "Done"

**Status:** Draft
**Date:** 2026-04-22
**References:** [project-lifecycle-continuous.md](project-lifecycle-continuous.md), [project-system.md](project-system.md)

## Problem

Agents tend to falsely claim projects are "done". The current workflow has ~150 lines fighting this: evaluator gate (LLM scores 1-10), milestone checks, false-done counter, auto-advance after 2 rejections. It's complex and still doesn't work well. The false-done rate was ~40% before the evaluator was added.

The separate evaluator LLM call catches real problems (missing deliverables, unchecked milestones, rubber-stamping), but it's architecturally wrong — it's a bolted-on gate fighting the agent instead of making the agent do better work.

Additionally, `agents/src/lib/project-health.ts` was deleted, so the project handler is currently **completely broken**. This needs restoring regardless of the design change.

## Core Insight

Agents shouldn't decide "done". Their job is: push forward, or stop with a reason. Only human or May marks "done".

## Design

### Agent stop model

Agent (via reviewer) has exactly 3 options:
- **CONTINUE** — made progress, keep going
- **BLOCKED** — needs something external it can't get. Must specify `stop_reason` and `resume_condition`
- **WAITING** — made progress but next step has a precondition. Must specify `stop_reason` and `resume_condition`

If the agent says **DONE**, it's automatically converted to **WAITING** with:
- `stop_reason: "Agent believes all milestones are complete"`
- `resume_condition: "Human/May review confirms done, or provides additional work"`

A journal entry is added to make the conversion visible:
```
**Auto-converted**: DONE → WAITING (awaiting human/May review). Agent cannot mark projects done.
```

This avoids the infinite DONE→CONTINUE→DONE loop — the project cleanly pauses and waits for review.

Examples:
- `BLOCKED: CI pipeline broken. Resume when: CI passes on main`
- `WAITING: PR #42 submitted for review. Resume when: PR merged or feedback received`
- `WAITING: Deployed to staging. Resume when: 24h soak period passes`
- `DONE` (auto-converted) → `WAITING: All milestones complete. Resume when: review confirms done or new work assigned`

### Quality gate = optional feature, not hardcoded

The evaluator's checks are valuable but we're not sure how well they work in the new model. Make them **features** — opt-in per project, testable, removable.

### How features work

Features are declared in project.md's `## Process Notes`:
```markdown
## Process Notes
features: active-reviewer, verify-before-stop
```

The workflow parses them once per iteration via `parseFeatures(projectContent)` → `Set<string>`. Then at branching points, `features.has("X")` toggles behavior. No framework, no plugin system — just conditional checks at the right spots in the workflow.

```typescript
// In buildReviewPrompt() — adds verification instructions to prompt
if (features.has("verify-before-stop")) {
  prompt += "Before WAITING/BLOCKED: verify deliverables exist, check files aren't empty\n";
}

// In processDecision() — optionally runs separate evaluator LLM call
if (decision.status === "waiting" && features.has("evaluator-gate")) {
  const score = await runEvaluator(ctx, config, ...);  // existing logic preserved
  if (score < 7) return null; // override to CONTINUE
}

// In handler's diagnoseProject() — escalation timing
if (features.has("auto-escalate")) {
  // 2h→May, 24h→human
}
```

**Feature table:**

| Feature | What it does | Default |
|---|---|---|
| `verify-before-stop` | Reviewer must check deliverables exist before BLOCKED/WAITING | off |
| `evaluator-gate` | Separate LLM call scores work 1-10 before WAITING (current behavior, preserved as opt-in) | off |
| `active-reviewer` | Reviewer gets tool access (read files, run bash) | off (existing) |
| `auto-escalate` | Handler escalates blocked projects on timer (2h→May, 24h→human) | on |

### This is how we evolve the project system

Instead of hardcoding complex behaviors (evaluator gate, false-done counter, auto-advance), each behavior is a named feature:
1. **Create** — implement the feature behind a flag in the workflow
2. **Test** — enable on one project, run gym scenarios, measure impact
3. **Ship** — enable by default (or keep opt-in for specific project types)
4. **Remove** — if a feature doesn't help, delete it cleanly

The project workflow becomes a simple core (CONTINUE/BLOCKED/WAITING loop) with pluggable features.

### Handler = watch + trigger + escalate (never fix)

Handler has no ability to fix anything. It can only:
1. **Active + no live session** → launch workflow
2. **Blocked/waiting + pending comment** → launch workflow (comment = someone fixed it or gave guidance)
3. **Blocked/waiting + no comment** → escalate up the chain

### Auto-escalate mechanism

When `auto-escalate` feature is enabled (default on), the handler tracks how long a project has been blocked/waiting without comments using `healthState.projects[relPath].lastStatusChange` timestamp.

On each tick, for blocked/waiting projects with no pending comments:
- **<2h** → skip (give fixer time)
- **>2h** → emit `escalation.created` event + log. May's handler picks this up and reviews the project
- **>24h** → call `ctx.notify(...)` which sends Telegram message to human

The timer resets when:
- A comment is added (project gets relaunched)
- Status changes (project goes active again)

This lives in `diagnoseProject()` — it's just another branch in the existing action-decision logic.

### Resume loop (comment = universal unblock)

```
Agent stops → BLOCKED/WAITING with reason + resume_condition
  → Handler detects (next tick) → escalates
  → Fixer (May or human) adds comment to ## Comments section in project.md
  → Handler next tick → sees blocked project with pending comment → launches workflow
  → Workflow sees blocked + pending comments → comment iteration → agent reads fix → continues
```

The workflow already has comment iteration logic (project.ts lines 737, 769-797). Blocked projects with pending comments fall through to the main loop. **The loop is already closed** — we just need the handler to launch workflow for blocked/waiting projects that have new comments.

### "Done" = `[done]` comment

Only human or May can mark a project done. The mechanism: add a `[done]` comment to `## Comments` in project.md.

```markdown
## Comments
[done] Reviewed — all milestones complete, deliverables verified. Closing.
```

The workflow processes this as a normal comment iteration. The reviewer sees the `[done]` directive, confirms completion, and sets status=done. This keeps **comment as the universal mechanism** — same path for unblocking, redirecting, and completing.

In the workflow:
```typescript
// In comment iteration, after extracting pending comments:
if (pendingComments.match(/^\[done\]/m)) {
  // Reviewer prompt gets: "A human/May has marked this project done. 
  // Confirm completion and set status=done, or explain why it's not ready."
}
```

If the reviewer disagrees (unlikely since human said done), the comment stays in the journal and the project continues — but this is a safety valve, not expected behavior.

## Implementation

### Phase 1: Rewrite project-health (fix broken handler)

The handler imports 12 functions from the deleted `project-health.ts`. Rewrite fresh (not restore from git) — the old code had the import path bug and was entangled with src/lib. Use the handler's actual usage (lines 32-148) as the spec for what each function needs to do.

**Create `agents/shared/lib/project-health.ts`** with:
- `scanAllProjects(agentsRoot)` — scan `agents/*/projects/` dirs
- `diagnoseProject(project, healthState, ...)` — decide action per project
- `newProjectHealthEntry()`, `readInflight/writeInflight`, `readHealthState/writeHealthState`
- `saveWorkflowRunFile`, `generateRunId`, `updateField`, `appendComment`, `simpleHash`
- `MAX_LAUNCHES_PER_TICK`

**Update handler import**: `from "../../src/lib/project-health.ts"` → `from "../../shared/lib/project-health.ts"`

### Phase 2: Simplify workflow — DONE→WAITING, behaviors→features

**File**: `agents/shared/workflows/project.ts`

1. **DONE→WAITING conversion** in `extractDecision()`: DONE becomes WAITING with "review needed"
2. **Add WAITING status**: new `handleWaitingDecision()` (~20 lines): set status=waiting, record stop_reason + resume_condition
3. **Move evaluator gate behind `evaluator-gate` feature flag** — don't delete, just guard with `features.has("evaluator-gate")`
4. **Move verification prompting behind `verify-before-stop` feature flag**
5. **Remove hardcoded false-done counter / auto-advance** — these are workarounds for the DONE problem, which DONE→WAITING solves
6. **Simplify `processDecision()`**: no "done" branch, no continuous-project override
7. **Simplify `handleBlockedDecision()`**: record stop_reason + resume_condition (evaluator call only if feature enabled)
8. **Update `buildReviewPrompt()`**:
   - New decision options: CONTINUE / BLOCKED / WAITING (DONE accepted but converted)
   - Feature-conditional verification instructions
   - Remove references to false-done counter, auto-advance

### Phase 3: Update handler for WAITING + comment-based resume

In `diagnoseProject()`:
- **blocked/waiting + has pending comments** → action: launch-workflow
- **blocked/waiting + no comments + recent** → action: skip (give fixer time)
- **blocked/waiting + no comments + >2h** → action: escalate (nudge May)
- **blocked/waiting + no comments + >24h** → action: escalate (notify human)
- No condition-checking logic needed — the fixer communicates via comments

### Phase 4: Add project.md fields

Projects gain two new fields:
```
**Stop Reason**: <why the agent stopped>
**Resume Condition**: <what needs to happen before resuming>
```

Cleared when project goes back to active.

## Files to modify

| Action | File |
|---|---|
| **Create** | `agents/shared/lib/project-health.ts` (restore from git history) |
| **Edit** | `agents/may/handlers/project.ts` — fix import path |
| **Edit** | `agents/shared/workflows/project.ts` — remove DONE path, add WAITING |
| **Delete** | ~150 lines of done-detection machinery |
| **Add** | ~50 lines of WAITING handling |

Net: **~100 lines removed**, simpler control flow.

## Verification

1. `bun run build` — no import errors
2. `grep -n "handleDoneDecision\|falseDoneCount\|buildEvalPrompt" agents/shared/workflows/project.ts` — no matches
3. Create a test project, run workflow manually, verify BLOCKED/WAITING/CONTINUE work
4. Verify handler picks up waiting projects correctly
5. `npx vitest run` — no regressions in existing tests
