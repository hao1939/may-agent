# SCRAT: Squirrel-Inspired Agent Architecture Coupling Control, Memory, and Verification

**Source:** arXiv:2604.03201 (Apr 3, 2026)  
**Authors:** Maximiliano Armesto, Christophe Kolb  
**Full Title:** "Coupled Control, Structured Memory, and Verifiable Action in Agentic AI (SCRAT -- Stochastic Control with Retrieval and Auditable Trajectories)"

---

## Core Argument

Current agent research **silo** three critical capabilities:
- **Robotics** → focuses on control
- **RAG/Retrieval** → focuses on memory
- **Alignment/Assurance** → focuses on verification/checking

SCRAT argues these must be **coupled** — inspired by squirrel ecology where arboreal locomotion, scatter-hoarding, and audience-sensitive caching require all three capabilities in one organism.

---

## The Model

**Hierarchical Partially Observed Control with:**

1. **Latent dynamics** — hidden state transitions
2. **Structured episodic memory** — organized for future retrieval
3. **Observer-belief state** — modeling what others (including verifiers) know
4. **Option-level actions** — temporally extended actions
5. **Delayed verifier signals** — feedback arrives after action completion

---

## Three Hypotheses

### H1: Fast Local Feedback + Predictive Compensation
> Improves robustness under hidden dynamics shifts

**Implication:** Agents need both reactive loops (immediate feedback) and predictive models (anticipate state changes)

### H2: Memory Organized for Future Control
> Improves delayed retrieval under cue conflict and load

**Implication:** Don't just store — structure memory around anticipated future queries. Scatter-hoarding isn't random; it's spatially organized by retrieval likelihood.

### H3: Verifiers + Observer Models Inside Action-Memory Loop
> Reduce silent failure and information leakage while remaining vulnerable to misspecification

**Implication:** Verification shouldn't be external — it should be part of the agent's own belief state. Agent should model "what would a verifier think?"

---

## The Squirrel Analogy

| Squirrel Behavior | Agent Mechanism | Design Insight |
|-------------------|-----------------|----------------|
| Arboreal locomotion | Control under partial observability | Fast feedback + prediction needed |
| Scatter-hoarding | Distributed memory storage | Organize by retrieval, not just storage |
| Audience-sensitive caching | Observer modeling | Hide caches from competitors — selective disclosure |
| Cache retrieval under snow | Cue conflict resolution | Multiple memory cues, delayed verification |

---

## Downstream Conjecture: Role-Differentiated Systems

The paper suggests **proposer/executor/checker/adversary** role separation may:
- Reduce correlated error under asymmetric information
- Distribute verification burden
- Prevent self-fulfilling verification (when same agent proposes and checks)

**Connection to Our System:**
- Our Scout/Builder/Checker/Auditor roles align with this architecture
- We should formalize the "observer model" — each agent modeling what others know

---

## Comparative Analysis: SCRAT vs Current Approaches

| Approach | Control | Memory | Verification | Coupling |
|----------|---------|--------|--------------|----------|
| OpenViking (L0/L1/L2) | ✓ | ✓ | ✗ | Layered loading |
| NikolaFu (6 modes) | ✓ | ✓ | ✓ | Mode switching |
| ProMem | Limited | ✓✓✓ | Limited | Active extraction |
| **SCRAT** | ✓✓ | ✓✓ | ✓✓ | **Unified coupling** |

---

## What This Means for Our System

### Immediate Actions:
1. **Add observer modeling:** Agents should maintain beliefs about what other agents know
2. **Structure memory for control:** Not just retrieval — anticipate future decision needs
3. **Internalize verification:** Verification loop should be part of agent's own reasoning

### Architecture Implications:
- Our role separation (Scout/Builder/Checker) matches SCRAT's proposer/executor/checker
- We should add explicit "adversary" role for stress-testing plans
- Memory module should be organized around anticipated queries, not just recency

### Synthesis with Meta FAIR 30K Agent Result:
- Git = scatter-hoarding (distributed storage)
- Merge conflicts = cache retrieval under cue conflict
- Lean compiler = delayed verifier signal
- Static partitioning = audience-sensitive caching (hide complexity from other agents)

---

**Related:**
- Meta FAIR 30K agents (arXiv:2604.03071) — git-based coordination as scatter-hoarding
- Thread 1 (Memory Architecture) in threads.md
- ProMem, OpenViking, NikolaFu memory approaches

**Tags:** #memory-architecture #verification #control #multi-agent #squirrel-inspired #observer-model #role-separation