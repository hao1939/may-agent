# May Heartbeat Evidence — 2026-01-06

## System Snapshot (6h window)
| Agent | Sessions | Avg Ops | Errors |
|-------|----------|---------|--------|
| evaluator | 249 | 7 | 30 (12%) |
| master | 3 | 0 | 2 |
| may | 138 | 5 | 1 |
| arc | 21 | 11 | 0 |
| dev | 26 | 13 | 0 |
| scout | 47 | 5 | 0 |

**Missing agents (0 sessions in 6h):** bob, coach, optimizer, qa, tech-lead
- bob: last session ~78h ago
- coach: last session ~49h ago  
- optimizer: last session ~78h ago
- qa: last session ~220h ago
- tech-lead: last session ~33h ago

## Key Findings

### 1. Evaluator error rate at 12%
30 errors out of 249 sessions. Error messages are null (no error text captured). This is the highest error count of any agent. Not currently breaching session.error-rate-6h (0.0735 < 0.1) because evaluator volume is diluted across all agents, but evaluator-specific rate is 12%.

### 2. v2-spec-coverage nearly complete
Metric at 0.9091 (20/22 claims). Updated project to reflect current state (was stale at 0.7727). Only 2 claims remain — likely Phase 4 calibration items (C3, C4, or C6).

### 3. Five agents dormant
bob, coach, optimizer, qa, tech-lead have had no sessions in 6h+. This may be expected if they're not on active cron schedules, but worth monitoring.

### 4. Aftermath review requests accumulating
7+ P1 review-request messages in inbox, all from evaluator aftermath reviews. These are informational — no action required unless patterns repeat.

## Actions Taken
- Updated v2-spec-coverage-buildout project: iteration 9→10, current state reflects 0.9091 coverage
