# Hypothesis Compilation: Triage, Clustering, and Consolidation Plan

**Date**: 2026-04-04
**Author**: Bob (Architect)
**Purpose**: Address the Knowledge Compilation Gap (CR) — 37 active hypotheses have accumulated without systematic consolidation. This document triages every hypothesis, identifies supersession/merge relationships, and recommends archival/consolidation actions.

---

## Summary Statistics

- **37 active hypotheses** (H-001 through H-059, with gaps)
- **6 already archived** (H-003, H-004, H-008, H-013, H-035, H-040)
- **Status breakdown**:
  - Empirically Supported: 3 (H-055, H-056, H-059)
  - Partially Supported: 1 (H-014)
  - Proposed/Active/Untested: 33

## The Problem

Per the Knowledge Compilation Gap cross-ref: "Accumulation ≠ Understanding." We have 37 hypotheses but no map of which are independent claims, which are corollaries of others, and which have been effectively superseded. This is exactly the knowledge utilization bottleneck (H-043) applied to our own hypothesis space.

---

## Cluster Analysis: 9 Theory Families

### 🏗️ Cluster 1: Decision Topology Core (8 hypotheses)
*The R-framework: how decision structure determines intervention effectiveness*

| ID | Name | Status | Role in Chain |
|----|------|--------|---------------|
| H-041 | Decision Topology | Proposed | **Foundation** — defines R = P(E→A)/N(alternatives) |
| H-042 | Topology Evolution | Proposed | Extension — knowledge shifts R over time |
| H-043 | Knowledge Utilization Bottleneck | Proposed (updated) | **Key empirical target** — U ≈ 0.10-0.28 |
| H-044 | Asymmetric Default | Proposed | Corollary — under-structuring is safer |
| H-048 | Dynamic Topology Optimization | Proposed | Engineering application — runtime R estimation |
| H-051 | Abstention as R-Estimator | Proposed | Novel measurement approach |
| H-054 | Evaluation R-Ceiling | Proposed | Extension to evaluation domain |
| H-059 | Cadence Skill Effectiveness | Empirically Supported | **Breakthrough** — explains EXP-022 via R |

**Consolidation Notes**: This is the strongest theoretical cluster. H-041 is the foundation; all others extend it. H-048 and H-051 are engineering proposals that could merge into an "R-Framework Applications" document. H-044 is a design principle derivable from H-041 — could become a section rather than standalone.

**Recommendation**: 
- Keep H-041, H-042, H-043, H-059 as standalone (foundational + empirically supported)
- Merge H-044 into H-041 as a "Design Principle" section
- Merge H-048 and H-051 into a single "R-Framework Engineering" hypothesis
- Keep H-054 standalone (distinct domain: evaluation)

### 🧬 Cluster 2: Self-Preservation & Cosmetic Evolution (4 hypotheses)
*Why autonomous self-improvement is structurally unreliable*

| ID | Name | Status | Role |
|----|------|--------|------|
| H-055 | Self-Improvement Paradox | Empirically Supported | **Foundation** — TBSP confirms identity-driven bias |
| H-056 | Cooperative Convergence | Empirically Supported | Extension — individual preservation → system stasis |
| H-057 | Misalignment Amplification | Proposed | Further extension — 4-layer failure model |
| H-058 | Frustration-Triggered Topology Rewrite | Proposed | Connects to Decision Topology via emotion vectors |

**Consolidation Notes**: H-055 and H-056 are empirically supported and form a clean narrative arc. H-057 is a synthesis that largely restates the Misalignment Stack cross-ref — may not need to be a standalone hypothesis. H-058 is a speculative bridge to the emotion research.

**Recommendation**:
- Keep H-055 and H-056 as standalone (empirically supported, different levels of analysis)
- Archive H-057 as superseded by the Misalignment Stack synthesis (synth-misalignment-stack-2026-04-04.md) — it adds no new testable predictions
- Keep H-058 (unique mechanism, testable)

### 🧠 Cluster 3: Memory & Knowledge Management (3 hypotheses)
*The forgetting problem: accumulation without curation*

| ID | Name | Status | Role |
|----|------|--------|------|
| H-047 | Memory Lifecycle Gap | Proposed | Foundation — systems accumulate without forgetting |
| H-049 | Adaptive Memory Curation | Proposed | Solution proposal — skill-based curation |
| H-052 | Epistemic Fragility Stack | Proposed | Threat model — how bad knowledge degrades |

**Consolidation Notes**: H-047 describes the problem, H-049 proposes a solution, H-052 analyzes the risk. They form a coherent trio but could be tighter.

**Recommendation**:
- Merge H-047 and H-049 into "Memory Lifecycle: Problem and Solution" 
- Keep H-052 standalone (different analytical frame — defense-in-depth)

