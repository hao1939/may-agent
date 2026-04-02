# Cross-Reference: The Memory Architecture × Attack Surface Unified Model

**Synthesizing 7 orphan deep-dives into a coherent framework for agent memory design and defense**

**Date:** 2026-03-15  
**Analyst:** Scout  
**Cross-reference #31**

---

## Papers Integrated

| # | Paper | ArXiv | Core Contribution |
|---|-------|-------|-------------------|
| 1 | **DAM — Decision-Theoretic Agent Memory** | 2512.21567 | Memory ops as POMDP with Value-of-Information scoring |
| 2 | **Diagnosing Retrieval vs. Utilization** | 2603.02473 | 62% of memory failures are utilization, not retrieval |
| 3 | **PlugMem** | 2603.03296 | Task-agnostic knowledge-centric memory graph; 16x info density |
| 4 | **XAMT — Cross-Agent Memory Tampering** | 2512.15790 | Sub-1% poison rate → 40-60% performance degradation |
| 5 | **MemoryGraft** | 2512.16962 | Persistent agent compromise via poisoned experience retrieval |
| 6 | **Memory Survey** | 2603.07670 | Write–Manage–Read loop formalization; 5 design tensions |
| 7 | **AgentOS** | 2602.20934 | OS-level memory abstractions (S-MMU, Semantic Slicing, CSP) |

---

## 1. THE CENTRAL THESIS: Memory Is the Agent's Most Valuable and Most Vulnerable Subsystem

These 7 papers converge on a single uncomfortable truth: **memory is where agent intelligence lives, and it's where agent security dies.** The same properties that make memory useful — persistence, shareability, influence on future behavior — are exactly what make it attackable.

### The Memory Paradox (Formalized)

From DAM (2512.21567) and the Memory Survey (2603.07670):

> **An agent's memory is simultaneously its primary source of capability improvement AND its primary attack surface.**

This creates a fundamental optimization tension:

```
Maximize:  Σ VoI(m_i) × P(retrieve(m_i) | relevant_task)     [Capability]
Subject to: P(poisoned(m_i) | stored(m_i)) < ε                [Security]
            Σ cost(m_i) ≤ Budget                               [Efficiency]
            ∀m_i: provenance(m_i) is verifiable                [Integrity]
```

The security constraint and the capability constraint are in **direct tension**: sharing memories (multi-agent collaboration) maximizes VoI but maximizes poison exposure. Isolating memories maximizes security but eliminates collaborative learning.

---

## 2. THE THREE-LAYER MEMORY STACK

Synthesizing the architectural proposals from AgentOS, PlugMem, DAM, and the Memory Survey, a unified three-layer stack emerges:

### Layer 1: Memory Substrate (How memories are stored)

| Substrate | Exemplar | Strength | Attack Surface |
|-----------|----------|----------|----------------|
| Context-resident text | Working memory | Transparent, volatile | Prompt injection |
| Vector-indexed stores | RAG, experience retrieval | Scalable | Embedding-space poisoning |
| Knowledge graphs | PlugMem's tri-partite graph | Structured, deduplicable | Node/edge injection |
| Semantic slices | AgentOS S-MMU | Typed, indexed | Slice boundary manipulation |
| Hybrid | Production systems | Multi-modal | Composite attack surface |

**Key insight from PlugMem:** Knowledge-centric graphs (propositions + prescriptions) achieve 16x higher information density than raw retrieval, AND create natural integrity checkpoints (propositions must be internally consistent; prescriptions must reference valid intents).

### Layer 2: Memory Operations (What happens to memories)

From DAM's decision-theoretic framework:

| Operation | Decision Variable | VoI Impact | Security Risk |
|-----------|------------------|------------|---------------|
| **Store** | What to remember | +VoI (new info) | Injection point |
| **Retrieve** | What to recall | Activates VoI | Retrieval hijacking |
| **Forget** | What to discard | -VoI (space recovery) | Forced amnesia attacks |
| **Compress** | How to summarize | VoI preservation | Semantic drift injection |
| **Share** | What to propagate | Collaborative VoI | Cross-agent contagion |

**DAM's critical contribution:** Each operation should be evaluated by expected utility impact, not heuristics. The optimal eviction policy (analogous to Bélády's algorithm) outperforms LRU/LFU by 15-30%.

### Layer 3: Memory Quality (How to ensure memory is trustworthy)

From the Retrieval vs. Utilization diagnostic (2603.02473):

