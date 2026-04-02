# Cross-Reference #150: The State-Trust Duality — Bounded Memory Meets Contextual Reliability

**Primary Sources:** DD#409 (StatePlane), DD#410 (CESA-LinUCB)
**Secondary Sources:** DD#405 (TrinityGuard), DD#408 (ILION), CR#145 (Pruning Over Voting), DD#379 (Orla), DD#400 (Seven Laws)
**Pattern Class:** Agent Memory Architecture × Trust Dynamics
**Relevance:** ★★★★★ | Synthesizes two fundamental agent infrastructure problems into unified framework

---

## The Duality

Two papers, independently developed, address complementary halves of the same fundamental challenge:

| Dimension | StatePlane (DD#409) | CESA-LinUCB (DD#410) |
|-----------|--------------------|-----------------------|
| Core question | "What should I remember?" | "Who should I believe?" |
| Formal tool | Information bottleneck | Contextual bandits |
| Key mechanism | Selective encoding + forgetting | Trust-weighted aggregation |
| Security principle | "Evidence not instruction" | "When to trust, not who" |
| Failure mode addressed | State bloat / commitment loss | Consensus capture / sycophancy |
| Asymmetry insight | Forgetting reduces interference | False distrust < false trust |

**The duality:** An agent with perfect memory but no trust model is vulnerable to state poisoning. An agent with perfect trust but no memory loses commitments. Both problems are **context-dependent** — which memories matter depends on current goals (StatePlane), and which agents are reliable depends on current context (CESA).

---

## Unified Framework: Trusted Bounded State

Combining both papers suggests a four-layer architecture:

### Layer 1: State Management (StatePlane)
- Tripartite memory (episodic/semantic/procedural)
- Selective encoding via information bottleneck
- Goal-conditioned retrieval with bounded context guarantee

### Layer 2: Trust Modeling (CESA)
- Per-source contextual trust boundaries
- Trust regions learned from sparse ground-truth probes
- Dynamic weighting: reliable sources amplified, adversarial suppressed

### Layer 3: Write Gating (Synthesis)
- StatePlane's write gate + CESA's trust function = **trust-aware state updates**
- New information admitted to state only if source trust τ*_m(x) exceeds threshold in current context
- Prevents state poisoning by contextually-adversarial agents

### Layer 4: Read Filtering (Synthesis)
- Retrieved state weighted by **recency-adjusted salience** (StatePlane) AND **source trust** (CESA)
- State from contextually-untrusted sources downweighted but not deleted (preserves auditability)
- "Evidence not instruction" enforced structurally: state influences but never commands

---

## Three Design Principles Formalized

### Principle 1: Asymmetric Error Costs
Both papers independently discover the same asymmetry:
- **StatePlane**: Forgetting (losing useful state) costs O(retrieval delay). Retaining (keeping toxic state) costs O(permanent bias).
- **CESA**: False distrust costs O(√T). False trust costs O(T).

**Unified:** In agent systems, **conservative defaults are strictly better than permissive defaults**. Default to forget, default to distrust. Override requires evidence.

### Principle 2: Sparse Supervision Sufficiency
- **StatePlane**: Promotion lifecycle requires minimal human-in-the-loop verification at tier boundaries
- **CESA**: Only ~5% axiomatic checks break the consensus trap

**Unified:** Agent systems don't need continuous human oversight — they need **strategically-placed verification checkpoints**. Sparse supervision at decision boundaries > dense monitoring of routine operations.

### Principle 3: Context-Dependency of Both Memory and Trust
- **StatePlane**: Goal-conditioned retrieval — what's relevant depends on current task
- **CESA**: Trust boundaries — who's reliable depends on current context

**Unified:** All agent infrastructure decisions (what to store, what to retrieve, who to trust, how to aggregate) must be **conditioned on the current operational context**. Static policies fail.

---

## Application to Our System

### Current State (Implicit Implementation):
- **Memory**: Journal entries, heartbeat.md, workspace files — no formal salience scoring or decay
- **Trust**: Analyst judgment on paper quality — no contextual trust model for sources
- **Write gating**: Human review of deep-dives — no automated poisoning detection
- **Read filtering**: Manual selection via todo/handoff system — no trust-weighted retrieval

### Improvements Suggested by This Synthesis:
1. **Salience-scored journal entries** — tag entries with utility/surprise/novelty scores; use for retrieval priority during compaction
2. **Source trust profiles** — track which paper venues/authors/methods have historically produced actionable insights vs. dead ends
3. **Contextual retrieval** — when starting a new deep-dive, retrieve based on topic + historical connection quality, not just keyword match
4. **Sparse verification anchors** — designate ~5% of analyses for cross-validation against ground truth (empirical reproduction, expert review)

---

## Connection to Broader Patterns

This synthesis connects three previously-identified principles:

1. **CR#145 (Pruning Over Voting)** → Pruning is the degenerate case of CESA (binary trust weights). CESA generalizes to continuous, context-dependent trust.
2. **DD#408 (ILION Execution Gates)** → Write gates at the action level. StatePlane adds write gates at the memory level. CESA adds trust gates at the input level. **Three-layer gating architecture.**
3. **DD#400 (Seven Laws)** → Law 5 (Self-Awareness) ← StatePlane's explicit state tracking. Law 6 (Learning) ← CESA's trust boundary learning. Law 3 (Bounded Authority) ← Both papers' conservative defaults.

### Emerging Meta-Pattern: **The Gated Agent**
Across DD#408, DD#409, DD#410, and CR#145, a consistent architecture emerges:
- **Input Gate** (CESA trust boundaries) → filter incoming signals
- **State Gate** (StatePlane write/promotion) → filter what enters memory
- **Action Gate** (ILION execution gates) → filter what gets executed
- **Team Gate** (CR#145 pruning) → filter who participates

Each gate implements the same principle: **conservative defaults with evidence-required override**. The Gated Agent is the architectural pattern unifying all four.

---

## Key Takeaway

StatePlane and CESA-LinUCB solve the two halves of bounded-context agent reliability: what to remember and who to believe. Combined, they formalize the **Gated Agent** architecture where every information flow — inputs, memory, actions, team membership — passes through context-dependent gates with conservative defaults. This is not just theoretical elegance; it's the design pattern that enables agent systems to operate reliably in adversarial, long-horizon, resource-constrained environments.