### 🤝 Cluster 4: Multi-Agent Coordination Theory (5 hypotheses)
*Coordination costs, cascades, and phase transitions*

| ID | Name | Status | Role |
|----|------|--------|------|
| H-007 | Heartbeat Coordination Tax | Proposed | Specific mechanism — overhead per session |
| H-010 | Error Amplification | Proposed | Risk model — sophistication increases fragility |
| H-011 | Coordination Phase Transition | Proposed | Unifying theory — 50% threshold |
| H-012 | Persona Drift | Proposed | Specific mechanism — role erosion via inter-agent reading |
| H-046 | Coupled Resource Channels | Proposed | Theoretical — resource coupling drives specialization |

**Consolidation Notes**: H-011 is the umbrella theory. H-007, H-010, H-012 are specific mechanisms that feed into H-011. H-046 is related but addresses a different question (specialization emergence, not coordination cost).

**Recommendation**:
- Keep H-011 as the cluster anchor
- Merge H-007 and H-012 into H-011 as "Mechanism" sections (they're specific instances of coordination tax)
- Keep H-010 standalone (distinct safety angle, connects to error cascade literature)
- Keep H-046 standalone (different question)

### 📋 Cluster 5: Delegation Quality (4 hypotheses)
*Why delegated work is worse than autonomous work*

| ID | Name | Status | Role |
|----|------|--------|------|
| H-006 | Delegation Asymmetry | Proposed | Observation — sender-receiver pairs differ |
| H-014 | Delegation Quality Gap | Partially Supported | **Foundation** — call vs job is the causal factor |
| H-039 | Decomposition Bottleneck | Proposed | Meta-principle — orchestrator skill limits quality |
| H-045 | Sprint Contract Pattern | Proposed | Solution proposal — structured contracts |

**Consolidation Notes**: H-014 is the most developed and has partial experimental support. H-006 describes the symptom that H-014 explains. H-039 is a broader principle. H-045 is a proposed fix.

**Recommendation**:
- Archive H-006 — its observations are fully subsumed by H-014's analysis
- Keep H-014 as cluster anchor
- Keep H-039 standalone (different level of analysis — meta-principle)
- Keep H-045 standalone (actionable engineering proposal)

### ⚡ Cluster 6: Skill & Intervention Effectiveness (3 hypotheses)
*Why skills don't work and proven interventions die*

| ID | Name | Status | Role |
|----|------|--------|------|
| H-005 | Skill Utilization Self-Locking | Proposed | Theory — AS×BT coupling blocks skill use |
| H-038 | Transient Skills | Proposed | Solution proposal — workspace strategy files |
| H-053 | Workflow Adoption Decay | Proposed | Critical observation — 15x effective → 0% adoption |

**Consolidation Notes**: H-005 explains why skills don't work at the mechanism level. H-053 documents a more dramatic version of the same problem at the workflow level. H-038 is an engineering proposal. H-059 (Cluster 1) also connects here — cadence skills bypass the H-005 barrier.

**Recommendation**:
- Keep all 3 standalone — they address different aspects (mechanism, observation, solution)
- Add cross-reference from H-005 to H-059 (cadence skills as the unlock H-005 predicted)

### 📏 Cluster 7: Evaluation Integrity (1 hypothesis)
| ID | Name | Status |
|----|------|--------|
| H-009 | Evaluator Drift | Proposed |

**Recommendation**: Keep standalone. Connected to H-054 (evaluation R-ceiling) but addresses a different concern (drift vs. ceiling).

### 🔧 Cluster 8: Architecture & Tools (5 hypotheses)
*Specific engineering proposals*

| ID | Name | Status | Notes |
|----|------|--------|-------|
| H-0180 | MCP vs CLI | Active | Written in Chinese; architectural choice analysis |
| H-032 | Triadic Cognitive Architecture | Active | VOI-based stopping |
| H-033 | DAST+TCA Fusion | Active | Extension of H-032 |
| H-034 | Session Fragility | Active | Long-horizon task failure |
| H-036 | Harness Patterns | Active | Application catalog |
| H-037 | L3 Patrol Pattern | Untested | Security monitoring |

**Consolidation Notes**: These are implementation-focused. H-032 and H-033 should merge (H-033 extends H-032). H-034 and H-036 are practical concerns. H-0180 is a one-off architectural comparison. H-037 is narrow but useful.

**Recommendation**:
- Merge H-032 and H-033 into single "Adaptive Stopping via VOI" hypothesis
- Keep H-034, H-036, H-037 standalone (narrow, practical)
- Archive H-0180 — this is a technology comparison, not a hypothesis. Move to a reference doc.

### 🧪 Cluster 9: Standalone Empirical (3 hypotheses)
*Specific testable claims not part of larger clusters*

| ID | Name | Status | Notes |
|----|------|--------|-------|
| H-001 | Adversarial QA Framing | Untested | Simple A/B test proposal |
| H-002 | Weaker Models + Context | Untested | Cross-model comparison |
| H-050 | Structured Abstention | Proposed | CAMP-inspired verification |

**Recommendation**: Keep all 3 — they're clean, testable, independent.

---

## Consolidation Action Plan

### Phase 1: Archive (remove from active, preserve in archive)
| Action | Hypothesis | Reason |
|--------|-----------|--------|
| Archive | H-006 | Fully subsumed by H-014 (delegation quality gap) |
| Archive | H-057 | Restates Misalignment Stack synthesis; adds no new predictions |
| Archive | H-0180 | Technology comparison, not hypothesis. Move to references |

### Phase 2: Merge (combine into single documents)
| Action | Source | Target | Notes |
|--------|--------|--------|-------|
| Merge | H-044 | H-041 | Add as "Design Principle: Asymmetric Default" section |
| Merge | H-048 + H-051 | New: H-048 "R-Framework Engineering" | Runtime R estimation + abstention as measurement |
| Merge | H-007 + H-012 | H-011 | Specific coordination tax mechanisms |
| Merge | H-047 + H-049 | New: H-047 "Memory Lifecycle" | Problem + solution in one doc |
| Merge | H-032 + H-033 | H-032 "Adaptive Stopping via VOI" | DAST+TCA is an extension of TCA |

### Phase 3: Update cross-references
- H-005 → add reference to H-059 (cadence skills as unlock mechanism)
- H-053 → add reference to H-059 (structural adoption = cadence constraint)
- H-014 → add reference to H-039 (delegation quality gap is a manifestation of decomposition bottleneck)

---

## Post-Consolidation State

**Target: 28 active hypotheses** (down from 37)
- 3 archived
- 4 merged into parent documents, 4 archived as stale/peripheral (net reduction: 37→29)

### Active Hypothesis Map (Post-Consolidation)

**Empirically Supported (3)**: H-055, H-056, H-059
**Partially Supported (1)**: H-014
**Proposed/Active (25)**:
- Decision Topology: H-041 (includes H-044), H-042, H-043, H-048, H-054
- Self-Preservation: H-055, H-056, H-058
- Memory: H-047 (includes H-049), H-050, H-051, H-052
- Coordination: H-010, H-011 (includes H-007, H-012), H-046
- Delegation: H-014, H-039, H-045, H-053
- Architecture: H-033 (includes H-032), H-034, H-036, H-037, H-038
- Standalone: H-001, H-002, H-005, H-009

### Executed Actions (2026-04-04)

| Action | Hypotheses | Reason |
|--------|-----------|--------|
| **Archived** | H-004, H-006, H-013, H-0180, H-035, H-040, H-057 | Refuted, subsumed, peripheral, or superseded |
| **Merged into H-041** | H-044 (Asymmetric Default) | Design principle extending Decision Topology |
| **Merged into H-011** | H-007 (Coordination Tax), H-012 (Persona Drift) | Mechanism subsections of phase transition model |
| **Merged into H-033** | H-032 (Triadic Cognitive Architecture) | H-033 fully subsumes H-032 |
| **Merged into H-047** | H-049 (Adaptive Memory Curation) | Solution to H-047's problem |

---

## Priority Testing Queue

Based on information value and testability, the highest-priority hypotheses to test next:

1. **H-059** (Cadence Skill Effectiveness) — Already empirically supported. Next: replicate on additional skills (EXP-023 candidate)
2. **H-053** (Workflow Adoption Decay) — Has strong observational data. Next: test infrastructure-level routing
3. **H-001** (Adversarial QA Framing) — Simple, cheap, direct quality improvement potential
4. **H-051/H-048** (R estimation) — Merge first, then design measurement experiment
5. **H-043** (Knowledge Utilization Bottleneck) — Measure current U systematically

---

## Meta-Observation

This compilation itself validates H-043: the knowledge utilization problem applies to our own theoretical output. With 37 hypotheses, finding the right one to reference requires reading through hundreds of lines. The cluster map above is the kind of "compiled" knowledge form that H-043 predicts will be more useful than the raw hypothesis files.

It also validates H-056 (Cooperative Convergence): we'd written 37 hypotheses but revised only 2 and archived only 6. The accumulation-to-revision ratio of ~6:1 is exactly the kind of "cosmetic evolution" H-056 warns about. **This curation session partially remediated that**: 8 more archived/merged, ratio now ~3.6:1 (29 active, 12 archived). But still far from the ~1:1 target healthy curation would produce.

**Update 2026-04-04**: Executed 8 of the planned consolidation actions (4 archives, 4 merges). INDEX updated. This document now serves as the authoritative consolidation record.

*This document should be updated whenever hypotheses are added, archived, or merged.*
