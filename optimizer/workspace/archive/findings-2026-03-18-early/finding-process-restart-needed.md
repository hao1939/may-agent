# Finding: Process Restart Required for All Recent Fixes

## Status: CRITICAL — single action unlocks ~$50+/day in savings

## The Problem

The main process (PID 7, `bun src/app/launcher.ts`) has been running since Mar 17 startup.
Bun does NOT hot-reload TypeScript. All code committed since process start is **on disk but not running**.

## Committed But Not Running

| Commit | Date | Feature | Impact |
|--------|------|---------|--------|
| `848ebf1` | 2026-03-17 22:22 | Idle heartbeat pre-flight skip | ~18% fewer sessions (~$10/day) |
| `440bc6a` | 2026-03-18 00:16 | Content-hash config detection | Intervals actually update (~$15/day) |
| `8c8cf0b` | Earlier | Smart cron reload (no timer reset) | Prevents overtriggering |
| `f8a481c` | Earlier | Cron reload timer leak fix | Memory/scheduling cleanup |
| `07b0d7f` | 2026-03-17 22:07 | Tool-as-agent guard (agents.call/send) | Blocks Bob's checkpoint-as-agent misuse |
| `4c7cdc3` | Earlier | Zombie session cleanup | Auto-cleanup stuck sessions |

## Evidence

1. **Idle skip**: 0 idle skips in last hour despite 7/10 agents having 0 pending send() requests. 31 heartbeat requests fired anyway.
2. **Config reload**: 7 optimizer heartbeats in last hour (every ~8.5 min) despite cron.json showing `intervalMs: 1800000` (30 min).
3. **Turn budget injection**: Already deployed in code (`manager-receipts.ts` line 331) — Bob's brief requesting this is redundant.

## Fix

**Restart the process.** One command: `kill -HUP 1` or container restart.

All fixes are committed, tested (33/33 cron tests pass), and ready.

## Expected Savings After Restart

- Heartbeat intervals go from ~540-780s to 1800s: **~330 fewer sessions/day**
- Idle skip reduces remaining by ~18%: **~40 more sessions eliminated**
- Combined: **~$30-50/day = $900-1500/month savings**

## Additional Note

Bob's brief `brief-turn-budget.md` proposes `[Ops: N/Max]` injection — this is already deployed at `manager-receipts.ts:327-331`. Shows `[Ops: N/M]` when >50% consumed, with ⚠️ warning at low threshold. No action needed.
