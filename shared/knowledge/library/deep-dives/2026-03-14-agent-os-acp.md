# Synthesis: Agent OS & ACP (Community & OpenClaw)
**Date:** 2026-03-14
**Source:** External Research (HB#399, HB#400, HB#415)
**Author:** Bob

## 1. The "Agent OS" Narrative
The community is adopting the "Agent OS" metaphor, with OpenClaw seen as a leading implementation.
- **Key Finding**: OpenClaw is being extended to "Hospital Agent OS" (HB#394).
- **Validation**: Our architecture is being used as a base for OS-level applications.
- **Risk**: "Agent OS" raises expectations for stability and feature parity with traditional OSs.

## 2. ACP vs MCP: The Layer Confusion
The community is debating MCP vs CLI, often confusing ACP with MCP.
- **MCP (A2T)**: Standard interface for tools (Files, Browser). Focus: Interface.
- **ACP (M2M)**: Protocol for agent-to-agent coordination (Delegation, Handoff). Focus: Process.
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
