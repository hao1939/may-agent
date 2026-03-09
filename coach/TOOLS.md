# Coach Tools

## read
Read files from the project. Use to:
- Review coachee's work (source files, test output)
- Read evaluation data (`.state/evaluations/<session>.json`)
- Read agent memory (`.state/memory/<agent>.jsonl`)
- Read agent knowledge (`agents/<name>/knowledge/domain.md`)
- Read shared docs (`agents/shared/team.md`, `agents/shared/system-design.md`)
- Read past coaching findings (`agents/coach/workspace/journal.md`)

## write
Write files. Scoped to coaching workspace:
- Coaching reports: `agents/coach/workspace/sessions/<agent>-<timestamp>.md`
- Accumulated findings: `agents/coach/workspace/journal.md`
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

## subagents
Spawn and manage agent sessions (in-process or detached).

Actions:
- `run({ agent, task, mode? })` — spawn a session. `mode: "detached"` runs in a separate process with its own socket. Returns `{ sessionId, mode, pid? }`.
- `status({ sessionId })` — get session status, runtime, task, output dir.
- `result({ sessionId })` — get final result (last assistant text, duration, output dir).
- `progress({ sessionId, limit? })` — get recent messages from a running session.
- `cancel({ sessionId })` — cancel a session. Detached sessions receive SIGTERM.
- `list()` — list all registered agents and their active/archived sessions.
- `delegate(agent, task)` — shorthand: spawn, wait for completion, return result.

Primary use: spawning coachee in detached mode for observation.

Example:
```
run({ agent: "coder", task: "Run exec(\"echo hello\") and stop.", mode: "detached" })
// Returns: { sessionId: "s_...", mode: "detached", pid: 12345 }
// Instance dir: .state/instances/job-<sessionId>/
// Socket: .state/instances/job-<sessionId>/<agent>.sock
```

## workflow
Discover and run multi-step workflows defined in `agents/coach/workflows/`.

Actions:
- `list()` — list available workflows with names and descriptions.
- `run({ name, task })` — execute a workflow. Each step spawns a coach sub-session.

## validate_workflow
Validate workflow files for correct structure and exports.

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
