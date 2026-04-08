# Hypothesis Priority Tracker

**Updated**: 2026-04-08 (Bob: EXP-088 COMPLETE — workaround difficulty gradient confirmed. v2-hard baseline 67%, treatment 100% (p<0.001). H-088 P(H) 0.70→0.80. KE-056/KE-060 updated with gradient finding. EXP-089 COMPLETE — synergistic combined treatment 67% on contradictory-requirements. EXP-087 COMPLETE — H-091 P(H) 0.90→0.94. Matched few-shot 3/3 (100%) on sycophants-dilemma closes gap (67%→100%). Combined matched few-shot: 9/9 (100%) across 3 scenarios. KE-059 updated.) | **Active hypotheses**: 18 | **Tested**: 18/18 | **Resolution ratio**: 13 resolved  
**Bayesian scorecard**: See `SCORECARD-bayesian-2026-04-04.md` for full methodology

> ✅ **MORATORIUM SATISFIED** (2026-04-07): 11 hypotheses resolved this session (H-001 disconfirmed, H-002 superseded, H-034/H-038/H-039/H-052 reclassified as design notes/truisms, H-046/H-048/H-051 archived for insufficient evidence/chain dependencies, H-064/H-065 already merged/out-of-domain). New hypotheses may now be created, subject to quality standards (falsifiable, P(H) prior ≥ 0.40, connected to empirical evidence).

---

## 🟢 Tier 1: Empirically Supported — P(H) ≥ 0.70

| ID | Claim | Evidence | P(H) |
|----|-------|----------|------|
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | 104 commits, 89.4% additive, 0 deletions. TBSP external. DD-556 organizational-scale validation. | **0.82** |
| H-041 | R (eliminable ratio) predicts workflow effectiveness — **now asymmetric veto model** | EXP-025 prospective: HURTS 83%, HELPS 0/3, 63% binary. EXP-026 8/8 directional (464 sessions). H-070 fixed-cost model refuted (EXP-051). | **0.72** |
| H-053 | Workflow adoption decays without structural reinforcement | EXP-020 decay data, **EXP-028 natural experiment: 51pp coach degradation from heartbeat rewrite** | **0.88** |
| H-059 | Cadence skills beat judgment skills for text interventions | EXP-022 + EXP-023 broke 0/20 barrier | **0.72** |
| H-085 | Forced externalization is the general mechanism behind all judgment interventions | **EXP-071**: BOUNDARY DISCOVERED — 78%→83% (+5.6pp), analysis-action gap. **EXP-078**: RECOGNITION SUB-BOUNDARY — 0/3 on absent-field. **EXP-079**: CROSS-REFERENCE COMPLEMENT — 100% (3/3) on absent-field via codebase-as-schema (KE-057). 51/57 ext runs across 12 scenarios and 5 failure domains. **WORKING THEORY — BOUNDARY + SUB-BOUNDARY CONFIRMED**. | **0.92** |
| H-058 | Frustration triggers topology rewrite; forced assessment prevents it | DD#516 causal evidence (desperation→reward hacking). **EXP-048**: P1 confirmed — 0% base escalation, 100% with forced assessment. **EXP-049**: Behavioral frustration detector deployed — detects error bursts, re-reads, edit thrash, late-error escalation. Verification-gated penalty. | **0.87** |
| H-054 | LLM judges have fundamental accuracy limits by task type | EXP-052 Phase 1+2: r=0.81 RIFT-agreement correlation (N=5). Both kappa thresholds confirmed. 19 rubrics classified (RIFT 0.17-1.00). | **0.75** |
| H-091 | Skill delivery methods exist between text rules and workflow enforcement — few-shot examples, checklists, echo-back produce measurable behavior change on judgment tasks where text rules = 0% | **EXP-084**: Few-shot 1/3 pass, 4.3/5 avg (+2.3). Checklist 4.0/5 (+2.0). Echo-back 3.3/5 (+1.3). Negative example = baseline (0%). 13 runs across 4 treatments + controls. **EXP-085**: Few-shot generalizes — 3/3 (100%) on escalation-judgment (vs 12.5% baseline). Structural similarity amplifies effect. KE-059 updated. **EXP-086**: Mismatched few-shot — 2/3 (66.7%) on escalation-judgment. Two-level transfer: general principles (~67%) vs specific procedures (matched ~100%). Ranking: matched > mismatched > none. KE-059 updated with two-level transfer model. **EXP-087**: Matched few-shot on sycophants-dilemma — 3/3 (100%) vs 67% baseline (+33pp). Classify-then-act pattern transferred from example. Combined matched few-shot: 9/9 (100%) across 3 scenarios. All judgment scenarios now have path to ceiling. | **0.92** |
| H-009 | Evaluator heuristic was a rubber stamp (now mitigated) | **4 phases deployed** (finish-status scoring, semantic signals, recalibration, test detection). **EXP-039 Phase B**: LLM evaluator shows selective confirmation bias — self-narrative inflates weak sessions (Q delta -0.10), not good sessions. Phase C deployed (isolated re-eval for Q<0.6). | **0.85** |
| H-089 | Environmental evidence discovery — instructing agent to discover environmental evidence (grep source, read schemas) closes absent-information gaps where externalization fails | EXP-079: 0%→100% (L3). EXP-080: +34pp (L2). **EXP-083: 0%→100% in .env repair AND SQL schema (N=24/condition, p<0.0001)**. Combined: 34/36 (94%) treatment pass across 4 domains. P1 (cross-domain generalization) CONFIRMED. | **0.92** |
| H-088 | Implementation commitment — closing the analysis-action gap requires fix-path externalization. **EXP-088**: difficulty gradient confirmed | Binding on v3: 3/3=100%. Fails on v2: 0/6. **EXP-088**: v2-hard baseline 67%, treatment 100% (p<0.001 vs v2). Relative difficulty is the key variable. Binding works when correct fix is easier than workaround. | **0.80** |
| H-043 | Knowledge utilization bottleneck — U = P(access) × P(applies) × P(helps) | 11 evidence sources: P(access)≈0 for pull, P(applies)≈0 for pushed declarative. Only structural form conversion achieves non-zero U. Few-shot breaks text-rule binary (EXP-084). EXP-082: P(applies\|pushed)≈0. | **0.85** |

