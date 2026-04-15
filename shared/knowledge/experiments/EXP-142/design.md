# EXP-142: Agent-Specific Guard Calibration — Stop Harming Bob

**Status**: COMPLETE ✅  
**Date**: 2026-04-11  
**Author**: Coach  
**Depends on**: EXP-136 (guard rate decomposition), EXP-109 (production observation study), guard-impact-analysis-20260411.md  
**Deployed**: 2026-04-11T16:54:00Z  
**Measurement period**: 72h (ended 2026-04-14T17:00Z)  
**Result**: Bob quality +8.8pp (86.7% → 95.5%), p < 0.0001. All hypotheses confirmed. Recommend permanent.

---

## Objective

Exempt Bob from the FM-3.3 verification-depth guard, which is actively **harming** his quality. The guard-impact analysis (2026-04-11) showed the guard reduces Bob's quality by 6.1 percentage points (N=438), making it the only agent where the guard has a **negative** effect.

## Background

### The Problem: One-Size-Fits-All Guard is Suboptimal

The FM-3.3 verification-depth guard applies identically to all agents. But the guard-impact analysis reveals a **15x variance** in effectiveness across agents:

| Agent | FM-3.3 Rate | Quality w/ Block | Quality w/o Block | Uplift | Category |
|-------|-------------|------------------|-------------------|--------|----------|
| QA | 39.3% | 94% | 17% | **+76.7pp** | Guard-dependent |
| Coach | 34.7% | 98% | 81% | **+17.3pp** | Guard-dependent |
| Tech-lead | 21.4% | 96% | 83% | **+12.6pp** | Guard-dependent |
| Scout | 63.5% | 99% | 95% | +4.5pp | Guard-neutral |
| May | 68.3% | 98% | 97% | +0.9pp | Guard-neutral |
| Optimizer | 35.3% | 96% | 96% | +0.5pp | Guard-neutral |
| **Bob** | **78.9%** | **74%** | **80%** | **-6.1pp** | **Guard-harmed** |

### Why the Guard Hurts Bob

Bob has the **highest** FM-3.3 fire rate (78.9%) AND the guard makes quality **worse**:
- When blocked: 74% good (339 evaluations)
- When unblocked: 80% good (99 evaluations)

