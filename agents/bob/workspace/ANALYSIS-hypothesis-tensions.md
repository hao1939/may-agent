# Hypothesis Corpus Tension Scan: Tier-1 Contradictions & Redundancies

**Date**: 2026-04-12
**Analyst**: Bob
**Scope**: All 20 Tier-1 hypotheses (P ≥ 0.70) from PRIORITY-TRACKER.md

## Executive Summary

H-098 (Attention Channel Theory) emerges as a potential grand unifying framework that could subsume 5–6 other Tier-1 hypotheses. The corpus has significant redundancy but few genuine contradictions. I recommend 4 merges, 2 flags, and 14 keep-separates.

**Key finding**: The hypothesis corpus has organically grown a unified theory of agent intervention effectiveness (H-098) while retaining its earlier empirical building blocks (H-085, H-091, H-043) as separate entries. A consolidation pass would reduce 20 Tier-1 hypotheses to ~14 without information loss.

---

## Tension Analysis

### Tension 1: H-098 (Attention Channel Theory) vs H-085 (Forced Externalization)
| Aspect | H-098 | H-085 |
|--------|-------|-------|
| Core claim | Three attention channels (Ch1 instructional, Ch2 structural, Ch3 positional) with different effectiveness profiles | Forcing agents to externalize reasoning into artifacts improves verification quality |
| Type | Theoretical framework | Empirical finding |
| Probability | 0.75 | 0.80 |
| Evidence base | EXP-101–144 synthesis | EXP-060, EXP-065, EXP-085 |

**Analysis**: H-085 describes what works (externalization). H-098 explains *why* it works: externalization converts Ch1 instructions ("remember to verify") into Ch2 structural affordances (checklists, templates, required output fields). H-085 is the empirical observation; H-098 is the mechanistic theory. The forced externalization effect is precisely a Ch1→Ch2 channel switch.

**Evidence**: H-098's Ch2 interventions (workflow enforcement, structural templates) show 60-80% effectiveness vs Ch1's 0-15%. H-085's externalization interventions all fall in the Ch2 category.

**Recommendation**: **MERGE** — H-085 becomes the primary empirical evidence base for H-098's Ch2 channel. H-085's specific findings (externalization improves verification by ~40%) become supporting data points within H-098's framework. Retain H-085's ID for traceability but mark it as "subsumed by H-098."

---

### Tension 2: H-095 (Agent-Specific Interventions) vs H-099 (Discovery Task Boundary)
| Aspect | H-095 | H-099 |
|--------|-------|-------|
| Core claim | Agent-specific interventions outperform universal ones | Discovery tasks resist ALL intervention types |
| Type | Design principle | Boundary condition |
| Probability | 0.80 | 0.72 |

**Analysis**: H-099 is NOT a contradiction of H-095 — it's a scope boundary. H-095 says "when interventions work, agent-specific > universal." H-099 says "there's a domain where no interventions work at all." These are logically compatible: H-099 defines where H-095's optimization is irrelevant because the baseline effect is zero.

The deeper question: Does H-099 challenge the entire intervention paradigm (H-085, H-091, H-098, H-095) or just a specific application domain? Current evidence suggests the latter — discovery tasks have unique properties (open-ended goals, no clear verification criteria) that prevent structural interventions from gaining purchase.

**Recommendation**: **KEEP SEPARATE** — H-099 is a boundary condition on the entire intervention framework, not a competitor to H-095 specifically. H-099 should be cross-referenced as a scope limitation on H-085, H-091, H-095, and H-098.

---

### Tension 3: H-091 (Skill Delivery Methods) vs H-098 (Attention Channel Theory)
| Aspect | H-091 | H-098 |
|--------|-------|-------|
| Core claim | Three boundaries determine skill transfer effectiveness: positional privilege, domain proximity, temporal discipline | Three attention channels with different effectiveness profiles |
| Type | Empirical taxonomy | Theoretical framework |
| Probability | 0.82 | 0.75 |