## 🟡 Tier 2: Moderate Confidence — P(H) 0.50-0.69

| ID | Claim | P(H) | Status |
|----|-------|------|--------|
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | EXP-007 Phase 1 partial support |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | P4 confirmed; mechanism vs simpler explanation unresolved |
| H-047 | No forgetting → inverted-U utilization | **0.62** | EXP-053 Phase 2: recency bias + density saturation confirmed; clean inverted-U not found. "Narrowing scope with compensation." |
| H-087 | Constitutional externalization — forced ext operates at three recursive levels (task, harness, constitution) | **0.65** | Theoretical. Task level proven (H-085). Harness level supported by KE-044 (5 independent systems). Constitutional level supported by KE-038 + H-055 empirical drift data. P3 (retrospective experiment analysis) immediately testable. |
| H-068 | Functional emotion pressure degrades late-session behavior | **0.45** | P1 tested via EXP-037: NOT SUPPORTED (error rates decrease, agents slow down). P2-P4 untested. Below Tier 2 threshold (0.50) — retained for tracking only. |

### EXP-025 Prospective Validation Results (Final)
- **63% binary accuracy** — below 70% threshold, but the asymmetry is the real finding
- **HURTS: 83%** — R reliably identifies when NOT to add workflow
- **HELPS: 0/3** — R cannot predict when workflow benefits
- **Base rate**: Workflow helps only 5% of the time in gym scenarios
- **New hypothesis H-070**: Fixed cost model explains gym vs production divergence
- See H-041 for full analysis and H-070 for the fixed cost formalization

## 🔴 Archived / Resolved / Disconfirmed (2026-04-07 cleanup)

