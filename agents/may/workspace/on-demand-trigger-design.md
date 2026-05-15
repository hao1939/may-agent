# Design: On-Demand Task Triggering via Cron

## Problem

Today there are two ways to assign work to another agent:
1. **`subagents.run`** — creates an in-process sub-agent session. Dies when parent process restarts. Not independent.
2. **Write to agent's `todo.md`** — picked up by `drain-todo` cron job every 4 hours. Way too slow.

Neither gives us what we want: **immediately spawn an independent agent process that survives restarts**.

## Key Insight

The cron system already spawns dedicated job processes (`fireTask` in `cron.ts`). These are:
- Separate OS processes via `may.sh task --agent <agent>`
- Detached (survive parent restart)
- Expose a socket for monitoring/steering
- Tracked in job-history.jsonl

But this capability is only accessible on a timer. There's no way to trigger it on demand.

## Two Different Systems

| | Sub-agent (SubagentManager) | Dedicated Job (Cron) |
|---|---|---|
| Process | In-process, same PID | Separate OS process |
| Survives restart | No | Yes |
| Management | `subagents.run/status/result` | Socket (JSON protocol) |
| Use case | Quick tasks needing result in same turn | Independent work |

## Proposed Design

### 1. Add `trigger` action to cron tool

```
cron.trigger(agent="bob", task="Review the philosophy docs")
```

Returns:
```json
{
  "jobName": "adhoc-bob-1772xxx",
  "agent": "bob",
  "socketPath": ".state/instances/default/bob.sock"
}
```

### 2. Implementation in Cron class

Add a public `triggerTask(agent: string, task: string)` method that:
- Generates a job name like `adhoc-<agent>-<timestamp>`
- Reuses the same spawn logic as `fireTask` (detached process, timeout protection, job history)
- Returns job name + socket path

### 3. Monitoring via socket

After triggering, the caller can:
- Use `exec` + `socat` to connect to the socket path
- Read progress events (JSON lines)
- Send steer commands if needed
- Check if process is still running

A dedicated socket tool can be built later if the `exec`+`socat` pattern proves too clunky.

### 4. Tracking pattern

After triggering:
1. Note the jobName + socketPath in `todo.md`
2. Heartbeat picks it up → check socket for status
3. Act on result or steer if needed

## Open Questions

1. **Naming**: Should adhoc jobs use `adhoc-<agent>-<ts>` or something else?
2. **Overlap**: Should we prevent multiple adhoc jobs for the same agent? Or allow parallel?
3. **Timeout**: Default 10min timeout from cron — should adhoc jobs have a different default?
4. **`may.sh task` doesn't exist in container** — the cron.ts references it but it's a host-side script. Need to verify the actual spawn path works, or use `cron-task.sh` instead.
5. **Socket path**: The `cron-task.sh` approach uses instance-based socket paths. How does the dedicated process expose its socket?
6. **Should trigger be on cron tool or a separate tool?** Cron is about scheduled jobs; trigger is about immediate dispatch. But they share the spawn machinery.

## What This Enables

May can do:
```
cron.trigger(agent="bob", task="Review philosophy docs against recent sessions")
→ bob starts immediately in his own process
→ May notes the socket in todo.md  
→ Next heartbeat, May checks socket for result
→ If needed, May steers via socket
```

No blocking. No 4-hour wait. Independent process. Survives restarts.
