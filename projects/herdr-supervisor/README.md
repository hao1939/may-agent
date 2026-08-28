# Herdr Supervisor

Herdr Supervisor is an experiment in letting one agent supervise existing
Herdr workers without replacing Herdr or introducing another task system.

The intended behavior is simple:

1. A human gives a worker a goal and acceptance criteria.
2. Herdr owns the worker pane, process, live state, and events.
3. A supervisor sleeps while the worker is making progress.
4. A meaningful worker event wakes the supervisor.
5. The supervisor reads current evidence and either leaves the worker alone,
   steers the same worker, asks the human, recovers the worker, or accepts the
   result.

The proof of concept uses one Pi session as the supervisor and talks directly
to Herdr's local socket. Workers remain ordinary Herdr agents and may use Codex,
Claude Code, Pi, OpenCode, or another supported CLI.

## Current status

Stage 1 is implemented. It can bind goals to existing workers, show their live
state, fence worker identity, and observe lifecycle transitions without model
calls or worker mutation.

Stage 2a uses the worker's ordinary native agent messages as review evidence.
The worker does not know about Herdr or the supervisor. A small observation
adapter resolves the exact native session supplied by Herdr and returns only
new assistant messages; terminal output is a bounded fallback, not the normal
contract. The Pi session exposes only supervisor tools, so it cannot become a
second worker by reading or modifying the worker's workspace.

Stage 2b adds one nearest-deadline timer across all bindings. It is a recovery
safety net, not a polling loop: only due workers wake, and signals received
during a review coalesce until that review settles.

Stage 2c keeps the model side equally simple: one persistent Pi supervisor
session receives one explicitly scoped worker-review request at a time. Workers
still run concurrently. Signals for other workers coalesce in memory until the
current review settles; no separate model session, context store, or durable
review queue is introduced unless testing proves it necessary.

Stage 3 has now been exercised in live mode. Each Herdr signal starts one
bounded review turn: observe the exact worker once, then leave it alone or apply
one decision. Steering ends the turn. A later worker event starts a fresh turn,
so the supervisor cannot poll while waiting for the worker. A controlled run
verified `observe -> steer`, followed by a later `observe -> finish` with exact
result evidence.

The same session also supports a genuine human decision without another task or
queue: one review can observe and ask a concrete question while leaving the
worker untouched; the human's reply steers that worker once, and its next Herdr
event resumes normal review.

Restart and failure-edge trials are also passing. If Pi stops while a steered
worker runs, resuming the same Pi session reloads the binding checkpoint,
observes only new evidence, and accepts without repeating the steer. A replaced
pane occupant fails closed, and repeated ineffective steering causes the
supervisor to ask the human instead of looping forever.

The recovery path has also been verified end to end. When an exact Codex
process stopped but its original Herdr pane remained, the supervisor resumed
that native Codex session, sent one continuation, observed its new result, and
accepted the goal. A missing pane or changed identity still fails closed. Herdr
does not emit an event when a newly started agent becomes interactive, so this
explicit recovery operation uses Herdr's bounded readiness handshake; normal
supervision remains event-driven and performs no readiness polling.

## Try it

List the workers Herdr currently knows:

```sh
node bin/herdr-supervisor.js workers
```

Start Pi with the extension in passive mode:

```sh
pi --no-builtin-tools -e /app/projects/herdr-supervisor/extension.ts --supervisor-mode observe
```

Inside Pi, use `/supervise <pane> <goal>` and `/supervised`. Use the standalone
CLI when explicit acceptance criteria are needed. Registering and stopping are
human commands, not model tools. Passive mode displays meaningful lifecycle
signals but never starts a model turn or prompts a worker.

After passive behavior is verified, use `--supervisor-mode dry-run` to let the
supervisor model review events without applying its decisions. The extension
also disables non-supervisor tools itself; `--no-builtin-tools` makes that
boundary explicit at launch. `live` is the only mode that may prompt a
registered worker.

The standalone CLI can also register a binding before Pi starts:

```sh
node bin/herdr-supervisor.js register w1:p2 \
  --goal "Fix request cancellation" \
  --accept "The focused test passes"
node bin/herdr-supervisor.js status
```

## Documents

- [Research landscape](docs/research.md)
- [Proof-of-concept design](docs/poc-design.md)

## Design rule

Herdr owns runtime truth. The supervisor owns judgment about whether a
registered worker is still moving toward its stated goal. It must not copy
Herdr's lifecycle into a parallel queue, task graph, or status database.