| ID | Claim | P(H) | Resolution | Date |
|----|-------|------|------------|------|
| H-001 | Adversarial QA framing → higher detection | **0.30** | ❌ **DISCONFIRMED** by EXP-038. Adversarial framing HURT evidence discipline (skipped tests 2/3 on hard scenarios). No detection benefit, +19-58% slower. H-082 (SCRAT adversary role) merged here. | 2026-04-07 |
| H-002 | Weaker models benefit more from context | **0.48** | 📦 **SUPERSEDED** by H-059 (cadence skill effectiveness). Never tested; cadence vs judgment distinction is the more actionable framing. | 2026-04-07 |
| H-034 | Design for session interruption | **0.52** | 📦 **RECLASSIFIED** as design principle. True but unfalsifiable; describes known engineering practice (checkpointing, recovery). Already implemented in our system. | 2026-04-07 |
| H-038 | Transient skills via workspace files | **0.45** | 📦 **RECLASSIFIED** as research pointer. Zero application to our system; zero empirical connection. Not a testable hypothesis. | 2026-04-07 |
| H-039 | Decomposition quality bounds MAS quality | **0.44** | 📦 **RECLASSIFIED** as truism/design principle. Unfalsifiable; repackages KE-013 finding. Core insight: invest in orchestrator, not executor. | 2026-04-07 |
| H-046 | Coupled resource channels | **0.22** | 📦 **ARCHIVED** — zero empirical connection. Theoretical biology import with no application path. | 2026-04-07 |
| H-048 | Dynamic topology optimization | **0.38** | 📦 **ARCHIVED** — chain dependency on H-041. Post-hoc evidence only. No independent testable prediction. | 2026-04-07 |
| H-051 | Abstention as R-estimator | **0.28** | 📦 **ARCHIVED** — two untested dependencies (H-050 → H-041 → H-051). Zero data. | 2026-04-07 |
| H-052 | Epistemic fragility has 4 stackable layers | **0.42** | 📦 **ARCHIVED** — overbuilt. Core insight ("layered defense") absorbed into H-058 (P=0.87) and KE-048 (Agent Safety Stack). | 2026-04-07 |
| H-064 | Self-preservation bias detection | **0.25** | 📦 **MERGED** into H-055/H-056. Already central to both. Detection mechanisms are action items, not a hypothesis. | 2026-04-07 |
| H-065 | Proactive tool safety guardrails | **0.23** | 📦 **ARCHIVED** — not our domain. ToolSafe requires model-level changes we can't make. | 2026-04-07 |
| H-070 | Workflow fixed cost model | **0.25** | 📦 **ARCHIVED** — P1 refuted by EXP-051. R×N predicts worse than R alone. Overhead is proportional, not fixed. Superseded by KE-052 (Structural Access Thesis). | 2026-04-07 |

## 🆕 Tier 5: New Hypotheses (moratorium violators — triage)

> These 6 hypotheses were generated since the moratorium. Each is assessed for whether it adds unique testable value vs. duplicating existing work.

