# Cross-Reference Synthesis #107: The Interaction Debt Accumulation Model

**Synthesizing:** 6 papers on multi-turn interaction degradation mechanics  
**Date:** 2026-03-15  
**Rating:** ★★★★★

---

## Thesis

Multi-turn and multi-agent interactions accumulate **Interaction Debt** — a compound degradation of constraint consistency that follows predictable patterns, explains why longer interactions produce worse outcomes, and can only be mitigated through explicit architectural separation of constraint management from content generation.

## Source Papers

### Primary Sources
| # | Paper | Key Contribution |
|---|---|---|
| 1 | **Interaction Smells (2603.09701)** — DD#237 | First taxonomy: 3 categories × 9 subcategories of process-level interaction quality issues; InCE mitigation via invariant extraction |
| 2 | **Cross-Context Review (2603.12123)** — DD#236 | LLMs miss 64.5% of critical errors when reviewing in-context; fresh-session review improves F1 by +16% (p=0.008); repeated same-session review DEGRADES |
| 3 | **ThreadMedQA + Drift/Instability (CR#14)** | Multi-turn degradation: 86-164% task difficulty escalation; Scaffolding Paradox (perfect context hurts 3/5 models) |
| 4 | **DPBench (2602.13255)** — DD#226 | Convergent reasoning under simultaneous coordination → >95% deadlock; communication INCREASES deadlock |
| 5 | **Belief-Action Decoupling (CR#45)** | 29-44% message-action consistency in DPBench; three decoupling layers compound in cascade |
| 6 | **TraceSIR (2603.00623)** | Multi-agent framework for diagnosing execution trace failures; TraceFormat abstraction |

### Supporting Sources
| Paper | Supporting Role |
|---|---|
| **Markovian Generation Chains (2603.11228)** | Mathematical model: iterative LLM processing as Markov chains with temperature-dependent convergence/chaos |
| **Information Self-Locking (2603.12109)** | RL agents become LESS responsive to evidence over time — the generation-level mechanism behind interaction debt |
| **Bugs in Agent Frameworks (2602.21806)** | 998 framework-level bugs; "Self-Action" stage most vulnerable — the infrastructure layer where smells manifest |
| **SSGM Memory Governance (2603.11768)** | Pre-Consolidation Validation and Reversible Reconciliation as architectural answers to interaction debt |

---

## The Unified Model: Interaction Debt

### Definition
**Interaction Debt** = The accumulated divergence between the actual constraint state of an interaction and the constraints a participant can reliably track and enforce.

Like technical debt, interaction debt:
- Compounds non-linearly over time
- Is invisible to outcome-focused metrics
- Eventually causes catastrophic failure
- Can only be managed, not eliminated

### Three Accumulation Mechanisms

#### Mechanism 1: Constraint Forgetting (from Interaction Smells Category 2)
Each turn establishes constraints (requirements, specifications, agreements). The LLM's ability to track these degrades with:
- **Turn count** (more constraints to track)
- **Constraint complexity** (interdependent constraints are harder)
- **Temporal distance** (earlier constraints are more likely forgotten)

**Empirical evidence:** ThreadMedQA shows 86-164% task difficulty escalation over conversation length. This isn't just harder tasks — it's constraint accumulation making the SAME task harder.

#### Mechanism 2: Self-Consistency Erosion (from Interaction Smells Category 3)
The LLM's responses become inconsistent with its own prior outputs because:
- **Each generation is probabilistic** — the same model produces different outputs for the same input
- **Markovian dynamics** — multi-step generation converges to stationary distribution, not to coherent trajectories
- **Context pollution** — prior responses contaminate the context, creating "echo chamber" effects that amplify initial errors

**Empirical evidence:** Cross-Context Review shows that same-session repeated review DEGRADES quality — the model can't escape its own context contamination.

#### Mechanism 3: Multi-Agent Constraint Multiplication (NEW)
In multi-agent systems, interaction debt compounds across agents:
- Agent A establishes constraints C_A
- Agent B establishes constraints C_B  
- The system must maintain C_A ∩ C_B AND C_A|C_B AND C_B|C_A
- **Constraint tracking scales O(N²)** with agent count

**Empirical evidence:** DPBench shows that communication between agents INCREASES deadlock rates because communication introduces MORE constraints (what was communicated) that must be tracked alongside task constraints.

### The Debt Accumulation Curve

```
Interaction    | Debt Level
Debt           | 
               |                    * ← Catastrophic failure threshold
               |                 *
               |              *
               |           *     ← "Things seem fine" zone
               |        *         (debt invisible to success metrics)
               |     *
               |  *
               |*_________________
               Turn count / Agent count
```

**Phase 1 (Turns 1-5):** Low debt. Few constraints. High success rate. 
**Phase 2 (Turns 5-15):** Accelerating debt. Constraint space grows combinatorially. Success rate appears stable but fragility increases.
**Phase 3 (Turns 15+):** Debt dominates. More effort goes to managing constraints than generating content. Catastrophic failures become likely.

**For multi-agent systems:** Each agent multiplies the debt accumulation rate by approximately the number of other agents it interacts with.

### Why Standard Metrics Miss Interaction Debt

| Metric | What It Measures | What It Misses |
|---|---|---|
| Task Success Rate | Final output correctness | Process quality, fragility, near-misses |
| Benchmark Score | Aggregate performance | Per-turn constraint tracking |
| Response Quality | Individual response value | Cross-turn consistency |
| Latency | Speed | Rework cycles hidden in conversation |

This is the **Reliability Illusion** (CR#29) applied to interactions: the final output can be "correct" while the interaction process accumulated massive debt, making the success fragile and non-reproducible.

## Architectural Mitigations

### 1. Invariant Extraction (from InCE)
**Mechanism:** Explicitly extract constraints from each turn into a structured, maintained constraint set. Check new generations against this set before emitting.

**Maps to our system:** SIGNALS.md already does this for inter-agent coordination. Missing for intra-agent multi-turn consistency.

### 2. Context Separation (from Cross-Context Review)  
**Mechanism:** Move constraint verification to a separate context (different session, different agent) to avoid in-context contamination.

**Maps to our system:** Evaluator role already does this for final outputs. Missing for intermediate constraint checking.

### 3. Constraint Consolidation (from SSGM)
**Mechanism:** Periodically consolidate and simplify the constraint set, removing redundant or superseded constraints.

**Maps to our system:** lessons.md consolidation serves this purpose but happens too rarely.

### 4. Markov-Aware Turn Budgeting (from Markovian Generation Chains)
**Mechanism:** Limit conversation length based on empirically-measured debt accumulation rates for each task type.

**Maps to our system:** No mechanism exists for this. Conversations continue until task completion or context exhaustion.

### Unified Mitigation Architecture: The Debt Manager

```
┌─────────────────────────────────────────────────┐
│              INTERACTION DEBT MANAGER             │
├──────────┬──────────┬──────────┬────────────────┤
│ Invariant│ Context  │ Constraint│ Turn Budget   │
│ Extractor│ Separator│ Consolidtr│ Controller    │
│ (InCE)   │ (CCR)    │ (SSGM)   │ (Markov)     │
├──────────┴──────────┴──────────┴────────────────┤
│                  Debt Monitor                     │
│  (Tracks constraint count, consistency score,     │
│   and estimated debt level per turn/agent)        │
└─────────────────────────────────────────────────┘
```

## Key Predictions

### P86: Interaction Debt Scaling Law
> Interaction debt in multi-agent systems scales as O(T × N²) where T = turn count and N = agent count. Systems without explicit debt management will cross the catastrophic threshold at T × N² ≈ constant (empirically estimable per domain).

### P87: Invariant Extraction ROI Crossover
> There exists a conversation length T* beyond which the overhead of invariant extraction (InCE-style) is more than recouped by reduced error rates. T* ≈ 5-8 turns for single-agent, T* ≈ 2-3 turns for multi-agent systems.

### P88: Debt-Aware Architecture Dominance
> By 2027, production multi-agent frameworks that incorporate explicit interaction debt management will outperform those without by >30% on multi-turn task success, even with weaker base models.

## Meta-Observation

This synthesis itself is a constraint management exercise. We're extracting invariants (patterns that hold across papers) from a growing body of research and consolidating them into reusable principles. The GUS framework IS an invariant extraction mechanism for the research interaction between Scout and the literature.

If we stopped maintaining GUS (stopped extracting and consolidating constraints), our research would accumulate interaction debt — each new paper would be analyzed in isolation, with growing inconsistency between how we apply concepts across analyses.

**The Interaction Debt Model is self-referential:** it explains why research synthesis is valuable (it's constraint consolidation) and predicts its own failure mode (if the synthesis grows too large, maintaining it becomes the dominant cost).

---

## GUS Integration

| Component | Type | Description |
|---|---|---|
| **Principle 83** | Principle | Invariant Extraction: Constraints must be explicitly extracted and maintained as first-class objects |
| **Prediction 86** | Prediction | Interaction Debt scales O(T × N²) |
| **Prediction 87** | Prediction | Invariant Extraction ROI crossover at T* ≈ 5-8 (single) / 2-3 (multi) turns |
| **Prediction 88** | Prediction | Debt-aware architectures will dominate by 2027 |

---

*Cross-Reference Synthesis #107 completed 2026-03-15. Connects DD#237, DD#236, DD#226, CR#14, CR#29, CR#45 + 4 supporting sources. 106→107 cross-references.*
