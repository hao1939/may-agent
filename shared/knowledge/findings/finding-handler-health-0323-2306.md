# Handler Health Check — 2026-03-23T23:06

## Summary

Binary `may-agent-97a3754` (built Mar 20 05:17, running since Mar 23 09:32 UTC) is 3.7 days old. **Critical cascade failure: sessions table empty → evaluate-sessions starved → convention-check starved → tool-quality-scan no data.**

## Binary Status
- **Version**: `may-agent-97a3754` (commit Mar 20 03:34)
- **Running since**: 2026-03-23T09:32 UTC (~13.5h uptime)
- **Code drift**: 10 handler files modified since binary build. Key commit `1223990` (Mar 23) rewrites handler imports to use `ctx.getDb()` — NOT live yet.

## Handler Status

### ✅ Working (produced output since last restart)
| Handler | Last Output | Evidence |
|---|---|---|
| workspace-compaction | Mar 23 09:06 | compaction-report.md |
| lessons-graduation | Mar 23 09:06 | graduation-report.md |
| memory-trimmer | Mar 23 09:06 | memory-trimmer-report.md |
| active-nudge | Mar 23 09:08 | nudge-active.md |
| watchdog | Unknown | No output files (silent when no stuck sessions) |

### ⚠️ Partially Working
| Handler | Status | Evidence |
|---|---|---|
| evaluate-sessions | Ran once at startup, wrote 14 "skipped" evals | 0 real evaluations since Mar 23. Uses `loadAllSessionMetas` but only finds already-evaluated sessions. |
| agents-auto-commit | Unknown | No git commits from it today. May be working (nothing to commit). |

### ❌ Dead (no output since restart)
| Handler | Root Cause | Impact |
|---|---|---|
| convention-check | Depends on evaluations → starved | 0 convention checks since Mar 23 |
| tool-quality-scan | Depends on evaluations → starved | No tool-quality-report.md generated |
| heartbeat-context | Unknown — no output dir `.state/heartbeat-context/` exists | No pre-computed context for heartbeats |
| system-status | Unknown — no output file | No automated health monitoring |
| daily-brief | Unknown — no output file | No daily metrics summary |
| coaching-report | Unknown — no output file | No coaching quality tracking |
| tracker-compact | Unknown — no output file | No common-sense tracker compaction |
| repo-gate-check | Unknown — no output in QA workspace | No automated test gating |
| focus-task-tracker | Unknown — no output file | No focus task tracking |

## Root Cause Analysis

### Cascade: sessions table → evaluations → convention checks
1. The `sessions` table was added in commit `bb3e86b` (Mar 23 16:56 +0800 = 08:56 UTC) — **after** the running binary was built
2. The binary from Mar 20 creates the table schema via migration but has NO code to populate it
3. `loadAllSessionMetas()` in the binary reads from disk (meta.json files), not the sessions table
4. Evaluate-sessions found 14 sessions to skip at startup but hasn't found new sessions since
5. Convention-check and tool-quality-scan depend on evaluated sessions → starved

### Handler import breakage
Commit `1223990` (Mar 23) rewrites 8 handlers to use `ctx.getDb()` instead of direct `import getDb from src/lib/requests.js`. The current binary has the OLD import style baked in. But handlers that DON'T import from src/lib (like workspace-compaction, memory-trimmer, active-nudge) still work.

## Quantified Impact
- **0 evaluations/day** (was ~100-200/day before): No quality signal on sessions
- **0 convention checks/day**: No mechanical compliance tracking
- **0 tool-quality reports**: Optimizer has no automated tool-quality data
- **0 coaching reports**: Coach has no quality trend data
- **0 system-status checks**: No automated anomaly detection (was detecting tsc failures, unevaluated backlog)

## Fix Required
**Binary rebuild** — run `bun run bundle` to compile all handler changes into a new binary. This is the same blocker identified in previous health checks (Mar 22). The `1223990` commit specifically addresses the handler import issue.

The migration script `scripts/migrate-sessions-to-db.ts` should also be run to backfill the sessions table.

## Previous Finding
Previous check (2026-03-22T03:09): Identified 3 dead handlers (convention-check, tool-quality-scan, heartbeat-context). Root cause same: binary too old. Now **10+ handlers** affected due to code drift accumulation.
