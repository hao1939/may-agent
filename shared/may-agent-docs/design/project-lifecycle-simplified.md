# Design: Simplified Project Lifecycle — Agents Push or Stop, Never "Done"

**Status:** Draft
**Date:** 2026-04-22
**References:** [project-lifecycle-continuous.md](project-lifecycle-continuous.md), [project-system.md](project-system.md)

## Problem

Agents tend to falsely claim projects are "done". The current workflow has ~150 lines fighting this: evaluator gate (LLM scores 1-10), milestone checks, false-done counter, auto-advance after 2 rejections. It's complex and still doesn't work well.

Additionally, `agents/src/lib/project-health.ts` was deleted, so the project handler is currently **completely broken**.

## Core Insight

Agents shouldn't decide "done". Their job is: push forward, or stop with a reason. Only human or May marks "done".

## Design

### Agent stop model (replaces DONE/BLOCKED/CONTINUE)

Agent (via reviewer) has exactly 3 options:
- **CONTINUE** — made progress, keep going
- **BLOCKED** — needs something external it can't get. Must specify `stop_reason` and `resume_condition`
- **WAITING** — made progress but next step has a precondition. Must specify `stop_reason` and `resume_condition`

**DONE is removed entirely.** No evaluator gate, no false-done counter, no auto-advance.

Examples:
- `BLOCKED: CI pipeline broken. Resume when: CI passes on main`
- `WAITING: PR #42 submitted for review. Resume when: PR merged or feedback received`
- `WAITING: Deployed to staging. Resume when: 24h soak period passes`

### Handler = watch + trigger + escalate (never fix)

Handler has no ability to fix anything. It can only:
1. **Active + no live session** → launch workflow
2. **Blocked/waiting + pending comment** → launch workflow (comment = someone fixed it or gave guidance)
3. **Blocked/waiting + no comment** → escalate up the chain
4. **Escalation chain**: blocked >2h → May notified, >24h → human via Telegram

### Resume loop (comment = universal unblock)

```
Agent stops → BLOCKED/WAITING with reason + resume_condition
  → Handler detects (next tick) → escalates
  → Fixer (May or human) adds comment to ## Comments section in project.md
  → Handler next tick → sees blocked project with pending comment → launches workflow
  → Workflow sees blocked + pending comments → comment iteration → agent reads fix → continues
```

The workflow already has comment iteration logic (project.ts lines 737, 769-797). Blocked projects with pending comments fall through to the main loop. **The loop is already closed** — we just need the handler to launch workflow for blocked/waiting projects that have new comments.

### "Done" = human judgment

Only human or May can set status=done, after reviewing and deciding no further action is needed.

## Implementation

### Phase 1: Restore project-health (fix broken handler)

The handler imports 12 functions from the deleted `project-health.ts`. Recreate them.

**Create `agents/shared/lib/project-health.ts`** with:
- `scanAllProjects(agentsRoot)` — scan `agents/*/projects/` dirs
- `diagnoseProject(project, healthState, ...)` — decide action per project
- `newProjectHealthEntry()`, `readInflight/writeInflight`, `readHealthState/writeHealthState`
- `saveWorkflowRunFile`, `generateRunId`, `updateField`, `appendComment`, `simpleHash`
- `MAX_LAUNCHES_PER_TICK`

**Update handler import**: `from "../../src/lib/project-health.ts"` → `from "../../shared/lib/project-health.ts"`

### Phase 2: Simplify workflow — remove DONE path

**File**: `agents/shared/workflows/project.ts`

1. **Remove `handleDoneDecision()`** (lines 539-621, ~80 lines)
2. **Remove evaluator gate** — `buildEvalPrompt()` (lines 431-474, ~40 lines)
3. **Remove from `LoopState`**: `falseDoneCount`, `lastMilestoneDone`
4. **Simplify `processDecision()`**: no "done" branch, no continuous-project override
5. **Simplify `extractDecision()`**: DONE → treated as CONTINUE (agent can't end the project)
6. **Add WAITING status**: `extractDecision()` parses `WAITING:`, new `handleWaitingDecision()` (~20 lines)
7. **Simplify `handleBlockedDecision()`**: remove evaluator call, record stop_reason + resume_condition
8. **Update `buildReviewPrompt()`**: remove evaluator/auto-check references, new decision options

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
