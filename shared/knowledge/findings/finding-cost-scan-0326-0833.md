# Cost Outlier Scan — 2026-03-26T08:33Z

**Window**: Since last scan (~3.5h, 05:03-08:33 UTC)
**Method**: Checkpoint data + tool quality report + request DB (no direct session DB access)

## Findings

### 1. DB Access Limitation
Neither `sqlite3` CLI nor `bun` runtime is available in the current environment. The session DB (may.db) uses `bun:sqlite`/`node:sqlite` which aren't accessible from Node 18. This means:
- **Cannot query session-level cost data** (totalOps, durationMs per session)
- **Cannot identify individual outlier sessions** by ops count
- Cost scans are limited to proxy data: checkpoints, tool quality report, request counts

**Impact**: Cost outlier scan is partially blind. The handler-generated tool-quality-report.md (every 4h) is the only automated cost signal available without DB access.

### 2. Available Cost Signals (05:00-08:33 UTC)
- **Tool quality report** (05:07 UTC): 4069 calls, 191 wasted (4.7% waste rate) — 24h window
- **Optimizer sessions with checkpoint data**: 
  - s_389 (07:33): 26 ops — under 35-op budget ✓
  - s_383 (06:33): 20 ops — under 35-op budget ✓
  - s_382 (06:33): separate session (bob delegation), ops unknown
- **5 optimizer sessions** checkpointed since 05:00 UTC, consistent with ~1.4 sessions/hr
- **35-op budget is working**: both measured sessions are well under limit

### 3. Stale Request Pollution (Unchanged)
- 68 active requests, ~50 are stale echo/testing artifacts (ages 1340-1680 min)
- These pollute every `requests(filter:active)` query
- Previously documented in `finding-stale-requests-0326-0311.md`
- **No action taken yet** — handler proposal exists but needs process restart

### 4. Waste Rate Trend
- 3.8% → 4.1% → 4.4% → 4.7% (trending up over ~12h)
- Primary driver: bash:empty-args regression (+75%, 8→14)
- Secondary: read:empty-args regression (+600%, 1→7)  
- All fixes blocked on process restart (PID 52 running stale binary)

## Recommendations

1. **HIGH**: Process restart to activate accumulated fixes (isToolError, tool guards, empty-args guards)
2. **MEDIUM**: Request cleanup — ask May to batch-cancel stale echo/testing requests
3. **LOW**: Consider adding `sqlite3` or `better-sqlite3` as a dev dependency for ad-hoc queries

## No Outliers Detected
No evidence of sessions exceeding normal cost bounds in available data. System appears stable.
