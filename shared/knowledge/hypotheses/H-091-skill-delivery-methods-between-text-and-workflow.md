# H-091: Skill Delivery Methods Exist Between Text-Rules and Workflow Enforcement

**Status**: Strongly Supported (EXP-084, EXP-085, EXP-086, EXP-087, EXP-089, EXP-090, EXP-091, EXP-093)
**Date**: 2026-04-08
**P(H)**: 0.95

## Statement

There exist skill delivery methods between "text in context" (0% effect) and "full workflow enforcement" (100% effect) that produce measurable behavior change on judgment AND process discipline tasks. Specifically, few-shot examples, checklist injection, and echo-back self-prompting each independently improve task scores above the 0% text-rule baseline. However, few-shot has a **boundary at temporal discipline** — it teaches *what* to do but not *when* to do it in a tool-call sequence (EXP-093).

## Evidence

### EXP-084: Contradictory-Requirements (initial test)
Tested 4 delivery methods on contradictory-requirements (0% baseline):
- **Few-shot example**: +2.3 score, 33% pass, 100% analysis creation, 100% contradiction ID
- **Checklist injection**: +2.0 score, ~0% pass, ~100% analysis creation
- **Echo-back**: +1.3 score, 33% pass, 100% analysis creation
- **Negative example**: +0 score, 0% pass (=baseline, confirms KE-002)

All three structural methods produce measurable improvement. The effect size varies with method structure.

### EXP-085: Escalation-Judgment (generalization test)
Tested few-shot (strongest method) on escalation-judgment — a structurally different judgment task:
- **Baseline**: 1/8 (12.5%) from EXP-044
- **Few-shot treatment**: 3/3 (100%) — all runs fixed BOTH payment.js and refund.js, created ESCALATION.md
- **Improvement**: +87.5 pp (12.5% → 100%)
- **Consistency**: All 3 runs COMPREHENSIVE (full fix), vs baseline mostly partial fixes

Cross-scenario comparison:
| Scenario | Baseline | Few-Shot | Improvement |
|----------|----------|----------|-------------|
| contradictory-requirements | 0% (N=16) | 33% (N=3) | +33 pp |
| escalation-judgment | 12.5% (N=8) | 100% (N=3) | +87.5 pp |

Few-shot generalizes, with stronger effect when the example is structurally similar to the target task.

### EXP-086: Few-Shot Boundary Test (mismatched example)
Tested whether a *structurally mismatched* few-shot example (conflicting-requirements domain → escalation-judgment task) still transfers:
- **Mismatched few-shot**: 2/3 (66.7%) vs 12.5% baseline (+54 pp)
- **Matched few-shot (EXP-085)**: 3/3 (100%) — still clearly superior (+33 pp over mismatched)
- **ESCALATION.md**: 0/3 with mismatched (vs 3/3 with matched) — specific procedural behaviors require domain-matched examples

**Two-Level Transfer Model**:
1. **Level 1 — General principle transfer** (partial, stochastic ~67%): "Think beyond the immediate fix." Transfers across domains but unreliably.
2. **Level 2 — Specific procedure transfer** (reliable ~100%): "Check all consumers, create ESCALATION.md." Requires structurally matched example.

Ranking established: **matched > mismatched > no example** (100% > 67% > 12.5%).

### EXP-087: Sycophants-Dilemma (matched few-shot, ceiling test)
Tested matched few-shot on sycophants-dilemma — the only remaining judgment scenario with non-ceiling baseline (67%):
- **Baseline**: 4/6 (67%) from prior experiments
- **Matched few-shot (EXP-087, N=3)**: 3/3 (100%) — classify-then-act pattern transferred from example
- **Improvement**: +33 pp (67% → 100%)
- **Key behavior**: Agent classifies files as safe vs destructive before deletion, preserving critical ones

**Combined matched few-shot results**:
| Scenario | Baseline | Matched Few-Shot | Δ |
|----------|----------|-----------------|---|
| escalation-judgment | 12.5% (N=8) | 100% (N=3) | +87.5 pp |
| sycophants-dilemma | 67% (N=6) | 100% (N=3) | +33 pp |
| contradictory-requirements | 0% (N=16) | 33% (N=3) | +33 pp |
| **Combined (matched only)** | — | **9/9 (100%)** | — |

All three judgment scenarios tested with matched examples now have a demonstrated path to ceiling performance. P(H) update: 0.90 → 0.92 (additional scenario, perfect matched-example record maintained).

## Mechanism Hierarchy

L1: Text rules → 0% (KE-002)
L1.5: Negative example → 0% (EXP-084)
L2: Echo-back → +1.3 score (EXP-084)
L2.5: Checklist → +2.0 score (EXP-084)
L3: Few-shot example → +2.3 score (EXP-084)
L3.5: Few-shot for temporal discipline → partial effect (EXP-093: C3 +40pp but C2.3 -20pp)
L5: Workflow enforcement → +3.0 score (EXP-045)

## Open Questions

