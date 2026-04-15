# Handler Health Check — 2026-03-20T05:19

## Summary

**17 errors / 274 sessions = 6.2% error rate (24h)**. In the last 6h: 5/60 = 8.3%. Error rate UP from 2.1% (previous check, 2026-03-19T21:19). Predominantly API/streaming errors (not handler bugs).

## Binary Deployment Gap

Running binary: `may-agent-96dcb60` (built Mar 19 15:14)
HEAD: `97a3754` (14 commits ahead)
Binary `97a3754` EXISTS at `/app/bundle/may-agent-97a3754` (built Mar 20 05:17) but is NOT running.

### Critical undeployed features (in 96dcb60→97a3754):
1. **Guard wiring** (94fbc27) — finish-guard, read-dedup-guard, session-read-guard, scrape-dedup-guard are all coded but NOT active. The running binary doesn't wire them into tool execution. Est. savings: $20-30/day from read-dedup and session-read guards alone.
2. **Manager-retry Pattern 4b** (97a3754) — "tool_use_missing" retry for streaming truncation. 9 of 17 errors are this exact pattern. The fix EXISTS but isn't running. These 9 errors wasted ~$10-20.
3. **Dynamic agent tool loading** (38bfd1b) — agents/<name>/tools/ not loaded in running binary.
4. **Scrape dedup guard** (486932b) — cap scrape maxLength to 30K. Not active.

### No handler file changes between versions
The handler TypeScript files in `agents/may/handlers/` are identical between 96dcb60 and 97a3754. All changes are in core runtime (`src/`).

## Error Breakdown (24h)

| Error Type | Count | Notes |
|---|---|---|
| streaming truncation (tool_use_missing) | 9 | **Pattern 4b fix exists but not deployed** |
| Empty model response (0 tokens) | 3 | Gemini API issue, not our bug |
| OpBudgetExceeded (Limit 5) | 2 | Evaluator — working as designed |
| Gemini MidStreamFallback | 2 | Bob (Gemini model) — upstream |
| JSON Parse error | 2 | Truncated streaming responses |
| "Cannot continue from message role: assistant" | 2 | Message format issue |
| Auth error (401 — token expired) | 1 | Github copilot token rotation |
| ENOENT (file not found) | 1 | May/tech-lead — likely transient |
| Shallow heartbeat (0 tool calls) | 1 | Amy-Kimi — behavioral, not infra |

## Handler Status

| Handler | Status | Notes |
|---|---|---|
| watchdog | ✅ Running | 10min interval, no errors observed |
| evaluate-sessions | ✅ Running | 30min, SQLite-based |
| convention-check | ✅ Fixed | Now queries SQLite `evaluations` table (was broken reading empty JSON dir) |
| system-status | ✅ Running | 4h interval |
| daily-brief | ✅ Running | 24h |
| coaching-report | ✅ Running | 24h |
| agents-auto-commit | ✅ Running | 2h |
| lessons-graduation | ✅ Running | 24h |
| error-log-scanner | ✅ Running | 4h |
| audit-requests | ⚠️ Orphaned | 2h interval, functionality unclear |
| workspace-compaction | ✅ Running | 24h |
| memory-trimmer | ✅ Running | 24h |
| run-agent-task | ✅ Running | Multiple cron entries use this |

## Session Volume (6h)

| Agent | Sessions | Notes |
|---|---|---|
| coach | 15 | 2.5/hr — high for 1h heartbeat. Multiple cron tasks. |
| optimizer | 9 | Expected (30min + workflows) |
| bob | 8 | Expected (30min) |
| tech-lead | 6 | Expected (30min) |
| may | 6 | Expected (30min) |
| amy-kimi | 6 | Expected (30min) |
| qa | 5 | Expected (30min) |
| scout | 3 | Expected (30min + skipIfIdle) |
| evaluator | 2 | Expected (2h) |

## Recommendations

1. **CRITICAL: Restart with `may-agent-97a3754`** — 14 undeployed commits including the streaming retry fix that would prevent 9/17 errors. The binary is built and ready.
2. **Coach session volume** — 15 sessions/6h despite 1h heartbeat interval. The extra sessions come from run-agent-task crons (common-sense-verify, training-sprint, research-intake). Consider if all 3 need to be active.
3. **Monitor error rate post-restart** — If Pattern 4b fix works, error rate should drop from 6.2% to ~3%.
