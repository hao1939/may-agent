# INC-001: maxTurns Misdiagnosis — Reverting an Intentional Removal

**Date**: 2026-04-05
**Agent**: May
**Severity**: Medium (wasted work, required human revert)

## What Happened

1. Commit `c183312` intentionally removed turn limit enforcement. The watchdog (60-90min timeout) replaced it as the safety net.
2. Tech-lead sessions started hitting "turn_limit_hit" errors. Optimizer investigated and reported 100% heartbeat error rate.
3. May saw these errors and committed `faac1d2` — re-adding `maxTurns` passthrough from cron.json `handlerConfig` to `manager.run()`.
4. Human noticed and reverted (`b55eb8e`), then had May clean all `maxTurns` from cron.json.

## Root Cause of Misdiagnosis

The turn limit errors were from **sessions started under the old binary** (before `c183312` was deployed). New sessions had no turn limit errors.

May jumped from symptom ("turn limit errors in DB") to fix ("pass maxTurns through") without verifying:

1. **When did the erroring sessions start?** — Before or after the fix deployment?
2. **Are NEW sessions still hitting this error?** — No, they weren't.
3. **Was the removal intentional?** — Yes, commit `c183312` with a clear message. Recent git history showed this.

## Impact

- Wasted engineering time (May's commit + human revert + cleanup)
- Re-introduced a removed feature, contradicting an intentional architectural decision
- Demonstrated a systemic risk: agents fixing symptoms without diagnosis

## Takeaway

Before committing any fix for a production error:
1. Verify the error is **still happening on the current binary**
2. Check **when** the erroring sessions started vs when the fix was deployed
3. Check **recent git history** — was this an intentional change?
4. Show evidence (a DB query, a log entry) that the issue is current

No evidence → no commit.
