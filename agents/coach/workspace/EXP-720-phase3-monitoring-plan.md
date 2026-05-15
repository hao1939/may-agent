# EXP-720 Phase 3: Monitoring Plan — Few-Shot Dry-Run Data Collection

**Date**: 2026-05-03
**Status**: AWAITING DATA — dry-run deployed, zero log entries yet

## Current State

EXP-720 dry-run logging was deployed to `master-worker.ts:458-472` in commit `ae73929d9` (2026-05-03). The code:
1. Imports `selectExamples` from `fewshot-inject-helpers.js` (TS file exists, Bun resolves .js→.ts)
2. Runs pattern matching on orchestrator `guidance` text
3. Logs matches to `agents/shared/exp720-fewshot-dryrun.log`
4. Wrapped in try/catch — silent failure if anything goes wrong

## Problem: Zero Data Collected

As of 2026-05-03T16:15Z, `exp720-fewshot-dryrun.log` does not exist. Possible causes:

1. **No worker sessions since deployment** — deployment was same-day, few hours ago
2. **Import fails silently** — dynamic `import("./fewshot-inject-helpers.js")` may fail if Bun doesn't resolve .js→.ts for dynamic imports (different from static imports)
3. **No pattern matches** — all orchestrator guidance may lack debug/error vocabulary
4. **File write path issue** — `appendFileSync` uses relative path, may write to wrong directory

## Diagnostic Steps (Next Heartbeat)

1. Check if `agents/shared/exp720-fewshot-dryrun.log` exists
2. If not, test the import path manually:
   ```bash
   cd /app/agents/shared/workflows && bun -e "const { selectExamples } = await import('./fewshot-inject-helpers.js'); console.log(selectExamples('fix a bug in the error handler'))"
   ```
3. If import fails, fix: change `.js` → `.ts` in the dynamic import, OR add a static import at top of master-worker.ts

## Decision Gate (When Data Available)

Once ≥50 log entries collected:
- **Match rate ≥15% with FP rate <30%** → Phase 3: actual few-shot injection
- **Match rate <15%** → Broaden patterns or close experiment
- **FP rate ≥30%** → Tighten patterns per Phase 1 recommendations

## Connection to Inbox Notification

The EXP-705/710 notification confirmed: "workflows are dynamically loaded — TS changes take effect without binary rebuild." This means:
- EXP-720 dry-run code IS active in production
- If no log exists, the issue is #2 (import resolution) or #3 (no matches), not deployment

## Timeline

- **Deployed**: 2026-05-03
- **Check #1**: Next heartbeat (verify log exists or diagnose import)
- **Expected data**: 50+ entries within 1-2 days of active worker sessions
- **Decision**: Once data collected, ≤1 heartbeat to analyze and decide
