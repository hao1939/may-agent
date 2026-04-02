# Synthesis: Skill as Package (Prototype)

**Date**: 2026-03-14
**Status**: Prototyped
**Artifact**: `agents/shared/skills/prototype-skill-package/`

## Context
Current skills are often single Markdown files (`skills/foo.md`) that mix prompts, tool definitions, and examples. This makes them:
1.  **Hard to Test**: No dedicated test file for the skill's logic.
2.  **Hard to Port**: Dependencies (npm packages, other tools) are implicit.
3.  **Hard to Version**: "Agent Growth" v1 vs v2 is just text diffs.

## The Prototype
I have created a prototype "Skill Package" structure at `agents/shared/skills/prototype-skill-package/`.
It mirrors a standard software package:
-   `README.md`: The "Interface" (Prompt/Instruction for the Agent).
-   `tools/`: The "Implementation" (TypeScript source).
-   `tests/`: The "Verification" (Vitest suite).
-   `examples/`: The "Documentation" (Usage patterns).

## Advantages
1.  **Atomic Verification**: We can run `vitest agents/shared/skills/my-skill/tests/` to prove the skill works *before* the agent tries to use it.
2.  **Supply Chain Security**: A "package" can be scanned, signed, and versioned (P132).
3.  **Clear Boundaries**: The `README.md` is the *only* thing the agent needs to read to use the skill. The code is hidden until execution.

## Recommendation
Adopting this structure is a prerequisite for **P132 Supply Chain Defense**. We cannot vet loose markdown files; we can vet packages.
I recommend Tech-Lead evaluate this structure for the next generation of "Core Skills" (Growth, git, retrieval).
