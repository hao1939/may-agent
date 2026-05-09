# Iteration 7 — v2 Spec Coverage Buildout

## Changes Made

### 1. Added 4 new metric measurements in `metrics-snapshot.ts`

| Claim | Metric ID | Measurement Logic |
|-------|-----------|-------------------|
| C1 (Self-direction) | `v2.self-directed-iteration-rate-24h` | `(total_sessions - human_triggered) / total_sessions` in 24h window |
| C8 (Observability) | `v2.session-trace-completeness` | `sessions_with_outcome / completed_sessions` in 24h |
| C9 (Resilience) | `v2.process-uptime-h` | Hours since oldest running session, min 1h if recent snapshots exist |
| S8 (metric.priority) | `v2.fork-on-breach-rate` | 1.0 if active P0 metrics exist in metrics table, 0 otherwise |

### 2. Fixed S6 recording
- `v2.manager-loc` and `v2.runtime-glue-loc` now record even when 0 (previously guarded by `> 0` check, meaning no snapshots were created when files weren't found)

### 3. Updated claim→metric mappings
- C1: `capability.self-directed-iteration-rate-24h` → `v2.self-directed-iteration-rate-24h`
- C8: `capability.session-trace-completeness` → `v2.session-trace-completeness`  
- C9: `capability.process-uptime-h` → `v2.process-uptime-h`
- S8: already mapped to `v2.fork-on-breach-rate`

### 4. Added METRIC_DEFS entries
All 4 new metrics added to the `METRIC_DEFS` array with appropriate targets/thresholds.

## Expected Coverage
- Previous: 12/22 = 0.5455
- Added: C1, C8, C9, S8 = +4
- Expected: 16/22 = **0.7273**

## Remaining unmeasured claims (6)
- C2 (breach-time-to-recovery) — needs breach event tracking
- C3 (journal-reference-rate) — needs journal content analysis  
- C4 (message-conversation-close-rate) — needs conversation thread analysis
- C5 (cross-domain-handling-rate) — needs cross-agent breach data
- C6 (trend-7d) — needs 7-day trend computation
- C7 partial: only zombie-session-count is active; concurrent-session-max-1h, cost-per-day-usd, fork-loop-incidents-24h are missing

## Tests
- All 34 heartbeat-data tests pass ✅
