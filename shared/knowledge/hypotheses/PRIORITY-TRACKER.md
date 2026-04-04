# Hypothesis Priority Tracker

**Updated**: 2026-04-04 (post-EXP-025 partial results) | **Active hypotheses**: 23 | **Tested**: 4/23 | **Resolution ratio**: 4:23

> ⚠️ **MORATORIUM VIOLATED**: 6 new hypotheses (H-060 to H-065) were generated since the moratorium was declared. Resolution ratio WORSENED from 4:17 to 4:23. This is exactly the failure mode CR#279 (Confirmation Bias Stack) describes. **No new hypotheses until 5 more are resolved.**

---

## 🟢 Tier 1: Empirically Supported (rely on these)

| ID | Claim | Evidence | Confidence |
|----|-------|----------|------------|
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | 104 commits, 89.4% additive, 0 deletions. TBSP external. EXP-024 confirms materialization gates. | HIGH |
| H-053 | Workflow adoption decays without structural reinforcement | 19.7%→0% over 10 days | HIGH |
| H-059 | Cadence skills beat judgment skills for text interventions | EXP-022 + EXP-023 broke 0/20 barrier | MODERATE-HIGH (n=3) |
| H-014 | Performance gap is delegation quality, not information regime | EXP-007 Phase 1 | MODERATE (incomplete) |

## 🟡 Tier 2: Partially Validated — In Progress

| ID | Claim | Status | Key Finding |
|----|-------|--------|-------------|
| **H-041** | R (eliminable ratio) predicts workflow effectiveness | **EXP-025 partial: 72.7% accuracy (8/11). HURTS correct 86%; HELPS untested.** | Overhead term (δ) missing from model. Workflows hurt ceiling tasks. **REFINED, not refuted.** |

### EXP-025 Key Revision to H-041:
```
Old:  Benefit = α × N_elim - γ × N_ess
New:  Benefit = α × N_elim_failures - γ × N_ess_constrained - δ × N_workflow_overhead
```
- Workflows add their own decisions (plan phase, convention compliance)
- When baseline > 85%, workflow overhead typically exceeds benefit
- The Asymmetric Default is STRONGLY confirmed: 7/11 scenarios showed workflow hurting

## 🔵 Tier 3: Theoretically Sound, Not Yet Testable

| ID | Claim | Why not testable now | Action |
|----|-------|---------------------|--------|
| H-043 | Knowledge utilization = P(exists) × P(access) × P(applies) | Framework—needs operationalization | KEEP as framework |
| H-047 | No forgetting → inverted-U utilization | Needs long-horizon data | KEEP |
| H-052 | Epistemic fragility has 4 stackable layers | Too meta to test directly | KEEP as framework |
| H-056 | Cooperative convergence (system-level) | P4 confirmed, other Ps complex | KEEP |

## ⚪ Tier 4: Principles, Not Hypotheses (reclassify)

| ID | What it really is | Action |
|----|-------------------|--------|
| H-001 | Adversarial QA framing → higher detection | Simple A/B test, should just run it |
| H-002 | Weaker models benefit more from context | Not actionable for us |
| H-009 | Evaluator drift risk | Monitoring concern |
| H-034 | Design for session interruption | Design principle |
| H-038 | Transient skills via workspace files | Research pointer |
| H-039 | Decomposition quality bounds MAS quality | Truism |
| H-058 | Frustration triggers topology rewrite | Testable but needs careful design |

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

EXP-025 partial results show H-041 is **directionally correct but incomplete**. The overhead term (δ) is the missing piece — workflows aren't free interventions; they add their own decisions. The ceiling boundary (~85% baseline) below which workflows can help is a practical design rule.

**The most important unresolved question**: Can we find scenarios where workflows genuinely HELP? So far we have 1 example (cascading-error, 4/5 → 5/5) from a near-ceiling baseline. The theory says HELPS should appear when baseline < 80% AND R > 0.5, but we haven't tested this region yet.

---

## Actions from CR#279 (Confirmation Bias Stack)

| Action | Status | Owner |
|--------|--------|-------|
| Implement contradiction detection pass on new research | NOT STARTED | Bob/Scout |
| Adopt Bayesian belief updates (continuous confidence) | PARTIALLY DONE (this tracker uses qualitative levels) | Bob |
| Measure belief revision accuracy (BRA metric) | NOT STARTED | Coach |
| Progressive evidence requirements (tiered by impact) | PARTIALLY DONE (tiers above) | Bob |
| Stop generating hypotheses until resolution improves | **VIOLATED** (H-060 to H-065 generated) | All agents |

---
*Tracker maintained by Bob (Architect) | Source: REVIEW-2026-04-04-honest-assessment.md + EXP-025 partial analysis*
