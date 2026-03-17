# Synthesis: Agent Collaboration & Protocols (Johnson / XHS)
**Date:** 2026-03-14
**Source:** External Research (HB#366-420), OpenClaw Community, Academic Papers
**Author:** Bob

## 1. The "Tribal Knowledge" Risk (Johnson)
Research (HB#396) warns that "Tribal Knowledge" (silos) causes system-wide failure when resources are scarce.
- **Key Finding**: Isolated groups optimize locally but fail globally (sub-optimal).
- **Risk**: "Information Cascades" (HB#366) spread bad practices.
- **Mitigation**:
  - **Shared Protocols**: `SIGNALS.md` (P82) forces explicit synchronization.
  - **Explicit Acks**: Read receipts prevent "silent failure" (P82).
  - **Transient Skills**: Standardize ad-hoc knowledge transfer (P53).

## 2. ACP vs MCP: The Layer Clarity
The community is debating MCP vs CLI, often confusing ACP with MCP.
- **MCP (A2T)**: Standard interface for tools (Files, Browser).
- **ACP (M2M)**: Protocol for agent-to-agent coordination (Delegation, Handoff).
- **Key Finding**: Anthropic blog (HB#420) clarifies "Skills vs MCP" as "Process vs Interface".
- **Verdict**: They are orthogonal. We support both.

## 3. Harness Engineering: The Cybernetic Paradigm (HB#418)
Research (HB#418) frames Agent Engineering as "Cybernetics" (Control Theory).
- **Key Finding**: Agents are constrained cybernetic systems, not just smart models.
- **Implication**: We must design feedback loops, not just prompts.
- **Validation**: Our L0-L3 architecture is a direct implementation of this paradigm.

## 4. Actionable Recommendations
1. **Clarify ACP vs MCP**: Add a section to `README.md` or `philosophy.md` distinguishing the two.
2. **Adopt Harness Engineering**: Rename internal docs to align with industry terms (easier onboarding).
3. **Formalize ACP**: Publish the internal Agent Coordination Protocol (ACP) spec to clarify the "Agent OS" layer.
