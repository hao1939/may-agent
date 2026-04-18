# Cron Overtrigger Analysis — Tech Lead Response

**Date**: 2026-03-17
**Responding to**: Optimizer session waste analysis
**Fix committed**: `8c8cf0b`

## Root Cause

`Cron.reload()` performed a full `stop()` + `start()` cycle, destroying ALL running timers and recreating them. When any agent used the `cron` tool to modify `cron.json`, every entry's `setInterval` was cleared and a new one created via `computeResumeDelay()`.

For entries that had fired recently (or were triggered via `triggerNow`), `computeResumeDelay()` computed `elapsed >= intervalMs → delay=0`, causing immediate re-fire. This explains:

- May's heartbeat (30min config) firing every ~10min
- "Double tap" patterns where a fire was followed by another 1-3min later
- 72 fires/24h vs expected 48

## Additional Finding: Send-Triggered Fires

`agents.send()` calls `triggerHeartbeat()` which calls `triggerNow()` on the target agent's heartbeat. This has a 75% interval cooldown (22.5min for May) but still adds extra fires when sends come at the right timing.

The 15 "rapid fires" (gap < 5min) in 24h correlate with `agents.send()` calls from bob/optimizer.

## Fix Applied

**Smart reload** (`8c8cf0b`): `reload()` now diffs old vs new config and only restarts entries whose config actually changed. Unchanged entries keep their existing timers.

Also already committed by May: **Idle heartbeat pre-flight skip** (`848ebf1`) — skips heartbeats when no pending `send()` requests exist (with initiative cadence to still allow proactive work).

## Expected Impact

- May heartbeat: 72/day → ~48/day (33% reduction)
- With idle skip: further ~18% reduction on low-activity periods
- Bob/optimizer rapid-fire double taps: eliminated for unchanged configs
- Total session reduction: ~30-40%

## Optimizer's Claim Accuracy

- "2-12x overtriggering" — **partially confirmed**. May was at 1.5x, not 8.5x. Other agents were within normal range.
- "Root cause: setInterval drift" — **incorrect**. Root cause was `reload()` timer reset, not drift.
- "~18% waste from low-value sessions" — **plausible**, now addressed by idle skip.
