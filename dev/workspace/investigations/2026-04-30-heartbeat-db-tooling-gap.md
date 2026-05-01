# Heartbeat investigation — DB metrics queries blocked by missing query_db tool (dev)

Date: 2026-04-30
Owner: dev

## Signal / trigger
Heartbeat.md instructs running SQL queries against tables like `sessions`, `events`, `metrics`, `metric_snapshots` using a `query_db` tool.

## What happened
In this runtime, the available tools for dev are: `read`, `bash`, `edit`, `write`, `finish`.
There is no `query_db` (nor `emit`) tool exposed, so I cannot safely execute the heartbeat’s SQL queries.

## Constraints
SOUL.md prohibits opening DB directly via bash/sqlite3 due to corruption risk.
Therefore I cannot inspect metrics health or recent failures as instructed.

## Impact
- Error metrics cannot be checked.
- Recent failed sessions/handler errors cannot be queried.
- Highest-impact failure pattern selection is blocked.

## Evidence
- Tool list in system instructions: only read/bash/edit/write/finish.
- DB files exist: `agents/may.db`, `agents/gym/gym.db` (found via `find`).
- Attempted filesystem check for a metrics directory failed (no `agents/shared/metrics`).

## Likely root cause
Tooling mismatch: heartbeat.md and SOUL.md assume the existence of `query_db` / `emit` tools, but dev’s toolset in this environment does not include them.

## Proposed fix
One of:
1) Expose a safe `query_db` tool to dev (preferred), or
2) Add a handler/skill that proxies read-only SQL queries through an allowed interface, or
3) Update heartbeat.md for dev to use an alternative safe mechanism available in this environment.

## Next steps
- Escalate to May/infra owner to align tool availability with documented process.
- Once query_db is available, re-run the heartbeat SQL checks and proceed with failure investigation.
