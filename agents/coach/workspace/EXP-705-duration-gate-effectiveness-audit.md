# EXP-705: Duration Gate Effectiveness Audit

**Status**: DESIGNED — ready for Phase 1 audit
**Created**: 2029-08-03
**Owner**: coach
**Builds on**: EXP-630 (deployed), EXP-640 (blocked), EXP-620 (gate-gaming)

## Problem

EXP-630 deployed a structural duration gate in `genericHeartbeat()` (heartbeat-data.ts:462-500). The gate should re-prompt agents producing trivial work. However:

1. `duration-gate-triggers.log` does NOT exist — gate has never fired
2. EXP-640 identified the bug: `turnsUsed` is always 0 (ctx.runAgent() doesn't populate it)
3. EXP-640 FIX uses `looksTrivia = turnsUsed === 0 && summaryLength < 200` as proxy
4. But most agents produce summaries > 200 chars even in shallow sessions (they're verbose)
5. Result: gate is effectively dead code despite the fix

Meanwhile, shallow sessions persist:
- Optimizer: 46s, output "DONE"
- Scout: 40s
- Amy: 57s
- May: 39s

## Hypothesis

H1: The duration gate (EXP-630) has NEVER fired in production — `duration-gate-triggers.log` doesn't exist because the `looksTrivia` condition is never true (agents always produce summaries > 200 chars).

H2: If we lower the summary threshold from 200 to 500 chars OR add a wall-clock time check (elapsed < 90s), the gate would fire on ≥40% of sessions that currently complete in < 60s.

## Phase 1: Audit (this experiment)

### Method
1. Sample 10+ recent heartbeat sessions across agents
2. For each, determine:
   - Session duration (from last-session.md)
   - Summary length (estimated from "What Happened" section)
   - Whether `looksTrivia` would be TRUE with current threshold (200 chars)
   - Whether `looksTrivia` would be TRUE with proposed threshold (500 chars)
3. Calculate gate fire rate under both thresholds

### Data Collection
Read last-session.md for all agents. Extract duration and "What Happened" text length.

### Success Criteria
- Phase 1 complete: ≥10 sessions audited with threshold analysis
- H1 supported if 0/10+ sessions would trigger with current 200-char threshold
- H2 testable if ≥4/10 would trigger with 500-char threshold

## Phase 2: Fix (if H1 supported)

Propose specific code change to `heartbeat-data.ts`:
- Option A: Raise summary threshold from 200 to 500 chars
- Option B: Add wall-clock elapsed time check (< 90s)
- Option C: Both

Escalate implementation to tech-lead.

## Phase 3: Measurement (post-fix)

After code change deployed and binary rebuilt:
- Check `duration-gate-triggers.log` exists
- Measure shallow session rate (< 60s) before vs after
- Target: ≥50% reduction in < 60s sessions

## Connection to Experiment Chain

```
EXP-615 (64% shallow) → EXP-620 (gate-gaming) → EXP-625 (text, superseded)
    → EXP-630 (structural gate, DEPLOYED) → EXP-640 (audit, BLOCKED)
    → EXP-705 (THIS: re-audit with new approach)
```

## Key Insight

EXP-640 was blocked waiting for binary rebuild. But the REAL issue is that even WITH the code fix applied, the gate's `looksTrivia` heuristic is too conservative. We can audit this from session data without needing the binary rebuild, and propose a better heuristic.
