# Chat and Bounded Job Convergence Tracker

**Status:** Active tracker; core separation is implemented.
**Design authority:** [Human Control Surfaces](../2a-design/human-control-surfaces.md),
[Sessions](../2a-design/sessions.md), [Event Graph](../2a-design/event-graph.md),
and [Native Coding Workers](../2a-design/native-coding-workers.md).

## Accepted model

Chat and bounded jobs use the same agent capability and observability, but
different lifecycle policies:

| Concern     | Persistent chat                        | Bounded job                              |
| ----------- | -------------------------------------- | ---------------------------------------- |
| Lifecycle   | repeated turns, idle between turns     | start, work, terminal result             |
| Context     | conversation plus fresh system state   | task-specific context and acceptance     |
| Completion  | turn becomes idle                      | explicit terminal result                 |
| Tools       | read, steering, delegation, control    | domain capability plus structured finish |
| Persistence | transcript and compact resume snapshot | session/workflow/task evidence           |

Chat bypasses bounded-job completion semantics, not session persistence,
events, traces, metrics, or UI visibility. Each human turn receives its own
trace even when the conversation container persists.

## Implemented

- persistent chat turns use running/idle lifecycle instead of terminal job
  closure;
- empty turns receive bounded retry and visible failure handling;
- chat prompts include fresh compact system state;
- chat omits broad mutation and terminal finish tools by default;
- transcript compaction and compact resume snapshots are implemented;
- CLI delegation persists work before process spawn and emits `cli.task.*`
  events; and
- app-owned platform/domain agents are app-local rather than hidden chat worker
  types.

## Remaining work

### 1. Restart recovery proof

Add one end-to-end scenario proving that a persisted chat transcript resumes,
fresh system state is injected, and failed recovery produces a visible
notification/event.

### 2. Per-turn trace proof

Add golden traces for a new conversation, later turn, correction, approval,
cancellation, and asynchronous delegation completion. Every human turn must
have one root trace and typed terminal/delivery evidence.

### 3. CLI delegation presentation

Prove from the human surface that delegation is accepted immediately, chat
stays responsive, completion steers the originating conversation, and the
result is presented once.

### 4. Global-agent residue

Keep global `agents/` only for genuinely standalone capability. Move, archive,
or explicitly justify leftover identities and runtime files; do not maintain a
hard-coded roster in design docs.

## Non-goals

- another chat framework;
- a second agent implementation;
- a new request lifecycle;
- untracked conversation memory;
- CLI agents as a new agent type; or
- routing concrete project repair through the human deputy instead of the
  owning app.

## Completion

This tracker is complete when restart recovery, per-turn traces, and delegation
presentation pass end-to-end tests and the remaining global-agent inventory has
an explicit disposition. The completed narrative then belongs in the archive,
not the active proposal folder.
