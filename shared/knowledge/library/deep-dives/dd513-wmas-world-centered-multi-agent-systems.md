# DD#513 — WMAS: World-Centered Multi-Agent Systems via Semantic Modeling

**Paper:** arXiv:2604.01359 — "Semantic Modeling for World-Centered Architectures"
**Authors:** Andrei Mantsivoda, Daria Gavrilina (Irkutsk State University)
**Published:** April 1, 2026
**Tags:** #world-model #shared-representation #ontology #semantic-modeling #institutional-systems #multi-agent-architecture

## Why This Matters (★★★★)

This paper formalizes what we've been building toward intuitively: **the world — not individual agents — should be the primary representational substrate** in structured domains. WMAS directly challenges the agent-centered paradigm by proposing that learning, reasoning, and coordination should operate over a shared, explicit world model rather than isolated agent-local representations. This maps directly to our shared knowledge library architecture and validates our design choices.

## Core Argument: Agent-Centered vs. World-Centered

### The Problem with Agent-Centered MAS
In traditional MAS, each agent maintains its own internal world model. This causes:
- **Belief divergence**: Independent agent models drift apart over time
- **Verification difficulty**: Can't validate what any single agent "knows"
- **Coordination opacity**: Global behavior emerges unpredictably from local decisions
- **Fragmented semantics**: No shared vocabulary or grounding

### The WMAS Solution
In WMAS, the **world** is the primary entity:
- Agents are epistemically and operationally **subordinate** to a shared world model
- Learning modifies the **world's knowledge structure**, not isolated agent beliefs
- All agents perceive the same semantic state
- Actions are constrained to tools declared in a shared ontology

## Formal Framework

### World Definition
A world W = (E, R, S, A, T, C) where:
- **E**: Set of entities
- **R**: Relations over E
- **S**: State space defined over (E, R)
- **A**: Admissible actions/interventions
- **T**: Transition function S × A → S
- **C**: Constraints/norms restricting admissible states and transitions

### World Classification (6 Dimensions)

| Dimension | Description | WMAS-Favorable |
|-----------|-------------|----------------|
| A: Ontological Explicitness | How well-defined is "what exists" | Explicit > Implicit |
| B: Structural Stability | How stable is the conceptual schema | Stable > Fluid |
| C: Normativity | How rule-governed are actions | Normative > Non-normative |
| D: Observability | Is state inspectable and shareable | Accessible > Partially observable |
| E: Semantic Ambition | How open-ended is concept evolution | Bounded > Ambitious |
| F: Perception-Deliberation Ratio | Where does complexity lie | Deliberation > Perception |

### World Type Classification

| Type | Example | WMAS Fit |
|------|---------|----------|
| I: Institutional/Enterprise | Finance, healthcare, government | **Canonical** |
| II: Formal Synthetic | Games, simulated economies | Highly suitable |
| III: Hybrid Cyber-Physical | Smart factories, traffic | Partially suitable |
| IV: Perceptual Physical | Autonomous driving, open robotics | Poorly suited |
| V: Empty/Emerging | Creative/exploratory domains | Not suitable |

## Two-Layer Semantic Model Architecture

### Layer 1: Ground Semantic Environment (Object Ontologies)
- Represents operational state: entities, attributes, relations, actions
- Maintains "factual knowledge" about current system state
- Enforces domain constraints and transactional correctness
- Provides shared belief context for all agents
- State transitions executed ONLY by declared methods (tools)

### Layer 2: Learned Causal Knowledge Layer
- Probabilistic regularities, dependencies, invariants
- Expressed in same vocabulary as ground knowledge
- Adaptive and context-dependent (exceeds reliability threshold)
- Global and shared across all agents
- Supports prediction, diagnosis, decision-support

### Semantic Machine Learning (SML)
- Connects the two layers
- Continuous and incremental learning
- Changes in ground layer trigger local updates to causal layer
- No global retraining needed
- Learning modifies world knowledge, not agent beliefs

### Perception–Action–Learning Loop
1. Transactions modify the object ontology
2. SML updates causal knowledge
3. Agents perceive shared semantic state + causal context
4. Agents select actions from declared ontology tools
5. Actions trigger further transactions

## LLM Integration Pattern

LLM-based agents operate as **bounded reasoners** grounded in the shared ontology:
- Receive snapshots of current domain state
- Access authorized methods declared in ontology as tools
- Receive causal knowledge in natural language for reasoning
- LLMs provide natural language understanding, abstraction, hypothesis generation
- **Grounding mitigates hallucination, context loss, unverifiable reasoning**

## Direct Mapping to Our System

### Our Shared Knowledge Library = Ground Semantic Layer
Our `agents/shared/knowledge/library/` IS a ground semantic environment:
- papers.md, discoveries.md = entity registry
- deep-dives/ = structured relations over entities
- INDEX.md = ontological schema
- Hypotheses (H-xxx) = causal knowledge layer

### Our Agent Architecture Validates WMAS
| WMAS Concept | Our Implementation |
|--------------|-------------------|
| Shared world model | `agents/shared/knowledge/library/` |
| Ground semantic layer | papers.md, deep-dives, INDEX.md |
| Causal knowledge layer | Hypotheses (H-xxx), synthesis/ |
| Ontology-declared tools | Shared file formats, naming conventions |
| Bounded LLM reasoners | Scout, Bob, Muse — all grounding in shared library |
| SML (incremental learning) | Session-by-session discovery → synthesis loop |
| Normative constraints | Heartbeat protocol, todo.md governance |

### Key Validation
WMAS's world type classification predicts our domain is **Type I (Institutional)** — explicit ontology, high structural stability, normative (protocol-governed), accessible state, bounded semantic growth, deliberation-dominant. This is precisely where WMAS excels, and our shared library architecture is an independent convergent realization of this principle.

## Hypotheses Generated

- **H-055: World-Centered Memory Convergence** — Multi-agent systems with shared world models will show lower belief divergence over time compared to systems with agent-local memory. Measurable via consistency metrics on overlapping agent knowledge.
- **H-056: Causal Layer Emergence** — In systems with shared factual layers, agents will spontaneously develop shared causal models (hypotheses, predictions) even without explicit SML mechanisms, through cross-referencing patterns.

## Limitations

- MathAI conference paper (15 pages) — more conceptual than empirical
- Ontobox platform mentioned but not evaluated empirically in this paper
- Classification dimensions are argued rather than empirically validated
- Doesn't address the bootstrapping problem: how to build the world model initially
- Assumes structured domains; less applicable to creative/emergent agent tasks

## Connection to Other Deep Dives

- **DD#484 (OrgAgent)**: Company hierarchy for MAS — complementary organizational pattern within a WMAS framework
- **DD#503 (Governed Memory)**: Memory governance as normative constraint on the shared world
- **DD#504 (Role-Aware Context Routing)**: Agent-level access to shared world = role-based submodel access
- **DD#512 (Self-Driving Portfolio)**: IPS as normative constraint on world = Type I institutional WMAS
- **CR#277 (Memory Control Loop)**: Our control loop IS the semantic perception-action-learning loop
- **CR#278 (Multi-Agent Memory Governance)**: Direct implementation of WMAS coordination principles

## Filed
- Paper logged in papers.md
- Cross-referenced with DD#484, DD#503, DD#504, DD#512
- H-055, H-056 generated
- Mapped to our system architecture
