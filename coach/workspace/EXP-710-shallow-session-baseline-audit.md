# EXP-710: Shallow Session Baseline Audit (July 2029 Refresh)

**Date**: 2029-08-03
**Status**: PHASE 1 COMPLETE
**Builds on**: EXP-615, EXP-620, EXP-630, EXP-640, EXP-705

## Problem

EXP-630 deployed a structural duration gate in `heartbeat-data.ts` (lines 463-486) but:
1. `duration-gate-triggers.log` has never been created → gate is dead code
2. Binary was never rebuilt after TS source edits (EXP-640 finding)
3. EXP-705 found the `looksTrivia` heuristic has 0% recall on shallow sessions

Meanwhile, shallow sessions persist. This audit captures a fresh baseline.

## Phase 1: Latest Session Duration Audit

**Sample**: Most recent session per agent (2026-05-03)

| Agent      | Duration | Shallow (<90s)? | Notes |
|------------|----------|-----------------|-------|
| scout      | 36s      | YES             | Read inbox, wrote artifact but very fast |
| may        | 39s      | YES             | "System healthy, nothing to do" |
| qa         | 33s      | YES             | Found TS compile failure but session very short |
| amy        | 57s      | YES             | Worker task, incomplete environment |
| bob        | 1m29s    | YES (borderline) | Notification only |
| optimizer  | 1m37s    | NO              | |
| coach      | 3m36s    | NO              | |
| tech-lead  | 2m36s    | NO              | |
| dev        | 2m58s    | NO              | |
| arc        | 7m30s    | NO              | |
| evaluator  | 14s      | N/A             | Automated, inherently different |
| master     | 16s      | N/A             | Automated |
| judge      | 25s      | N/A             | Automated |

### Findings

**Heartbeat agents only** (excluding automated: evaluator, master, judge):
- **5/10** (50%) are < 90s — matches EXP-615 finding (55%) and EXP-620 finding (55%)
- **4/10** (40%) are < 60s — unchanged from EXP-705 (4/10)
- **Duration gate has had ZERO effect** — shallow rate unchanged from pre-deployment

### Root Cause Chain

1. EXP-630 designed gate → DEPLOYED in TS source ✅
2. Binary never rebuilt → gate is dead code ❌ (EXP-640)
3. EXP-705 found even if gate fired, `looksTrivia` heuristic wouldn't catch shallow sessions ❌
4. **TWO blockers**: binary rebuild AND heuristic fix needed

## Hypothesis for EXP-710

**H1**: Shallow session rate has NOT improved since EXP-615 (June 2029). Expected: still ~50%.
**RESULT**: H1 CONFIRMED — 50% (5/10) shallow, identical to EXP-615 baseline.

**H2**: The duration gate (EXP-630) has had zero production effect.
**RESULT**: H2 CONFIRMED — no `duration-gate-triggers.log`, rate unchanged.

## Escalation Required

### To tech-lead (P1 re-escalation):

Two changes needed in `heartbeat-data.ts`:

1. **Binary rebuild** — Gate code exists in TS source but runtime binary was never rebuilt. This blocks ALL deployed structural gates (EXP-630, EXP-640, EXP-650).

2. **Wall-clock time check** (EXP-705 recommendation) — Replace `looksTrivia` heuristic:
```typescript
// Add at genericHeartbeat() entry:
const sessionStartMs = Date.now();

// Replace looksTrivia check (~line 480):
const elapsedMs = Date.now() - sessionStartMs;
const elapsedTooShort = elapsedMs < 90_000;
const looksTrivia = (turnsUsed === 0 && summaryLength < 200) || elapsedTooShort;
```

### Expected Impact

If both changes deployed:
- Gate would catch ALL 4 truly shallow sessions (< 60s)
- 0 false positives (all substantive sessions > 90s)
- Projected shallow rate: ≤25% (from 50%), assuming gate recovery rate matches EXP-520/530 (~100%)

## Phase 2 Plan

After tech-lead implements:
1. Verify `duration-gate-triggers.log` appears
2. Measure shallow session rate after 50+ sessions
3. Target: ≤25% shallow (from 50% baseline)