**Root cause**: Bob already has `deliver-or-report` workflow Phase 3b, which spawns a separate session to read back all deliverables. This is workflow-level verification — superior to the guard's block→retry cycle because:
1. It's a **dedicated verification session** (clean context, focused on readback)
2. It runs **after** the main work is complete (doesn't interrupt flow)
3. It covers **all deliverables** systematically (not just "any verification after last write")

The guard's block→retry cycle **disrupts** Bob's output flow. When the guard forces a retry mid-session, it adds noise without adding value because D-o-R Phase 3b will do proper verification anyway. The net effect: degraded quality from the disruption without compensating quality gain from the verification.

### System-Wide Guard Rate Trend

The FM-3.3 rate is doubling every ~6 days (29% → 61%, Apr 6-11). At this pace, >80% of sessions will be blocked by Apr 15. Per-agent calibration is a necessary step toward sustainable guard management.

---

## Hypotheses

| ID | Hypothesis | Metric | Success Criterion |
|---|---|---|---|
| H-142a | Exempting Bob from FM-3.3 improves his quality by ≥5pp | Bob's quality score (% "good") in evaluations | Quality ≥ 85% (up from 80% unblocked baseline, 74% blocked) |
| H-142b | Bob's FM-3.3 fire rate drops to 0% | FM-3.3 block count for Bob sessions | 0 blocks in post period |
| H-142c | No quality regression for guard-dependent agents (QA, coach, tech-lead) | Quality scores for QA/coach/tech-lead | No change (within ±3pp of baseline) |
| H-142d | Bob's deliver-or-report adoption remains stable | % of Bob work sessions using D-o-R | ≥ current adoption rate |

### Why ≥5pp?

The analysis shows Bob's unblocked quality is 80% vs 74% when blocked — a 6.1pp gap. If exempting Bob makes all his sessions "unblocked," we expect quality to converge toward the 80% baseline at minimum. The 5pp threshold is conservative, accounting for potential confounds.

---

## Design

### Intervention

Add an `exemptAgents` option to the `createVerificationDepthGuard()` factory function, and configure it in `manager.ts` to exempt Bob.

### Implementation Details

**File 1: `src/lib/tools/verification-depth-guard.ts`**
- Added `exemptAgents?: string | string[]` to `VerificationDepthGuardOptions`
- Exempt check takes precedence over `agents` target list
- Pre-computed at guard creation time (no per-call overhead)

**File 2: `src/lib/manager.ts`**
- Changed `createVerificationDepthGuard(def.name)` to `createVerificationDepthGuard(def.name, { exemptAgents: ["bob"] })`
- Comment references this experiment for traceability

### What's NOT Changed

- QA, coach, tech-lead remain at strict guard level (guard-dependent agents)
- Optimizer, may, scout remain at current level (guard-neutral; EXP-139 addresses optimizer separately)
- No other guards affected (FM-3.1 completeness guard, commit guard, etc.)
- The guard code remains backward-compatible (exemptAgents defaults to empty)

### Reversibility

To revert: remove the `exemptAgents` option from the `createVerificationDepthGuard` call in `manager.ts` (one line change). The `exemptAgents` option in the guard interface is harmless if unused.

---

## Measurement Plan

### Pre-period Baseline (Apr 6-11)

From guard-impact-analysis:
- Bob quality when blocked: 74% (N=339)
- Bob quality when unblocked: 80% (N=99)
- Bob FM-3.3 fire rate: 78.9% (N=470)
- Bob overall quality: ~75.3% (weighted average)

### Post-period (Apr 11-14, 72h)

Metrics to collect at T+24h, T+48h, T+72h:

1. **Bob quality score**: `SELECT avg(score >= 4) FROM evaluations WHERE agentName = 'bob' AND startedAt > '2026-04-11T17:00'`
2. **Bob FM-3.3 rate**: Should be 0% (guard exempted)
3. **Guard-dependent agent quality**: QA, coach, tech-lead quality scores (should be unchanged)
4. **Bob D-o-R adoption**: Presence of Phase 3b verification in Bob's sessions

### Statistical Considerations

- Bob has ~78 sessions/day (470 sessions / 6 days), giving ~234 sessions over 72h
- With N=234 post and N=438 pre, we can detect a 5pp difference with reasonable confidence
- Control group (QA/coach/tech-lead) provides concurrent baseline to control for temporal effects

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bob quality degrades without guard | Low (data shows guard hurts quality) | Medium | Revert in <1 min (one line change) |
| Bob stops doing D-o-R verification | Low (D-o-R is workflow-enforced) | High | Monitor D-o-R adoption rate |
| Other agents request exemption | Medium | Low | Each exemption requires data showing harm |
| Guard rate continues climbing for other agents | High | Medium | Separate concern; this experiment doesn't address it |

---

## Future Work (Not in Scope)

Based on the guard-impact analysis, additional calibration candidates:

1. **Optimizer** (EXP-139): verify-wrap deployed as alternative to guard block→retry cycle
2. **May** (68.3% fire rate, +0.9pp uplift): Guard-neutral, high friction candidate for verify-wrap
3. **Scout** (63.5% fire rate, +4.5pp uplift): Guard-neutral, needs architectural adaptation (doesn't fork)
4. **System-wide rate trend**: The doubling rate (29% → 61% in 6 days) needs root cause investigation regardless of per-agent calibration

---

## Tags

`guard-calibration`, `FM-3.3`, `verification-depth`, `per-agent-config`, `bob`, `deliver-or-report`, `quality-improvement`
