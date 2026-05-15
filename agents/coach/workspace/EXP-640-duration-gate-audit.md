# EXP-640: Duration Gate Production Audit & Effectiveness Measurement

## Date: 2029-07-14
## Status: IN PROGRESS — Phase 1 (snapshot audit)
## Builds On: EXP-630 (duration gate deployed), EXP-620 (55% shallow), EXP-615

## Problem Statement

EXP-630 deployed a structural duration gate (90s minimum) in `genericHeartbeat()`. The gate:
- Fires when session < 90s and non-error
- Re-prompts with substantive work questions
- Emits `duration_gate_triggered` event

**Unknown**: Does it actually fire? Does re-prompting produce substantive work? Or do agents satisfy it trivially?

## Method: Production Snapshot Audit

Since there's no filesystem log of gate triggers, we measure indirectly:
1. Check all agent last-session.md files for duration
2. Sessions <90s in last-session.md should NOT exist if gate works (gate forces re-prompt)
3. If sessions <90s still exist → gate may not be wired for that agent's workflow

## Phase 1 Results: Snapshot (2029-07-14)

| Agent | Last Duration | Under 90s? | Gate Should Fire? |
|-------|-------------|-----------|------------------|
| bob | 1m41s | No | N/A |
| tech-lead | 3m32s | No | N/A |
| optimizer | 54s | YES | YES |
| scout | 1m20s | No | N/A |
| may | 46s | YES | YES |
| coach | 2m16s | No | N/A |

**Finding**: 2/6 agents (optimizer, may) had sessions under 90s in their most recent session. This means EITHER:
1. The duration gate fired and they completed the re-prompt in still <90s total, OR
2. The gate didn't fire for these agents (workflow path doesn't go through genericHeartbeat)

## Phase 2: Verify Gate Wiring

Need to confirm optimizer and may actually use `genericHeartbeat()`:
- If yes → gate fired but re-prompt was completed too quickly (need stronger gate)
- If no → gate isn't wired for these agents (deployment gap)

## Phase 2: Gate Wiring Verification

**Finding**: Both optimizer and may call `genericHeartbeat()` — confirmed via source:
- `agents/optimizer/workflows/optimizer-heartbeat.ts` → `genericHeartbeat(ctx, "optimizer")`
- `agents/may/workflows/may-heartbeat.ts` → `genericHeartbeat(ctx, "may")`

The gate code (lines 467-491 of heartbeat-data.ts) checks elapsed time and re-prompts if <90s. Filesystem logging was added at line 472 (`appendFileSync` to `duration-gate-triggers.log`).

**Critical Finding**: `duration-gate-triggers.log` does NOT exist. Either:
1. The gate is never triggering (code not compiled/deployed after source edit)
2. The `appendFileSync` is failing silently (path resolution issue at runtime)
3. The compiled JS doesn't include the logging additions

**Action Required**: Verify the compiled JS matches the TypeScript source. The logging addition may not have been transpiled.

## Phase 3: Recommendations

1. **P0**: Verify duration gate is actually running — check compiled JS output
2. **P1**: If gate IS running but log isn't: fix path resolution in appendFileSync
3. **P1**: If gate is NOT running: escalate to tech-lead for recompilation
4. **P2**: Add duration to last-session.md as "total session duration" (including re-prompts) for easier auditing

