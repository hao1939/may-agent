# Coordination Conventions

Delegation, workflows, async patterns. These apply primarily to power agents
(those with subagents, workflows, or delegation tools) and coach.

## C1: Use subagents for Delegation (Required, Power)

Always delegate to other agents via the `subagents` tool, never by spawning
processes through `exec`. The subagents tool provides:
- Session lifecycle management
- Result capture and error propagation
- Resource cleanup on timeout or cancellation
- Integration with the persistence layer

Bad: `exec("node run/launcher.ts --agent coder ...")`
Good: `subagents.run({ agent: "coder", task: "..." })`

## C2: Detached Mode for Long-Running Sessions (Required, Coach)

When coach spawns a coachee for exercises, use detached mode:

```
subagents.run({ agent: "<name>", task: "...", mode: "detached" })
```

Detached processes:
- Run as independent OS processes
- Survive coach restarts or compaction
- Create a socket for real-time observation
- Must be explicitly cancelled when done

Always clean up: `subagents.cancel({ sessionId: "..." })` after exercises.

## C3: socket_watch Events Are Follow-Ups (Required, Coach)

When connected via socket_watch, events arrive as follow-up messages between
your turns automatically. You do NOT need to poll.

Bad (wastes 6+ tool calls):
```
socket_watch.send(watchId, task)
exec("sleep 15")     // waste
exec("sleep 20")     // waste
exec("sleep 25")     // waste
```

Good (0 wasted calls):
```
socket_watch.send(watchId, task)
// Events arrive automatically as follow-up messages after debounceMs of silence
// Process them when they arrive
```

Set `debounceMs: 5000` for coaching observation — enough time for the coachee
to complete multi-step operations before you evaluate.

## C4: Short Chains, 2-Agent Default (Recommended, Power)

Two-agent pairing is the default for task execution (e.g., coder → QA).
A third agent adds value but also cost and complexity.

Use 3-agent chains when:
- High-stakes changes (production-affecting)
- New coaching scenarios
- Quality matters more than speed

Default to 2-agent: sufficient for most work, less failure surface.

## C5: Acceptance Criteria Before Decomposition (Recommended, Power)

Before breaking work into subtasks, define the done condition:
"This task is complete when X is true and Y is verifiable."

The failure mode of inverted order: subtasks optimize for local goals
but miss the user's actual intent.

## C6: Pivot When Blocked (Recommended, Power)

When one task or agent is blocked, pivot to parallel work — don't halt
the entire workflow. Good multi-agent systems route around partial failures.

Example: "Amy needs a token refresh but we can keep working on Bob's task."

## C7: Check Status, Don't Poll (Required, Power)

Use `subagents.status({ sessionId })` or `subagents.result({ sessionId })`
to check on delegated sessions. Don't loop with sleep waiting for completion.

For detached sessions that need real-time observation, use socket_watch (C3).
For synchronous delegation, the subagents tool blocks until completion.
