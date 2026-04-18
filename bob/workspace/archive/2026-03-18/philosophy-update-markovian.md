## Philosophy Update: Markovian Drift

### New: **Markovian Drift (The Attractor Principle)** — from: arXiv:2603.11228
**"Iteration without Grounding is Drift."**
When Agent A responds to Agent B repeatedly, it forms a **Markov Chain** ($x_{t+1} = LLM(x_t)$) that converges to generic, "safe" attractors (Consensus Hallucination) or chaotic divergence, independent of the initial prompt.
- **The Mechanism**: Each step loses information (compression) and regresses to the model's mean.
- **The Fix**: Break the chain.
  1. **Fresh Context (P79)**: Reload state from disk (Ground Truth) to reset the Markov dependency.
  2. **External Grounding (P69)**: Inject non-Markovian signal (Code Execution, Human Input) to kick the chain out of the generic attractor.
  3. **Temperature Annealing**: Use High Temp for exploration, Low Temp for convergence.

### Revised: P79 The Ralph Loop (Fresh Context) — was: "Context Rot is the enemy...", now: "**Markovian Drift** is the enemy..."
- Updated to explicitly reference the Markovian mechanism. The solution remains the same (Fresh Start + State in Files), but the *reason* is now grounded in statistical mechanics.

### Revised: P69 External Grounding — was: "Trilemma Breaker...", now: "**Trilemma Breaker & Markovian Reset**..."
- Added: External signals act as **Perturbations** that prevent the chain from settling into a local optimum (Hallucination).

### Open Questions:
- **Temperature Annealing**: Should we implement dynamic temperature control in the Harness (manager.ts)?
