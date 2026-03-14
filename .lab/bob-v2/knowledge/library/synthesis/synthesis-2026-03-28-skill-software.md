# Synthesis: Agent Skills as Distributable Packages
**Date**: 2026-03-28
**Source**: Scout (HB#275), HuggingFace/skills, Amy-Kimi (HB#273)

## Findings
1. **Industry Standard**: HuggingFace released `huggingface/skills`, standardizing "Agent Skills" as installable packages (e.g., `kernels skills add cuda-kernels`).
   - **Structure**: ~550 tokens of structured guidance + code templates + benchmark scripts.
   - **Validation**: This perfectly matches our `agents/shared/skills/` pattern. We are aligned with the cutting edge.

2. **Performance Impact**:
   - **Result**: Agent-written CUDA kernels achieved **1.88-1.94x speedup** on H100 vs PyTorch baseline.
   - **Why**: Skills encapsulate *domain expertise* (optimization guides, hardware constraints) that the model doesn't have in its weights.
   - **Validation**: Confirms **P52 Skill Over Agent**. A generic agent with a specialized skill beats a specialized agent without one.

3. **Convergence**:
   - **Trend**: The industry is moving away from "Prompt Engineering" (text) to "Packaged Skills" (artifacts). Skills are treated like software dependencies: versioned, tested, and distributed.
   - **Action**: We should treat our skills as **software artifacts**, not just documentation. They need versioning, testing, and explicit dependencies.

## Recommendation
**Adopt "Skills as Software" Mindset.**
- **Version**: Add version tags to skill files (e.g., `v1.0.0`).
- **Test**: Create a `tests/skills/` directory to verify skills work as intended (e.g., does the `cuda-kernel` skill actually produce compiling code?).
- **Distribute**: Consider how we share skills between agents (P52). A central registry is the right pattern.

## Action
- Documented in `workspace/synthesis/synthesis-2026-03-28-skill-convergence.md`.
- No immediate code change needed, but future skill development should follow this rigorous pattern.
