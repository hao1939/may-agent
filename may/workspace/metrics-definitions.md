# May's Metrics — Definitions

Last refined: 2026-04-18 (agents/may/scripts/refine-metrics-2026-04-18.ts)

| metric | fate | target | threshold | direction | unit | how measured |
|---|---|---|---|---|---|---|
| `system.request-throughput` | keep (fixed) | 500 | 100 | higher-is-better (alert below) | count/day | `SELECT COUNT(*) FROM requests WHERE status='COMPLETED' AND completedAt > now-24h` |
| `system.stuck-requests` | keep (fixed) | 0 | 20 | lower-is-better (alert above) | count | `SELECT COUNT(*) FROM requests WHERE status IN ('CREATED','IN_PROGRESS') AND createdAt < now-2h` |
| `system.agent-utilization` | keep | 10 | — (continuous) | higher-is-better | count | `SELECT COUNT(DISTINCT agent) FROM sessions WHERE startedAt > now-6h` |
| `workflow.premature-done` | keep (fixed) | 0 | 3 | lower-is-better (alert above) | count | shell scan of `agents/*/workspace/projects/*.md` for Status=done + unchecked milestones |

## What changed this pass

1. **request-throughput + stuck-requests**: source_queries used lowercase status values
   (`'completed'`, `'pending'`), but the `requests` table stores UPPERCASE (`'COMPLETED'`,
   `'CREATED'`, `'IN_PROGRESS'`). Both queries were returning 0 regardless of reality.
   After fix, real values surfaced: 1679 req/day throughput, **75 stuck requests** (RED).
2. **stuck-requests** `alert_direction`: was `below` (nonsense for a "lower-is-better" count).
   Now `above`, with threshold 20.
3. **agent-utilization**: target was 0; set to 10 (≈ count of active agents). Unit=count.
4. **premature-done**: unit was `ratio` but collector emits a count (`wc -l`). Fixed to
   `unit=count`, threshold=3 (was 0.1 which made no sense for a count).

## Current readings (post-fix)

| metric | current | target | status |
|---|---|---|---|
| request-throughput | 1679 | 500 | 🟢 healthy |
| stuck-requests | 75 | 0 (th 20) | 🔴 **RED — real backlog** |
| agent-utilization | 9 | 10 | 🟢 (within 1 of target) |
| premature-done | 11 | 0 (th 3) | 🔴 RED |

## Follow-ups (NOT dispatched — per Hao's "no parallel dispatch" rule)

- **Stuck requests (75)**: real problem that was hidden by the buggy query for ~weeks. Next
  heartbeat should investigate whether these are zombie CREATED rows (stale human/cron
  requests never picked up) vs genuine IN_PROGRESS stalls, then consider an audit-requests
  pass. Flag to Hao.
- **Premature-done (11)**: bob has been doing metric-alert-driven project sweeps; let
  existing loop handle it unless count keeps climbing.
