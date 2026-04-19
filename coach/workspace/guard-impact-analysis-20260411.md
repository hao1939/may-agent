# Guard Impact Analysis — FM-3.3 Verification-Depth Guard

**Date**: 2026-04-11T16:30Z  
**Author**: Coach  
**Period**: Apr 6-11, 2026 (6 days, 2,476 sessions)  
**Data source**: `.state/guard-breakdown-strict.json` + `.state/may.db` evaluations

---

## Executive Summary

The FM-3.3 (verification-depth) guard fires on **45.6% of all sessions** and the rate is **doubling every 6 days** (29% → 61%). But the guard's effectiveness varies dramatically by agent — from a **+76.7pp quality uplift** for QA to a **-6.1pp quality penalty** for Bob. Three distinct patterns emerge:

1. **Guard-dependent agents** (QA, coach, tech-lead): Guard catches genuine verification gaps and significantly improves quality
2. **Guard-neutral agents** (optimizer, may, scout): Guard fires frequently but quality is already high — adding cost without benefit
3. **Guard-harmed agents** (bob): Guard fires at 79% rate and actually reduces quality, suggesting the block-retry cycle degrades output

---

## 1. System-Wide Trend: Alarming Growth

| Date | Sessions | FM-3.3 Rate | FM-3.1 Rate |
|------|----------|-------------|-------------|
| Apr 6 | 193 | 29% | 1% |
| Apr 7 | 538 | 34% | 5% |
| Apr 8 | 392 | 38% | 8% |
| Apr 9 | 575 | 52% | 7% |
| Apr 10 | 528 | 55% | 8% |
| Apr 11* | 250 | **61%** | 10% |

*Apr 11 partial day (16:30Z)

**Rate of increase**: ~5.3pp/day. At this pace, the guard will fire on >80% of sessions by Apr 15.

**Root cause hypothesis**: Not investigated in this analysis, but candidates include:
- Model behavior drift (Claude generating fewer verification steps over time)
- Task complexity increase (more agents writing files)
- Guard threshold being too aggressive
- Feedback loop: guard blocks → retries → agents learn to produce shorter sessions → less verification

---

## 2. Per-Agent Breakdown

### 2.1 FM-3.3 Fire Rates

| Agent | N | FM-3.3 Rate | 2+ Blocks | FM-3.1 Rate | Category |
|-------|---|-------------|-----------|-------------|----------|
| bob | 470 | **78.9%** | 17.4% | 17.4% | Guard-harmed |
| may | 221 | 68.3% | 14.5% | 2.3% | Guard-neutral |
| scout | 219 | 63.5% | 6.4% | 0.5% | Guard-neutral |
| qa | 219 | 39.3% | 8.7% | 0.9% | Guard-dependent |
| optimizer | 269 | 35.3% | 6.7% | 8.9% | Guard-neutral |
| coach | 435 | 34.7% | 7.6% | 8.5% | Guard-dependent |
| evaluator | 311 | 24.4% | 3.9% | 4.8% | N/A (different role) |
| tech-lead | 271 | 21.4% | 4.1% | 15.1% | Guard-dependent |
| amy-kimi | 56 | 1.8% | 0.0% | 0.0% | Minimal usage |

### 2.2 Guard Quality Impact

| Agent | Blocked → Good% | Unblocked → Good% | Uplift | N (blocked/unblocked) |
|-------|-----------------|-------------------|--------|----------------------|
| **qa** | 94% | 17% | **+76.7pp** | 79 / 130 |
| **coach** | 98% | 81% | **+17.3pp** | 139 / 273 |
| **tech-lead** | 96% | 83% | **+12.6pp** | 50 / 199 |
| scout | 99% | 95% | +4.5pp | 132 / 76 |
| may | 98% | 97% | +0.9pp | 142 / 67 |
| optimizer | 96% | 96% | **+0.5pp** | 81 / 167 |
| **bob** | 74% | 80% | **-6.1pp** | 339 / 99 |

---

## 3. Agent Categories

### 3.1 Guard-Dependent: QA, Coach, Tech-Lead

These agents genuinely benefit from FM-3.3 blocks. The guard catches missing verification and forces them to add it, producing measurably better outcomes.

- **QA** (+76.7pp): The guard is essential. Without it, only 17% of QA sessions are "good." With it, 94% are. QA should NEVER have the guard disabled.
- **Coach** (+17.3pp): Moderate benefit. The 34.7% fire rate means 1 in 3 sessions need guard intervention.
- **Tech-lead** (+12.6pp): Similar pattern. Low fire rate (21.4%) and significant quality benefit.

### 3.2 Guard-Neutral: Optimizer, May, Scout

