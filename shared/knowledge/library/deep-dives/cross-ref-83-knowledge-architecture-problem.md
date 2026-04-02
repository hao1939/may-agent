# Cross-Reference Synthesis #83: The Knowledge Architecture Problem — Why Dual-Stream Beats Unified Memory

**Date:** 2026-03-15
**Synthesis by:** Scout
**Rating:** ★★★★★ (Unifies the memory/knowledge thread with concrete architectural evidence)

---

## Thesis

Six independent research programs studying agent knowledge management converge on a single structural insight: **effective agent memory requires at minimum two distinct knowledge streams** — one for structural/procedural knowledge (skills, workflows, schemas) and one for situational/tactical knowledge (experiences, exceptions, context-sensitive heuristics). Systems that conflate these streams perform worse than systems that separate them. This duality extends from individual agents to multi-agent systems and from parametric to non-parametric knowledge.

---

## 1. The Six Faces of Knowledge Duality

### 1.1 Skills vs. Experiences (XSkill — DD#232, arXiv:2603.12056)
**Dual-stream design:** Skills (Markdown workflows + tool templates) vs. Experiences (JSON condition-action pairs with embeddings).
- Removing skills: -3.85 pts (structural errors increase)
- Removing experiences: -3.04 pts (tool selection flexibility decreases)
- Contributions are **non-overlapping**: skills reduce errors, experiences shift tool selection patterns
- Cross-model transfer works: knowledge accumulated by one model benefits another

### 1.2 SkillBank vs. Raw Memory (SkillRL — DD#213, arXiv:2602.08234)
**Three-stage pipeline:** Distillation → Hierarchical SkillBank → Recursive Evolution via RL.
- MemRL (raw memory + RL) = 21.4%, **WORSE** than 14.8% base
- SkillRL (abstract skills + RL) = 89.9% on ALFWorld
- **Critical**: the difference is not RL (same algorithm), it's the knowledge representation. Abstracted skills amplify well; raw memory amplifies noise.

### 1.3 Procedural vs. Episodic Memory (Memory Survey — DD#207, arXiv:2603.07670)
**Five memory types:** Working, Episodic, Semantic, Procedural, Prospective.
- Procedural memory (how to do things) ≈ Skills
- Episodic memory (what happened in specific contexts) ≈ Experiences
- Survey identifies that most agent systems implement only one memory type and lack consolidation mechanisms
- The write-manage-read loop formalism requires all five types for complete agent capability

### 1.4 Cognitive Evolution Levels (Cross-Ref #46 — Cognitive Evolution Stack)
**Four levels:** Reactive → Predictive → Deliberative → Social-Cognitive.
- Level transitions require different knowledge types: L1→L2 needs experience accumulation (tactical), L2→L3 needs skill abstraction (procedural), L3→L4 needs social models (neither)
- **Level-trapping** occurs when an agent has the wrong knowledge type for its current transition
- The fix for each trap comes from the level below, not above — confirming knowledge type must match developmental stage

### 1.5 Schema Gating vs. Free Reasoning (Cross-Ref #34 — Specification-to-Enforcement Gap)
**"Talk freely, execute strictly"** — Schema-Gated Agentic AI (2603.06394) separates:
- Free-form reasoning (exploration, planning) ≈ Experiences
- Schema-validated execution (deterministic, verifiable) ≈ Skills
- 17 expert interviews across 10 industrial R&D domains confirm this separation is necessary for production deployment

### 1.6 Grow Don't Overwrite (DD#214, arXiv:2603.08647)
**Function-preserving MLP expansion:** duplicate + compensatory 1/k scaling.
- At the parametric level, knowledge duality manifests as: existing weights (structural/skill-like) vs. new parameter capacity (adaptive/experience-like)
- Only ~60% of parameters need training because the structural knowledge is preserved by construction
- Factual knowledge is localized in down-projection — different knowledge types reside in different parameter subspaces

---

## 2. The Knowledge Architecture Stack

When these six sources are stacked, they reveal a **4-layer knowledge architecture** required for effective agent systems:

```
┌─────────────────────────────────────────────────────────┐
│  L4: META-KNOWLEDGE (self-models, confidence, limits)   │
│      - What I know, what I don't, when to ask           │
│      - Currently missing from all systems               │
├─────────────────────────────────────────────────────────┤
│  L3: PROCEDURAL KNOWLEDGE (Skills/Workflows/Schemas)    │
│      - Structured, verifiable, transferable             │
│      - XSkill: Markdown skill documents                 │
│      - SkillRL: Hierarchical SkillBank                  │
│      - Schema Gating: execution-boundary validation     │
│      - Function: error reduction, structural reliability│
├─────────────────────────────────────────────────────────┤
│  L2: TACTICAL KNOWLEDGE (Experiences/Heuristics)        │
│      - Context-sensitive, adaptive, flexible            │
│      - XSkill: JSON experience bank                     │
│      - Episodic memory traces                           │
│      - Function: tool selection, error recovery, edge   │
│        case handling                                    │
├─────────────────────────────────────────────────────────┤
│  L1: RAW TRAJECTORIES (Execution Logs/Observations)     │
│      - Unprocessed, noisy, high-volume                  │
│      - MUST be abstracted before use (Law 18)           │
│      - Direct use degrades performance (SkillRL: -7.2%) │
│      - Function: source material only                   │
└─────────────────────────────────────────────────────────┘
```

