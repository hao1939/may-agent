# Meta Loop — Self-Improvement Cycle

**Owner: bob (orchestrator), evaluator (measurement), optimizer (implementation)**

The meta loop is how the agent system improves itself. From the runner's perspective,
it's just another agent session — no special infrastructure, no timers, no flags.
Bob is an agent like any other; the meta-loop is just what happens when you give
Bob a task.

## Flow

```
Trigger (crontab, user, @bob, socket run)
    │
    ▼
┌──────┐     ┌──────────┐     ┌───────────┐
│ Bob  │────▶│Evaluator │────▶│ Optimizer │
│(lead)│     │(measure) │     │(implement)│
└──────┘     └──────────┘     └───────────┘
  │  ▲                              │
  │  │                              ▼
  │  │                          ┌──────┐
  │  └──────────────────────────│ Bob  │
  │         accept/reject/hold  │(close)│
  │                             └──────┘
  │
  ▼ (async, non-blocking)
┌─────────┐
│  Human  │
│(clarify) │
└─────────┘
```

## How to Trigger

No built-in automation. Use whatever external mechanism fits:

- **Interactive**: `@bob run the meta-loop`
- **Socket**: `echo '{"type":"run","agent":"bob","message":"Run the meta-loop"}' | socat - UNIX-CONNECT:.state/may.sock`
- **Crontab**: schedule the socket command on any interval
- **Direct**: `AGENT=bob` makes Bob the interface agent

## Agent Roles

### Bob — Orchestrator
- Reads evaluation data, connects it to philosophy.md
- Writes optimizer brief, delegates to optimizer
- Reviews results: accept, reject, or hold
- Queues questions for the human in `agents/bob/workspace/pending-decisions.md`

### Evaluator — Measurement
- Scores sessions against consistent criteria (efficiency, quality)
- Does NOT decide what to fix — just measures

### Optimizer — Implementation
- Implements fixes based on Bob's brief
- One fix per run, verified with tests
- Can delegate to coder and QA