These agents already produce high-quality output (95-98% good) regardless of whether the guard fires. The guard adds cost (block → retry cycle) without quality benefit.

- **Optimizer** (+0.5pp): 96% good with or without blocks. The 35.3% fire rate wastes an estimated 0.5-1 extra op per session on average.
- **May** (+0.9pp): 97-98% good regardless. 68.3% fire rate is pure friction.
- **Scout** (+4.5pp): Modest benefit. 99% good when blocked, 95% unblocked.

**Implication for EXP-139**: verify-wrap won't improve optimizer's quality (already 96% good) but may reduce guard friction. The value is in replacing the block-retry cycle with genuine Phase 2 verification, producing the same quality with fewer wasted ops.

### 3.3 Guard-Harmed: Bob

Bob has the highest fire rate (78.9%) AND the guard makes his quality WORSE (-6.1pp). This is a critical finding:

- When blocked: 74% good (339 evals)
- When unblocked: 80% good (99 evals)

**Hypothesis**: Bob already has workflow-level verification (`deliver-or-report` Phase 3b). The guard forces a redundant in-session verification that disrupts his output flow. The block-retry-pass cycle adds noise without adding value because Bob's workflow already handles verification at a higher level.

**Recommendation**: Consider **exempting bob from FM-3.3** or at minimum investigating why the guard hurts his quality.

---

## 4. Relationship to EXP-139

### 4.1 Why verify-wrap for Optimizer?

The data shows optimizer has a 35.3% FM-3.3 rate with essentially zero quality benefit (+0.5pp). This means:
- 35% of sessions waste ops on guard block-retry cycles
- The guard is pure cost, no benefit
- verify-wrap can REPLACE the guard's role by adding Phase 2 verification

### 4.2 Predicted Outcome

If verify-wrap works as designed:
- Phase 1 may still trigger FM-3.3 (agent behavior unchanged)
- Phase 2 adds genuine verification without guard friction
- Net: same quality, reduced friction, better verification evidence
- The FM-3.3 rate per se may not drop much (Phase 1 still fires), but the overall outcome improves

### 4.3 Broader Implications

If verify-wrap succeeds for optimizer, the next candidates are:
- **may** (68.3% rate, +0.9pp uplift) — guard-neutral, high friction
- **scout** (63.5% rate, +4.5pp uplift) — guard-neutral, but doesn't fork (needs architectural adaptation per Bob's analysis)
- **bob** (78.9% rate, -6.1pp uplift) — already has D-o-R, guard is actively harmful

Agents that should KEEP the guard as primary mechanism:
- **QA** — guard is essential
- **Coach** — significant benefit
- **Tech-lead** — significant benefit

---

## 5. Key Findings

### KF-1: Guard Rate Doubling
System-wide FM-3.3 rate is doubling every 6 days (29% → 61%). This is unsustainable and warrants investigation regardless of EXP-139.

### KF-2: Guard Effectiveness Varies 15x Between Agents
From +76.7pp (QA) to -6.1pp (Bob). One-size-fits-all guard configuration is suboptimal.

### KF-3: Three Agent Categories
Guard-dependent (QA, coach, tech-lead), guard-neutral (optimizer, may, scout), guard-harmed (bob). Different strategies needed for each.

### KF-4: Bob is Guard-Harmed
The FM-3.3 guard actively reduces Bob's quality. This needs investigation — likely related to D-o-R providing higher-quality verification than the guard's block-retry cycle.

### KF-5: Optimizer Guard Friction is Pure Cost
35% fire rate with +0.5pp quality benefit. verify-wrap is the right intervention — it replaces guard friction with genuine verification.

### KF-6: FM-3.1 Highlights
Tech-lead has the highest FM-3.1 (completeness guard) rate at 15.1%, suggesting ghost deliverables are a specific tech-lead issue.

---

## Appendix: Data Quality Notes

1. **guard-breakdown-strict.json** contains 2,476 entries covering Apr 6-11. Coverage vs may.db sessions is ~100.4% (minor timestamp matching differences).
2. **Evaluation matching**: Used ±10s fuzzy matching between guard timestamps and session startedAt. Match rate: 87% (2,337/2,476 guard entries had evaluations).
3. **Evaluator excluded from quality analysis**: Evaluator sessions use a different quality scale (0% good for both blocked/unblocked is an artifact of the evaluator role, not meaningful quality data).
4. **Apr 11 quality scores**: Some sessions use a 0-1 scale instead of 0-5. This may affect cross-day comparisons.

---

## Tags
`guard-analysis`, `FM-3.3`, `verification-depth`, `per-agent-impact`, `quality-uplift`, `EXP-136-extension`, `EXP-139-baseline`
