# Heartbeat Notes

## 2026-04-25: handler-health metric

- **Issue**: `system.handler-health` metric reads 0 for 7+ heartbeats
- **Root cause**: SQL query uses `artifact IN (SELECT sessionId FROM sessions WHERE agent IN ('handler'))` but no agent named 'handler' exists
- **Actual health**: 30/32 COMPLETED = 93.75%
- **2 failures**: heartbeat-amy-kimi timeout, optimize handler timeout (both 300s)
- **Action**: Notified optimizer (P1) to fix metric query definition
