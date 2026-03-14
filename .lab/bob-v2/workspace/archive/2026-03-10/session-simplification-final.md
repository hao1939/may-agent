# Session Model Simplification: Final Design

## 1. Manager (src/manager.ts)

- **Input**: Constructor takes `interfaceAgent: string`.
- **Run**: `persistent: (name === this.interfaceAgent)`.
- **Completion**: Only interface agent enters `idle`. Others archive.
- **FollowUp**: Throws for ephemeral sessions.

## 2. Cron (run/cron.ts)

- **Heartbeat**: Spawns fresh session (`manager.run`).
- **Backpressure**: Checks `heartbeatRunning` set.
- **Legacy**: `detached: true` handled via `spawnDetached`.

## 3. Tool (src/tools.ts)

- **List**: Shows ephemeral sessions.
- **Cancel**: Aborts ephemeral session.
- **FollowUp**: Blocked for ephemeral.

## 4. Impact

- **Positive**: No zombie processes. Explicit context.
- **Negative**: Re-read overhead (minimal with caching).
- **Migration**: Phased rollout (Cron first, Manager second).

## 5. Next Steps

1.  Add `interfaceAgent` to `SubagentManager` constructor.
2.  Update `run/may.ts` and `run/cli-agents.ts` to pass it.
3.  Refactor `manager.run` to enforce persistence rule.
4.  Remove `idle` logic for non-interface agents.
