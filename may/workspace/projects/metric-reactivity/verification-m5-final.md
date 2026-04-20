# Metric Reactivity — Final Verification (Iteration 5)

## Root Cause Analysis

**Problem**: `autoForkForAlert()` in `metrics-snapshot.ts` creates `trackRequest()` entries but `ctx.manager.run()` never successfully creates sessions.

**Evidence**:
- **0 sessions** with `source=metric-alert` in the sessions table
- **72 requests** from `fromEntity=metrics-snapshot` exist, but **36 stuck in CREATED status** forever
- **352 sessions** with `source=cron` exist (from `run-agent-task.ts`), proving `ctx.manager.run()` works in principle
- The CLI fallback referenced `agents/scripts/run-agent.mjs` which **does not exist**
- The handler code was last modified at 11:19 UTC today but hasn't run since (last run ~18h before modification)

**Two bugs found**:
1. **Stale dedup**: The dedup check `WHERE status = 'CREATED' AND task LIKE ?` matches requests from days ago, permanently blocking new forks for the same metric
2. **Broken CLI fallback**: References non-existent `run-agent.mjs`

## Fixes Applied

### 1. Dedup expiry (24h window)
Both dedup checks (in `autoForkForAlert` and backfill) now include `AND createdAt > ?` with a 24h window. Stale CREATED requests no longer block new fork attempts.

### 2. File-based fallback instead of broken CLI
Replaced the `execSync` CLI fallback with a file-based trigger: writes alert JSON to `agents/may/workspace/pending-metric-alerts/`. May's heartbeat can pick these up and fork via the `agents` tool (which is the proven working fork mechanism — 921 sessions with `source=agents.fork`).

### 3. QA alert routed through tech-lead
The only currently unresolved alert (`qa.review-coverage`) was dispatched to tech-lead since `qa` cannot be forked directly. Session: `s_1776684478802_295`.

## Current State

| Item | Status |
|------|--------|
| `ctx.manager.run()` primary path | Kept — may work now that handler has been updated |
| Dedup blocking | **Fixed** — 24h expiry window |
| CLI fallback | **Fixed** — replaced with file-based trigger |
| qa.review-coverage alert | **Dispatched** to tech-lead |
| 36 stale CREATED requests | Will be bypassed by new dedup logic |

## Remaining Risk
- `ctx.manager.run()` may still fail for the same reason it failed before (unknown — no error logs captured since handler hasn't run with new code)
- If it does fail, the file-based fallback provides a recovery path
- The handler needs to run once to validate the fix end-to-end
