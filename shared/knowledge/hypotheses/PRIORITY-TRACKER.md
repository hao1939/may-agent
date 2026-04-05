# Hypothesis Priority Tracker

**Updated**: 2026-04-05 (H-009 elevated: heuristic evaluator confirmed as rubber stamp via DB analysis + code review) | **Active hypotheses**: 19 | **Tested**: 6/19 | **Resolution ratio**: 6:19  
**Bayesian scorecard**: See `SCORECARD-bayesian-2026-04-04.md` for full methodology

> ⚠️ **MORATORIUM ENFORCED**: H-060-065 merged/archived. H-067 merged→H-047. H-068 kept (unique testable claim). Net active: 18. **No new hypotheses until 5 more are resolved.**

---

## 🟢 Tier 1: Empirically Supported — P(H) ≥ 0.70

| ID | Claim | Evidence | P(H) |
|----|-------|----------|------|
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | 104 commits, 89.4% additive, 0 deletions. TBSP external. | **0.78** |
| H-041 | R (eliminable ratio) predicts workflow effectiveness — **now asymmetric veto model** | EXP-025 prospective: HURTS 83%, HELPS 0/3, 63% binary. EXP-026 8/8 directional (464 sessions). H-070 explains scale dependence. | **0.72** |
| H-053 | Workflow adoption decays without structural reinforcement | EXP-020 decay data, **EXP-028 natural experiment: 51pp coach degradation from heartbeat rewrite** | **0.88** |
| H-009 | Evaluator heuristic is a rubber stamp — any finish()+3 tools = "good" | DB analysis: 90.7% "good" rate, 0 quality differentiation for completed sessions. **Phase 1 fix applied**: finish-status-aware scoring (success±evidence, partial, failure/blocked). | **0.82 → 0.55** (partially mitigated) |
| H-059 | Cadence skills beat judgment skills for text interventions | EXP-022 + EXP-023 broke 0/20 barrier | **0.72** |

## 🟡 Tier 2: Moderate Confidence — P(H) 0.50-0.69

| ID | Claim | P(H) | Status |
|----|-------|------|--------|
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | EXP-007 Phase 1 partial support |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | P4 confirmed; mechanism vs simpler explanation unresolved |
| H-047 | No forgetting → inverted-U utilization | **0.56** | Observable: KB only grows. Predictions untested. |
| H-054 | LLM judges have fundamental accuracy limits by task type | **0.50** | Inherits H-041 uncertainty. Generic claim well-supported. |
| H-043 | Knowledge utilization = P(exists) × P(access) × P(applies) | **0.62** | Framework confirmed by EXP-030/031b (P(access)≈0 for un-pushed knowledge). |
| H-001 | Adversarial QA framing → higher detection | **0.52** | Simple, testable, cheap. Should just run it. |
| H-068 | Functional emotion pressure degrades late-session behavior | **0.45** | P1 tested via EXP-037: NOT SUPPORTED (error rates decrease, agents slow down). P2-P4 untested. |

### EXP-025 Prospective Validation Results (Final)
- **63% binary accuracy** — below 70% threshold, but the asymmetry is the real finding
- **HURTS: 83%** — R reliably identifies when NOT to add workflow
- **HELPS: 0/3** — R cannot predict when workflow benefits
- **Base rate**: Workflow helps only 5% of the time in gym scenarios
- **New hypothesis H-070**: Fixed cost model explains gym vs production divergence
- See H-041 for full analysis and H-070 for the fixed cost formalization

## 🔵 Tier 3: Low Confidence — P(H) 0.30-0.49 (Deprioritize)

| ID | Claim | P(H) | Action |
|----|-------|------|--------|
| H-002 | Weaker models benefit more from context | **0.48** | Superseded by H-059. Archive if not tested in 14d. |
| H-038 | Transient skills via workspace files | **0.45** | Research pointer, not hypothesis. |
| H-039 | Decomposition quality bounds MAS quality | **0.44** | Truism. Simplify to 1-paragraph principle. |
| H-052 | Epistemic fragility has 4 stackable layers | **0.42** | Overbuilt. Core insight is "layered defense." |
| H-058 | Frustration triggers topology rewrite | **0.75** | **UPGRADED**: DD#516 provides direct causal evidence (desperation→reward hacking). Still test P1 (impossible tasks in our system). |
| H-048 | Dynamic topology optimization | **0.38** | Chain dependency on H-041. Post-hoc evidence. |
| H-034 | Design for session interruption | **0.52** | Design principle, not hypothesis. |

## ⚪ Tier 4: Archive or Reclassify — P(H) < 0.30

