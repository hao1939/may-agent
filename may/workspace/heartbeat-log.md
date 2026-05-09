# May Heartbeat Log

## 2026-05-09T17:25 UTC — Steward Audit

### System Health Summary
- **Active sessions**: 2 (healthy)
- **Handler success rate**: 99.6% (excellent)
- **Session error rate**: 3.96% (within target)
- **Real output (24h)**: 1,036 (strong)
- **DB size**: 1,113 MB (monitor — 2GB threshold)

### Metrics Requiring Attention
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Active project iterations (24h) | 0 | 1 | ⚠️ Below threshold |
| Scout good session rate | 24.8% | 65% | ⚠️ Critical |
| Scout operational friction | 83.8% | 30% | ⚠️ Critical |

### Key Observations
- 160 sessions listed as "active" but most are stale/interrupted from days ago
- Scout metrics are the primary area of concern
- All health checks passing (zombies, stale sessions, delivery all PASS)
- Evaluator pipeline healthy: 23 LLM-evaluated sessions in 24h, 0.88h eval lag

## 2026-05-09T17:28 UTC — Heartbeat (artifact-gate triggered)

### 6h Session Volume / Error Snapshot
| Agent | Sessions (6h) | Errors | Err % |
|-------|---------------|--------|-------|
| evaluator | 7848 | 79 | 1.0% |
| optimizer | 2737 | 9 | 0.3% |
| coach | 2021 | 8 | 0.4% |
| may | 1331 | 40 | 3.0% |
| amy | 1147 | 10 | 0.9% |
| scout | 526 | 12 | 2.3% |
| **dev** | **403** | **68** | **16.9% ⚠️** |
| arc | 357 | 8 | 2.2% |
| bob | 332 | 1 | 0.3% |
| tech-lead | 318 | 4 | 1.3% |
| master | 5 | 4 | 80% (low N) |

### New Signal Worth Investigating
- **dev error rate ~17%** (68/403) over last 6h — substantially above other high-volume
  agents. Likely tied to the open `empty-assistant-stop-runtime-retry` blocker noted in
  the prior heartbeat. Recommend scout sample 3–5 dev error sessions to confirm.
- May error rate (3.0%) is ~double org average; worth one targeted glance next heartbeat.
- Master 4/5 errors is low-N noise; flag only if persists.

### Actions Taken
- No nudges issued (read-only heartbeat under artifact gate). Findings recorded for the
  next heartbeat to act on.

### Next Heartbeat Should
1. Confirm dev error spike correlates with `empty-assistant-stop-runtime-retry`; if yes,
   bump priority and ping owner.
2. Check `eval-llm-lane-restoration` review status (>24h ⇒ ping).
3. Re-sample evaluator-low-quality-rate-calibration project for movement.

