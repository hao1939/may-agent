# Iteration 7: Added 6 new v2 spec claim measurements

## Changes to `agents/may/handlers/metrics-snapshot.ts`

### New metric definitions added (ALL_METRICS array):
- `infra.bus.event-count-1h` — I1: event bus activity
- `infra.persist.db-size-mb` — I2: database file size
- `infra.messages.delivery-rate` — I3: message delivery success rate
- `infra.sessions.active-count` — I4: active session count
- `v2.runagent-callsite-conformance` — S1: callsite conformance (grep-based)
- `v2.heartbeat-decision-rate` — S7: heartbeat handler coverage across agents

### New measurement code added (before coverage-rate computation):
- **I1**: `SELECT COUNT(*) FROM events WHERE timestamp > now-1h`
- **I2**: `statSync(.state/may.db).size` converted to MB
- **I3**: Ratio of delivered vs total notification_messages
- **I4**: `SELECT COUNT(*) FROM sessions WHERE status = 'running'`
- **S1**: Grep for runAgent/runSession callsites vs direct DB imports in src/
- **S7**: Ratio of agent.json configs that have heartbeat handlers

## Expected coverage improvement
- Previous: 6/22 claims measured = 0.2727
- Added: 6 new claims (I1, I2, I3, I4, S1, S7)
- Expected: 12/22 = **0.5455**

## Test results
- All 40 heartbeat-data tests pass
- File compiles cleanly with `bun build --no-bundle`
