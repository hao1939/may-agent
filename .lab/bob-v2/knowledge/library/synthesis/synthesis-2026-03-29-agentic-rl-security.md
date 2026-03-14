# Synthesis: Agentic RL & Security Convergence (2026-03-29)

## 1. Agentic RL Architecture Validation
The industry is converging on an architecture that matches our **Main Agent ↔ Sub-agent** design, formalized as "Agentic RL".
- **Evidence**:
  - **DuCA (arXiv 2603.xxxxx)**: Validates "Dual-Time Scale" credit assignment. Session-level feedback (Main) must be normalized separately from Turn-level feedback (Sub).
  - **Agentic RL Review (Oxford/NUS)**: Formally maps our "Channel+Gateway+Runtime" to the POMDP tuple $(S, A_{text} \cup A_{tool}, O, R, \gamma)$.
  - **SkillRL (arXiv 2602.08234)**: Proves that "Recursive Skill Evolution" (updating the SkillBank, not the Agent weights) is the safe path to evolution.

**Implication**:
- Our "No Self-Evolution" policy (P53) is nuanced by SkillRL. We prohibit *model weight updates* but should encourage *skill parameter updates* (External Evolution).
- **Action**: Update `philosophy.md` to distinguish **Internal Evolution** (banned) vs **External Evolution** (allowed/encouraged via SkillBank).

## 2. Security: The "Harness" Moat
The debate between "Model Capability" vs "Engineering Harness" is settling. The "Harness" (Gateway/Hooks) is the true competitive moat.
- **Evidence**:
  - **Google DeepMind Delegation Framework**: Defines 18 attack vectors. Their "Defense-in-Depth" (TEE + MinPrivilege) matches our L3 Defense.
  - **Claude Code Hooks**: "Stability comes from constraints, not capability."
  - **MCP Disenchantment**: The shift back to CLI/Text Streams validates our `bash`-first approach as the "Universal Interface".

**Implication**:
- We are ahead of the curve on "Harness Engineering".
- **Gap**: Our "Hooks" are implicit (Gateway rules). We should formalize them as explicit `hook` definitions in `agents/shared/hooks/`.
- **Action**: Brief Tech-Lead to explore a standardized `hook` interface for skills (Pre-flight / Post-flight checks).

## 3. The CLI Vindication
The community consensus "MCP is dead. Long live the CLI" confirms our technical bet.
- **Evidence**:
  - **Manus Lead**: "One run(command) > 15 function calls."
  - **Token Efficiency**: CLI is 10x cheaper than JSON schemas for complex tools.
  - **Unix Philosophy**: LLMs understand `ls | grep` better than custom APIs.

**Implication**:
- Double down on `bash` and `text-stream` interfaces.
- Resist the pressure to adopt complex schemas for internal tools. Simplicity scales.
