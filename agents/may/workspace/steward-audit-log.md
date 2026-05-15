# Closed-Loop Steward Audit Log

## Run: 2026-05-10

### Alert #275 — scout.sourced-artifacts-24h (P2, 31m)
- **Issue**: source_command misses workspace root .md files
- **Owner**: scout
- **Judgment**: upgrade_or_escalate (10m ago)
- **Action**: Sent P1 message to scout requesting source_command fix
- **Next signal**: scout updates metric source_command, next snapshot shows current > 0

### Alert #197 — scout.operational-friction-rate-24h (P3, 55h)  
- **Issue**: friction rate 0.57 vs 0.3 threshold
- **Owner**: scout
- **Judgment**: downgraded to P3 (54h ago)
- **Action**: No escalation — P3 with active owner
- **Next signal**: friction rate drops below 0.3

### Alert #225 — scout.good-session-rate-24h (P3, 42h)
- **Issue**: 0.62 vs 0.65 threshold (marginal)
- **Owner**: scout  
- **Judgment**: resolve_stale (47h ago), still breaching
- **Action**: No escalation — P3, marginal breach
- **Next signal**: rate exceeds 0.65

### Alert #273 — project.iterations-24h (P3, 19h)
- **Issue**: 0 iterations vs threshold 1
- **Owner**: may
- **Judgment**: calibrate_metric (70h ago)
- **Action**: No escalation — P3 with active owner
- **Next signal**: iteration count > 0

### Delivery Failures: none
