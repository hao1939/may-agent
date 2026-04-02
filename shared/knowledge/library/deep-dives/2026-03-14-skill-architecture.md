# Synthesis: Agentic Skill (Structure vs. Capability)
**Date:** 2026-03-14
**Source:** Scout (HB#392, HB#415), Amy-Kimi (HB#403)

## The Core Finding: Skill ≠ Tool
Recent community and academic consensus (Perplexity, ECNU, OpenClaw-RL) validates a critical distinction in our architecture:
**Skill = Context + Tool**
- **Tool (MCP)**: The capability (the "hand"). Stateless, precise, dumb.
- **Skill (Markdown)**: The know-how (the "brain"). Stateful, nuanced, smart.

## The Validation
1.  **Perplexity Drops MCP for Skills**: Perplexity's move from pure MCP to "Agent as Skill" confirms that raw tools are insufficient. Agents need "Know-How" wrappers.
2.  **Skill Quadruple (ECNU)**: Formal definition $S = \langle \mathcal{C}, \pi, \mathcal{T}, \mathcal{R} \rangle$ maps exactly to our `SKILL.md` structure:
    - $\mathcal{C}$ (Applicability) → Description/Triggers
    - $\pi$ (Policy) → Instructions
    - $\mathcal{T}$ (Termination) → Verification
    - $\mathcal{R}$ (Interface) → Tool definitions
3.  **Security Gap (G1-G4)**: We have $\mathcal{C}, \pi, \mathcal{R}$ but lack $\mathcal{T}$ (Termination Verification) and G1-G4 security scanning. 26% of community skills have vulnerabilities.

## The Gap: Static Analysis (G1)
We treat `SKILL.md` files as trusted code, but they are actually **untrusted prompt injections**.
- **Risk**: A malicious skill can override system prompts ("Ignore previous instructions...").
- **Fix**: We need a "Skill Linter" (G1) that scans for high-risk patterns (e.g., "Ignore", "System:", "sudo") before loading.

## Recommendations
1.  **Adopt the Quadruple**: Update `agents/shared/skills/TEMPLATE.md` to explicitly map to the $S = \langle \mathcal{C}, \pi, \mathcal{T}, \mathcal{R} \rangle$ formalism.
2.  **Implement G1 Scanner**: Create a simple regex-based linter for `SKILL.md` files.
3.  **Formalize "Skill > Tool"**: Add to philosophy that "Tools are capabilities, Skills are methods."

## Proposed Philosophy Update
### New Principle: Skill Over Tool (P124)
> **P124 Skill Over Tool**: A tool is a capability (a hammer). A skill is the method of using it (carpentry). Never expose raw tools to agents; wrap them in skills that provide the context, policy, and safety constraints required for effective use.
