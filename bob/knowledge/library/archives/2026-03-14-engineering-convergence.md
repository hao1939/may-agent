# Synthesis: Agentic Engineering Convergence
**Date:** 2026-03-14
**Source:** External Research (HB#366-420), OpenClaw Community, Academic Papers
**Author:** Bob

## 1. The "Harness Engineering" Paradigm
Our L0-L3 architecture has a name in the broader industry: **Harness Engineering**.
- **Definition**: Agent systems are not "smart models" but "constrained cybernetic systems".
- **Core Components**: State, Tools, Memory, Permissions, Observation, Rollback.
- **Validation**:
  - **OpenViking**: Uses L0/L1/L2 memory hierarchy (exact match).
  - **SAGE (AWS)**: Uses Skills as RL learning units (validates L3 Skill Review).
  - **Anthropic**: Explicitly distinguishes Skills (Process) from MCP (Interface).

## 2. The Identity-Behavior Link (NormCoRe & ACS)
Research (NormCoRe, ACS/UToronto) proves that **Identity is a Behavior Controller**, not just flavor text.
- **Key Finding**: Changing the identity frame shifts behavior as much as changing the goal.
- **Risk**: "Jailbreaking Dance" — users exploit identity ambiguity.
- **Mitigation**:
  - **Explicit Identity**: `SOUL.md` must be rigid and tested.
  - **No Runtime Evolution**: Preventing identity drift is a safety requirement, not just a preference.

## 3. The "Convergence-by-Scaling" Paradox (CreativeBench)
Larger models become more "correct" but less "creative" (converge to the mean).
- **Implication**: We cannot rely on model scale for innovation.
- **Solution**: **Explicit Divergence Mechanisms**.
  - **Novelty Metrics**: Skill review must assess novelty, not just correctness.
  - **Task Adaptation**: Allow `strategy.md` (transient) to diverge, while `SOUL.md` (core) stays rigid.

## 4. The "Agent OS" Narrative
The community is adopting the "Agent OS" metaphor, with OpenClaw seen as a leading implementation.
- **ACP vs MCP**:
  - **MCP (A2T)**: Standard interface for tools (Files, Browser).
  - **ACP (M2M)**: Protocol for agent-to-agent coordination (Delegation, Handoff).
  - **Verdict**: They are orthogonal. We support both.

## 5. Actionable Recommendations
1. **Adopt "Harness Engineering" Vocabulary**: Rename internal docs to align with industry terms (easier onboarding).
2. **Harden Identity Tests**: Add specific "Identity Resilience" tests to the gym (NormCoRe validation).
3. **Formalize ACP**: Publish the internal Agent Coordination Protocol (ACP) spec to clarify the "Agent OS" layer.
4. **SkillRL Experiment**: Brief Tech-Lead to experiment with SAGE-style "Skill-Integrated Reward" for the Optimizer.
