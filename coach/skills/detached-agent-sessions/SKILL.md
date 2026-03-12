---
name: coachee-sessions
description: Use when spawning a coachee agent process, connecting to it for observation, sending tasks and corrections, or cleaning up after coaching. Covers the full lifecycle using agents tool (detached mode) + socket_watch.
---

# Coachee Sessions

How to start, observe, control, and shut down a coachee process for coaching.

## Overview

Coach uses two tools together:
- **agents** — spawn and manage the coachee as a detached process
- **socket_watch** — connect to the coachee's socket for real-time observation and commands

The coachee runs as an independent OS process (survives coach restart).

## Step 1: Spawn the Coachee

```javascript
agents.call({
  agent: "<agent-name>",
  task: "<exercise-task>",
  mode: "detached"
})
// Returns: { sessionId: "s_..." }
```

This spawns a new may-agent process with `--socket` enabled automatically.
The coachee is fully independent — if you crash, it keeps running.

## Step 2: Find the Socket

The detached process creates a socket. Find it via the instance registry:

```
exec("ls .state/instances/*/")
exec("cat .state/instances/job-<sessionId>/identity.json")
```

The `identity.json` contains the socket path:
```json
{
  "pid": 12345,
  "agent": "coder",
  "socket": "/home/hao/may-agent/.state/instances/job-s_.../coder.sock"
}
```

## Step 3: Connect socket_watch

```javascript
socket_watch.connect(
  "<socket-path-from-identity.json>",
  { label: "coachee", debounceMs: 5000 }
)
```

`debounceMs: 5000` means event batches arrive after 5 seconds of silence —
gives the coachee time to complete multi-step operations before you evaluate.

Events arrive as follow-up messages between your turns:
```
[socket_watch: coachee] Event batch (3 events):
[tool_call] exec: {"command":"npm run check"}
[tool_result] exec: All checks pass
[text] The implementation is complete...
```

## Step 4: Interact with the Coachee

### Send a new task (if coachee is idle)
```javascript
socket_watch.send(watchId, { "type": "input", "message": "<task>" })
```

### Steer mid-execution (correct course)
```javascript
socket_watch.send(watchId, { "type": "steer", "message": "<correction>" })
```

### Cancel current task
```javascript
socket_watch.send(watchId, { "type": "cancel_task" })
```

### Check status
```javascript
agents.peek({ sessionId: "<sessionId>" })
```

## Step 5: Verify Results

After the coachee finishes, verify independently — don't trust self-reports:

```
read("<modified-files>")
exec("npm run check")
exec("git diff")
```

## Step 6: Cleanup

```javascript
socket_watch.disconnect(watchId)
agents.cancel({ sessionId: "<sessionId>" })
```

Always clean up, even if exercises failed or were aborted.

## Multiple Exercises in One Session

After one exercise completes, send the next task via socket_watch — no need
to respawn:

```javascript
socket_watch.send(watchId, { "type": "input", "message": "<next-exercise>" })
```

The coachee retains context from previous exercises within the same session.

## Troubleshooting

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| No socket file | Process failed to start | Check detached log: `exec("cat .state/logs/detached-<sessionId>.log")` |
| Socket connection refused | Process crashed after start | Check `agents.peek()`, re-spawn |
| No events arriving | debounceMs too high, or coachee stuck | Lower debounceMs, check `agents.peek()` |
| Coachee ignores steer | Agent mid-tool-call | Wait for current tool to finish, steer again |
| identity.json missing | Session ID wrong | `exec("ls .state/instances/")` to find instance dir |
