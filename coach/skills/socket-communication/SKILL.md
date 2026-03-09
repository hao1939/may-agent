---
name: socket-communication
description: Use when you need to understand socket events, interpret coachee behavior from event streams, or debug socket connection issues. Covers event types, command protocol, and event interpretation for coaching assessment.
---

# Socket Communication

How to read, interpret, and respond to socket events from a coachee process.

## Event Types

Events arrive in debounced batches via `socket_watch`. Each event has a type:

| Event Type | What It Means | Coaching Relevance |
|------------|---------------|-------------------|
| `text` | LLM text output (streaming) | Read for reasoning quality, self-awareness |
| `tool_call` | Agent invoked a tool | Track tool efficiency, appropriate tool choice |
| `tool_result` | Tool returned result | Check for errors, verify correct interpretation |
| `session_start` | New session began | Coachee started processing |
| `session_end` | Session completed | Exercise finished — time to verify |
| `info` | System diagnostic | Watch for warnings, errors |
| `prompt` | Agent is idle | Ready for next exercise or input |

## Reading Event Batches

A typical batch looks like:

```
[socket_watch: coachee] Event batch (5 events):

[tool_call] read: {"path":"src/manager.ts","offset":1,"limit":50}
[tool_result] read: (2847 chars)
[tool_call] exec: {"command":"grep -n 'function run' src/manager.ts"}
[tool_result] exec: 142:  run(agent: string, task: string): string {
[text] I can see the run method starts at line 142. Let me read the full implementation...
```

### What to Look For

**Good signs:**
- Reads before writing (grep → read → edit)
- Uses line-range reads (`offset`/`limit`) instead of reading entire files
- Runs verification after changes (`npm run check`, tests)
- Concise tool calls (not repeating the same read)

**Bad signs:**
- Blind writes without reading first
- Reading entire large files (no `limit`)
- Re-reading files already read this session
- Guessing file paths instead of using `find`/`ls`
- Ignoring tool errors and plowing ahead
- Excessive exploration before starting real work

## Commands You Can Send

### `input` — New task or response
```json
{ "type": "input", "message": "Now implement the error handling for edge case X" }
```
Use when coachee is idle (after `prompt` event).

### `steer` — Mid-execution correction
```json
{ "type": "steer", "message": "Stop reading the entire codebase. Focus only on src/manager.ts" }
```
Use sparingly. Track every steer — needing intervention is itself a finding.

### `cancel_task` — Abort current exercise
```json
{ "type": "cancel_task" }
```
Use when coachee is completely off-track (>2 steers failed).

### `status` — Check process state
```json
{ "type": "status" }
```
Response shows active sessions and their state.

## Intervention Guidelines

1. **Wait before steering.** Give the coachee 2-3 event batches to self-correct.
2. **Steer specifically.** "Stop X, do Y instead" — not vague hints.
3. **Max 2-3 steers per exercise.** If it needs more, cancel and re-task.
4. **Record every intervention.** Needing a steer is a finding in the report.

## Debounce Tuning

| `debounceMs` | Effect | Use When |
|--------------|--------|----------|
| 3000 | Frequent batches, more interrupts | You need tight control |
| 5000 | Balanced (default) | Normal coaching |
| 10000 | Infrequent batches, less noise | Long-running exercises |

## Connection Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| "Connection refused" | Socket not created yet | Wait longer after spawn, re-check path |
| Events stop arriving | Coachee finished or crashed | Check `subagents.status()` |
| Events too noisy | debounceMs too low | Increase to 5000-10000 |
| "Socket timeout" on send | Coachee process hung | Kill and respawn |
