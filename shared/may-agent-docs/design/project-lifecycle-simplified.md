# Design: Simplified Project Lifecycle — Agents Push or Stop, Never "Done"

**Status:** Implemented
**Date:** 2026-04-24
**References:** [project-lifecycle-continuous.md](project-lifecycle-continuous.md), [project-system.md](project-system.md)

## Problem

Agents tend to falsely claim projects are "done". The previous workflow had ~150 lines fighting this: a separate evaluator LLM call (scores 1-10), milestone hard gates, a false-done counter, and auto-advance after 2 rejections. It was complex and still didn't work well — the false-done rate was ~40% before the evaluator was added.

The separate evaluator catches real problems (missing deliverables, unchecked milestones) but it's architecturally wrong — a bolted-on gate fighting the agent instead of making the agent work better.

Additionally, `project-health.ts` was deleted, leaving the project handler completely broken.

## Core Insight

Agents shouldn't decide "done". Their job is: push forward, or stop with a reason. Only human or May marks "done".

## Design

### Agent stop model

The reviewer has 3 decision options (DONE is accepted but converted):

| Decision | Meaning | What happens |
|---|---|---|
| **CONTINUE** | Made progress, keep going | Next iteration |
| **BLOCKED** | Needs something external | Status=blocked, stop_reason + resume_condition recorded |
| **WAITING** | Precondition must be met | Status=waiting, stop_reason + resume_condition recorded |
| **DONE** | Agent thinks it's finished | Auto-converted to WAITING with "awaiting human/May review" |
| **PIVOT** | Current approach failed | Treated as CONTINUE with strategy change |

When DONE is auto-converted, a journal entry makes it visible:
```
**Auto-converted**: DONE → WAITING (awaiting human/May review). Agent cannot mark projects done.
```

### Project fields for stopped state

When a project enters blocked/waiting, two fields are written to project.md:
```
**Stop Reason**: <why the agent stopped>
**Resume Condition**: <what needs to happen before resuming>
```
These are cleared when the project returns to active.

### Handler = watch + trigger + escalate (never fix)

The handler (`agents/may/handlers/project.ts`) cannot fix anything. It can only:

| Project state | Handler action |
|---|---|
| Active + no live session | Launch workflow |
| Blocked/waiting + pending comment | Launch workflow (comment = unblock signal) |
| Blocked/waiting + no comment, <2h | Skip (give fixer time) |
| Blocked/waiting + no comment, >2h | Escalate to May |
| Blocked/waiting + no comment, >24h | Escalate to human (Telegram) |
| Done / cancelled / paused | Skip |

Escalation timing uses `lastStatusChange` in the health state, reset when comments arrive or status changes.

### Resume loop (comment = universal unblock)

```
Agent stops → BLOCKED/WAITING with reason + resume_condition
  → Handler detects (next tick) → escalates
  → Fixer (May or human) adds comment to ## Comments in project.md
  → Handler next tick → sees blocked/waiting + pending comment → launches workflow
  → Workflow sees blocked/waiting + comments → comment iteration → agent reads fix → continues
  → Stop Reason / Resume Condition cleared on resume
```

The workflow already had comment iteration logic. Blocked/waiting projects with pending comments fall through to the main loop. The loop was already closed — we just needed the handler to launch workflows for stopped projects with new comments.

### "Done" via `[done]` comment

Only human or May can mark done. Mechanism: add a `[done]` comment:

```markdown
## Comments
[done] Reviewed — all milestones complete, deliverables verified. Closing.
```

The workflow detects `[done]` in the comment iteration, sets status=done, clears stop fields, emits `project.completed`, and exits. The reviewer also gets a directive to confirm completion, but the human's judgment takes priority.

### Quality gates = optional features

Behaviors are opt-in per project via `## Process Notes` in project.md:
```markdown
## Process Notes
features: active-reviewer, verify-before-stop, evaluator-gate
```

Parsed by `parseFeatures()` → `Set<string>`, checked via `features.has("X")` at branching points in the workflow. No framework — just conditional checks.

| Feature | What it does | Where it acts | Default |
|---|---|---|---|
| `active-reviewer` | Reviewer gets tool access (read files, run bash) | `buildReviewPrompt()` | off |
| `verify-before-stop` | Reviewer prompt includes "verify deliverables exist before stopping" | `buildReviewPrompt()` | off |
| `evaluator-gate` | Separate LLM call scores work 1-10 before WAITING; <7 overrides to CONTINUE | `handleWaitingDecision()` | off |
| `auto-escalate` | Handler escalates blocked/waiting projects on timer (2h/24h) | `diagnoseProject()` | on |

### How to evolve the project system

1. **Create** — implement behavior behind `features.has("X")` in the workflow
2. **Test** — enable on one project, run gym scenarios, measure impact
3. **Ship** — enable by default or keep opt-in
4. **Remove** — if it doesn't help, delete the flag check

## What was changed

### Created: `agents/shared/lib/project-health.ts`

Fresh rewrite (not restored from git). Provides all functions the handler needs:
- `scanAllProjects()` — scans `agents/*/workspace/projects/` directories
- `diagnoseProject()` — core decision function: one branch per project state
- `updateField()`, `appendComment()` — markdown helpers
- `readHealthState/writeHealthState`, `readInflight/writeInflight` — persistence
- `saveWorkflowRunFile()`, `generateRunId()`, `simpleHash()` — utilities

### Modified: `agents/shared/workflows/project.ts`

| Removed | Added |
|---|---|
| `handleDoneDecision()` (~80 lines) | `handleWaitingDecision()` (~35 lines) |
| `trackMilestoneProgress()` | Stop Reason / Resume Condition field management |
| `falseDoneCount` / `lastMilestoneDone` in LoopState | `[done]` comment detection + handling |
| `DoneHandlerResult` type | `StopHandlerResult` type |
| Continuous-project DONE override | DONE→WAITING auto-conversion (handles all project types) |
| Hardcoded evaluator calls in blocked handler | Evaluator behind `evaluator-gate` feature flag |
| Old reviewer prompt (DONE/PIVOT/BLOCKED/CONTINUE) | New prompt (CONTINUE/PIVOT/WAITING/BLOCKED) |

`buildEvalPrompt()` preserved — used when `evaluator-gate` feature is enabled.

### Modified: `agents/may/handlers/project.ts`

- Import path: `../../src/lib/project-health.ts` → `../../shared/lib/project-health.ts`
- Added `lastStatusChange` tracking for escalation timing

## Verification

1. `npx tsc --noEmit` — zero errors in agents/ code
2. `grep -n "handleDoneDecision\|falseDoneCount\|trackMilestoneProgress" agents/shared/workflows/project.ts` — no matches
3. New code present: `handleWaitingDecision`, `isDoneComment`, `Stop Reason`, `Resume Condition`, `verify-before-stop`
4. Handler correctly imports from `agents/shared/lib/project-health.ts`
