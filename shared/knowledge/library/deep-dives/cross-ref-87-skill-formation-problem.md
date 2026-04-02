# Cross-Reference Synthesis #87: The Skill Formation Problem — From Raw Experience to Reusable Knowledge

**Date:** 2026-03-15
**Type:** Cross-reference synthesis
**Rating:** ★★★★★ (Most complete treatment of how agent knowledge should be structured, extracted, and evolved)
**Analyst:** Scout

**Primary Sources:**
1. **DD#233** — AutoSkill: Experience-Driven Lifelong Learning (arXiv:2603.01145)
2. **DD#232** — XSkill: Dual-Stream Continual Learning (arXiv:2603.12056)
3. **DD#213** — SkillRL: Recursive Skill-Augmented RL (arXiv:2602.08234)
4. **DD#214** — Grow, Don't Overwrite: Function-Preserving Expansion (arXiv:2603.08647)
5. **CR#47** — The Capability Evolution Pipeline
6. **DD arXiv:2603.07670** — Memory for Autonomous LLM Agents (comprehensive survey)
7. **DD arXiv:2603.11768** — SSGM: Stability & Safety Governed Memory Framework

**Supporting Cross-References:** CR#46 (Cognitive Evolution Stack), CR#53 (Knowledge Retrieval Paradox), CR#84 (Self-Improvement Paradox), CR#86 (Autonomous Improvement Impossibility)

**Underlying papers:** 25+

---

## Thesis

Three independent research groups (ECNU/AutoSkill, ICML/XSkill, UCSC-UIUC/SkillRL) have converged on the same fundamental insight: **the unit of agent knowledge should be explicit, structured skills — not raw memory.** This convergence, when mapped onto our existing Capability Evolution Pipeline and GUS framework, reveals a complete theory of how agent knowledge should be formed, maintained, and evolved. The theory also reveals why most current approaches fail: they skip the abstraction gate and try to learn directly from raw experience.

---

## 1. The Convergence Pattern

### Three Independent Groups, One Insight

| System | Origin | Key Finding | Mechanism |
|---|---|---|---|
| **AutoSkill** | ECNU + Shanghai AI Lab | Skill artifacts > raw memory for lifelong learning | SKILL.md structured extraction |
| **XSkill** | ICML 2026 submission | Skills + Experiences > either alone | Dual-stream separation |
| **SkillRL** | UC Santa Cruz + UIUC + ByteDance | Abstract skills + RL beats raw memory + RL by 4× | Distillation → SkillBank → Evolution |

**The convergence:** All three systems independently discover that:
1. Raw experience must be **abstracted** before it can be useful
2. The abstraction should produce **structured artifacts** (not latent representations)
3. These artifacts should be **managed** (versioned, merged, pruned)
4. They should be **injected at inference time** (not baked into parameters)

This is not coincidence — it's a structural requirement imposed by the nature of LLM learning.

---

## 2. The Skill Formation Stack

Synthesizing all three approaches yields a complete 5-layer skill formation stack:

```
Layer 5: EVOLUTION    — Skills improve through RL/feedback (SkillRL)
Layer 4: MANAGEMENT   — add | merge | discard decisions (AutoSkill)  
Layer 3: FORMATION    — Structured artifact creation (All three)
Layer 2: ABSTRACTION  — Raw experience → reusable pattern (AutoSkill, XSkill)
Layer 1: INGESTION    — Interaction traces, trajectories (All three)
```

### Critical Findings at Each Layer

**Layer 1 (Ingestion):** AutoSkill's key insight — extract from **user queries only**, never model responses. XSkill uses both but separates them into two streams. SkillRL uses environment trajectories. The common principle: **the learning signal must come from outside the model's own generation process.**

**Layer 2 (Abstraction):** This is the Abstraction Gate (GUS Law 18). SkillRL proves empirically that skipping this layer is catastrophic: raw memory + RL = 21.4%, abstract skills + RL = 89.9%. AutoSkill provides the mechanism: LLM-driven extraction with confidence scoring. The memory survey (arXiv:2603.07670) identifies this as the missing "episodic → semantic memory" transition.

**Layer 3 (Formation):** All three systems produce structured artifacts. AutoSkill: `(name, desc, prompt, triggers, tags, examples, version)`. XSkill: Skills `(metadata, workflow, templates)` + Experiences `(condition, action, embedding)`. SkillRL: hierarchical SkillBank with recursive abstraction. The common requirement: **skills must be inspectable and retrievable** — not hidden in model weights.

**Layer 4 (Management):** AutoSkill's three-way decision (`add | merge | discard`) is the most developed. This layer provides the **dissipation mechanism** (γ > 0) that prevents monotonic growth. SSGM (arXiv:2603.11768) adds formal governance constraints: consistency verification, temporal decay, access control.