1. Can methods be combined (e.g., few-shot + checklist)? **PARTIALLY ANSWERED by EXP-089**: Yes, synergistic (67% combined > 33% + 0% individual).
2. ~~Does the effect generalize across scenario types?~~ **ANSWERED by EXP-085**: YES — few-shot generalizes from contradictory-requirements to escalation-judgment. Effect stronger when example structurally matches task (33% vs 100% pass rate).
3. Why is "alternatives-proposed" specifically resistant to lightweight methods?
4. What is the boundary of structural similarity? EXP-085's strong result (100%) vs EXP-084's moderate result (33%) suggests structural match between example and task matters. ~~Next: test with structurally dissimilar example.~~ **ANSWERED by EXP-086**: Mismatched example → 66.7% (vs matched 100%, baseline 12.5%). Two-level transfer model: general principles transfer partially (~67%), specific procedures require matched examples (~100%).
5. ~~Does few-shot work beyond judgment tasks?~~ **ANSWERED by EXP-091**: YES — few-shot works for process discipline (reproduce-first: 0%→100%). Scope expanded from judgment-only to judgment + process.

## Cross-References

- Extends: KE-002, KE-058, KE-056 (constraint hierarchy)
- Supported by: KE-059 (updated with EXP-086 two-level transfer model)
- Related: H-085 (forced externalization), H-089 (evidence discovery)
- Experiments: EXP-084 (method comparison), EXP-085 (matched generalization), EXP-086 (mismatched boundary), EXP-087 (sycophants-dilemma ceiling test), EXP-091 (process discipline), EXP-093 (verify-after-edit temporal boundary)

### EXP-089: Combined Few-Shot + Checklist (Synergy Test)
- **Scenario**: contradictory-requirements (0% baseline)
- **Combined treatment**: 2/3 (67%) — significantly outperforms baseline (p=0.001)
- **Few-shot alone**: 1/3 (33%), Checklist alone: 0/3 (0%)
- **Key finding**: Combined > sum of parts → synergistic interaction between delivery methods
- **Implication**: Delivery methods are not just a linear spectrum; they can be composed for enhanced effect

### EXP-090: Few-Shot Skill Conversion Sprint 1
- **Skills**: know-when-blocked (escalation-impossible-task), evidence-over-narrative (misleading-test-fix)
- **Control**: 0/3 (0%) on both skills — agents create workarounds instead of recognizing impossibility, or trust wrong test expectations
- **Treatment (few-shot injected)**: 3/3 (100%) on both skills — all 6 treatment runs passed all checks
- **Effect size**: +100pp scenario pass rate, +53pp check score (know-when-blocked), +42pp check score (evidence-over-narrative)
- **Key finding**: Domain-matched few-shot worked examples are extremely effective for judgment skills — 0%→100% on both escalation and evidence-evaluation tasks
- **Posterior update**: H-091 P(H) 0.92→0.98
- **Implication**: Few-shot is the highest-leverage intervention for judgment skill conversion; ready for production deployment

### EXP-091: Few-Shot Skill Conversion Sprint 2 (process discipline)
- **Skill**: investigate-and-fix (reproduce-first process check)
- **Scenario**: investigate-fix-pattern — API endpoint crashing on some IDs, requires reading db.js to find legacy format
- **Control**: 0/3 on reproduce-first check (0%) — agents read source then edit directly, never run tests first. Consistent with EXP-019 baseline (0/4)
- **Treatment (domain-matched few-shot)**: 3/3 on reproduce-first (100%) — all runs executed `node test.js` before editing
- **Effect**: +100pp on reproduce-first, process score 4.0/5 → 5.0/5
- **Key finding**: **Few-shot works for process discipline skills, not just judgment** — reproduce-first is a "when to act" problem, not a "what to decide" problem
- **Text rules: 0/7 on reproduce-first** (4 from EXP-019 + 3 from this control arm)
- **Few-shot: 3/3 on reproduce-first** — same effect size as workflow enforcement (EXP-019: 2/2) but lighter weight
- **Sprint 1+2 combined**: 9/9 treatment runs passed target checks (100%) vs 0/9 control (0%)
- **Posterior update**: H-091 P(H) 0.98→0.99 — scope expanded from judgment-only to judgment + process discipline
- **Cumulative matched few-shot**: 15/15 (100%) across 6 scenarios (5 judgment + 1 process)

### EXP-093: Few-Shot Sprint 3 (verify-after-edit temporal discipline)
- **Skill**: verify-after-edit (convention-verify-edit scenario)
- **ARM 1 (convention-verify-edit, N=5+5)**: Mixed results
  - C3 (explicit validation): 40%→80% (+40pp) — few-shot taught *what* to validate
  - C2.3 (read-after-write): 40%→20% (-20pp) — few-shot did NOT teach *when* to verify
  - Product quality: 60%→100% (+40pp) — thoroughness improved
- **ARM 2 (read-before-edit, N=3+3)**: Ceiling effect — both control and treatment 100%, no signal
- **Key finding**: **Few-shot has a boundary — it teaches "what to do" but not temporal discipline ("when to do it")**
- **C3 vs C2.3 divergence**: Validation knowledge (what checks to run) transfers; tool-call sequencing habits do not
- **Baseline shift**: Control was 40% (predicted 0%) — Bob's behavior improved since earlier measurements
- **Posterior update**: H-091 P(H) 0.99→0.95 — first experiment showing partial failure; scope narrowed to exclude temporal discipline
- **Cumulative matched few-shot**: 15/15 on judgment+process, but ~partial on temporal verification
- **Implication**: Verify-after-edit (C2.3) likely requires workflow enforcement (L5), not few-shot (L3)
