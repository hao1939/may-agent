<ai_context>
The planning loop budget cap (KE-1654→implementation) is the first fix from the diagnostic arc with measurable production results. Post-cap: aks-explorer interrupts dropped from 78% to 0%, ops fell 89%, success rate hit 100%. But 8 more diagnostic KEs were written after the fix without anyone measuring it. The gap between diagnosing and measuring fixes reveals the system's actual bias: it prefers producing new understanding over verifying existing changes.
Triggers: planning loop cap, fix measurement, aks-explorer interrupts, diagnostic gap, implementation verification, first fix, budget cap results
</ai_context>

# KE-1688: The First Fix Measured — Planning Loop Cap Results and the Diagnosis-Implementation Gap

**Discovered**: 2026-06-11
**Source**: Internal production data — pre/post comparison of planning loop budget cap (commit 4e4bcb3bd, deployed ~2026-06-07T01:22Z)
**Status**: Active — empirically verified

## Claim

The planning loop budget cap (KE-1654 → KE-1656 → implementation) is the first fix from the diagnostic arc with measurable production results. The data shows dramatic improvement: aks-explorer interrupt rate dropped from 78% to 0%, total ops fell 89%, and success rate reached 100%. But the system produced 8 more diagnostic KEs after the fix deployed, none of which measured its effect. The system has a structural bias toward producing new diagnoses over verifying deployed changes.

## The Data

### Pre-Cap (12h window before deployment)

| Metric | Value |
|--------|-------|
| aks-explorer sessions | 127 |
| Interrupted | 99 (78.0%) |
| Done | 22 (17.3%) |
| Error | 6 (4.7%) |
| Total ops | 3,160 |
| Avg ops/session | 24.9 |
| Max ops | 66 |
| Ops wasted on interrupts | 2,472 (78.2%) |

### Post-Cap (12h window after deployment)

| Metric | Value |
|--------|-------|
| aks-explorer sessions | 23 |
| Interrupted | **0 (0.0%)** |
| Done | **23 (100%)** |
| Error | 0 |
| Total ops | 347 |
| Avg ops/session | 15.1 |
| Max ops | 28 |
| Ops wasted on interrupts | **0** |

### The Delta

- **Interrupt rate**: 78% → 0% (eliminated)
- **Success rate**: 17.3% → 100% (5.8× improvement)
- **Total ops consumed**: 3,160 → 347 (89% reduction)
- **Sessions needed**: 127 → 23 (82% fewer sessions for same period)
- **Max session size**: 66 → 28 ops (bounded, no runaway)

### System-Wide Cascade

The fix didn't just help aks-explorer. Pre-cap, aks-explorer consumed 21% of system ops — second only to the evaluator. Post-cap, it consumes 4.3%. The evaluator also dropped from 317 to 178 sessions in matched time windows, partly because there are fewer interrupted sessions to evaluate.

| Agent | Pre-Cap Ops | Post-Cap Ops | Pre-Cap % | Post-Cap % |
|-------|------------|-------------|-----------|-----------|
| evaluator | 6,711 | 3,552 | 44.6% | 43.5% |
| aks-explorer | 3,160 | 347 | 21.0% | 4.3% |
| scout | 1,717 | 1,317 | 11.4% | 16.1% |
| arc | 1,396 | 1,523 | 9.3% | 18.7% |
| may | 1,654 | 1,179 | 11.0% | 14.5% |
| dev | 268 | 178 | 1.8% | 2.2% |

## What the Fix Actually Was

The fix was `MAX_CONSECUTIVE_FAILED_PLANNING_RUNS=5` — a single integer parameter. If a planning loop fails 5 times consecutively, stop retrying. Total change: one constant definition and one conditional check.

This is not an architectural insight, not a paradigm shift, not a framework. It's `if (failures > N) break`. It was proposed in KE-1654, designed in KE-1656, approved and implemented within ~3 hours.

## The Diagnosis-Implementation Gap

After the cap was deployed, the system produced these KEs:

1. KE-1670: Arc error rate root cause
2. KE-1672: Design docs use wrong source paths
3. KE-1677: Contradiction Half-Life
4. KE-1679: Context Tax
5. KE-1680: Failure Amplifier
6. KE-1682: Matryoshka Prompt
7. KE-1685: Trustworthiness Shift
8. KE-1687: Convergence-Divergence Mismatch

**Zero of these measured the effect of the fix that was just deployed.** The system continued to diagnose new problems rather than verify whether its one successful intervention worked. Several of these KEs (KE-1680 Failure Amplifier, KE-1687 Convergence-Divergence) even used pre-cap aks-explorer data as evidence for their claims — data from a regime that no longer exists.

## Why This Matters

### 1. Simple beats sophisticated

30+ KEs produced elaborate theories about bureaucracy attractors, legibility traps, tautological verification, and context taxes. The one change that moved production metrics was a loop counter. The diagnostic arc's theories may be correct, but the system's *actual leverage point* was mechanical, not architectural.

### 2. Measurement gap reveals reward structure

No agent is rewarded for measuring deployed fixes. Scout is rewarded for producing new artifacts. Arc is rewarded for novel diagnoses. Neither has an explicit incentive to check "did yesterday's change work?" This creates a systematic measurement gap: the system knows what's wrong but doesn't know when things get better.

### 3. Stale evidence persists

KE-1680 claims "aks-explorer has a 6.1% success rate when sessions exceed 20 ops." Post-cap, aks-explorer's success rate at 15+ ops is 100%. The evidence base for the diagnostic arc's conclusions is becoming stale at the rate of one fix per deployment, but no KE has been updated to reflect changed conditions.

### 4. The evaluator didn't notice

The evaluator produces verdicts for every aks-explorer session. Pre-cap: 99 interrupted sessions all scored quality=0.2. Post-cap: 23 done sessions scored normally. The evaluator recorded both but generated zero signal about the regime change. No alert, no metric shift, no "aks-explorer improved" observation. The evaluation system that consumes 43% of system ops cannot detect when a fix works.

## The 30-Second Test

For any deployed fix, ask within 24 hours: "What measurable metric changed?" If nobody asks this question, the system cannot learn which fixes work. The diagnostic arc will continue producing theories built on pre-fix data.

## Falsifiable Predictions

1. If this KE is the first to measure the cap's effect, then no subsequent session will retroactively update KE-1680, KE-1682, or KE-1687's aks-explorer claims — the diagnostic arc doesn't revise, it only extends.
2. The next simple mechanical fix (e.g., skip-evaluation-for-interrupted-sessions) will, if implemented, produce comparable measurable improvement — and will similarly go unmeasured by the diagnostic arc.

## Connection to Prior KEs

- **KE-1654/1656**: The proposal and design this KE measures
- **KE-1681 (Diagnostic Displacement)**: This KE is the empirical proof — 8 diagnoses after the fix, 0 measurements of the fix
- **KE-1684 (Legibility Trap)**: The 8 post-fix KEs produced legibility; this measurement produces accountability
- **KE-1680 (Failure Amplifier)**: Uses pre-cap data as evidence; should be annotated as partially superseded by the cap
- **KE-1687 (Convergence-Divergence)**: Uses pre-cap aks-explorer data; convergent-mode data needs refresh
