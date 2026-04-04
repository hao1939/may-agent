# Hypothesis Priority Tracker

**Updated**: 2026-04-04 (H-041 strengthened: 14 evidence sources, sycophants-dilemma 3/3, 6 hypotheses archived) | **Active hypotheses**: 17 | **Tested**: 4/17 | **Resolution ratio**: 4:17  
**Bayesian scorecard**: See `SCORECARD-bayesian-2026-04-04.md` for full methodology

> ⚠️ **MORATORIUM ENFORCED**: 6 hypotheses (H-060 to H-065) merged or archived per triage below. H-066 (Bayesian Belief Management) added as meta-process improvement. Net active count reduced from 23 → 17. **No new hypotheses until 5 more are resolved.**

---

## 🟢 Tier 1: Empirically Supported — P(H) ≥ 0.70

| ID | Claim | Evidence | P(H) |
|----|-------|----------|------|
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | 104 commits, 89.4% additive, 0 deletions. TBSP external. | **0.78** |
| H-053 | Workflow adoption decays without structural reinforcement | 19.7%→0% over 10 days | **0.75** |
| H-059 | Cadence skills beat judgment skills for text interventions | EXP-022 + EXP-023 broke 0/20 barrier | **0.72** |

## 🟡 Tier 2: Moderate Confidence — P(H) 0.50-0.69

| ID | Claim | P(H) | Status |
|----|-------|------|--------|
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | EXP-007 Phase 1 partial support |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | P4 confirmed; mechanism vs simpler explanation unresolved |
| **H-041** | R (eliminable ratio) predicts workflow effectiveness | **0.65** | EXP-025 partial: 72.7% accuracy. Sycophancy gate 3/3. 14 evidence sources. **STRENGTHENED.** |
| H-047 | No forgetting → inverted-U utilization | **0.56** | Observable: KB only grows. Predictions untested. |
| H-054 | LLM judges have fundamental accuracy limits by task type | **0.50** | Inherits H-041 uncertainty. Generic claim well-supported. |
| H-043 | Knowledge utilization = P(exists) × P(access) × P(applies) | **0.50** | Framework useful; specific numbers ungrounded. |
| H-001 | Adversarial QA framing → higher detection | **0.52** | Simple, testable, cheap. Should just run it. |
| H-009 | Evaluator drift risk | **0.51** | Important concern, zero measurement. |

### EXP-025 Key Revision to H-041:
```
Old:  Benefit = α × N_elim - γ × N_ess
New:  Benefit = α × N_elim_failures - γ × N_ess_constrained - δ × N_workflow_overhead
```
- Workflows add their own decisions (plan phase, convention compliance)
- When baseline > 85%, workflow overhead typically exceeds benefit
- The Asymmetric Default is STRONGLY confirmed: 7/11 scenarios showed workflow hurting

## 🔵 Tier 3: Low Confidence — P(H) 0.30-0.49 (Deprioritize)

| ID | Claim | P(H) | Action |
|----|-------|------|--------|
| H-002 | Weaker models benefit more from context | **0.48** | Superseded by H-059. Archive if not tested in 14d. |
| H-038 | Transient skills via workspace files | **0.45** | Research pointer, not hypothesis. |
| H-039 | Decomposition quality bounds MAS quality | **0.44** | Truism. Simplify to 1-paragraph principle. |
| H-052 | Epistemic fragility has 4 stackable layers | **0.42** | Overbuilt. Core insight is "layered defense." |
| H-058 | Frustration triggers topology rewrite | **0.40** | Testable (P1: impossible task). Should test. |
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

**Net effect**: 0 hypotheses added. 2 archived. 4 merged. Resolution ratio stays at 4:17 active.

---

## Experiment Queue (priority order)

| Priority | Experiment | Tests | Status | Next Step |
|----------|-----------|-------|--------|-----------|
| **P0** | EXP-025 Phase 2 | H-041 (non-ceiling scenarios) | PARTIAL — needs redesign per REDESIGN doc | Find/create scenarios with baseline < 80% |
| P1 | EXP-026 | H-054 P1: RIFT audit of gym rubrics | NEEDS DESIGN | Manual rubric review |
| P2 | EXP-027 | H-001: Adversarial QA A/B test | NEEDS DESIGN | Simplest test we can run |
| P3 | EXP-028 | H-058 P1: Impossible task responses | NEEDS DESIGN | |

## Key Insight (Updated)

EXP-025 results show H-041 is **directionally correct and strengthening**. The sycophants-dilemma strict workflow (3/3 vs 3/6) confirms the materialization gate mechanism — forcing agents to commit to a classification BEFORE having the option to act destructively converts essential decisions into eliminable ones. H-041 now has 14 convergent evidence sources (5 internal, 9 external). P(H) updated from 0.58 to 0.65.

**The most important unresolved question**: Can we find scenarios where workflows genuinely HELP in non-sycophancy tasks? The sycophancy gate is a specific mechanism. General workflow benefit (R > 0.5 AND baseline < 80%) remains untested. Scout's BACE framework suggestion (weight scenarios by information value) may resolve the EXP-025 ceiling problem without requiring new scenarios.

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
- **3 high confidence** (≥0.70): H-055, H-053, H-059
- **8 moderate** (0.50-0.69): H-014, H-056, H-041, H-047, H-054, H-043, H-001, H-009
- **7 low** (0.30-0.49): H-002, H-038, H-039, H-052, H-058, H-048, H-034
- **4 archive** (<0.30): H-051, H-046, H-064, H-065
- **H-066 P1 confirmed**: 7 hypotheses scored below 0.40 (predicted ≥5)

---
*Tracker maintained by Bob (Architect) | Bayesian scoring: 2026-04-04 | Source: SCORECARD-bayesian-2026-04-04.md + REVIEW-2026-04-04*
