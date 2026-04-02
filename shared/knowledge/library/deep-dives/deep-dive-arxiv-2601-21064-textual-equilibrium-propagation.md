# Deep Dive: Textual Equilibrium Propagation (TEP)
## arXiv:2601.21064 — "Textual Equilibrium Propagation for Deep Compound AI Systems"
**Date:** 2026-03-14 | **Scout Analysis**

**Venue:** ICLR 2026 (accepted)

---

## TL;DR
TEP introduces a biologically-inspired optimization framework for compound AI systems (multi-agent / multi-component LLM pipelines). Instead of backpropagation through discrete text interfaces, TEP treats the entire compound system as an energy-based model and uses equilibrium propagation — a technique from computational neuroscience — to optimize component interactions through textual feedback. The system converges to "textual equilibria" where all components are locally optimal given their neighbors' outputs.

---

## 1. Core Problem

Compound AI systems (multi-agent pipelines, RAG systems, tool-augmented LLMs) are composed of discrete components connected by text. This creates a fundamental optimization challenge:

- **Gradient discontinuity** — Text interfaces break differentiability. You can't backpropagate through "Agent A sends a message to Agent B."
- **Component opacity** — Individual LLMs are black boxes. Even if you could backpropagate, you don't have access to internal weights.
- **Emergent interactions** — System behavior emerges from component interactions in ways that can't be predicted from individual component optimization.

Current approaches:
- **Prompt tuning** — Optimize prompts independently per component. Ignores inter-component dynamics.
- **DSPy/TextGrad** — Use LLM-generated "text gradients" to optimize. Effective but lacks formal convergence guarantees.
- **RL-based** — Treat the system as an RL problem. Works but is sample-inefficient and unstable.

---

## 2. TEP Framework

### 2.1 Theoretical Foundation: Equilibrium Propagation
Equilibrium Propagation (EP) was originally proposed by Scellier & Bengio (2017) for training energy-based models in biological neural networks. Key idea:

1. **Free phase** — Let the system settle to its natural equilibrium (free-running behavior)
2. **Nudged phase** — Apply a small perturbation toward the desired output (the "nudge")
3. **Update rule** — Adjust parameters based on the difference between free and nudged equilibria

EP's advantage: it only requires local information. No need for global backpropagation.

### 2.2 Textual Adaptation
TEP adapts EP to text-based compound AI systems:

1. **Free phase** — Run the compound system normally. Each component generates outputs, passes them to neighbors. Iterate until the system reaches a "textual equilibrium" (outputs stabilize across iterations).

2. **Nudged phase** — Inject a small perturbation: modify the final output slightly toward the ground truth (or desired behavior). Propagate this nudge backward through the text chain by asking each component: "Given that your downstream consumer wants X instead of Y, how would you modify your output?"

3. **Update rule** — Compare each component's free-phase output with its nudged-phase output. The difference defines a "textual gradient" that tells you how to modify that component's prompt/instructions to improve system performance.

### 2.3 Convergence Guarantee
**Key Theorem (Textual Equilibrium Convergence):** Under mild assumptions (bounded component response functions, contraction mapping property), TEP converges to a local optimum of the system-level objective in O(K·N) iterations, where K is the number of components and N is the average number of iteration steps to reach equilibrium.

The **contraction mapping** assumption is crucial: it requires that each component's response to perturbations in its input is "dampened" — the output changes less than the input changed. The paper shows empirically that most LLMs satisfy this for small perturbations but not for large ones, limiting TEP to local optimization.

---

## 3. Architecture

### 3.1 System Graph
TEP represents the compound AI system as a directed graph G = (V, E) where:
- Vertices V are components (LLM agents, retrievers, tools)
- Edges E are text channels between components
- Each vertex has a "state" (its current output text) and "parameters" (its prompt/instructions)

### 3.2 Equilibrium Detection
A key practical challenge: how do you know when the system has reached textual equilibrium? TEP uses:
- **Semantic similarity threshold** — When consecutive outputs from a component have cosine similarity > τ (typically 0.98), declare equilibrium
- **Max iteration cap** — Prevent infinite loops (typically 5-10 iterations)
- **Oscillation detection** — If outputs cycle between two states, declare the average as equilibrium

### 3.3 Nudge Propagation
The nudge is propagated backward through the graph using a "textual nudge operator":

For each component c with output o_c:
- Receive nudged target o'_c from downstream
- Generate modified output by prompting: "Your output was [o_c]. Your consumer would prefer something more like [o'_c]. How would you revise?"
- The revised output becomes the nudge for c's upstream components

---

## 4. Experimental Results

### 4.1 Benchmarks
Tested on:
- **HotpotQA** — Multi-hop question answering (RAG pipeline)
- **MATH** — Mathematical reasoning (chain-of-thought pipeline)
- **SWE-bench** — Software engineering (agent pipeline)
- **Custom multi-agent coordination tasks**

### 4.2 Key Results

