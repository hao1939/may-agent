# Task Continuity Harness Contract

Date: 2026-05-24
Owner: `agent-system-evolution`
Implementation owner: `platform`

## Problem

The multi-session task continuity audit (`outputs/multi-session-task-continuity-audit.md`) measured **50% average context loss** across tasks spanning multiple sessions. Agents re-derive completed work, re-hit known blockers, and fail to advance iteration state — wasting tokens and delaying task completion.

Root causes:
1. No durable checkpoint between sessions — each session starts from scratch.
2. Completed tasks get re-dispatched because no machine-readable "done" signal exists outside session state.
3. Accumulated context injections balloon to 4000+ words, creating noise without preventing re-derivation.
4. Blockers encountered in prior sessions are not surfaced, causing agents to retry the same failed approach.

## Contract

### 1. Checkpoint File Format

Every task spanning 2+ sessions MUST maintain a checkpoint at:

```
<project-dir>/outputs/checkpoint-<task-id>.md
```

Required format:

```markdown
# Checkpoint: <task-id>
## Last Updated: <ISO 8601 timestamp>
## Status: in-progress | blocked | complete

## Accomplished (append-only log)
- [<session-id>] <concrete outcome>

## Current State
<2-3 sentences describing exactly where work stands>

## Known Blockers
- <blocker description + what was tried + outcome>

## Next Action
<single concrete step the next session should execute first>

## Anti-Patterns (do NOT retry)
- <approach that failed — with enough detail to recognize the pattern>
```

**Invariants:**
- `Accomplished` is append-only; prior entries MUST NOT be edited or removed.
- `Next Action` is singular — exactly one actionable step, not a plan.
- `Anti-Patterns` entries are permanent for the task's lifetime.
- Total checkpoint file size MUST NOT exceed 2000 words.

### 2. Dispatch Gate Specification

Before dispatching a session to a task, the dispatcher MUST:

1. Check whether `outputs/checkpoint-<task-id>.md` exists.
2. If it exists and `Status: complete` — **do not dispatch**. The task is done.
3. If it exists and `Status: blocked` — **do not dispatch** unless the blocker's resolution is included in the dispatch context.
4. If it exists and `Status: in-progress` — inject `Current State`, `Next Action`, and `Anti-Patterns` sections into the session's task prompt (not the full file).

**Gate failures** (dispatching to a complete task) SHOULD emit a metric: `task.dispatch.gate_violation`.

### 3. Resumption Protocol

On session start for a checkpointed task:

1. **Read checkpoint first** — before any other file reads or tool calls.
2. **Execute Next Action** — do not re-derive the plan or re-read context that the checkpoint already summarizes.
3. **Check Anti-Patterns** — if the current approach matches a listed anti-pattern, pivot immediately or escalate.
4. **Update checkpoint before finish()** — the checkpoint MUST be updated before calling `finish()`. At minimum: append to `Accomplished`, update `Current State` and `Next Action`.

### 4. Context Budget Rule

Accumulated context injected into multi-session task prompts MUST NOT exceed **1000 words**.

If the dispatcher's context payload would exceed 1000 words:
- Move all detail into the checkpoint file.
- Inject only: `Current State`, `Next Action`, `Anti-Patterns`, and the checkpoint file path.
- The agent reads the full checkpoint if it needs history.

This prevents the context-bloat anti-pattern (4000+ word injections observed in the audit) while preserving essential continuity.

### 5. Blocker Deduplication

If a session encounters a blocker already listed in `Anti-Patterns`:
- **Do not retry the same approach.**
- Escalate immediately via `finish({ status: 'blocked' })` referencing the repeated blocker.

If a session encounters a novel blocker:
- Add it to `Anti-Patterns` with a description of what was tried.
- After **2 sessions** hitting the same blocker class, the dispatcher MUST escalate to the task owner rather than dispatching again.

---

## Platform Request: Auto-Checkpoint Support in master-worker.ts

### Motivation

The checkpoint convention requires manual discipline from agents. The audit showed that agents without structural enforcement lose 50% of context. Platform-level auto-checkpoint support makes the convention zero-cost and reliable.

### Requested Capabilities

#### R1: Auto-Create Checkpoint on First Dispatch

When `master-worker.ts` dispatches to a task for the first time (no existing checkpoint file), it SHOULD create a skeleton checkpoint file with `Status: in-progress` and empty sections.

**Acceptance criteria:**
- After first dispatch to task `foo`, `outputs/checkpoint-foo.md` exists with valid format.
- Skeleton includes the task goal in `Current State`.

#### R2: Auto-Inject Checkpoint Context on Subsequent Dispatches

When dispatching to a task that has an existing checkpoint, `master-worker.ts` MUST:
- Read the checkpoint file.
- If `Status: complete`, skip dispatch and log the gate violation.
- If `Status: blocked`, skip dispatch unless a resolution hint is available.
- Otherwise, inject `Current State`, `Next Action`, and `Anti-Patterns` into the worker's task prompt (respecting the 1000-word budget).

**Acceptance criteria:**
- Worker prompt contains checkpoint summary on iteration ≥2.
- Completed tasks are never re-dispatched.
- Gate violations emit `task.dispatch.gate_violation` metric.

#### R3: Auto-Update Checkpoint on Worker Completion

After a worker session calls `finish()`, `master-worker.ts` SHOULD update the checkpoint:
- Append to `Accomplished` using the session's `summary` field.
- Update `Status` based on `finish.status` (`success` → `complete`, `blocked` → `blocked`, else `in-progress`).
- If `finish.next_steps` is present, set it as `Next Action`.
- If `finish.blockers` is present, append to `Anti-Patterns`.

**Acceptance criteria:**
- Checkpoint reflects worker outcome without worker needing to manually edit the file.
- `Accomplished` log grows monotonically across iterations.

#### R4: Context Budget Enforcement

`master-worker.ts` MUST enforce the 1000-word limit on injected context:
- Count words in the assembled context payload.
- If over budget, truncate to `Current State` + `Next Action` + `Anti-Patterns` + file path reference.
- Log a warning when truncation occurs.

**Acceptance criteria:**
- No worker prompt exceeds 1000 words of accumulated task context.
- Truncation events are logged.

### Validation Signals

- `task.dispatch.gate_violation` — counts dispatch attempts to completed/blocked tasks (target: 0 after adoption).
- `task.context_loss` — future audit metric; re-derivation rate should drop below 20% after auto-checkpoint is live.
- Checkpoint file existence rate for tasks with 2+ sessions should reach 100%.

### Priority

P1 — This addresses the single largest measured source of wasted agent effort (50% context loss across multi-session tasks, equivalent to ~50% token waste on affected tasks).

---

## Promotion Path

1. **Immediate**: Agents adopt the checkpoint convention manually via context facts.
2. **Platform implementation**: `master-worker.ts` gains auto-checkpoint (R1–R4).
3. **Validation**: Re-audit 5 multi-session tasks post-implementation; context loss should drop below 20%.
4. **Enforcement**: Evaluator penalizes sessions that skip checkpoint reads on iteration ≥2.
