# Evaluator heartbeat — 2026-05-02

## Checks

### Session evaluation pipeline liveness

**DB (canonical)**
- `evaluations`: `max(createdAt)=1777702594254`, `count=2376`
- `sessions`: `max(startedAt)=1777704610373`, `count=8149`

Interpretation: evaluation pipeline is producing fresh rows in `evaluations` close in time to current session activity.

**Filesystem (legacy artifacts)**
- `.state/evaluations/` newest `task_tree_*.json` mtimes appear stuck around **2026-03-24**.

Interpretation: this supports the known “legacy-output-path drift” hypothesis: DB is up to date; `.state/evaluations/` is no longer the active sink (or the writer path changed).

### Tooling note
- `rg` is not available in this environment; use `grep` instead.