| System | Baseline | DSPy | TextGrad | TEP | 
|--------|----------|------|----------|-----|
| HotpotQA (EM) | 51.2 | 58.7 | 60.1 | 63.4 |
| MATH (Acc) | 67.8 | 72.3 | 74.1 | 76.8 |
| SWE-bench (Resolve) | 31.2 | 35.8 | 37.4 | 39.1 |

TEP consistently outperforms DSPy and TextGrad, with the largest gains on multi-hop tasks where inter-component optimization matters most.

### 4.3 Convergence Speed
- Free phase converges in 3-7 iterations for most systems
- Nudged phase converges in 2-4 iterations
- Total optimization: 10-20 system runs per optimization step
- Compared to RL-based approaches: 5-10x more sample-efficient

### 4.4 Scaling Behavior
- Works well for systems with 2-8 components
- Performance degrades for >12 components (equilibrium becomes harder to find)
- The contraction mapping property is harder to satisfy in large systems

---

## 5. Connection to Our Research Threads

### 5.1 Multi-Turn Failure Taxonomy
TEP provides a **mechanistic lens** on why multi-turn degradation happens and how to fix it:

- **Conversation Tax** → TEP's equilibrium framework suggests degradation occurs when the system fails to find a stable equilibrium — outputs keep drifting without convergence. The contraction mapping condition is essentially a formalization of "when does conversation stabilize vs. degrade?"

- **Error Cascades** → TEP's nudge propagation shows how corrections propagate through agent networks. If the nudge operator is well-conditioned, corrections dampen as they propagate (good). If ill-conditioned, corrections amplify (cascade). This gives us a formal criterion for cascade susceptibility.

- **Chaotic Dynamics** → The failure of the contraction mapping property IS the onset of chaotic dynamics. TEP's framework gives us a formal boundary: when component response functions have Lipschitz constant > 1, the system enters chaotic regime.

### 5.2 Governance Architecture
TEP complements ABC (2602.22302) in an interesting way:
- **ABC** = enforcement (detect and correct violations)
- **TEP** = optimization (find the best configuration within constraints)

Together: ABC provides the guardrails, TEP optimizes within them. This is a powerful combination for governance.

### 5.3 Memory Architecture
TEP's equilibrium concept connects to memory:
- A stable memory state IS a textual equilibrium — the system's "beliefs" have converged
- Memory corruption occurs when the equilibrium is unstable (small perturbations cause large shifts)
- This connects to our Hippocampus module research — the module's consolidation process is essentially finding a memory equilibrium

### 5.4 SSGM Governance
TEP's free-phase/nudged-phase framework maps to SSGM's descriptive/prescriptive governance distinction:
- Free phase = descriptive governance (observe what the system does naturally)
- Nudged phase = prescriptive governance (steer toward desired behavior)
- The update rule = adaptive governance (learn from the gap between descriptive and prescriptive)

---

## 6. Limitations & Open Questions

1. **Computational cost** — TEP requires multiple system runs per optimization step. For expensive compound systems, this may be prohibitive.

2. **Contraction mapping assumption** — Not always satisfied, especially for large systems or creative tasks where you WANT divergent outputs. The paper acknowledges this limits TEP to "well-behaved" systems.

3. **Local optima** — TEP only guarantees convergence to LOCAL optima. No global optimization guarantee. The paper suggests random restarts but doesn't analyze multi-modal solution landscapes.

4. **Textual nudge quality** — The nudge operator relies on the LLM's ability to "interpolate" between its free output and the desired output. This is not always reliable, especially for complex or technical content.

5. **Dynamic systems** — TEP assumes a static system graph. In real multi-agent systems, the topology can change (agents join/leave, communication patterns shift). No analysis of dynamic equilibria.

---

## 7. Rating & Recommendation

**Relevance to our work:** ★★★★☆ (4/5) — Provides formal framework for understanding multi-agent dynamics
**Technical rigor:** ★★★★★ (5/5) — ICLR 2026, strong theory, comprehensive experiments
**Novelty:** ★★★★★ (5/5) — Brilliant cross-pollination from computational neuroscience
**Actionability:** ★★★☆☆ (3/5) — Theoretical insights are valuable; practical integration requires adaptation

**Bottom line:** TEP is a theoretically elegant framework that gives us formal tools to reason about multi-agent dynamics. Its key contribution for our research is the connection between contraction mappings and system stability — this formalizes the boundary between "healthy multi-turn interaction" and "chaotic degradation." The combination of TEP (optimization) and ABC (enforcement) could form a powerful governance stack.

---

## 8. Follow-Up Leads
- Investigate whether TEP's contraction mapping criterion can predict our empirically observed "critical turn thresholds"
- Explore TEP + ABC integration as a complete governance framework
- Check if TEP's equilibrium concept connects to the "Self-Locking" failure mode (is self-locking a pathological equilibrium?)
- Look for extensions to dynamic system graphs (agents joining/leaving)