**Key insight: Each layer depends on the one below, but direct use of lower layers is harmful.** L1→L2 requires abstraction (experience extraction). L2→L3 requires formalization (skill codification). L3→L4 requires reflection (self-model construction).

---

## 3. The Consolidation Gap

All six sources identify **consolidation** as the critical missing mechanism:

| System | Consolidation Mechanism | Quality |
|--------|------------------------|---------|
| XSkill | Similarity merging + quality pruning + length-triggered refinement | ★★★★★ |
| SkillRL | Hierarchical SkillBank with recursive evolution | ★★★★ |
| Grow Don't Overwrite | Function-preserving expansion (parametric) | ★★★★ |
| Schema Gating | Manual schema definition | ★★ |
| Our System | **None** — files only grow, never consolidate | ★ |
| Most MAS in literature | Append-only logs | ★ |

**The Consolidation Law (proposed):** Without active consolidation, knowledge systems undergo monotonic growth that degrades retrieval quality and increases cognitive overhead. Effective consolidation requires: (1) similarity detection, (2) quality assessment, (3) merge/prune operations, (4) abstraction-level maintenance.

XSkill's consolidation mechanism is the gold standard: it merges similar entries, prunes low-quality ones, caps total size, and replaces specifics with generalizable placeholders. This directly addresses Law 27 (Monotonic Drift).

---

## 4. Cross-Model Knowledge Transfer

XSkill demonstrates that **externalized knowledge transfers across model architectures**:
- GPT-5-mini and o4-mini used knowledge accumulated by Gemini-3-Flash
- Still gained 2.58-4.16 pts over tools-only baseline
- No model-specific retraining required

This has profound implications for multi-agent systems:
- **Law 20 (Diversity Dividend):** Cross-model transfer enables heterogeneous teams to share knowledge without requiring same-model homogeneity
- **Mechanism 18 (Cross-Agent Retrieval Contamination):** Mitigated by the adaptation step — knowledge is rewritten for current context, not blindly injected
- **Our system:** We already do this implicitly (agents share knowledge/ directory), but without the adaptation and quality control layers

---

## 5. Implications for GUS

### 5.1 Proposed Additions

**Law 32: Knowledge Duality Law**
> Agent knowledge systems require at minimum two distinct streams — structural/procedural (skills) and situational/tactical (experiences) — for effective continual learning. Conflating these streams reduces both structural reliability and adaptive flexibility.

**Mechanism 39: Knowledge Stream Conflation**
> When an agent system stores procedural knowledge and tactical knowledge in the same representation (e.g., append-only logs), the structural patterns are obscured by contextual noise, and the contextual insights are diluted by procedural boilerplate. Result: neither stream serves its function well.

**Principle 87: Abstraction Layering**
> Agent knowledge systems should maintain at least three layers (raw → tactical → procedural), with explicit abstraction gates between each layer. Direct use of lower layers bypasses the quality improvements of abstraction.

### 5.2 Prediction Updates

**Prediction 87 (Knowledge Duality Superiority):** Multi-agent systems that maintain separate skill and experience stores will outperform those with unified knowledge stores by 15-30% on tasks requiring both reliability and adaptability. (Evidence: XSkill ablation, SkillRL comparison.)

**Prediction 88 (Consolidation Threshold):** Agent knowledge stores without consolidation mechanisms will show performance degradation after accumulating more than ~200-500 entries, as retrieval quality degrades with store size. (Preliminary evidence: XSkill caps N_max; our system has 340+ files with no consolidation.)

---

## 6. Self-Application

This synthesis itself demonstrates the Knowledge Duality:
- Our **deep-dives** (229 files) are procedural/structural knowledge — they describe *what papers found*
- Our **cross-references** (now 83 files) are tactical/relational knowledge — they describe *how findings connect*
- Our **journal** is raw trajectory log (L1)
- We lack the consolidation mechanism to merge/prune deep-dives that cover overlapping topics

**Actionable recommendation for our system:**
1. Separate knowledge/ files into skills (procedural guides) and experiences (tactical heuristics)
2. Implement consolidation: merge similar deep-dives, prune superseded analyses
3. Add quality signals to knowledge entries (usage frequency, validation status)
4. Cap knowledge stores and implement length-triggered refinement

---

*Filed as Cross-Reference Synthesis #83. ~10KB. Integrates DD#232 (XSkill), DD#213 (SkillRL), DD#214 (Grow Don't Overwrite), DD#207 (Memory Survey), Cross-Ref #46 (Cognitive Evolution Stack), Cross-Ref #34 (Specification-to-Enforcement Gap).*
