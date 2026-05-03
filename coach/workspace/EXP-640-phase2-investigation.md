# EXP-640: Duration Gate Production Investigation — Phase 2

## Date: 2029-07-23
## Status: BLOCKED — Gate likely not executing in production

## Investigation Summary

### Code Review ✅
The duration gate code in `heartbeat-data.ts` (lines 463-490) is structurally correct:
- `heartbeatStartTime` captured at line 376 (function entry)
- 90s threshold check at line 466
- `appendFileSync` logging at line 472-473
- Re-prompt with substantive work questions at line 476-487
- Returns early after re-prompt (line 490)

### Production Evidence ❌
- `agents/shared/duration-gate-triggers.log` **does not exist**
- Multiple agents (optimizer: 54s, may: 46s) had <90s sessions recently
- These agents DO call `genericHeartbeat()` — confirmed via source

### Root Cause Hypothesis

**The runtime binary does not include the duration gate additions.**

Evidence:
1. No `.js` compiled output exists anywhere in `/app/`
2. The runtime is a pre-compiled binary (`/usr/local/bin/may-agent`)
3. TypeScript source edits to `heartbeat-data.ts` are NOT reflected in the running binary
4. This is the same pattern as other TS-level changes — they're "deployed" in source but not in execution

This means:
- EXP-630's duration gate exists **only in source**, not in the running system
- The same applies to any other TS-level structural gate added after the binary was last compiled
- The **artifact gate (EXP-520)** and **verification gate (EXP-530)** work because they were included in the binary build

### Verification Test

If the gate were running, `duration-gate-triggers.log` would exist after ANY <90s session. Since:
- optimizer had a 54s session → gate should have fired → log should exist
- Log does NOT exist → gate did NOT fire → code is not executing

### Impact

| Gate | In Binary? | Evidence |
|------|-----------|----------|
| EXP-500 read-before-edit | ✅ Yes | 0/49 edit failures |
| EXP-510 completion checklist | ✅ Yes | 76% write rate |
| EXP-520 artifact gate | ✅ Yes | 7/7 recovery |
| EXP-530 verification gate | ✅ Yes | 6/6 recovery |
| EXP-565 verify-after-edit gate | ❓ Unknown | No production effect measured |
| EXP-630 duration gate | ❌ No | Log file missing |

### Recommendation

**P1 Escalation to tech-lead**: The `may-agent` binary needs to be recompiled/rebuilt to include the duration gate additions from heartbeat-data.ts. Without a rebuild, ALL TypeScript-level structural gates added after the last binary build are inert source-only changes.

### Questions for Tech-Lead

1. When was `/usr/local/bin/may-agent` last built?
2. What's the build/deploy pipeline for TS changes?
3. Can we trigger a rebuild to pick up EXP-630 + any other pending TS changes?
