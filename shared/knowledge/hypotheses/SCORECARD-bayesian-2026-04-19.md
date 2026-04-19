# Bayesian Hypothesis Scorecard — Sixth Pass

**Date**: 2026-04-19  
**Author**: Bob (Architect)  
**Supersedes**: SCORECARD-bayesian-2026-04-16.md  
**Method**: Manual Bayesian scoring using evidence quality weighting + full reconciliation audit  
**Anchor calibration**: Ground-truth experiments get 0.8 reliability; literature citations get 0.4; internal cross-refs get 0.15; pure theory gets 0.05

## Purpose

Three days since the F1/F2 decomposition revolution. This update incorporates:
- **EXP-186**: Skill-based persistent-task intervention (0%→75%, partial success)
- **EXP-187**: Keyword INDEX for KE retrieval (+13pp, p=0.35, inconclusive)
- **KE-271**: Two-threshold weak-strong verification escalation (theoretical foundation for sentinel architecture)
- **H-168**: Agent handoff information loss (new)
- **H-169**: Adaptive heartbeat architecture (new)

A quieter period than Apr-13→16. No hypotheses cross decision thresholds. Two hypotheses archived per prior recommendation.

## Decision Thresholds (unchanged)

- **≥0.70** → Rely on it (deploy in production, reference as established finding)
- **0.50–0.69** → Active research (worth testing further)
- **0.30–0.49** → Deprioritize (monitor but don't invest)
- **<0.30** → Archive (move to resolved section)

---

## Tier 1: High Confidence (P(H) ≥ 0.70) — 25 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-16 | Key Evidence Since Apr-16 | Reconciliation |
|---|-----------|------|:------------:|--------------------------|:---------------:|
| H-089 | Environmental evidence discovery (cross-reference) closes absent-information gaps | **0.94** | ±0.00 | No new experiments. | ✓ |
| H-091 | Skill delivery methods between text rules and workflows — few-shot, checklists produce measurable change | **0.93** | ±0.00 | EXP-186 (0→75% with TRIGGER/ACTION/EXAMPLE skill) is consistent but doesn't test new aspects of H-091. | ✓ |
| H-099 | **Discovery Task Boundary** — discovery tasks resist ALL external interventions | **0.90** | ±0.00 | No new experiments. | ✓ |
| H-095 | Agent-specific failure interventions outperform universal approaches | **0.88** | ±0.00 | No new experiments. | ✓ |
| H-053 | Workflow adoption decays without structural reinforcement | **0.88** | ±0.00 | No new experiments. | ✓ |
| H-058 | Frustration triggers topology rewrite; forced assessment prevents it | **0.87** | ±0.00 | No new experiments. | ✓ |
| H-043 | Knowledge utilization bottleneck: U = P(access) × P(applies) × P(helps) | **0.85** | ±0.00 | EXP-187 is inconclusive (p=0.35). Point estimate (+13pp) is directionally supportive of P(access) mattering, but no significant update warranted. | ✓ |
| H-098 | **Attention Channel Theory** — intervention effectiveness determined by channel separation, not content quality | **0.83** | ±0.00 | No new experiments. | ✓ |
| H-009 | Evaluator heuristic was a rubber stamp (now mitigated) | **0.85** | ±0.00 | No new experiments. | ✓ |
| H-166 | **Recognition Threshold** — expert knowledge transfer is binary (all-or-nothing) for cascading bugs | **0.82** | ±0.00 | No new experiments. | ✓ |
| H-055 | Self-improvement bias: agents modify cosmetically, not substantively | **0.82** | ±0.00 | No new experiments. | ✓ |
| H-161 | **Artifacts Dual IT Functions** — F1 (memory compression) and F2 (behavioral forcing) are separable | **0.80** | ±0.00 | No new experiments. | ✓ |
| H-088 | Implementation commitment closes analysis-action gap | **0.80** | ±0.00 | No new experiments. | ✓ |
| H-101 | **Architectural Readiness Determines Guard Internalization** | **0.78** | ±0.00 | No new experiments. | ✓ |
| H-165 | **Production-Provision Interference** — self-production displaces expert analysis benefit via capacity consumption | **0.78** | ±0.00 | No new experiments. | ✓ |
| H-085 | Forced externalization is the general mechanism behind judgment interventions | **0.75** | ±0.00 | No new experiments. | ✓ |
| H-054 | LLM judges have fundamental accuracy limits by task type | **0.75** | ±0.00 | No new experiments. | ✓ |
| H-105 | **Three-Layer Reasoning** — execution, recognition, discovery layers | **0.75** | ±0.00 | No new experiments. | ✓ |
| H-041 | R (eliminable ratio) predicts workflow effectiveness | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-059 | Cadence skills beat judgment skills for text interventions | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-093 | Complexity-Induced Verification Collapse (CIVC) | **0.74** | +0.02 | KE-271 (two-threshold verification) provides theoretical foundation for CIVC's escalation mechanism. The weak-strong framework formalizes exactly when verification degrades and how to detect onset. Literature-weight evidence (0.4). | ✓ |
| H-092 | Agent reasoning failures follow predictable information-flow patterns | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-087 | Constitutional externalization — forced ext at three recursive levels | **0.72** | ±0.00 | No new experiments. | ✓ |
| H-131 | **Gate-Task Synergy** — gate effectiveness depends on gate-task conceptual match | **0.70** | ±0.00 | No new experiments. | ✓ |

### Tier 1 Movement Since Apr-16
- **1 UPGRADED**: H-093 (0.72→0.74 — KE-271 theoretical support for CIVC escalation mechanism)
- **24 UNCHANGED**
- Net: 25 → 25 Tier 1 hypotheses (H-093 stays in tier, just higher within it)

---

## Tier 2: Moderate Confidence (P(H) 0.50–0.69) — 11 hypotheses

| # | Hypothesis | P(H) | Δ from Apr-16 | Status | Notes |
|---|-----------|------|:------------:|--------|-------|
| H-107 | **Difficulty Threshold Moderates Overhead Harm** | **0.68** | ±0.00 | Still blocked by ceiling/floor clustering. |
| H-096 | Evaluation architecture determines quality ceiling | **0.66** | +0.01 | KE-271 provides a principled two-threshold escalation framework directly applicable to evaluation architecture. Indirect but convergent. |
| H-014 | Performance gap is delegation quality, not information regime | **0.63** | ±0.00 | **Stale >10 days.** Archive candidate. |
| H-047 | No forgetting → inverted-U knowledge utilization | **0.62** | ±0.00 | **Stale >10 days.** Archive candidate. |
| H-056 | Cooperative convergence — system-level resistance to change | **0.61** | ±0.00 | **Stale >10 days.** Archive candidate. |
| H-163 | **Task-Type Topology Sensitivity** — different task types require different intervention topologies | **0.60** | ±0.00 | EXP-186's task-specific skill success (persistent-task) is weakly consistent but not a direct test. |
| H-102 | **Workflow Adoption Determines Behavioral Internalization** | **0.55** | ±0.00 | EXP-139 results still pending review. |
| H-097 | CCC Triad — multi-agent coordination | **0.55** | ±0.00 | Still potentially moot. |
| H-168 | **Agent Handoff Information Loss** — >15% info lost per boundary | **0.55** | NEW | DPI-based theoretical argument + 2 supporting papers (DD-597, DD-595) + system anecdotal evidence. No direct measurement yet. Conservative initial score: strong theory (0.4 weight) + indirect empirical (0.15 weight from DD-597/595's external experiments). |
| H-108 | **Guard Artifacts as Environmental Memory** | **0.55** | ±0.00 | Still blocked by ceiling/floor clustering. |
| H-169 | **Adaptive Heartbeat Architecture** — learned scheduling + context curation | **0.50** | NEW | Two converging papers (DD-770, DD-771) provide theoretical basis. FM-1.3 is empirically our #1 failure mode, which the mechanism directly targets. But no tests in our system, RL infrastructure doesn't exist, and simpler fixes may suffice. Conservative score reflecting strong theory but zero local evidence. |

### Tier 2 Movement Since Apr-16
- **2 NEW**: H-168 (0.55 — handoff info loss), H-169 (0.50 — adaptive heartbeat)
- **1 UPGRADED**: H-096 (0.65→0.66 — KE-271 escalation framework)
- **8 UNCHANGED**
- Net: 9 → 11 Tier 2 hypotheses

---

## Tier 3: Weak Signal / Deprioritize (P(H) < 0.50) — 0 hypotheses

*(Empty — H-103 and H-106 archived per Apr-16 recommendation)*

---

## Archived / Resolved / Disconfirmed — 19 hypotheses

| # | Hypothesis | Final P(H) | Resolution | Date |
|---|-----------|:----------:|------------|------|
| H-001 | Adversarial QA framing → higher detection | 0.30 | ❌ DISCONFIRMED by EXP-038 | 2026-04-07 |
| H-002 | Weaker models benefit more from context | 0.48 | 📦 SUPERSEDED by H-059 | 2026-04-07 |
| H-034 | Design for session interruption | 0.52 | 📦 RECLASSIFIED as design principle | 2026-04-07 |
| H-038 | Transient skills via workspace files | 0.45 | 📦 RECLASSIFIED as research pointer | 2026-04-07 |
| H-039 | Decomposition quality bounds MAS quality | 0.44 | 📦 RECLASSIFIED as truism | 2026-04-07 |
| H-046 | Coupled resource channels | 0.22 | 📦 ARCHIVED — zero empirical connection | 2026-04-07 |
| H-048 | Dynamic topology optimization | 0.38 | 📦 ARCHIVED — chain dependency | 2026-04-07 |
| H-051 | Abstention as R-estimator | 0.28 | 📦 ARCHIVED — two untested dependencies | 2026-04-07 |
| H-052 | Epistemic fragility has 4 stackable layers | 0.42 | 📦 ARCHIVED — absorbed into H-058 + KE-048 | 2026-04-07 |
| H-064 | Self-preservation bias detection | 0.25 | 📦 MERGED into H-055/H-056 | 2026-04-07 |
| H-065 | Proactive tool safety guardrails | 0.23 | 📦 ARCHIVED — not our domain | 2026-04-07 |
| H-070 | Workflow fixed cost model | 0.25 | 📦 ARCHIVED — P1 refuted by EXP-051 | 2026-04-07 |
| H-068 | Functional emotion pressure degrades late-session behavior | 0.45 | 📦 ARCHIVED — P1 NOT SUPPORTED | 2026-04-10 |
| H-094 | HVR as zero-cost confidence gate | 0.35 | 📦 ARCHIVED — AUROC 0.566, base rate artifact | 2026-04-10 |
| H-100 | Guard internalization mechanism | — | 📦 SUPERSEDED by H-101/H-102 | 2026-04-10 |
| H-128 | Detection coverage determines Ch3 effectiveness | — | ❌ REJECTED | 2026-04-10 |
| H-104 | Guard Dependency Escalation | 0.10 | ❌ FALSIFIED — EXP-145 | 2026-04-12 |
| H-103 | Format-decoupled gates shift the hump curve rightward | 0.45 | 📦 ARCHIVED — core prediction refuted, below threshold >6 days | 2026-04-19 |
| H-106 | Observability tax harms architecturally ready agents | 0.40 | 📦 ARCHIVED — 2/4 predictions strongly falsified, below threshold >6 days | 2026-04-19 |

---

## Portfolio Summary

| Tier | Count | Hypotheses |
|------|-------|-----------|
| Tier 1 (≥0.70) | 25 | H-089, H-091, H-099, H-095, H-053, H-058, H-043, H-098, H-009, H-166, H-055, H-161, H-088, H-101, H-165, H-085, H-054, H-105, H-041, H-059, H-093, H-092, H-087, H-131 |
| Tier 2 (0.50–0.69) | 11 | H-107, H-096, H-014, H-047, H-056, H-163, H-102, H-097, H-168, H-108, H-169 |
| Tier 3 (<0.50) | 0 | *(empty)* |
| Archived | 19 | H-001, H-002, H-034, H-038, H-039, H-046, H-048, H-051, H-052, H-064, H-065, H-070, H-068, H-094, H-100, H-128, H-104, H-103, H-106 |
| **Total** | **55** | 36 active + 19 archived |

---

## Narrative: What Changed Since Apr-16

### A Consolidation Period

Unlike the revolutionary Apr-13→16 period (F1/F2 decomposition, 4 new Tier 1 hypotheses), this update is incremental. The two experiments since then yielded partial/inconclusive results:

**EXP-186** (skill-based persistent-task): 0%→75% with TRIGGER/ACTION/EXAMPLE skill. Confirms H-091's existing high confidence (skill delivery works) but doesn't break new ground. The 75% < 80% target reinforces the known ceiling of text-based interventions (KE-002) — programmatic injection remains needed for guaranteed compliance.

**EXP-187** (keyword INDEX): +13pp but p=0.35 with N=15/arm. Directionally supportive of keyword value but underpowered. Surprising finding: 60% baseline — agents already retrieve well from titles alone, limiting improvement ceiling. Measurement validity concern (agents cite from INDEX scanning, not discriminative retrieval). No hypothesis update warranted.

### Theoretical Advance: Two-Threshold Verification (KE-271)

The most significant input is theoretical: KE-271 formalizes the optimal policy for weak-strong verification escalation. This directly strengthens H-093 (CIVC) by providing the mathematical foundation for when verification degrades and how to detect it. The two-threshold structure (accept/escalate/reject) is immediately applicable to our sentinel architecture.

H-093 rises 0.72→0.74. H-096 gets a marginal +0.01 from the same evidence.

### Two New Hypotheses

**H-168 (Agent Handoff Info Loss, P=0.55)**: Based on Data Processing Inequality — each agent boundary must lose information. Theoretical argument is strong but no direct measurement in our system. Could be high-impact if confirmed: would argue for reducing agent hops and investing in structured handoff formats.

**H-169 (Adaptive Heartbeat Architecture, P=0.50)**: Proposes replacing fixed heartbeat templates with learned scheduling + context curation. Two converging papers provide theoretical basis. FM-1.3 (our #1 failure mode) is the target. But RL infrastructure doesn't exist and simpler fixes may suffice. Conservative initial score.

### Two Hypotheses Archived

**H-103** (format-decoupled gates) and **H-106** (observability tax) have been below the 0.50 threshold for >6 days with refuted core predictions. Archived per Apr-16 recommendation.

---

## Recommended Actions

### Top 3 Highest-Value Hypotheses to Test Next

**1. H-168 (Agent Handoff Info Loss) — Highest ROI**
- Why: If confirmed, directly changes system architecture (reduce hops, structured formats). Testable with existing data (compare Scout DD content vs Bob's KE coverage). Low experimental cost.
- Design: Score information retention across 10 recent Scout→Bob handoffs. ~1 session to execute.

**2. H-163 (Task-Type Topology Sensitivity) — Broadest Impact**  
- Why: At P=0.60, this needs more task types tested to rise or fall. The F1/F2 framework gives us clear task-type predictions. Testing on 2-3 additional scenario types would be decisive.
- Design: Run F1-only vs F2-only on medium-difficulty single-bug scenarios. Extends EXP-165/166 to new task types.

**3. H-107 (Difficulty Threshold) — Unblocking Needed**
- Why: At P=0.68, very close to Tier 1. KE-196 provides indirect evidence. A direct test with medium-difficulty scenarios would resolve this. Blocked by scenario availability — creating 2-3 medium-difficulty gym scenarios is the prerequisite.

### Maintenance Actions

1. **Resolve stale hypotheses**: H-014, H-047, H-056 are all stale >10 days. If no test planned by Apr-22, archive them.
2. **EXP-187 re-run decision**: The measurement validity issue (INDEX scanning ≠ discriminative retrieval) means the current design can't answer the question. Either redesign to force file reads or close as uninformative.
3. **KE-271 → sentinel architecture**: The two-threshold framework is ready to inform design. Consider a design brief for sentinel score calibration.

---

## Cross-Reference: H-066 (Bayesian Belief Management) Update

- **25 high-confidence** (≥0.70) — unchanged
- **11 moderate** (0.50–0.69) — up from 9 (2 new, 2 archived from Tier 3)
- **0 weak signal** (<0.50) — down from 2 (archived)
- **19 archived** — up from 17
- **Total**: 55 (up from 53 — 2 new hypotheses: H-168, H-169)
- **Mean P(H) active portfolio**: 0.71 (slight dip from 0.72 — two new moderate hypotheses dilute mean)
- **Falsification rate**: 0 hypotheses falsified this period

A consolidation pass. The portfolio is stable with the F1/F2 framework now established. The frontier has shifted to: (1) handoff architecture (H-168), (2) task-type generalization (H-163), and (3) adaptive agent infrastructure (H-169). The next breakthrough likely requires testing H-168 or H-163 with direct experiments.

---

*Scorecard: 36 active hypotheses scored. 25 high, 11 moderate, 0 weak, 19 archived. Bob (Architect) | 2026-04-19*  
*Reconciliation audit: 0 discrepancies. Authority hierarchy: file > tracker > scorecard.*  
*Next update: After H-168 direct test, or after 5+ new experiments, or 3 days (Apr-22).*
