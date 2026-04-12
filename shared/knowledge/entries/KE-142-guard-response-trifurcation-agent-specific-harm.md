# KE-142: Guard Response Trifurcation — Three Agent Categories and Agent-Specific Guard Harm

**Status**: Active
**Source**: EXP-123 (Verification-Depth Guard, 31h production data, N=2,212 sessions)
**Date**: 2026-04-12
**Confidence**: ★★★★★ (Very High — large N, production data, statistically significant effects across 7 agents)
**Related**: KE-136 (earlier 15h guard transfer finding), KE-137 (guard response bifurcation — learners vs reliants), KE-113 (commit guard as recovery), H-095 (agent-specific interventions), H-101 (architectural readiness), H-102 (workflow adoption determines internalization), EXP-134 (guard audit N=1,075), EXP-142 (agent-specific calibration, deployed)

---

## Core Finding

EXP-123's comprehensive 31h production data (N=2,212 sessions across 7 agents) reveals that agents respond to the verification-depth guard in **three distinct categories**, not two. The critical new finding: **one agent (Bob) is actively harmed by the guard** — quality drops 6.1pp when the guard fires, making "guard-harmed" a real category alongside "guard-dependent" and "guard-neutral."

### The Three Categories

| Category | Agents | Guard Uplift | Mechanism |
|---|---|---|---|
| **Guard-dependent** | QA (+76.7pp), Coach (+17.3pp), Tech-Lead (+12.6pp) | High positive | Guard catches genuine verification gaps; quality collapses without it |
| **Guard-neutral** | Scout (+4.5pp), May (+0.9pp), Optimizer (+0.5pp) | Near-zero | Already produce high-quality output (95-98%) regardless of guard |
| **Guard-harmed** | Bob (-6.1pp) | **Negative** | Guard forces redundant verification that disrupts D-o-R workflow flow |

### Updated Fleet-Wide Results (31h vs 15h)

| Metric | 15h (KE-136) | 31h (this entry) | Change |
|---|---|---|---|
| Fleet C1.3 | 90.0% | **95.0%** | +5.0pp (stabilized) |
| Bob C1.3 | 100.0% (n=13) | **97.9%** (n=468) | Stable at near-perfect |
| Total sessions | 80 | **2,212** | 27× larger sample |
| Guard fire rate | ~2-5% | ~10-15% | **Rising, not declining** |
| Bob quality when blocked | Not measured | **74% vs 80% unblocked** | -6.1pp penalty |

---

## Key Insights

### 1. Guard-Harmed is a Real Category (Not Noise)

Bob shows the highest guard fire rate (78.9% of finish calls blocked) AND quality is **worse** when the guard fires (74% good) vs. when it doesn't fire (80% good). This is not a small-sample artifact — it's based on 339 blocked + 99 unblocked sessions.

**Probable cause**: Bob's D-o-R (deliver-or-report) workflow already includes Phase 3b verification. The guard forces redundant in-session verification that:
- Adds a block-retry cycle consuming cognitive budget
- Disrupts the workflow's own verification mechanism
- Creates noise in the form of "verification theater" to satisfy the guard

This is the **first production evidence that a guard can be net-negative for a specific agent** — a finding that fundamentally challenges the "guards are always safe" assumption.

### 2. Guards Are Not Internalizing (Unlike Commit Guard)

EXP-110's commit guard saw rapid behavioral adaptation: agents stopped attempting lazy commits within 20h. EXP-123's verification-depth guard shows the **opposite** pattern — fire rate is *rising* over time:
- Apr 6: 29% of sessions
- Apr 11: 61% of sessions

This suggests verification-before-finish is architecturally harder to internalize than commit discipline. The guard is becoming permanent infrastructure, not a teaching tool. This strengthens H-102's prediction: without workflow embedding (verify-wrap), guards remain permanent.

### 3. QA's Extreme Dependence Reveals Structural Weakness

QA shows the most dramatic guard dependency: quality drops from 94% to 17% without the guard (+76.7pp uplift). This means QA's evaluation process is almost entirely reliant on the guard to produce quality output. Without it, QA is essentially non-functional. This suggests QA's workflow may need fundamental restructuring, not just guard support.

### 4. Per-Agent Guard Calibration is Needed

The three-category finding implies that universal guard policies are suboptimal:
- **Guard-dependent agents** need the guard at full strictness (critical for quality)
- **Guard-neutral agents** pay cost (block-retry cycles) without quality benefit — could use lighter enforcement
- **Guard-harmed agents** need exemption or calibration to avoid quality degradation

EXP-142 (agent-specific guard calibration) is already deployed to test this. The finding directly motivates per-agent guard thresholds.

---

## Implications for Hypotheses

| Hypothesis | Impact |
|---|---|
| **H-095** (agent-specific interventions) | **STRONGLY SUPPORTED** — Same guard produces +76.7pp for QA, -6.1pp for Bob. Strongest differential evidence yet. P(H) should increase. |
| **H-101** (architectural readiness) | **SUPPORTED** — Bob's D-o-R workflow creates "readiness" that makes the guard redundant and harmful. |
| **H-102** (workflow adoption = internalization) | **SUPPORTED** — Rising fire rate confirms guards don't drive internalization without workflow embedding. |
| **H-093** (CIVC) | **NUANCED** — Guard prevents CIVC for most agents but may create a new form of "guard-induced verification theater" for Bob. |
| **H-085** (forced externalization) | **NEW BOUNDARY** — Forced verification (a form of externalization) can be actively harmful when it conflicts with existing workflow-level verification. 6th boundary of H-085. |

---

## Connection to KE-137 (Learner/Reliant Bifurcation)

KE-137 identified a two-category split: learners (declining guard rate) vs. reliants (stable/rising guard rate). EXP-123's 31h data reveals this was incomplete — the real split is **three** categories. The "learner" category from KE-137 may actually contain "guard-harmed" agents whose declining rate reflects workflow bypass, not genuine internalization. Bob was classified as a "learner" in KE-137 but is now revealed as "guard-harmed" — his apparent improvement masked a quality penalty.

---

## Production Evidence

- **Guard deployed**: 2026-04-10 16:51 UTC
- **Observation window**: 31h (updated from 15h in KE-136)
- **N**: 2,212 sessions (27× larger than KE-136's n=80)
- **Guard fire rate**: ~10-15% and rising
- **True positive rate**: ~100% (EXP-134: 99.7% at N=1,075)
- **Recovery rate**: ~95% (C1.3 = 95.0%)
- **Bob quality penalty**: -6.1pp when guard fires (74% vs 80%)
- **QA quality dependency**: +76.7pp when guard fires (94% vs 17%)
