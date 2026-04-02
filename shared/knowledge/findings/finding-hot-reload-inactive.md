# Finding: Hot-Reload Fix Not Active — Process Restart Required

**Date:** 2026-03-17T18:52
**Priority:** HIGH
**Status:** Needs server restart

## Problem

The opBudget hot-reload fix (commit `86f07c1`, merged 18:23:56 UTC) is deployed to disk
but **not active in the running process**. The process started at 14:09:16 UTC and Bun
caches module imports — the new `manager.ts` code has never been loaded.

## Evidence

### Post-fix budget errors still use OLD limits:
| Agent | Error Limit | agent.json Budget | Gap |
|-------|------------|-------------------|-----|
| optimizer | 30 | 40 | +10 missing |
| scout | 20 | 25 | +5 missing |
| tech-lead | 60 | 70 | +10 missing |
| coach | 40 | 50 | +10 missing |

### Impact (last 100 sessions):
- 13/15 errors (87%) are OpBudget exhaustion
- All 13 at OLD budget limits, none at new limits
- 15% overall error rate, would drop to ~2% with correct budgets
- ~13 wasted sessions × ~$0.50 avg = **~$6.50 wasted today from this bug alone**

## Root Cause

`bun src/app/launcher.ts` does NOT use `--hot` or `--watch`. Module imports are cached
for the process lifetime. The fix in `src/lib/manager.ts` uses `readFileSync` to read
`agent.json` at each `run()` call — but the code containing that `readFileSync` call
was never loaded by the running process.

## Fix Required

**Restart the server process.** This will:
1. Load the new `manager.ts` with the hot-reload code
2. Immediately pick up all agent.json budget changes
3. Prevent this class of bug from recurring (future agent.json changes auto-apply)

Command: `npm run restart` or `docker exec <container> restart-may.sh`

## Post-Restart Verification

After restart, first optimizer/coach/scout session should show new limits:
- optimizer: LIMIT=40 (not 30)
- coach: LIMIT=50 (not 40)
- scout: LIMIT=25 (not 20)
