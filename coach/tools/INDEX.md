# Coach Tools

## read
Read files from the project. Use to:
- Review coachee's work (source files, test output)
- Read evaluation data (`.state/evaluations/<session>.json`)
- Read agent memory (`.state/memory/<agent>.jsonl`)
- Read agent knowledge (`agents/<name>/knowledge/domain.md`)
- Read shared docs (`agents/shared/team.md`, `agents/shared/system-design.md`)
- Read past coaching findings (`agents/coach/workspace/findings.md`)

## write
Write files. Scoped to coaching workspace:
- Coaching reports: `agents/coach/workspace/sessions/<agent>-<timestamp>.md`
- Accumulated findings: `agents/coach/workspace/findings.md`
- Exercise definitions: `agents/coach/workspace/exercises/<name>.md`

Do NOT write to agent knowledge files, source code, or configuration.

## exec (read-only)
Execute read-only shell commands. Use for:
- `npm run check` — verify TypeScript compilation
- `git diff` — see what the coachee changed
- `git log --oneline -5` — check recent commits
- `grep -r "pattern" src/` — search for patterns
- `ls -t .state/evaluations/ | head -20` — find recent evaluations
- `wc -l .state/memory/coder.jsonl` — check memory size

Cannot write files, create directories, or modify git state.

## background_exec
Spawn and manage long-lived background processes.

Actions:
- `spawn(command, label?)` — start a background process, returns `{ pid, label }`
- `output(pid, lines?)` — read new output since last read (drain semantics)
- `input(pid, text)` — write to process stdin
- `kill(pid, signal?)` — terminate a process (default: SIGTERM)
- `list()` — list all tracked processes with status

Primary use: spawning the coachee may-agent process.

Example:
```
spawn("cd /home/hao/may-agent && STATE_DIR=.state/coaching AGENT=coder npx tsx run/may.ts", "coachee")
```

## socket_watch
Connect to Unix domain sockets, receive events, and send commands.

Actions:
- `connect(socketPath, options?)` — connect to a socket. Options:
  - `label` — human-readable name for the connection
  - `debounceMs` — batch window in ms (default: 3000). Events buffered until this much silence.
  - `interrupt` — if true, use steer (interrupting) instead of followUp (default: false)
  - `filter` — event types to forward (default: text, tool_call, tool_result, info, session_start, session_end, connected). Use `["*"]` for all.
- `send(watchId, data)` — send a JSON command to the socket. Commands:
  - `{ "type": "input", "message": "..." }` — send task/input to the coachee
  - `{ "type": "steer", "message": "..." }` — interrupt and redirect the coachee
  - `{ "type": "cancel_task" }` — cancel the coachee's current task
  - `{ "type": "status" }` — request status of active sessions
- `disconnect(watchId)` — close connection
- `list()` — list active connections

Events arrive as follow-up messages between your turns, formatted as batches:
```
[socket_watch: coachee] Event batch (3 events):

[tool_call] exec: {"command":"npm run check"}
[tool_result] exec: All checks pass
[text] The implementation is complete. I've added...
```
