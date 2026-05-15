# Heartbeat Coverage Session-Signal Adoption

## Context

Dev heartbeat found no approved work-queue item and no dev-owned unresolved metric alert. The repository already had an intentional source diff in `agents/may/handlers/metrics-snapshot.ts` changing `handler.heartbeat-coverage` from handler-completion counting to session-row counting.

## Evidence

- `agents/shared/work-queue.md` had an empty `## Approved` section.
- Active metric snapshot showed `session.error-rate-6h=0.0333` below threshold `0.3` and `handler.success-rate=0.9954` above threshold `0.8`.
- Unresolved metric alerts were owned by scout/evaluator, not dev.
- The live session-based heartbeat coverage query returned `4`, proving the query shape works against current `sessions` schema.
- Recent `metrics-snapshot` events ended in `handler.completed`, so the earlier `validateProjectFormat` import failure is recovered.
- `bun --check may/handlers/metrics-snapshot.ts` completed without syntax errors.

## Action

Committed the existing intentional source change as `41573b46d` (`may: improve heartbeat-coverage metric to count real sessions, raise target to 8`). This turns `handler.heartbeat-coverage` into a stronger signal: agents that actually start heartbeat sessions, not merely cron handler completions.

## Remaining Dirty State

Post-commit dirty files are runtime/session artifacts (`*/last-session.md`, heartbeat logs, gate outcomes). They were not staged because they are incidental generated state, not source deliverables for this heartbeat.