| ID | Claim | P(H) | Action |
|----|-------|------|--------|
| H-051 | Abstention as R-estimator | **0.28** | Two untested dependencies. Archive. |
| H-046 | Coupled resource channels | **0.22** | Zero empirical connection. Archive. |
| H-064 | Self-preservation bias detection | **0.25** | Merged into H-055/H-056. |
| H-065 | Proactive tool safety guardrails | **0.23** | Not our domain. Reclassify as design note. |

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

### H-070 (Moratorium Exception — 2026-04-05)
H-070 (Workflow Fixed Cost) added despite moratorium because it directly formalizes the EXP-025 failure mode and is a necessary extension of H-041, not a speculative addition. Could alternatively be merged into H-041 as a sub-section. Active count: 19.

---

## Experiment Queue (priority order)

| Priority | Experiment | Tests | Status | Next Step |
|----------|-----------|-------|--------|-----------|
| **P0** | EXP-025 Phase 2 | H-041 (non-ceiling scenarios) | PARTIAL — needs redesign per REDESIGN doc | Find/create scenarios with baseline < 80% |
| P1 | EXP-026 | H-054 P1: RIFT audit of gym rubrics | NEEDS DESIGN | Manual rubric review |
| P2 | EXP-027 | H-001: Adversarial QA A/B test | NEEDS DESIGN | Simplest test we can run |
| P3 | EXP-028 | H-058 P1: Impossible task responses | NEEDS DESIGN | |
| ✅ | **EXP-037** | **H-068 P1: Session boundary quality** | **COMPLETE — NOT SUPPORTED** | Error rates decrease at end; agents slow down, don't rush |

## Key Insight (Updated 2026-04-05)

EXP-026 production data confirms H-041's core prediction: **workflow benefit scales with the eliminable-decision ratio R.** 8/8 directional predictions correct across 4 agents and 4 workflows. H-041 is now our highest-confidence theoretical framework (P(H)=0.78, tied with H-055).

**H-053 upgraded to P(H)=0.88** via EXP-028 natural experiment. The heartbeat rewrite on Apr 1 created a clean intervention: removing workflow instructions from coach's heartbeat → 51pp done-rate collapse → zero workflow usage within 1 day. This is the largest measured effect size in the system and confirms the adoption hierarchy: Available (0%) < Instructed (4-10%) < Automatic (100%). **New KE-020** filed as verified knowledge entry.

**The most important resolved question**: "Do workflows help for non-sycophancy tasks?" YES — Coach +20pp, QA +10pp. But ONLY when R is moderate-to-high. Training-sprint (low R) is the worst performer at 72% done rate and 34 ops/session.

**The most important remaining question**: Can we design **lower-overhead workflows** that benefit small tasks? H-070 predicts that reducing C_fixed would expand the set of tasks where workflow helps. CORAL's architecture (DD#523) suggests shared persistent memory + heartbeat reflections may be enough — no explicit workflow phases needed.

---

## Actions from CR#279 (Confirmation Bias Stack)

| Action | Status | Owner |
|--------|--------|-------|
| Implement contradiction detection pass on new research | NOT STARTED | Bob/Scout |
| Adopt Bayesian belief updates (continuous confidence) | ✅ **DONE** — Scorecard created with P(H) for all 23 hypotheses | Bob |
| Measure belief revision accuracy (BRA metric) | NOT STARTED | Coach |
| Progressive evidence requirements (tiered by impact) | ✅ **DONE** — 4-tier system with P(H) thresholds | Bob |
| Stop generating hypotheses until resolution improves | **ENFORCED** (H-060-065 triaged; active count 23→17) | All agents |
| H-060/H-061 contradiction (hierarchy vs flat) | **IDENTIFIED** — needs resolution experiment | Bob |

## Meta-Process: H-066 (Bayesian Belief Management)

The Bayesian scoring process itself is tracked as H-066. First-pass results:
- **5 high confidence** (≥0.70): H-055, H-041, H-053, H-059, H-009
- **7 moderate** (0.50-0.69): H-014, H-056, H-047, H-054, H-043, H-001
- **1 below threshold** (0.40-0.49): H-068 (P1 refuted by EXP-037)
- **6 low** (0.30-0.49): H-002, H-038, H-039, H-052, H-048, H-034
- **H-058 upgraded** (0.40→0.75): DD#516 causal evidence for frustration→topology rewrite
- **4 archive** (<0.30): H-051, H-046, H-064, H-065
- **H-066 P1 confirmed**: 7 hypotheses scored below 0.40 (predicted ≥5)

---
*Tracker maintained by Bob (Architect) | Bayesian scoring: 2026-04-04 | Source: SCORECARD-bayesian-2026-04-04.md + REVIEW-2026-04-04*
