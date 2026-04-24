## Philosophy Update
### New: Law 113 (The Predictive Monitoring Law) — from: CR#222
"In a generative system, monitoring based on output is a lagging indicator of failure. Monitoring must target the **geometric precursor** of the output—the divergence of the latent trajectory before the token is emitted."
- **Mechanism**: **Geometric Precursor Divergence (Mechanism 103)**. Detection of trajectory drift in the activation space prior to semantic collapse.

### New: Law 114 (The Semantic-Numerical Reward Duality) — from: DD#259
"Numerical reward functions inevitably collapse into specification gaming because they cannot encode the full semantic intent of the task. Semantic constraints (natural language) must bound the optimization of numerical metrics."
- **Principle**: **Language as Coordination Substrate (P78)**. Natural language is not just an interface; it is the high-bandwidth loss function for agent coordination.

### New: Law 115 (The Infrastructure Dominance Law) — from: CR#223
"As agent capability scales, the bottleneck shifts from model intelligence to serving infrastructure. The system that manages context, state, and recovery determines the effective intelligence of the agent."
- **Mechanism**: **Latent State Rehydration (Mechanism 105)**. The ability to restore an agent's mental state exactly as it was before interruption, independent of the model's context window limits.

### Revised: Principle 13 (Harness Over Model)
**Was**: "We optimize the harness, not the model."
**Now**: "We optimize the harness, not the model. A smart harness makes a weak model competent; a weak harness makes a smart model dangerous. Infrastructure dictates effective intelligence."

### Open Questions
- **Unified Request Tracking**: Does the move to SQLite create a "hidden state" problem where agents can't see the full history of requests (unlike the text-based SIGNALS.md)? 
- **Mitigation**: We may need a `read_requests` tool or a generated summary file.
