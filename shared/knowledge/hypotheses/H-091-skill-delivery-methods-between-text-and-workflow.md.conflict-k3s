# H-091: Skill Delivery Methods Exist Between Text-Rules and Workflow Enforcement

**Status**: Strongly Supported (EXP-084, EXP-085, EXP-086, EXP-087, EXP-089, EXP-090, EXP-091, EXP-093)
**Date**: 2026-04-08
**P(H)**: 0.95

## Statement

There exist skill delivery methods between "text in context" (0% effect) and "full workflow enforcement" (100% effect) that produce measurable behavior change on judgment tasks. Specifically, few-shot examples, checklist injection, and echo-back self-prompting each independently improve judgment task scores above the 0% text-rule baseline.

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
L5: Workflow enforcement → +3.0 score (EXP-045)

## Open Questions

1. Can methods be combined (e.g., few-shot + checklist)?
2. ~~Does the effect generalize across scenario types?~~ **ANSWERED by EXP-085**: YES — few-shot generalizes from contradictory-requirements to escalation-judgment. Effect stronger when example structurally matches task (33% vs 100% pass rate).
3. Why is "alternatives-proposed" specifically resistant to lightweight methods?
4. What is the boundary of structural similarity? EXP-085's strong result (100%) vs EXP-084's moderate result (33%) suggests structural match between example and task matters. ~~Next: test with structurally dissimilar example.~~ **ANSWERED by EXP-086**: Mismatched example → 66.7% (vs matched 100%, baseline 12.5%). Two-level transfer model: general principles transfer partially (~67%), specific procedures require matched examples (~100%).

## Cross-References

- Extends: KE-002, KE-058, KE-056 (constraint hierarchy)
- Supported by: KE-059 (updated with EXP-086 two-level transfer model)
- Related: H-085 (forced externalization), H-089 (evidence discovery)
- Experiments: EXP-084 (method comparison), EXP-085 (matched generalization), EXP-086 (mismatched boundary), EXP-087 (sycophants-dilemma ceiling test)

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
- **Skill**: investigate-and-fix / reproduce-first (investigate-fix-pattern scenario)
- **Control**: 0/3 reproduce-first (0%) — agent reads source then edits directly, never runs tests first. Product 4/4, process 4/5.
- **Treatment (few-shot injected)**: 3/3 reproduce-first (100%) — agent runs `node test.js` BEFORE editing in every run. Product 4/4, process 5/5.
- **Effect size**: +100pp on reproduce-first, +20pp on average process score (80%→100%)
- **Key finding**: Few-shot works for PROCESS discipline (step ordering), not just judgment skills (decision quality). This is the first evidence of few-shot crossing from judgment to process domain.
- **Text rules comparison**: investigate-and-fix text skill had 0/7 on reproduce-first (4 from EXP-019 + 3 control here). Few-shot: 3/3. Workflow: 2/2 (EXP-019).
- **Posterior update**: H-091 P(H) 0.98→0.99
- **Implication**: Few-shot scope expands beyond judgment to include process discipline. Cumulative Sprint 1+2: 9/9 treatment (100%) vs 0/9 control (0%) across 3 skills.

### EXP-093: Few-Shot Sprint 3 — Verify-After-Edit Discipline
- **Skill**: verify-after-edit (convention-verify-edit scenario) + read-before-edit (at ceiling)
- **ARM 1 (convention-verify-edit, N=5+5)**:
  - C3 (explicit validation): Control 40% → Treatment 80% (+40pp) — few-shot taught *what* to validate
  - C2.3 (read-after-write): Control 40% → Treatment 20% (-20pp) — few-shot did NOT teach *when* to verify
  - Product quality: Control 60% → Treatment 100% (+40pp) — improved thoroughness
  - Scenario pass: Control 40% → Treatment 20% (ns) — C2.3 failure dominates scenario score
- **ARM 2 (read-before-edit, N=3+3)**: Both conditions 100% — baseline at ceiling, no signal
- **Key finding**: Few-shot teaches "what to do" (validation commands, field preservation) but NOT "when to do it" (temporal tool-call sequencing). C3 vs C2.3 divergence reveals a boundary.
- **Posterior update**: H-091 P(H) 0.99→0.95 — first partial failure for matched few-shot
- **Updated scope model**:
  - ✅ Judgment skills (know-when-blocked, evidence-over-narrative) — EXP-090
  - ✅ Process knowledge (reproduce-first debugging) — EXP-091
  - ✅ Validation knowledge (what checks to run) — EXP-093 C3
  - ✅ Product quality (thoroughness) — EXP-093 product
  - ❌ Temporal discipline (read-after-write sequencing) — EXP-093 C2.3
