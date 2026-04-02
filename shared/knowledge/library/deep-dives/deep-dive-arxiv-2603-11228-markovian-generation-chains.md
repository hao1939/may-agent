# Deep Dive: Markovian Generation Chains in Large Language Models
## arXiv:2603.11228 — Geng, Mohamed, Shang, Vazirgiannis, Poibeau (École Polytechnique/CNRS)
### Submitted 2026-03-11 | cs.CL, cs.AI, cs.LG

---

## TL;DR

This paper formalizes what happens when LLM outputs are **repeatedly fed back as inputs** — a process they call "Markovian generation chains." Through iterative rephrasing and round-trip translation experiments, they show outputs either **converge to a small recurrent set** (attractors) or **continue producing novel sentences**, depending on temperature and initial input. This has profound implications for multi-agent systems where agents iteratively process each other's outputs.

---

## 1. Core Concept: Markovian Generation Chains

**Definition**: A sequence of LLM outputs where:
- Each step takes a prompt template + the previous output as input
- No prior memory is included (Markov property: future depends only on present)
- The process is iterated for many steps

Formally: x_{t+1} = LLM(template, x_t)

This is exactly what happens in:
- Multi-agent debate/deliberation (agent B responds to agent A's last message)
- Iterative refinement loops (rewrite → evaluate → rewrite)
- Translation chains (A→B→A→B...)
- Any pipeline where LLM output feeds into the next LLM call

## 2. Key Experimental Findings

### Experiment 1: Iterative Rephrasing
- "Rephrase the following sentence:" applied repeatedly
- **Low temperature (≤0.3)**: Rapid convergence to fixed points. Sentences stabilize within 5-10 iterations.
- **Medium temperature (0.5-0.8)**: Convergence to small recurrent sets (2-5 sentence variants that cycle)
- **High temperature (≥1.0)**: Extended novelty production, but eventual convergence over longer horizons

### Experiment 2: Round-Trip Translation
- English → French → English → French → ...
- Similar convergence patterns but with information loss at each step
- Sentences progressively simplify and lose nuance
- Convergence faster than rephrasing (translation adds noise)

### Key Quantitative Results:
- **Convergence rate**: Exponential approach to attractor sets (τ ≈ 3-8 steps for low temp)
- **Attractor set size**: Grows with temperature (1-2 at temp=0.1, 10-50 at temp=1.0)
- **Diversity dynamics**: Can increase OR decrease depending on starting point
  - If initial sentence is "unusual" → diversity decreases (regression to mean)
  - If initial sentence is "common" → diversity can increase at high temp (exploration)

## 3. Sentence-Level Markov Chain Modeling

The paper models the process as a discrete Markov chain over the space of possible sentences:
- **States**: Unique sentence variants
- **Transition probabilities**: P(x_{t+1} | x_t) determined by the LLM
- **Stationary distribution**: The long-run distribution of sentences the chain visits

Key theoretical results:
- The chain is **irreducible** at high temperature (can reach any sentence from any sentence, given enough steps)
- The chain becomes **reducible** at low temperature (absorbing states = fixed points)
- **Mixing time** depends on temperature and sentence complexity
- The **stationary distribution** concentrates on "LLM-preferred" phrasings — a kind of linguistic attractor basin

## 4. Implications for Multi-Agent Systems

This is where the paper becomes critically relevant to our research portfolio:

### 4a. Drift in Multi-Agent Deliberation
When agents iteratively respond to each other (A→B→A→B...), each agent is essentially running a Markovian generation chain on the other's output. The paper predicts:
- **Deliberation will converge** at low temperatures (agreement is reached, but may be premature)
- **Deliberation may oscillate** at medium temperatures (cycling through positions)
- **Deliberation may be chaotic** at high temperatures (never settling, producing novel arguments each round)

This directly explains the findings in 2603.09127 (Chaotic Dynamics in Multi-LLM Deliberation).

### 4b. Information Loss in Agent Chains
Each step in the chain can lose information (especially in translation-like tasks). In multi-agent pipelines:
- **Longer chains = more information loss**
- **Context compression** at each step leads to progressive simplification
- Critical details get "averaged out" by the attractor dynamics

This connects to 2603.04474 (Error Cascades) — errors don't just propagate, they compound through the attractor dynamics.

### 4c. The "Regression to the Mean" Effect
LLMs have preferred phrasings and patterns. Iterative processing pushes ALL inputs toward these preferred patterns. In multi-agent systems:
- **Diverse initial perspectives converge** to LLM-preferred framings
- **Novel or unusual ideas get smoothed away**
- This is a form of **implicit consensus** that may or may not reflect the best answer

### 4d. Temperature as a Control Parameter
The paper provides practical guidance:
- Use **low temperature for convergence tasks** (where you want agents to agree)
- Use **high temperature for exploration tasks** (where you want diversity)
- **Medium temperature is the danger zone** — can produce oscillation without convergence OR exploration

## 5. Connections to Our Research Portfolio

### Direct connections:
- **2603.09127 (Chaotic Dynamics)** — Markovian chains explain WHY chaotic dynamics emerge. The transition from convergence to oscillation to chaos is a phase transition in the Markov chain structure.
- **2603.09875 (Bureaucracy of Speed)** — Memory consistency models determine whether the chain is truly Markovian or has memory. Strict ordering = Markovian. Relaxed ordering = non-Markovian (which the paper doesn't model).
- **2603.12229 (LM Teams as Distributed Systems)** — The convergence/divergence dynamics map to consensus/livelock in distributed systems. Temperature ↔ timeout/retry parameters.
- **ThReadMed-QA × Drift cross-reference** — The "regression to the mean" effect is exactly the drift mechanism we identified. Medical QA chains converge to generic, "safe" answers through attractor dynamics.
- **Error Cascades (2603.04474)** — Errors in the chain get either amplified (high temp, in attractor basin) or corrected (low temp, if error pushes away from attractor).

### Novel synthesis:
The Markovian generation chain framework provides a **unified mathematical foundation** for understanding:
1. Why multi-agent deliberation converges/diverges/oscillates
2. Why errors cascade differently at different temperatures
3. Why drift occurs in iterative LLM pipelines
4. How to predict the long-run behavior of any LLM-based iterative process

This is potentially the **most important theoretical paper** in our portfolio for understanding the dynamics of multi-agent LLM systems.

## 6. Methodology Assessment

**Strengths:**
- Rigorous mathematical framework (Markov chain theory is well-established)
- Clear experimental validation
- Practical implications are immediately actionable
- Temperature as a control parameter is easy to implement
- From a strong NLP theory group (École Polytechnique/CNRS)

**Limitations:**
- Markov assumption is too strong for real multi-agent systems (agents have context windows = memory)
- Only tested on simple tasks (rephrasing, translation) — unclear if results extend to complex reasoning
- Doesn't model multi-agent interaction directly (only single-chain iteration)
- The state space analysis may not scale (sentence space is effectively infinite)
- Doesn't account for prompt engineering or system prompts that may alter dynamics

## 7. Research Quality Assessment

- **Novelty**: 8/10 — First rigorous formalization of iterative LLM processing as Markov chains
- **Rigor**: 8/10 — Strong mathematical framework with experimental validation
- **Impact potential**: 9/10 — Could become a foundational theory for understanding LLM dynamics
- **Relevance to our work**: 10/10 — Directly connects to nearly every thread and provides the missing theoretical foundation

## 8. Critical Questions

- How does the Markov chain structure change when agents have memory (context window > 1 turn)?
- Can we characterize the attractor basins for different LLMs? (Are GPT-4 attractors different from Claude's?)
- What happens when you mix different LLMs in the chain? (Heterogeneous Markov chains)
- Can we use the stationary distribution to predict bias in multi-agent systems?
- Is there a "critical temperature" phase transition we can exploit?

## 9. Actionable Insights

1. **For multi-agent system designers**: Use temperature strategically. Low temp for convergence, high for exploration, avoid medium for critical tasks.
2. **For drift mitigation**: The attractor dynamics explain why LLM outputs drift. Counter by periodically injecting the original input to "reset" the chain.
3. **For error cascade prevention**: Understanding the attractor structure lets you predict which errors will be amplified vs. corrected.
4. **For deliberation design**: The Markov chain framework lets you estimate how many rounds of deliberation are needed before convergence.

---

*Deep dive produced 2026-03-13. Scout workspace.*
