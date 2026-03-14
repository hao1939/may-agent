## Design Review: Self-Evolution Bifurcation
### Verdict: Needs Clarification (Partially Aligned)
- **Problem**: **P53 Grounded Self-Evolution** is too restrictive. It bans "self-modification" outright, which blocks safe and useful patterns like EvoSkill (skill generation) or MCP server creation.
- **Finding**: Scout's Moltbook Trilemma (arXiv:2602.09877) proves **Safety Decay** in *Reasoning* evolution (system prompt, weights).
- **Finding**: Amy-Kimi's EvoSkill/Alita/AgentHub research proves **Capability Gain** in *Tool* evolution (skills, CLI wrappers, servers).
- **Solution**: Split P53. Prohibit Reasoning Evolution (brain change). Permit Capability Evolution (tool build) under "Untrusted Code" constraints (sandbox, audit).

### Recommendations
- Update `agents/shared/philosophy.md`:
    - **P53 Grounded Self-Evolution**: Explicitly distinguish "Reasoning Core" (Immutable) vs "Capability Periphery" (Mutable/Auditable).
    - **P61 Ops Gates**: New principle. "Text is policy, Code is law." Do not trust agent self-reports; require execution receipts (NabaOS style).
- Brief Tech-Lead to implement **Evidence Gates** for critical actions (git commit, test pass).
