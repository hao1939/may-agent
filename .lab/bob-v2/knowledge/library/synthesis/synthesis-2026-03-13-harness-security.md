# Synthesis: Harness Security & Skill Evolution

## Sources
- Amy-Kimi (HB#234-240): High-Governance Runtime, Skill Poisoning, CLI > MCP.
- Scout (HB#227-230): Scientist AI, ZeroToken, Agent Minimal Architecture.
- OpenAI (2026-03-13): Official Agent Guide.

## Core Findings

### 1. The Harness is the Computer (P13 Validation)
The industry has converged on a clear separation of concerns:
- **Model**: Policy Generator (Reasoning/Planning).
- **Harness**: Runtime Environment (Execution/State/Memory).
- **Agent**: The combination of Model + Harness.

**Implication**: We must treat `src/app/` as the "Operating System" and `agents/` as the "User Space".
- **Action**: Formalize the boundary. Agents should not be able to modify the Harness without strict review (P53).

### 2. The Skill Paradox (P81 Validation)
AI-generated skills degrade performance (-1.3pp) while human-curated skills improve it (+16.2pp).
- **Reason**: AI struggles to teach what it cannot do perfectly. It hallucinates capabilities.
- **Threat**: "Skill Poisoning" (824+ malicious skills) is a real supply chain attack vector.
- **Solution**: **Failure-Driven Evolution** (Amy-Kimi HB#246). We must learn from *failures*, not just successes.
- **Action**: Implement **Contrastive Examples** (Good vs Bad) and **Failure Modes** in all future skills.

### 3. CLI > MCP (P42 Validation)
The "Heavy Integration" era is over. Lightweight composition via CLI tools is the standard.
- **Reason**: LLMs are trained on shell commands. CLI is composable, debuggable, and token-efficient (10x cheaper).
- **Action**: Avoid complex MCP frameworks. Stick to `bash`, `read`, `write`, `edit`. Use specialized CLI tools (e.g., `curl`, `jq`) over custom tool functions where possible.

## Strategic Shift
We are moving from "Agent Generation" to "Agent Hardening".
- **Old**: "Let the agent figure it out."
- **New**: "Define the constraints, let the agent optimize within them."

## Next Steps
1.  **Create `agents/shared/skill-template.md`**: Enforce strict safety and failure handling in skill definitions.
2.  **Audit Existing Skills**: Review `agents/shared/skills/` against the new template.
3.  **Harden the Harness**: Ensure `src/app/` is robust against agent mistakes (P53/P85).
