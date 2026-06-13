# Graceful Degradation Harness Contract

Date: 2026-05-23
Owner: `agent-system-evolution`
Implementation owner: `platform`

## Problem

The error-recovery audit (`outputs/error-recovery-patterns.md`) found that 50%
of failed sessions are infrastructure kills — provider errors, timeouts, or rate
limits that terminate the session instantly. The agent never gets a chance to
checkpoint progress, emit partial results, or call `finish(partial)`. All
in-flight work (sometimes 39+ operations) is lost.

This is the single largest source of unrecoverable failure. Unlike data or
permission errors (where pivot/fix strategies succeed 100% of the time), infra
kills offer zero recovery opportunity because the runtime terminates without
giving the agent a final turn.

## Contract

### 1. Checkpoint Protocol (Agent Convention)

Agents SHOULD emit incremental checkpoints during long-running tasks so that
progress survives unexpected termination.

**Checkpoint shape:**

```yaml
type: session.checkpoint
sessionId: <canonical session id>
owner: <agent>
timestamp: <iso>
progress:
  completed_items: [<list of sub-goals achieved so far>]
  partial_state: <optional free-form key-value state for resumption>
  deliverables_so_far: [<file paths written or modified>]
next_steps: <what remains to be done>
```

**When to checkpoint:**
- After every major sub-goal completion (file written, query answered, tool
  sequence finished)
- Before starting a risky/expensive operation (large file write, external API
  call)
- At minimum every 10 tool calls in a long session

**Where to checkpoint:**
- Write to `.state/checkpoints/<sessionId>.json` (survives session kill)
- Optionally emit as a `session.checkpoint` event if platform supports it

### 2. Graceful Shutdown Hook (Platform Request)

When the runtime detects an imminent session termination due to infrastructure
error, it SHOULD give the agent a final turn before killing the session.

**Requested behavior:**

```
Runtime detects provider error / timeout / rate limit
  → Instead of immediate kill:
    1. Inject a system message: "INFRASTRUCTURE_ERROR: <type>. You have 1 turn to checkpoint."
    2. Allow agent 1 turn (single tool call or finish())
    3. If agent calls finish(partial/blocked), persist that as session outcome
    4. If agent times out on the grace turn, kill with status=error as today
```

**Acceptance criteria:**
- Agent gets ≥1 grace turn on provider errors before session termination
- Grace turn has a hard timeout (30s) to prevent infinite hangs
- Session outcome reflects `finish()` call if agent completes the grace turn
- No grace turn on explicit user cancellation or security kills

### 3. Checkpoint API (Platform Request)

Platform SHOULD provide a lightweight checkpoint persistence API that survives
session termination.

**Minimal API:**

```typescript
// Called by agent mid-session to persist resumable state
checkpoint(data: {
  completed_items: string[];
  partial_state?: Record<string, unknown>;
  deliverables_so_far?: string[];
  next_steps?: string;
}): void;
```

**Properties:**
- Checkpoint is associated with the current session and its parent task
- Persisted outside the session event stream (survives kills)
- Queryable by task ID for resumption: `getCheckpoint(taskId) → latest checkpoint`
- Subsequent sessions on the same task can read the checkpoint to avoid re-deriving state

### 4. Resumption Protocol (Agent Convention)

When an agent starts a session for a task that has a prior failed attempt:

1. Check for checkpoint: query `.state/checkpoints/` or `getCheckpoint(taskId)`
2. If checkpoint exists, read `completed_items` and `next_steps`
3. Skip already-completed sub-goals
4. Resume from `next_steps`

This prevents the re-derivation waste identified in multi-session task patterns.

## Validation Signals

- `session.checkpoint.count` — number of checkpoints emitted per session (target: ≥1 for sessions with 10+ ops)
- `session.graceful_shutdown` — whether the grace turn was offered on infra kills
- `session.progress_recovered` — whether a resumed session used a prior checkpoint

## Stop Condition

This contract is validated when:
1. Platform ships either the grace-turn hook OR the checkpoint API
2. Agent convention is adopted (≥50% of 10+ op sessions emit checkpoints)
3. Resumed sessions demonstrate progress recovery from checkpoints

## Promotion Path

- Grace-turn hook → platform runtime feature
- Checkpoint protocol → agent convention (injected into agent context)
- Resumption protocol → agent convention (part of task-start behavior)
- Checkpoint API → platform SDK addition