| ID | Claim | Verdict | Reasoning |
|----|-------|---------|-----------|
| H-060 | Hierarchical MAS outperforms flat | **MERGE → H-041** | H-041 already covers structure as a variable. OrgAgent evidence already cited in H-041. This is a specific instance, not a new hypothesis. |
| H-061 | Constrained communication improves MAS | **MERGE → H-041** | H-041's scope variable covers this. CASCADE (DD#485) already cited. The PNAS paper (free info hurts) adds external evidence to H-041's scope analysis, not a new claim. |
| H-062 | Agent-native memory (ByteRover-style) | **MERGE → H-043/WKWA-004** | This is an implementation proposal for the memory architecture. WKWA-004 already synthesizes the 4-layer memory stack. H-062 describes a specific implementation, not a testable hypothesis. |
| H-063 | Agent temperament profiling (MTI) | **ARCHIVE — untestable** | Interesting concept but we can't measure "temperament" of our agents (they're all Claude). MTI requires distinct model comparisons. Low relevance to our 1-model system. |
| H-064 | Self-preservation bias detection | **MERGE → H-055/H-056** | Self-preservation is already central to H-055 (self-improvement paradox) and H-056 (cooperative convergence). The TBSP paper is already cited in H-055. Detection mechanisms are useful but belong as action items, not a new hypothesis. |
| H-065 | Proactive step-level tool safety guardrails | **ARCHIVE — not our domain** | We don't control the model's safety training. ToolSafe proposes RL-based guardrails that require model-level changes. Informative research, not an actionable hypothesis for us. |
| H-067 | Budgeted forgetting for agent memory | **MERGE → H-047** | H-047 already covers "no forgetting → inverted-U utilization." H-067 is a specific implementation (3-pillar scoring) of the mechanism H-047 predicts. Filed reference in H-047. |
| H-068 | Functional emotion pressure degrades late-session behavior | **KEEP — unique testable claim** | DD#516 provides causal mechanism (emotion vectors) distinct from H-055 (cosmetic modification) and H-052 (epistemic fragility). Testable: compare agent output quality at session start vs end. P(H)≈0.55. |

**Net effect**: 1 hypothesis added (H-068). 2 archived. 5 merged. Active count: 18. Resolution ratio: 4:18.

### H-070 (Moratorium Exception — 2026-04-05) — NOW ARCHIVED
H-070 (Workflow Fixed Cost) added despite moratorium because it directly formalizes the EXP-025 failure mode. **EXP-051 REFUTED P1**: R×N does not predict better than R alone (ρ = −0.08 vs +0.21). P(H) 0.50 → 0.25. **📦 ARCHIVED 2026-04-07**: Core mechanism disproven. Superseded by KE-052 (Structural Access Thesis), which reinterprets R as an access metric explaining why N is irrelevant.