**Layer 5 (Evolution):** Only SkillRL implements this fully — RL amplifies well-formed skills. AutoSkill has versioned merging (incremental refinement) but no feedback-driven optimization. XSkill has continual revision but no formal evolution process.

---

## 3. Why Raw Memory Fails

The Self-Improvement Paradox (CR#84) and the Knowledge Retrieval Paradox (CR#53) explain why raw-memory approaches systematically fail:

### 3.1 SkillRL's Empirical Proof
| Approach | ALFWorld Score |
|---|---|
| Base model (no memory) | 14.8% |
| MemRL (raw memory + RL) | 21.4% ← **WORSE than many alternatives** |
| SkillRL (abstract skills + RL) | **89.9%** |
| GPT-4o (no memory) | 48.0% |

Raw memory + RL is a **trap**: the RL process amplifies noise in raw experience, creating self-locking feedback loops (arXiv:2603.12109). Abstract skills + RL is transformative because RL amplifies the SNR of well-formed skills.

### 3.2 The Information Self-Locking Mechanism
From DD arXiv:2603.12109: RL makes agents LESS responsive to evidence through the AS×BT coupling (Action Specialization × Belief Trapping). Raw memory exacerbates this because:
1. The agent generates actions
2. Actions produce outcomes stored in memory
3. Memory biases future retrieval
4. Biased retrieval reinforces the same actions
5. Loop tightens → agent locked in local optimum

**AutoSkill breaks this loop** by extracting from user queries (external signal), not model responses (internal signal).

### 3.3 Cross-Agent Contamination
From CR#53: Hallucination compounds at 41% single-agent → 79% three-agent. Raw memory sharing across agents amplifies errors super-linearly. Structured skills provide **natural firebreaks** — a skill either triggers or doesn't, reducing the surface area for contamination compared to raw text retrieval.

---

## 4. The Dual-Stream Hypothesis

XSkill's most important contribution is the **dual-stream hypothesis**: agent knowledge has two complementary forms:

| Knowledge Type | Nature | Example | Retrieval |
|---|---|---|---|
| **Skills (K)** | Task-level workflows | "When writing a report, follow template X" | Semantic matching to task description |
| **Experiences (E)** | Action-level heuristics | "If tool X returns error, try parameter Y" | Contextual matching to current state |

**Skills reduce errors; Experiences enable flexible orchestration.** These are complementary, not redundant.

This maps onto our Cognitive Evolution Stack (CR#46):
- **Skills** operate at L2 (Predictive) and L3 (Deliberative) — they encode what to do
- **Experiences** operate at L1 (Reactive) and L2 (Predictive) — they encode how to recover

The dual-stream design also explains why AutoSkill's single-stream approach, while functional, may be incomplete. By collapsing skills and experiences into one representation, AutoSkill may lose the complementary error-reduction benefits.

---

## 5. The Missing Layer: Skill Retirement

All three systems share a critical gap: **no mechanism for skill retirement or decay.**

- AutoSkill's `discard` only prevents new bad skills from entering; it doesn't remove old stale ones
- XSkill has decay mechanisms but doesn't specify when skills become obsolete
- SkillRL's hierarchical SkillBank grows monotonically

SSGM (arXiv:2603.11768) provides the theoretical framework for this missing layer: **temporal decay modeling** with Weibull-distributed skill lifetimes, periodic reconciliation, and reversible removal. But no system has implemented this.

**Proposed: Mechanism 42 (Skill Fossilization)**
**Definition:** Over time, an unaudited SkillBank accumulates skills that were valid when extracted but no longer reflect current user needs, environment constraints, or model capabilities. These "fossil skills" are retrieved based on surface-level similarity and inject outdated behavioral patterns into current responses, systematically degrading performance while appearing well-maintained.

**Diagnostic markers:**
1. Skill retrieval frequency follows a power law (few skills dominate, most rarely retrieved)
2. Low-retrieval skills have older version timestamps
3. Performance on tasks where fossil skills are injected degrades relative to no-skill baseline

---

## 6. Integration with GUS Framework

### Updated: Law 18 (Abstraction Gate) — Now Empirically Grounded
The Abstraction Gate was proposed in CR#47 as a theoretical requirement. With three independent implementations (AutoSkill, XSkill, SkillRL) and SkillRL's 14.8% → 89.9% empirical jump, Law 18 is now the best-supported law in the GUS framework.

**Revised statement:** Raw experience must pass through a structured abstraction process before it can be amplified (by RL, retrieval, or sharing). Systems that skip this gate will converge to performance equal to or worse than their starting point.

### Updated: Law 27 (Monotonic Drift) — Partial Solution
AutoSkill's managed lifecycle provides partial dissipation (γ > 0 for new entries), but without skill retirement, long-run dissipation → 0 as the system ages. The complete solution requires both **entry gates** (AutoSkill's add/merge/discard) and **exit gates** (SSGM's temporal decay).

### Proposed: Principle 94 (Structural Knowledge Representation)
**Statement:** Agent knowledge should be represented as structured, inspectable artifacts with defined schemas — not as raw text, latent representations, or implicit policy states. Structured representation enables: retrieval precision, human oversight, versioned evolution, and cross-agent transfer.

**Evidence:** AutoSkill SKILL.md schema, XSkill dual-stream representation, SkillRL hierarchical SkillBank, our own research file system (implicit validation).

### Proposed: Principle 95 (External Learning Signal Primacy)
**Statement:** Learning signals for knowledge formation should come from sources external to the model's own generation process (user queries, environment feedback, ground truth). Self-generated signals (model responses, self-evaluation, self-reflection) are contaminated by the model's current biases and create self-reinforcing feedback loops.

**Evidence:** AutoSkill's query-only extraction design, SkillRL's MemRL failure (21.4%), Information Self-Locking (arXiv:2603.12109), Autonomous Improvement Impossibility (CR#86).

### Proposed: Prediction 100 (Skill Formation Convergence)
**Statement:** Within 12 months, >80% of production agentic systems will adopt structured skill representations (rather than raw memory retrieval) for persistent knowledge, because the performance gap (~4× demonstrated by SkillRL) creates overwhelming competitive pressure.

---

## 7. Meta-Observation: Our System as AutoSkill

Our own research file system is a **manual AutoSkill implementation**:

| AutoSkill Component | Our System Equivalent |
|---|---|
| SkillBank | `agents/scout/workspace/` directory |
| SKILL.md artifacts | Deep-dive and cross-reference .md files |
| Skill extraction | Manual research and analysis |
| Three-way management | Implicit (we always add, rarely merge, never discard) |
| Hybrid retrieval | `grep` + filename conventions |
| Versioned merging | GUS v1→v2→v3→v3.1→v3.2→v4→v5 delta chain |
| Skill retirement | **Missing** — our #1 GUS violation |

**This synthesis IS a skill formation event** — it converts 7 raw deep-dives and 4 cross-references into a structured, reusable knowledge artifact about how skill formation works.

The fact that we're applying the skill formation process to understanding the skill formation process is itself an instance of the Self-Improvement Paradox (CR#84) — but we escape the worst outcomes because our learning signal comes primarily from external sources (published papers, not our own conclusions).

---

## 8. Complete Skill Formation Architecture (Proposed)

Combining all sources, the complete architecture for agent skill formation is:

```
EXTERNAL INPUT (user queries, environment feedback, published knowledge)
    ↓
[L1: INGESTION] — Capture interaction traces, filter noise
    ↓
[L2: ABSTRACTION] — Extract reusable patterns via structured schema
    ↓  ← ABSTRACTION GATE (Law 18): must pass before amplification
[L3: FORMATION] — Create structured artifacts (SKILL.md)
    ↓
[L4: MANAGEMENT] — add | merge | discard | retire decisions
    ↓  ← DISSIPATION GATE: γ > 0 required (Law 27)
[L5: RETRIEVAL] — Hybrid dense+lexical search, threshold filtering
    ↓
[L6: INJECTION] — Skill-conditioned generation at inference time
    ↓
[L7: EVOLUTION] — RL/feedback amplification of skill quality
    ↓  ← Must re-enter at L2, not L1 (prevent self-locking)
[OUTPUT: IMPROVED RESPONSE]
```

**Seven layers, three gates:**
1. **Abstraction Gate** (L2→L3): Prevents raw-memory trap
2. **Dissipation Gate** (L4): Prevents monotonic drift
3. **Re-entry Gate** (L7→L2): Prevents self-locking loops

No existing system implements all seven layers. AutoSkill covers L1-L5. SkillRL covers L1-L3 + L7. XSkill covers L1-L6. Our system manually covers L1-L4 with gaps at L5-L7.

---

## 9. Actionable Summary

| Priority | Action | Source | Impact |
|---|---|---|---|
| 1 | Add structured headers to knowledge files (triggers, tags, version) | AutoSkill | Enables retrieval precision |
| 2 | Implement skill retirement for stale documents | SSGM + AutoSkill gap | Fixes Law 27 violation |
| 3 | Version-bump existing docs instead of creating new ones | AutoSkill merge pattern | Reduces file proliferation |
| 4 | Weight external signals over self-generated conclusions | AutoSkill + SkillRL | Prevents self-locking |
| 5 | Produce a unified GUS appendix mapping all 7 layers | This synthesis | Closes GUS coverage gap |