**Analysis**: H-091's three boundaries map directly onto H-098's channels:
- **Positional privilege** (system-prompt 0%, task-message 100%) = H-098's Ch3 (positional effects)
- **Domain proximity** (same-domain skills transfer, cross-domain don't) = refinement of Ch2 effectiveness
- **Temporal discipline** (skills decay without reinforcement) = Ch1 degradation over time

H-091 has richer empirical detail than H-098 in the delivery-method space. H-098 provides the theoretical umbrella. The key difference: H-091 discovered the positional privilege boundary empirically (EXP-091 series), while H-098 formalized it as Ch3. H-091's domain proximity boundary adds a dimension H-098 doesn't explicitly capture.

**Recommendation**: **MERGE** — H-091's empirical findings become the primary evidence base for H-098's Ch3 and delivery-effectiveness predictions. H-091's domain proximity boundary should be incorporated into H-098 as a Ch2 qualification (structural interventions require domain-relevant structure). Retain H-091 ID for traceability.

---

### Tension 4: H-043 (Knowledge Utilization Bottleneck) vs H-098 (Attention Channel Theory)
| Aspect | H-043 | H-098 |
|--------|-------|-------|
| Core claim | U = P(access) × P(applies) × P(helps); knowledge goes unused due to access/application failures | Three channels with different effectiveness; Ch1 instructions degrade, Ch2 structure persists |
| Type | Utilization model | Intervention framework |
| Probability | 0.85 | 0.75 |

**Analysis**: H-043's utilization formula maps onto channel theory:
- **P(access)** varies by delivery channel: Ch1 (instruction recall) < Ch2 (structural lookup) < Ch3 (positional priming)
- **P(applies)** is about converting accessed knowledge into action — this is the Ch1→Ch2 conversion problem
- **P(helps)** is independent of channels — it's about knowledge quality

H-043's "Four Knowledge Forms" table (declarative, procedural, structural, contextual) provides a content taxonomy that cross-cuts H-098's delivery taxonomy. They're complementary, not redundant: H-043 asks "what kind of knowledge?" while H-098 asks "through what channel?"

However, H-043's core insight (most knowledge goes unused because of access/application failures, not quality failures) is essentially restated by H-098's channel effectiveness hierarchy. The difference: H-043 frames it as a knowledge management problem; H-098 frames it as an attention/delivery problem.

**Recommendation**: **MERGE (partial)** — H-043's utilization formula should be incorporated into H-098 as the quantitative model for channel effectiveness. H-043's knowledge forms taxonomy remains independently valuable and should be retained as a separate reference. Mark H-043 as "partially subsumed by H-098 (delivery mechanism); retained for knowledge taxonomy."

---

### Tension 5: H-053 (Workflow Adoption Decay) vs H-098 (Channel Theory)
| Aspect | H-053 | H-098 |
|--------|-------|-------|
| Core claim | Workflow adoption decays without structural reinforcement; half-life ~2 weeks | Ch1 instructions degrade; Ch2 structural interventions persist |
| Probability | 0.78 | 0.75 |

**Analysis**: H-053 is a temporal dynamics finding that H-098 explains mechanistically. H-053's "adoption decay" is exactly the Ch1 degradation curve. H-053's "structural reinforcement" prescription is exactly "convert Ch1→Ch2." These are the same insight expressed in different vocabularies.

**Recommendation**: **MERGE** — H-053's temporal data (decay curves, half-life measurements) become the empirical evidence for H-098's Ch1 degradation prediction (P-098d). H-053's structural reinforcement prescription validates H-098's Ch1→Ch2 conversion recommendation.

---

### Tension 6: H-087 (Constitutional Externalization) vs H-085 (Forced Externalization) vs H-098
| Aspect | H-087 | H-085 |
|--------|-------|-------|
| Core claim | Three recursive externalization levels (task→session→constitutional) | Forced externalization improves verification |
| Probability | 0.72 | 0.80 |

**Analysis**: H-087 generalizes H-085 from a single intervention to a three-level hierarchy. If H-085 is subsumed by H-098, then H-087 extends the subsumption: all three levels are Ch2 interventions at different scopes (task-level Ch2, session-level Ch2, constitutional Ch2). H-087 adds the insight that externalization compounds across levels.

**Recommendation**: **MERGE (into H-098)** — H-087's recursive levels become a depth dimension within H-098's Ch2 channel. The three-level hierarchy enriches H-098's framework without contradicting it.

---

### Tension 7: H-088 (Implementation Commitment) vs H-085/H-098
| Aspect | H-088 |
|--------|-------|
| Core claim | Specific implementation commitments bridge the analysis-action gap |
| Probability | 0.70 |

**Analysis**: H-088 describes a sub-mechanism within H-085's externalization framework: it's not enough to externalize reasoning; you must externalize *commitments to act*. In H-098 terms, H-088 is about Ch2 intervention design — the most effective Ch2 structures include commitment devices, not just analysis templates.

**Recommendation**: **KEEP SEPARATE** — H-088 adds a design principle for effective Ch2 interventions that isn't captured by H-098's channel taxonomy. It's a prescription within the framework, not a competing theory.

---

### Tension 8: H-089 (Environmental Evidence Discovery) vs H-098
| Aspect | H-089 |
|--------|-------|
| Core claim | Cross-referencing environmental evidence accelerates learning |
| Probability | 0.72 |

**Analysis**: H-089's environmental evidence mechanism is a specific Ch2 intervention type — discovering and linking evidence embedded in the environment (logs, code, previous outputs). It's compatible with H-098 but at a different level of abstraction: H-098 describes channels; H-089 describes a specific technique within Ch2.

**Recommendation**: **KEEP SEPARATE** — H-089 is a concrete technique, not a competing framework. Cross-reference with H-098 Ch2.

---

### Tension 9: H-093 (CIVC — Complexity-Induced Verification Collapse) vs H-098
| Aspect | H-093 | H-098 |
|--------|-------|-------|
| Core claim | Verification quality collapses above complexity threshold | Ch1 interventions have 0-15% effectiveness |
| Probability | 0.78 | 0.75 |

**Analysis**: CIVC and channel theory reinforce each other. H-093 says verification collapses under complexity. H-098 says Ch1 instructions fail. The connection: verification instructions are Ch1, so they fail under complexity. But H-093 adds something H-098 doesn't: even Ch2 structural interventions show degraded effectiveness above the CIVC threshold. This is a genuine tension — H-098 predicts Ch2 should persist; H-093 suggests Ch2 also degrades (just less dramatically).

**Recommendation**: **FLAG** — Genuine tension. H-098 predicts Ch2 persistence; H-093 suggests Ch2 degradation under extreme complexity. Resolution needed: does the CIVC threshold override channel effectiveness predictions? Proposed experiment: test Ch2 interventions specifically at above-threshold complexity levels.

---

### Tension 10: H-055 (Self-Improvement Bias) — Independence Check
**Analysis**: H-055 describes a cognitive bias in agents (overestimating self-improvement capacity). This is orthogonal to the intervention effectiveness framework (H-098 family). No tension.

**Recommendation**: **KEEP SEPARATE** — Independent construct. No overlap with intervention framework.

---

### Tension 11: H-058 (Frustration Topology) — Independence Check  
**Analysis**: H-058 maps failure cascade patterns. This is a descriptive taxonomy independent of the intervention framework. No tension with any other Tier-1 hypothesis.

**Recommendation**: **KEEP SEPARATE** — Independent construct.

---

### Tension 12: H-092 (Reasoning Flow Failures) — Independence Check
**Analysis**: H-092 provides a taxonomy of reasoning failures. This describes the *problem space* that intervention hypotheses (H-098, H-085, etc.) attempt to address. It's complementary, not redundant.

**Recommendation**: **KEEP SEPARATE** — Problem taxonomy; complements intervention framework.

---

### Tension 13: H-103 (Guard Internalization Hypothesis)
**Analysis**: H-103 proposes that guards become internalized through repeated exposure. In channel terms, this suggests Ch2 structural interventions eventually train Ch1 behavior. This is compatible with H-098 but adds a dynamic: channels aren't static; Ch2 exposure may improve Ch1 effectiveness over time. This is a genuinely novel prediction H-098 doesn't make.

**Recommendation**: **FLAG** — Potential tension with H-098's implicit assumption that channel effectiveness is stable. If guard internalization works, it means Ch2→Ch1 transfer is possible, which would modify H-098's predictions. Track for evidence.

---

## Summary Table

| Tension | Hypotheses | Recommendation | Rationale |
|---------|-----------|---------------|-----------|
| 1 | H-098 vs H-085 | **MERGE** | H-085 is the empirical base for H-098's Ch2 |
| 2 | H-095 vs H-099 | **KEEP SEPARATE** | H-099 is a boundary condition, not a contradiction |
| 3 | H-091 vs H-098 | **MERGE** | H-091's boundaries map to H-098's channels |
| 4 | H-043 vs H-098 | **MERGE (partial)** | Utilization formula → channel model; knowledge taxonomy retained |
| 5 | H-053 vs H-098 | **MERGE** | Adoption decay = Ch1 degradation |
| 6 | H-087 vs H-085/H-098 | **MERGE** | Recursive externalization = multi-level Ch2 |
| 7 | H-088 vs H-085/H-098 | **KEEP SEPARATE** | Design principle within Ch2, not competing theory |
| 8 | H-089 vs H-098 | **KEEP SEPARATE** | Specific Ch2 technique, not framework-level |
| 9 | H-093 vs H-098 | **FLAG** | Ch2 degradation under CIVC contradicts Ch2 persistence |
| 10 | H-055 | **KEEP SEPARATE** | Independent construct (cognitive bias) |
| 11 | H-058 | **KEEP SEPARATE** | Independent construct (failure patterns) |
| 12 | H-092 | **KEEP SEPARATE** | Problem taxonomy, not intervention theory |
| 13 | H-103 vs H-098 | **FLAG** | Guard internalization implies Ch2→Ch1 transfer |

## Consolidation Proposal

If all MERGE recommendations are executed, the Tier-1 corpus would consolidate as:

**Absorbed into H-098 (Attention Channel Theory)**:
- H-085 (Forced Externalization) → Ch2 empirical evidence
- H-091 (Skill Delivery Methods) → Ch3 + delivery effectiveness evidence  
- H-043 (Knowledge Utilization) → Quantitative utilization model for channels (knowledge taxonomy retained separately)
- H-053 (Workflow Adoption Decay) → Ch1 temporal degradation evidence
- H-087 (Constitutional Externalization) → Multi-level Ch2 depth dimension

**Result**: 20 Tier-1 hypotheses → 15, with H-098 becoming a well-evidenced grand theory incorporating 5 previously-separate empirical findings.

## Flagged for Resolution

1. **H-093 (CIVC) vs H-098**: Does extreme complexity override Ch2 effectiveness? Experiment needed.
2. **H-103 (Guard Internalization) vs H-098**: Does repeated Ch2 exposure improve Ch1 effectiveness? Longitudinal study needed.

## Remaining Independent Tier-1 Hypotheses (no tension)
- H-055 (Self-Improvement Bias)
- H-058 (Frustration Topology)  
- H-088 (Implementation Commitment)
- H-089 (Environmental Evidence Discovery)
- H-092 (Reasoning Flow Failures)
- H-095 (Agent-Specific Interventions)
- H-098 (Attention Channel Theory) — promoted to framework status
- H-099 (Discovery Task Boundary)
- H-103 (Guard Internalization)
- Plus remaining Tier-1 entries not implicated in tensions

---

*This analysis should be revisited after the proposed merges are executed and the two flagged tensions are experimentally resolved.*