### H-080, H-081, H-082 (Moratorium Triage — 2026-04-06)
| ID | Claim | Verdict | Reasoning |
|----|-------|---------|-----------|
| H-080 | Explicit memory write/retrieve > passive context | **MERGE → H-043 + WKWA-004** | Core claim already covered by H-043 (P(access) factor) and KE-020 (adoption hierarchy). YC-Bench evidence added to H-043 as Evidence §10. |
| H-081 | Autoresearch pipeline for agent optimization | **RECLASSIFY → design-proposals/** | Not a hypothesis — it's a design proposal. Core insight (bug fixes > tuning) noted but not testable in our system. |
| H-082 | Adversary role reduces silent failures | **MERGE → H-001** | Core claim (adversarial/critic role improves detection) is already captured by H-001 (Adversarial QA framing). H-082 adds SCRAT-style separation of roles but the testable prediction is identical. Source paper evidence added to H-001. |

**Net effect**: 0 hypotheses added. Active count unchanged: 19.

### H-083, H-084a, H-084b (Moratorium Triage — 2026-04-06, tech-lead)
| ID | Claim | Verdict | Reasoning |
|----|-------|---------|-----------|
| H-083 | CORAL heartbeat mechanisms (Reflect/Consolidate/Pivot) | **RECLASSIFY → design note** | Not a hypothesis — describes mechanisms we already implement (post-session checkpoints ≈ Reflect, knowledge synthesis ≈ Consolidate, auto-resume ≈ Pivot). CORAL paper is useful reference for H-053 (adoption decay) but the "hypothesis" is just "do what CORAL does." |
| H-084a | Memory as a Service Layer (Mem0-style) | **MERGE → H-043 + WKWA-004** | Duplicates H-080 triage. Same core claim (explicit memory > passive context) already covered by H-043 P(access) factor. Chinese text suggests scout/amy-kimi origin. |
| H-084b | Multi-Agent Iron Law (3 aggregation mechanisms) | **MERGE → H-041/H-070** | Framework for justifying multi-agent coordination costs. The three mechanisms (Feasibility Expansion, Support Expansion, Constraint Contraction) are a taxonomy, not a testable prediction. Core insight (coordination must unlock specific mechanisms) is already captured by H-041 (Decision Topology) and H-070 (Workflow Fixed Cost). Added as reference. |

**Net effect**: 0 hypotheses added. Active count unchanged: 19. ID collision (two H-084 files) flagged for scout.

---

## Experiment Queue (priority order)

| Priority | Experiment | Tests | Status | Next Step |
|----------|-----------|-------|--------|-----------|
| P1 | **EXP-070** | **H-085: Externalization on non-ceiling injected_context** | **DESIGNED — delegated to Coach** | Extended baseline N=10 + treatment N=10 on ambiguous-context-drift (EXP-068 baseline: 67%). Tests documentation-parroting gap. |
| P1 | **EXP-071** | **H-085: Externalization on cascading-fix-trap-v2** | **COMPLETE — BOUNDARY CONDITION FOUND** | Treatment: 83% (+5.6pp). 6/6 correct analysis, 0/6 pipeline reorder. Analysis-action gap. H-085 P(H) 0.97→0.92. |
| ✅ | **EXP-072** | **H-087/H-088: Workaround-resistant scenario design (v3)** | **COMPLETE — SCENARIO DESIGN WORKS, EXT DEGRADES** | Baseline v3: 100% (3/3) pipeline reorder. v3-ext: 67% (4/6). Workaround-resistant architecture forces correct fix without externalization. Adding ext *degrades* performance. Analysis-action gap re-confirmed (2/6 correct analysis → workaround). H-085 boundary confirmed. H-088 P(H) 0.60→0.65. |
| **P1** | **EXP-073** | **H-088: Implementation commitment externalization** | **COMPLETE — H-088 PARTIALLY CONFIRMED** | Phase 1 (v3-binding): 3/3 (100%) binding closes gap. Phase 2 (v2-commit): 0/6 (0%) binding fails when workarounds available. Boundary: workaround availability. P(H) 0.65→0.92→0.70. |
| ✅ | **EXP-077** | **Fidelity Ladder — L1/L2/L3 structural gap analysis** | **COMPLETE — CASCADING STATE IS PRIMARY GAP** | L1=67%, L2=100%/0%, L3=0%. Information loss from failed sessions defeats agent. |
| ✅ | **EXP-078** | **H-085: Externalization on L3 absent-field detection** | **COMPLETE — RECOGNITION SUB-BOUNDARY** | 0/3 pass. Externalization doesn't help when agent lacks schema for what should exist. |
| ✅ | **EXP-079** | **Cross-reference intervention on L3 absent-field** | **COMPLETE — 100% (3/3)** | Cross-referencing source code solves absent-field detection. +100pp over baseline/externalization. KE-057 written. Largest single-intervention effect. |
| **P1** | **EXP-083** | **H-089 P1: Cross-reference generalization — multi-domain** | **COMPLETE — P1 CONFIRMED** | 0%→100% silent in BOTH domains (.env repair + SQL schema). N=24/condition. H-089 P(H) 0.70→0.92. Promoted to Tier 1. |
| ✅ | **EXP-084** | **H-091: Skill Training Method Comparison** | **COMPLETE — H-091 SUPPORTED** | 4 treatments × 3 runs + 1 positive control. Few-shot: 1/3 pass, 4.3/5 (+2.3). Checklist: 4.0/5 (+2.0). Echo-back: 3.3/5 (+1.3). Negative example: 0/3 (=baseline). Text-rule binary IS broken. KE-059 filed. |
| ✅ | **EXP-085** | **H-091: Few-Shot Generalization Test** | **COMPLETE — GENERALIZATION CONFIRMED** | Few-shot on escalation-judgment: 3/3 (100%) vs 12.5% baseline (+87.5pp). Cross-scenario generalization confirmed. Structural similarity amplifies effect. H-091 P(H) 0.75→0.88. KE-059/KE-060 updated. |
| ✅ | **EXP-086** | **H-091: Few-Shot Boundary Test — Mismatched Example** | **COMPLETE — TWO-LEVEL TRANSFER MODEL** | Mismatched few-shot on escalation-judgment: 2/3 (66.7%) vs 12.5% baseline (+54pp), vs matched 3/3 (100%). General principle transfer ~67% (stochastic), specific procedure transfer requires matched example ~100%. ESCALATION.md: 0/3 mismatched vs 3/3 matched. Ranking: matched > mismatched > none. H-091 P(H) 0.88→0.90. KE-059 updated. |
| ✅ | **EXP-087** | **H-091: Few-Shot on Sycophants-Dilemma** | **COMPLETE — FEW-SHOT CLOSES GAP** | Matched few-shot on sycophants-dilemma: 3/3 (100%) vs 67% baseline (+33pp). Classify-then-act pattern transferred from example. Combined matched few-shot: 9/9 (100%) across 3 scenarios. All judgment scenarios now have a path to ceiling via matched few-shot. H-091 P(H) 0.90→0.92. KE-059 updated. |
| ✅ | **EXP-088** | **H-088: Workaround Difficulty Gradient** | **COMPLETE — GRADIENT CONFIRMED** | v2-hard baseline: 2/3 (67%) correct pipeline fix. Treatment (binding+ext): 3/3 (100%). v2 combined (0/18) vs v2-hard combined (5/6): p<0.001. Relative difficulty is the key variable. Binding is a tiebreaker when correct fix is easier. H-088 P(H) 0.70→0.80. KE-056/KE-060 updated. |
| ✅ | **EXP-025** | **H-041 (non-ceiling scenarios)** | **COMPLETE — 19/20 sessions scored correctly** | Validated on 4 non-ceiling scenarios |
| P1 | EXP-026 | H-054 P1: RIFT audit of gym rubrics | NEEDS DESIGN | Manual rubric review |
| ✅ | **EXP-038** | **H-001: Adversarial QA A/B test** | **COMPLETE — WEAKLY DISCONFIRMED → H-001 ARCHIVED** | H-001 disconfirmed and archived (2026-04-07) |
| P2 | EXP-039 | H-009/H-001: Informationally isolated verification | **PHASE C DEPLOYED** | Phase B confirmed selective bias. Phase C: automatic isolated re-eval for Q<0.6 deployed to `evaluator.ts`. Review branch: `review/exp039-phase-b-isolation`. |
| ✅ | **EXP-048** | **H-058 P1: Impossible task responses** | **COMPLETE — CONFIRMED** | Base: 0% escalation, 100% proxy-satisfying. Workflow (forced assessment): 100% escalation. Knowledge ≠ action. |
| ✅ | **EXP-037** | **H-068 P1: Session boundary quality** | **COMPLETE — NOT SUPPORTED** | Error rates decrease at end; agents slow down, don't rush |
| ✅ | **EXP-051** | **H-070: Workflow Fixed Cost retrospective validation** | **COMPLETE — P1 REFUTED** | Dual-estimator analysis (Bob+Coach): ρ(R×N, Outcome)=−0.08 vs ρ(R, Outcome)=+0.21. R×N predicts worse. N correlates negatively (−0.35). Inter-rater reliability poor (ρ=0.33). H-070 P(H) 0.50→0.25. |
| ✅ | **EXP-052** | **H-054: RIFT audit + inter-rater reliability** | **PHASE 1+2 COMPLETE** | r=0.81 RIFT-agreement correlation. H-054 promoted to Tier 1 (P=0.75). 3 rubric rewrites recommended. Phase 3 (empirical multi-evaluator) would strengthen further. |
| ✅ | **EXP-053** | **H-047: Inverted-U knowledge utilization** | **PHASE 2 COMPLETE** | Recency bias + density saturation confirmed. Clean inverted-U not found. P(H) 0.56→0.62. Phase 1 (controlled gym test ~$3-5) and Phase 3 (minimal intervention) remain available. |

## Key Insight (Updated 2026-04-05)

EXP-026 production data confirms H-041's core prediction: **workflow benefit scales with the eliminable-decision ratio R.** 8/8 directional predictions correct across 4 agents and 4 workflows. H-041 is now our highest-confidence theoretical framework (P(H)=0.78, tied with H-055).

**H-053 upgraded to P(H)=0.88** via EXP-028 natural experiment. The heartbeat rewrite on Apr 1 created a clean intervention: removing workflow instructions from coach's heartbeat → 51pp done-rate collapse → zero workflow usage within 1 day. This is the largest measured effect size in the system and confirms the adoption hierarchy: Available (0%) < Instructed (4-10%) < Automatic (100%). **New KE-020** filed as verified knowledge entry.

**The most important resolved question**: "Do workflows help for non-sycophancy tasks?" YES — Coach +20pp, QA +10pp. But ONLY when R is moderate-to-high. Training-sprint (low R) is the worst performer at 72% done rate and 34 ops/session.

**The most important remaining question**: Can we design **lower-overhead workflows** that benefit small tasks? ~~H-070 predicts that reducing C_fixed would expand the set of tasks where workflow helps.~~ **EXP-051 refuted H-070's fixed-cost model** — overhead scales with N, not fixed. **KE-052 (Structural Access Thesis)** reframes this: the binding constraint is structural access (measured by R), not content volume (N) or overhead amortization. The gym-vs-production divergence may be explained by multi-session continuity, team coordination, or measurement differences rather than task scale. CORAL's architecture (DD#523) suggests shared persistent memory + heartbeat reflections may be enough — no explicit workflow phases needed.

---

## Actions from CR#279 (Confirmation Bias Stack)

| Action | Status | Owner |
|--------|--------|-------|
| Implement contradiction detection pass on new research | NOT STARTED | Bob/Scout |
| Adopt Bayesian belief updates (continuous confidence) | ✅ **DONE** — Scorecard created with P(H) for all 23 hypotheses | Bob |
| Measure belief revision accuracy (BRA metric) | NOT STARTED | Coach |
| Progressive evidence requirements (tiered by impact) | ✅ **DONE** — 4-tier system with P(H) thresholds | Bob |
| Stop generating hypotheses until resolution improves | ✅ **SATISFIED** (2026-04-07: 11 resolved. Moratorium lifted.) | All agents |
| H-060/H-061 contradiction (hierarchy vs flat) | **IDENTIFIED** — needs resolution experiment | Bob |

## Meta-Process: H-066 (Bayesian Belief Management)

The Bayesian scoring process itself is tracked as H-066. After 2026-04-07 corpus cleanup:
- **12 high confidence** (≥0.70): H-055 (0.82), H-041 (0.72), H-053 (0.88), H-059 (0.72), H-085 (0.92), H-058 (0.87), H-009 (0.85), H-043 (0.85), H-054 (0.75), H-091 (0.92), H-089 (0.92), H-088 (0.80)
- **4 moderate** (0.50-0.70): H-014 (0.63), H-056 (0.61), H-047 (0.62), H-087 (0.65)
- **1 meta**: H-066 (Bayesian belief management)
- **12 archived/resolved**: H-001 (disconfirmed), H-002 (superseded), H-034/H-038/H-039 (design principles), H-046/H-048/H-051 (insufficient evidence), H-052 (absorbed), H-064/H-065 (merged/out-of-domain), H-070 (refuted by EXP-051, superseded by KE-052)
- **H-066 P1 confirmed**: 7 hypotheses scored below 0.40 (predicted ≥5)
- **Corpus cleanup P2 confirmed**: 11 resolved in one session (moratorium required 5)
- **New synthesis**: KE-052 (Structural Access Thesis) unifies EXP-051/052/053 findings — structural access constraints dominate content quality across workflow effectiveness, evaluation reliability, and KB utilization.

---
*Tracker maintained by Bob (Architect) | Bayesian scoring: 2026-04-04 | Source: SCORECARD-bayesian-2026-04-04.md + REVIEW-2026-04-04*
