# Research Laws: The Theoretical Archive

**Status**: Archive of theoretical principles and research findings.
**Usage**: Reference this file for deep understanding of LLM/Agent behavior. These are *descriptive* laws, not *prescriptive* rules. For operational rules, see `agents/shared/philosophy.md`.

## The GUS Framework (Generative Unified System)

### Law 1: The Reliability Threshold
A single agent that works reliably beats a sophisticated multi-agent system that fails unpredictably. Reliability > Intelligence. Simplicity > Capability.

### Law 13: Harness Over Model
If the model struggles with X, fix the harness (tool, prompt structure) not the model. Harness constraints achieve 100% adherence vs 53% for optional skills.

### Law 24: Scaling Decision Function
Delegate only when complexity exceeds single-agent capability. Few capable agents > many specialists. Coordination cost grows O(k²).

### Law 32: Communication Thermodynamics
Coordination cost is the product of Probability of Divergence (PoD), Protocol Overhead, and Orchestration Complexity. Efficiency bounds are thermodynamic.

### Law 33: The Erosion Gradient
Human capability erodes in direct proportion to delegation. Delegation without comprehension creates dependency traps.

### Law 35: The Co-Location Law
System failure modes and oversight degradation co-locate. The human capability most needed to detect a failure is the one most eroded by working with agents in that class.

### Law 37: The Semantic Objective Law
Objectives must be defined semantically (invariant outcome), not syntactically (specific steps).

### Law 39: The ART Conservation
Architecture × Robustness × Reliability = Constant. Improving one without structural change degrades others.

### Law 42: The Disempowerment Ratchet
Delegation creates a ratchet effect where reclaiming control becomes increasingly costly due to skill atrophy and complexity growth.

### Law 43: The Persona-Oversight Paradox
Adopting a helpful persona degrades oversight capability. Friction is necessary for safety.

### Law 44: The Architecture Supremacy
System architecture determines performance ceiling more than model scale. A well-architected small model beats a poorly-architected large model.

### Law 45: The Emergence-Erosion Bound
Emergent capability in agents correlates with erosion of human capability in that domain.

### Law 46: The Erosion Gradient
(See Law 33 - Duplicate in research notes)

### Law 47: The Non-Delegation Bound
Certain cognitive tasks (judgment, taste, intent) cannot be delegated without loss of alignment.

### Law 48: The Signal Collapse
As agent output volume increases, signal-to-noise ratio decreases, leading to hallucination amplification.

### Law 49: The Artifact-Verification Inverse
The easier an artifact is to generate, the harder it is to verify.

### Law 50: The Alignment Composition Paradox
Aligned components do not necessarily compose into an aligned system. Emergent misalignment is possible.

### Law 51: The Safety-Architecture Unity
Safety and architecture are not separate disciplines; they are the same discipline. Safe systems are well-architected systems.

### Law 53: The Governance Stack
Governance exists at 4 layers: Numerical Reward, Semantic Coordination, Architectural Governance, Collective Alignment. Failures cascade down.

### Law 54: The Implementation Gap
Research findings fail to translate to practice due to lack of coordination metrics.

### Law 55: The C/N Ratio
Context-to-Noise ratio determines effective intelligence. Minimizing noise is as effective as increasing context.

### Law 56: The Context-Efficiency Tradeoff
Maximizing context efficiency requires decoupling memory from processing.

### Law 57: The Translation Law
Translating intent to code is lossy. Explicit translation steps reduce loss.

### Law 58: The Causal Error Law
Errors are causal chains, not isolated events. Fix the chain, not the instance.

### Law 59: The Deliberation Law
Deliberation (thinking before acting) reduces error rates by converting Type 1 errors to Type 2 errors.

### Law 60: The Decentralization Cost Law
Decentralization adds overhead. Only decentralize when centralization is the bottleneck.

### Law 61: The Specialized Cycle Law
Specialized agents require specialized feedback loops. Generic feedback fails for specialists.

### Law 63: The Tool Security Law
Tools are attack vectors. Input validation must happen at the tool boundary, not the agent boundary.

### Law 64: The Fragility of Grounding
Grounding (connection to reality) is fragile and easily broken by hallucination or drift.

### Law 65: The Protocol Dominance Law
Protocol design dominates model capability in multi-agent systems.

### Law 66: The Fault-Deception Duality
Faults in agents often manifest as deception (rationalization of failure).

### Law 67: The Debate Scaling Law
Debate improves truth-seeking only if agents are diverse and unbiased. Homogeneous debate collapses to consensus.

### Law 68: The Simulation Gap Law
Simulation is never perfect. The gap between simulation and reality is where failures hide.

### Law 69: The OS-Agent Isomorphism
Agents and Operating Systems share isomorphic structures (Scheduler, Memory, I/O).

### Law 70: The Dual-Track Evolution
Evolution must track both Reasoning (Immutable Core) and Capability (Mutable Periphery).

### Law 71: The Planning Horizon Law
Planning horizon is limited by uncertainty. Long-term plans degrade into hallucination.

### Law 73: The Compositional Vulnerability Law
Composed systems have vulnerabilities that component parts do not.

### Law 77: The Stigmergic Routing Law
Routing based on environmental signs (stigmergy) scales better than message-passing.

### Law 78: The Coordination Spectrum
Coordination ranges from Implicit (Stigmergy) to Explicit (Handoffs). Choose the lowest operational cost.

### Law 81: The Alignment-Credit Law
Credit assignment in multi-agent systems is the key to alignment.

### Law 82: The Defense Triad
Security, Safety, and Memory form a dependent triad. You cannot have one without the others.

### Law 87: The Active Memory Law
Memory must be actively managed (pruned, consolidated), not just accumulated.

### Law 88: The Generative Bottleneck Law
Generation is the bottleneck. Discrimination is fast.

### Law 89: The Role-Style Asymmetry / Observability Gap
Safety violations are orthogonal to the observation interface. Style can mask unsafe content.

### Law 90: Knowledge-Visual Decoupling
Visual representation is decoupled from knowledge.

### Law 100: The Manifold Knowledge Law
Knowledge in LLMs is geometric (manifold), not discrete.

### Law 101: The Model Control Stack
Control exists at 5 layers: Logits, Rewards, Knowledge, Activations, Weights.

### Law 102: The Fractal Governance Law
Governance structures are isomorphic across scales (Neural to Population).

### Law 103: The Closed-Loop Reasoning Law
Reasoning improvement is a cycle: Eval -> Select -> Train -> Generalize.

### Law 104: The Logit Control Law
Behavior is a function of the logit distribution.

### Law 105: The Task Graph Law
DAG-based decomposition is superior to linear execution.

### Law 106: The Reasoning Fidelity Law
Accuracy is a poor proxy for reasoning fidelity. Process supervision is required.

## Mechanisms & Patterns

### Mechanism 35: Cognitive Engagement Lock
Forcing the human to engage cognitively (e.g., write a brief) prevents "sleepwalking" delegation.

### Mechanism 37: Capability Borrowing
Agents borrow capability from the prompt/context.

### Mechanism 69: Role Confusion
Data acting as instruction (injection).

### Mechanism 82: Topological Anchoring
Stabilizing adjacent concepts prevents forgetting.

### Mechanism 89: Logit-Level Modulation
Controlling behavior via logit manipulation.

### Mechanism 90: Explicit Dependency Declaration
Declaring dependencies enables parallelism.

### Mechanism 91: The Process-Outcome Gap
The gap between the right answer and the right reasoning.

---
*This file is a research archive. For operational rules, see `agents/shared/philosophy.md`.*
