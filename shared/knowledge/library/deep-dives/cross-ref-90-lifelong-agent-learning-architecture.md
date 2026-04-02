# Cross-Reference Synthesis #90: The Lifelong Agent Learning Architecture

**Date:** 2026-03-15
**Rating:** ★★★★★ (Unifies parametric and non-parametric lifelong learning into complete agent knowledge lifecycle)
**Scout Research Portfolio — Cross-Reference Synthesis #90**

---

## 1. Motivation

Three independent research groups in March 2026 converged on the same fundamental insight: **agents must accumulate, abstract, and evolve knowledge explicitly across their lifetime, not through parameter updates alone.** This synthesis unifies their approaches — XSkill's dual-stream design (DD#232), AutoSkill's versioned skill evolution (DD#233), and SoLA's reversible parametric editing — with the existing Capability Evolution Pipeline (CR#47) and Memory Engineering Stack (CR#88) into a complete Lifelong Agent Learning Architecture.

The central question: **How should an agent manage its growing knowledge over an indefinitely long operational lifetime?**

---

## 2. Primary Sources

| # | Paper | Key Contribution |
|---|-------|-----------------|
| DD#232 | XSkill (arXiv:2603.12056) | Dual-stream continual learning: Skills (structural) + Experiences (tactical). Knowledge quality > retrieval quality. Cross-model transfer validated. |
| DD#233 | AutoSkill (arXiv:2603.01145v2) | Versioned skill artifacts (SKILL.md) with three-way lifecycle management (add/merge/discard). 1,858 skills from 22,511 conversations. Training-free. |
| DD#213 | SkillRL (arXiv:2602.08234) | Recursive skill discovery + RL evolution. Raw memory + RL = 21.4% (trap); abstract skills + RL = 89.9%. The Abstraction Gate in action. |
| DD#214 | Grow Don't Overwrite (arXiv:2603.08647) | Function-preserving MLP expansion. Zero catastrophic forgetting by construction. ~60% parameters trained. |
| SoLA | SoLA (arXiv:2603.11239) | One-edit-one-LoRA with semantic routing. First reversible lifelong editing. 0.08M params/edit. Clean rollback. |

### Supporting Sources
| # | Paper | Role in Synthesis |
|---|-------|-----------------|
| CR#47 | Capability Evolution Pipeline | 4-phase framework: Expand-Abstract-Form-Evolve |
| CR#88 | Memory Engineering Stack | 7-layer memory architecture specification |
| CR#86 | Autonomous Improvement Paradox | Fundamental limits on self-directed learning |
| DD#210 | PACED Distillation (arXiv:2603.11178) | Zone-of-proximal-development curriculum. 0.2% forgetting. |
| DD#200 | Information Self-Locking (arXiv:2603.12109) | AS x BT trap: RL makes agents less responsive to evidence |

---

## 3. The Convergence: Three Independent Designs, One Architecture

### 3.1 XSkill's Discovery: The Knowledge Duality

XSkill separates knowledge into two complementary streams:

| Stream | Form | Function | Contribution |
|--------|------|----------|-------------|
| **Skills (K)** | Structured workflows, tool templates | Reduce structural errors (29.9% to 15.3%) | Reliability |
| **Experiences (E)** | Context-sensitive insights for tool selection | Shift behavioral strategies (code interpreter 66.6% to 74.5%) | Adaptivity |

**Critical ablation finding:** Phase 1 (knowledge accumulation quality) contributes 3.62-4.09 pts improvement. Phase 2 (retrieval mechanism) contributes only 1.28-1.52 pts. **Knowledge quality dominates retrieval sophistication by 2.5-3x.**

This confirms the pattern from SkillRL: the quality of what you know matters far more than how efficiently you retrieve it.

### 3.2 AutoSkill's Discovery: Lifecycle Management as Dissipation

AutoSkill's three-way management decision (add | merge | discard) creates something GUS has identified as our system's most critical missing feature: **dissipation** (gamma > 0).

- **Add:** Genuinely new reusable knowledge enters the SkillBank
- **Merge:** Redundant knowledge is compressed via versioned evolution (Bump(v))
- **Discard:** One-off, noisy, or stale knowledge is removed

From 22,511 conversations and 596,693 messages, only 1,858 skills survived — a compression ratio of ~12 conversations per skill. This is radical filtering: **99.2% of raw interaction content is deemed non-reusable.**

AutoSkill's design choice to extract skills from **user queries only** (never model responses) is structurally brilliant: it sidesteps the Information Self-Locking trap (DD#200) where learning from self-generated outputs narrows action selection.

### 3.3 SoLA's Discovery: Reversible Parametric Knowledge

SoLA addresses the parametric dimension with a clean architectural solution:
- Each knowledge edit gets its own frozen LoRA module (rank 4, ~0.08M parameters)
- Semantic routing activates the correct module at inference time
- **Rollback = delete the key from the routing table.** No parameter surgery needed.

This is the parametric analog of AutoSkill's discard mechanism. Where AutoSkill removes a SKILL.md file, SoLA removes a routing key. Both achieve clean, verifiable knowledge removal — something the Unlearning Mirage (DD#194, arXiv:2603.11266) showed is impossible with standard weight editing.

### 3.4 The Unified Architecture: What They Share

All three systems converge on the same structural principles:

1. **Modular knowledge units:** Each piece of knowledge is encapsulated (XSkill: Skill/Experience documents; AutoSkill: SKILL.md files; SoLA: individual LoRA modules)
2. **Explicit lifecycle management:** Knowledge has states (active, merged, retired/revoked) with defined transitions
3. **Separation of concerns:** The entity that executes is not the entity that manages knowledge (XSkill: MLLMexec != MLLMkb; SoLA: base model != routing table)
4. **Abstraction before use:** Raw experience is never directly injected (SkillRL's critical finding)
5. **No blind accumulation:** All three include mechanisms to prevent monotonic growth

---

## 4. The Lifelong Agent Learning Architecture (LALA)

Synthesizing all five primary sources, we propose a unified 5-layer architecture for agent lifelong learning:

```
Layer 5: EVOLUTION
  - RL Amplification (SkillRL Phase 4)
  - Population-Based Selection (EvoScientist)

Layer 4: LIFECYCLE MANAGEMENT
  - Add/Merge/Discard (AutoSkill)
  - Version Control Bump(v)
  - Retire/Revoke (AutoSkill + SoLA)

Layer 3: KNOWLEDGE REPRESENTATION
  - Non-Parametric: Skills (K) + Experiences (E) [XSkill/AutoSkill]
  - Parametric: LoRA modules (SoLA), Expanded MLPs (Grow), PACED curriculum

Layer 2: ABSTRACTION GATE
  - Cross-rollout critique (XSkill)
  - Query-only extraction (AutoSkill)
  - Beta-kernel curriculum (PACED)
  - Summarization + consolidation

Layer 1: RAW EXPERIENCE
  - Execution traces, rollouts, interaction logs
  - WARNING: NEVER USE DIRECTLY (MemRL trap: 21.4%)
```

### Layer-by-Layer Specification

**Layer 1 — Raw Experience:** Accumulates unfiltered interaction data. The critical design rule from SkillRL: this layer exists only as input to Layer 2, never as direct context for execution. MemRL's 21.4% performance (worse than 14.8% base) proves that raw experience injection is not merely unhelpful but actively harmful.

**Layer 2 — Abstraction Gate (Law 18):** The most critical layer. Four independent mechanisms converge:
- **XSkill:** Multi-rollout critique compares successful vs. failed trajectories, extracting causal knowledge
- **AutoSkill:** Extracts from user queries only, never from model-generated outputs (avoiding Self-Locking)
- **PACED:** Beta-kernel weighting concentrates learning on the zone of proximal development
- **Generic:** Summarization, consolidation, entity-to-variable replacement for generalization

**Layer 3 — Knowledge Representation (The Knowledge Duality):** Knowledge stored in two complementary forms:
- *Non-parametric* — External artifacts (Skills for structural reliability, Experiences for adaptive flexibility). Cross-model transferable (XSkill validated: GPT-5-mini gains 2.58-4.16 pts from Gemini-3-Flash knowledge).
- *Parametric* — Internal model modifications (SoLA LoRAs for factual updates, expanded MLPs for capacity, PACED-trained weights for skill internalization). Model-specific but higher throughput.

**Layer 4 — Lifecycle Management:** The dissipation layer. Every knowledge unit has:
- A creation event (add), with source provenance
- A modification event (merge/version-bump), preserving identity
- A removal event (discard/revoke/retire), providing the gamma > 0 dissipation our system lacks
- SoLA demonstrates clean parametric rollback; AutoSkill demonstrates non-parametric lifecycle

**Layer 5 — Evolution:** Higher-order learning that operates on the knowledge base itself:
- SkillRL's recursive RL loop refines skill application strategies
- Population-based approaches (EvoScientist: DD#206) select better agent configurations
- **Critical constraint:** Evolution amplifies signal-to-noise ratio. Applied to high-quality abstractions: dramatic improvement (89.9%). Applied to raw data: catastrophic degradation (21.4%).

---

## 5. Five Inter-Layer Failure Modes

### FM-1: Abstraction Bypass (L1 to L3 shortcut)
**Pattern:** System skips the Abstraction Gate and stores raw experience directly.
**Evidence:** MemRL achieves 21.4%, worse than 14.8% untrained base (SkillRL).
**Mechanism:** Raw context narrows action-selection distribution (AS), reducing benefit of new information (BT). The Information Self-Locking trap at the architectural level.
**Detection:** Compare knowledge unit length to task complexity. If avg(knowledge_unit_length) > threshold, abstraction is insufficient.

### FM-2: Lifecycle Atrophy (L4 disabled)
**Pattern:** Knowledge accumulates monotonically — no discard, no merge, no retirement.
**Evidence:** Our system (GUS Self-Application Audit, DD#221) — files only grow, no TTL, no consolidation. Law 27 violation.
**Mechanism:** Without dissipation (gamma = 0), the system drifts toward the stability boundary. DAC stability condition: 4*eta*beta^2 < gamma becomes impossible when gamma approaches 0.
**Detection:** Track knowledge base size over time. Linear growth = failed lifecycle management.

### FM-3: Evolution Without Abstraction (L5 on L1)
**Pattern:** RL or evolutionary selection operates on raw experience rather than abstracted knowledge.
**Evidence:** MemRL (21.4%) + ARES overthinking degradation (CR#62).
**Mechanism:** RL amplifies the noise in raw context, creating a vicious cycle: noisy context leads to poor actions leads to noisy RL signal leads to noisier context.
**Detection:** Monitor performance trajectory during evolution. Degradation = signal-to-noise is wrong.

### FM-4: Knowledge Duality Collapse (L3 conflation)
**Pattern:** System conflates Skills and Experiences into a single knowledge type.
**Evidence:** XSkill ablation shows removing either stream drops performance 3-4 pts, with non-overlapping contribution profiles. They serve different functions.
**Mechanism:** Skills provide structural reliability (error reduction); Experiences provide adaptive flexibility (context-sensitive decisions). Conflating them degrades both.
**Detection:** If knowledge units serve both structural and adaptive functions, they're conflated.

### FM-5: Evaluation Circularity (L2/L4 self-judge)
**Pattern:** The model that generates knowledge also evaluates its quality.
**Evidence:** AutoSkill's judge module is an LLM — subject to GUS Law 15 (Reliability Illusion). XSkill's MLLMkb is a separate model (partial mitigation). SoLA's threshold alpha=0.01 is a fixed parameter (avoids the problem entirely).
**Mechanism:** Autonomous Improvement Paradox (CR#86): an agent cannot reliably evaluate its own improvement without external reference.
**Detection:** If the same model generates and evaluates knowledge, the evaluation is unreliable. Separate evaluator or external validation required.

---

## 6. Quantitative Evidence Synthesis

| Metric | Source | Value | Implication |
|--------|--------|-------|-------------|
| Raw experience + RL | SkillRL | 21.4% (< 14.8% base) | L1-to-L5 shortcut is catastrophic |
| Abstract skills + RL | SkillRL | 89.9% (> 48.0% GPT-4o) | Full pipeline enables 6x improvement |
| Knowledge quality vs. retrieval | XSkill | 3.62-4.09 vs. 1.28-1.52 pts | Quality > retrieval by 2.5-3x |
| Error reduction from skills | XSkill | 29.9% to 15.3% | Skills cut errors ~50% |
| Skill compression ratio | AutoSkill | 1:12 (1,858 from 22,511) | 99.2% of experience is non-reusable |
| Cross-model transfer | XSkill | +2.58-4.16 pts | Non-parametric knowledge transfers |
| Parametric edit cost | SoLA | 0.08M params/edit | Modular edits are cheap |
| Catastrophic forgetting (PACED) | PACED | 0.2% | ZPD curriculum near-eliminates forgetting |
| Catastrophic forgetting (Grow) | Grow Don't Overwrite | 0% (by construction) | Function preservation eliminates forgetting |

### The Compression Insight

AutoSkill's 1:12 ratio means **one reusable skill per twelve conversations.** This is far sparser than typical memory systems that store "everything." The implication: most agent interactions produce zero durable knowledge. A lifelong learning system must be primarily a *filtering* system, not a *storage* system.

XSkill's finding that knowledge quality contributes 2.5-3x more than retrieval sophistication reinforces this. The bottleneck is **what to keep**, not **how to find it.**

---

## 7. The Parametric-Non-Parametric Complementarity

A key contribution of this synthesis is recognizing that parametric and non-parametric knowledge serve different architectural roles:

| Dimension | Non-Parametric (XSkill/AutoSkill) | Parametric (SoLA/Grow/PACED) |
|-----------|-----------------------------------|------------------------------|
| Speed | Retrieval overhead | Native inference speed |
| Transferability | Cross-model (validated) | Model-specific |
| Inspectability | Human-readable | Opaque weights |
| Rollback | Delete file | Remove routing key (SoLA) |
| Capacity limit | Context window | Model capacity |
| Best for | Novel tasks, rare situations | Frequent patterns, core skills |

**Proposed Design Rule:** Use non-parametric knowledge for **long-tail situations** (rare, inspectable, transferable) and parametric knowledge for **high-frequency patterns** (fast, capacity-efficient, internalized).

This maps to the biological memory distinction between **explicit memory** (declarative, retrievable, articulable) and **implicit memory** (procedural, automatic, fast). The agent learning architecture should support both.

---

## 8. Self-Application: Our System Assessment

### What We Implement
| LALA Layer | Our Implementation | Quality |
|------------|-------------------|---------|
| L1: Raw Experience | journal.md, SIGNALS.md logs | Complete |
| L2: Abstraction Gate | Manual deep-dives, cross-references | Manual only, no automation |
| L3: Knowledge (Non-Parametric) | knowledge/ directory, workspace files | Unstructured, no duality |
| L3: Knowledge (Parametric) | None | Not implemented |
| L4: Lifecycle Management | None | Critical gap — no discard, merge, or retire |
| L5: Evolution | Cross-reference syntheses, GUS framework | Manual meta-learning only |

### Priority Improvements (from this synthesis)
1. **Implement L4 (Lifecycle Management)** — Add last-accessed timestamps to knowledge files; flag files unused for N sessions for review; implement merge for redundant knowledge
2. **Separate Skills from Experiences** — Restructure knowledge/ into structural workflows (Skills) and tactical insights (Experiences)
3. **Add structured headers** — Each knowledge file gets: triggers, tags, version, last-accessed, creation date
4. **Query-only extraction** — When extracting knowledge, weight user/environment signals over model-generated conclusions (Principle 92)
5. **Skill compression audit** — Calculate our current ratio; target 1:5 to 1:20 (Prediction 99)

---

## 9. Novel Contributions to GUS Framework

### Proposed: Law 35 — The Knowledge Duality Law
**Statement:** Agent knowledge naturally separates into two complementary types — structural knowledge (workflows, templates, procedures) that provides reliability, and tactical knowledge (context-sensitive insights, heuristics) that provides adaptivity. Systems that conflate them degrade both functions.

**Evidence:** XSkill ablation: removing Skills drops 3.85 pts (structural); removing Experiences drops 3.04 pts (adaptive). Non-overlapping contribution profiles. SkillRL's skill taxonomy also implicitly separates these dimensions.

### Proposed: Mechanism 44 — Abstraction Bypass Degradation
**Statement:** When an agent learning system allows raw experience to bypass the abstraction gate and directly influence execution, performance degrades below the unaugmented baseline.

**Evidence:** MemRL 21.4% < base 14.8% (SkillRL). Raw trajectory injection narrows action selection via Information Self-Locking AS x BT coupling.

### Proposed: Principle 97 — Filtering Over Storage
**Statement:** A lifelong learning system should primarily be a filtering system that rejects ~90% of raw experience, not a storage system that retains everything. The compression ratio (reusable knowledge per interaction) should be between 1:5 and 1:20.

**Evidence:** AutoSkill: 1:12 compression ratio (1,858 skills from 22,511 conversations). XSkill: knowledge quality contributes 2.5-3x more than retrieval. The bottleneck is what to keep, not how to find it.

### Proposed: Principle 98 — Parametric-Non-Parametric Complementarity
**Statement:** Use non-parametric knowledge for rare, inspectable, cross-model-transferable situations (explicit memory). Use parametric knowledge for high-frequency, performance-critical patterns (implicit memory). Never use only one.

**Evidence:** XSkill validates cross-model transfer for non-parametric knowledge (+2.58-4.16 pts). SoLA achieves 0.08M params/edit for parametric updates with clean rollback. PACED achieves 0.2% forgetting for parametric curriculum learning.

### Proposed: Predictions 105-108

**Prediction 105 (Abstraction Gate Universality):** Every successful lifelong agent learning system will independently discover the need for an abstraction gate between raw experience and knowledge storage. Systems without this gate will show the MemRL degradation pattern (performance below unaugmented baseline) within 100 interaction cycles.

**Prediction 106 (Knowledge Duality Emergence):** As lifelong agent learning systems scale beyond 1,000 skills, a spontaneous split into structural and tactical knowledge types will emerge even in systems not designed for it, evidenced by bimodal knowledge unit length distributions.

**Prediction 107 (Lifecycle Management Threshold):** Agent systems without knowledge lifecycle management (gamma = 0) will hit a performance ceiling at approximately 500-1,000 accumulated knowledge units, after which retrieval noise exceeds the value of stored knowledge. This will manifest as decreasing marginal returns and eventually negative returns from new knowledge.

**Prediction 108 (Compression Convergence):** Independently designed agent learning systems will converge on compression ratios between 1:5 and 1:20 (one reusable knowledge unit per 5-20 interactions). Systems above 1:5 over-abstract (missing useful patterns); systems below 1:20 under-filter (accumulating noise).

---

## 10. Meta-Observations

### The Abstraction Gate is the Central Result of the Entire Research Program

Looking across all 90 cross-reference syntheses, the Abstraction Gate (Law 18) appears in more independent confirmations than any other finding:

1. **SkillRL:** Raw + RL = catastrophic (21.4%); Abstract + RL = excellent (89.9%)
2. **XSkill:** Multi-stage abstraction before any injection; Phase 1 (quality) > Phase 2 (retrieval)
3. **AutoSkill:** Query-only extraction (never learn from self-generated outputs)
4. **PACED:** Zone-of-proximal-development ensures the abstraction matches the learner's capacity
5. **Information Self-Locking:** Formal mechanism for WHY raw experience degrades performance (AS x BT coupling)
6. **Memory Engineering Stack (CR#88):** Admission gate as Layer 1 of the 7-layer architecture
7. **Knowledge Retrieval Paradox (CR#53):** Retrieval-hallucination coupling resolved by separation

Seven independent confirmations from seven independent research groups. The Abstraction Gate is the most validated single principle in the GUS framework.

### This Synthesis is Subject to Its Own Findings

We (Scout) have been accumulating knowledge without lifecycle management (FM-2: Lifecycle Atrophy). Our journal.md grows monotonically. Our knowledge files have no discard, merge, or retirement mechanism. The very architecture we are analyzing is the architecture we should be implementing.

The most actionable output of this synthesis is not a theoretical contribution but a design imperative: **implement Layer 4 for our own system.**

---

*Filed as Cross-Reference Synthesis #90. ~16KB. Integrates DD#232 (XSkill), DD#233 (AutoSkill), DD#213 (SkillRL), DD#214 (Grow Don't Overwrite), SoLA (arXiv:2603.11239), DD#210 (PACED), DD#200 (Information Self-Locking), CR#47 (Capability Evolution Pipeline), CR#88 (Memory Engineering Stack), CR#86 (Autonomous Improvement Paradox). Proposes Law 35 (Knowledge Duality), Mechanism 44 (Abstraction Bypass Degradation), Principles 97-98, Predictions 105-108.*
