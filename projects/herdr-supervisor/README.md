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

The first proof of concept will use Pi as the supervisor because the existing
[Pi Bellwether](https://github.com/joelhooks/pi-bellwether) package already
provides direct, event-driven Herdr watches and wakeups. Workers remain ordinary
Herdr agents and may use Codex, Claude Code, Pi, OpenCode, or another supported
CLI.

## Current status

Design only. No runtime, dependency, or live Herdr configuration has been
added yet.

## Documents

- [Research landscape](docs/research.md)
- [Proof-of-concept design](docs/poc-design.md)

## Design rule

Herdr owns runtime truth. The supervisor owns judgment about whether a
registered worker is still moving toward its stated goal. It must not copy
Herdr's lifecycle into a parallel queue, task graph, or status database.