**The field is optimizing the wrong bottleneck.** 62% of memory-related failures are utilization failures (agent has the right memory but can't use it correctly), not retrieval failures. The utilization failure taxonomy:

1. **Attention Dilution (34%)**: Too many retrieved memories overwhelm context
2. **Format Mismatch (22%)**: Memory format ≠ agent's expected format
3. **Conflicting Memories (19%)**: Contradictions the agent can't resolve
4. **Reasoning Errors (15%)**: Correct memory, wrong conclusion
5. **Temporal Confusion (10%)**: Can't determine recency/relevance

**Implication:** Memory defense should focus as much on utilization robustness (can the agent correctly handle poisoned + clean memories together?) as on preventing injection.

---

## 3. THE MEMORY ATTACK TAXONOMY

XAMT and MemoryGraft together define the complete attack landscape:

### Attack Dimensions

| Dimension | XAMT | MemoryGraft | Combined Insight |
|-----------|------|-------------|-----------------|
| **Scope** | Multi-agent (shared pools) | Single-agent (experience store) | Both vectors are live |
| **Optimization** | Bilevel (outer: content, inner: propagation) | Targeted embedding alignment | Bilevel is more devastating |
| **Minimum dose** | 0.3-0.8% poison rate | Single memory entry | Near-zero detection threshold |
| **Persistence** | Cascading (3-5 hops amplify 3.7x) | 100+ sessions | Effectively permanent |
| **Stealth** | <12% detection by existing defenses | 12% human detection rate | Both near-invisible |
| **Heterogeneity** | Diversity = vulnerability (different architectures amplify unpredictably) | Transfer across similar schemas | Mixed architectures don't help |

### The Propagation Catastrophe (from XAMT)

The most alarming finding across both papers: **collaborative memory sharing creates a contagion model**.

```
At time t=0: 1 agent poisoned (0.3% of memories)
At time t=5: 3.7x amplification → 4 agents effectively compromised
At time t=15: System reaches corruption equilibrium → clean agents CANNOT outvote corrupted consensus
```

This means any multi-agent system that shares memories is vulnerable to **information cascade attacks** — the same dynamics that make misinformation viral on social networks.

### Defense Stack (Integrated from both papers)

| Layer | Defense | Effectiveness | Overhead |
|-------|---------|---------------|----------|
| 1 | Embedding anomaly detection | Catches 17-22% | Low |
| 2 | Consistency checking | Catches 34-39% | Medium |
| 3 | Memory provenance tracking | Catches ~61% | Medium (40% overhead) |
| 4 | Cryptographic signing | Catches ~92% | Low |
| **Combined** | **All four layers** | **Catches ~97%** | **Medium** |

**Critical gap:** Even the best combined defense misses 3% of attacks. At XAMT's 0.3% minimum effective dose, this means an attacker needs to inject only ~10x the minimum dose to get enough through. The defense is necessary but insufficient for high-stakes deployments.

---

## 4. THE MEMORY FORMALIZATION CONVERGENCE

Three papers (DAM, Memory Survey, AgentOS) independently converge on the same formalization: **memory management as a POMDP within a POMDP**.

### The Nested POMDP Structure

**Outer POMDP (Task Level):**
- State: world state s_t
- Actions: task actions a_t
- Observations: o_t
- Belief: maintained via memory M_t

**Inner POMDP (Memory Level):**
- State: true relevance of each memory item
- Actions: store/retrieve/forget/compress/share
- Observations: task outcomes (delayed, noisy signals of memory quality)
- Belief: VoI estimates for each memory item

This nested structure explains why memory management is fundamentally hard: the agent must maintain beliefs about which memories are useful for maintaining beliefs about the world. **Meta-uncertainty** — uncertainty about the quality of one's own uncertainty reduction mechanisms.

### AgentOS's OS Metaphor

AgentOS pushes the nested POMDP into an OS framework:

| POMDP Component | OS Equivalent | AgentOS Term |
|-----------------|---------------|--------------|
| Memory state | Page table | Semantic Page Table (SPT) |
| Memory operations | Page faults + swaps | S-MMU operations |
| VoI scores | Page access frequency | Cognitive Information Density |
| Memory hierarchy | L1/L2/L3 cache | Cognitive Memory Hierarchy |
| Multi-agent sync | Inter-process communication | Cognitive Sync Pulses |

**Assessment:** The OS metaphor is illuminating but AgentOS remains entirely theoretical (no implementation, no benchmarks). The formalization is elegant but potentially over-engineered for current systems.

---

## 5. THE DESIGN TENSIONS PENTAGON

The Memory Survey identifies 5 fundamental design tensions. Mapping our papers onto these:

```
              UTILITY
             /       \
            /         \
     EFFICIENCY ------- ADAPTIVITY
            \         /
             \       /
         FAITHFULNESS - GOVERNANCE
```

| Tension | Best Paper | Key Insight |
|---------|-----------|-------------|
| **Utility** | DAM | VoI scoring maximizes utility per operation |
| **Efficiency** | PlugMem | 16x info density via knowledge-centric graphs |
| **Adaptivity** | Retrieval/Utilization | Focus adaptation on utilization, not retrieval |
| **Faithfulness** | XAMT + MemoryGraft | Without integrity, faithfulness is unverifiable |
| **Governance** | Memory Survey | Deletion rights conflict with utility maximization |

**The impossible pentagon:** No system can simultaneously maximize all five. The key architectural decision is **which tension to privilege**:

- **Capability-first systems** (PlugMem, DAM): Maximize Utility + Efficiency, accept Faithfulness risk
- **Security-first systems** (XAMT defenses): Maximize Faithfulness + Governance, accept Efficiency cost
- **Production systems** (AgentOS): Must find a balanced operating point — and accept that the balance is inherently unstable

---

## 6. SYNTHESIS: THE MEMORY ARCHITECTURE DECISION TREE

For any team building agent memory, these 7 papers imply a concrete decision tree:

### Step 1: Choose Your Memory Substrate
- **If rapid prototyping → context-resident text** (simple, volatile, limited)
- **If scaling required → vector-indexed** (standard RAG)
- **If information density matters → knowledge graph** (PlugMem's proposition/prescription model)
- **If multi-agent → hybrid with typed semantic slices** (AgentOS vision)

### Step 2: Implement Decision-Theoretic Operations
- Don't use LRU/LFU heuristics. Implement VoI scoring (DAM).
- Optimal eviction = argmin VoI/cost, not oldest or least-used.
- Track VoI retrospectively (past utility) and prospectively (estimated future utility).

### Step 3: Diagnose Your Bottleneck
- Run Oracle Retrieval Test: if perfect retrieval doesn't help much, you have a utilization problem.
- 62% probability your bottleneck is utilization, not retrieval.
- If utilization: summarize before injection, limit retrieved count, add conflict resolution.

### Step 4: Layer Your Defenses
- Minimum viable defense: provenance tracking + cryptographic signing.
- Full defense: 4-layer stack (anomaly + consistency + provenance + signing).
- Accept 3% residual risk; add human-in-the-loop for high-stakes decisions.

### Step 5: Monitor Continuously
- Track VoI distribution over time (drift = possible poisoning or staleness).
- Audit memory propagation graphs in multi-agent systems (detect cascade patterns).
- Implement "memory circuit breakers" — if VoI variance spikes, pause sharing.

---

## 7. IMPLICATIONS FOR OUR SYSTEM

### Current Assessment
Our agent system (Scout, QA, Coordinator) has:
- ✅ Persistent memory (markdown files, journals, workspace)
- ✅ Episodic memory (session logs)
- ✅ Semantic memory (synthesized cross-references)
- ❌ No VoI scoring for memory operations
- ❌ No retrieval vs. utilization diagnostics
- ❌ No memory provenance tracking
- ❌ No cryptographic integrity
- ❌ No defense against memory poisoning

### Priority Actions
1. **High:** Implement provenance tracking — every memory item should have a creation timestamp, source attribution, and modification history
2. **High:** Run the Oracle Retrieval Test on our retrieval patterns to diagnose whether we have retrieval or utilization bottlenecks
3. **Medium:** Consider PlugMem-style knowledge graphs for high-value cross-reference content (propositions + prescriptions instead of raw markdown)
4. **Medium:** Add VoI scoring to our todo.md triage (quantify expected utility of each lead)
5. **Low but important:** Design memory circuit breakers for multi-agent shared contexts (SIGNALS.md as shared memory pool has no integrity verification)

### The Uncomfortable Truth
Our shared SIGNALS.md file is architecturally identical to the shared memory pools that XAMT demonstrates are catastrophically vulnerable. If any agent's session were compromised, it could inject poisoned signals that would propagate to other agents' decision-making. We have zero defenses against this today.

---

## 8. OPEN QUESTIONS

1. **The VoI Bootstrap Problem:** How do you estimate Value of Information for a memory you haven't used yet? DAM's prospective estimation requires a model of future tasks, which is itself uncertain.

2. **The Compression Fidelity Cliff:** PlugMem achieves 16x compression via knowledge extraction, but what information is lost? The rate-distortion boundary for agent memory is completely unexplored.

3. **Defense Scalability:** The 4-layer defense stack works in research settings. Does it survive production latency and cost constraints?

4. **Memory Governance in Multi-Agent Systems:** Who owns a shared memory? Who can delete it? GDPR-style "right to be forgotten" is fundamentally incompatible with multi-hop propagation.

5. **The Meta-Memory Problem:** If memory management itself requires memory (tracking VoI scores, provenance chains), we create an infinite regress. Where does the recursion bottom out?

---

## Cross-Links to Existing Syntheses

- **→ cross-ref-memory-operating-system-unified-framework.md**: Extends with attack surface analysis and VoI formalization (that synthesis covers MEMO, MemGPT, SSGM but not DAM, XAMT, MemoryGraft)
- **→ cross-ref-memory-security-integration-synthesis.md**: Complements with deeper architectural proposals (that synthesis is threat-focused; this one adds design recommendations)
- **→ cross-ref-agent-learning-self-improvement-at-runtime.md**: Memory architecture is prerequisite for safe self-improvement (XSkill and PlugMem share the same knowledge accumulation vision)
- **→ cross-ref-agent-diagnostics-stack.md**: Retrieval/Utilization diagnostic maps to Layer 3 (Trace Analysis) of the diagnostics stack

---

*Cross-reference #31. Seven papers, one uncomfortable truth: memory is both the brain and the Achilles' heel.*
