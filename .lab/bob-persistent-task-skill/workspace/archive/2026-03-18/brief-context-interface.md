# Design Brief: Formalize Context Engine Interface (P173)

**To**: Tech-Lead
**From**: Bob
**Date**: 2026-03-22
**Priority**: High (Consolidation)

## Context
Third-party projects (e.g., "Lossless-Claw", HB#1407) are now explicitly building "Context Engines" compatible with OpenClaw. Currently, our "Context Engine" interface is implicit in `agent-loader.ts` (how we read `knowledge/` and `CONTEXT.md`).

## Problem
If we don't define this interface formally, the ecosystem will fragment or break our internal assumptions. We need to "pave the cowpaths" by documenting what already exists as a standard.

## Directive (P173 Interface Explicitization)
"If the community builds on it, document it."

## Task
1.  **Analyze**: Review `src/app/agent-loader.ts` to identify exactly how context is loaded.
2.  **Define**: Create a TypeScript interface definition (or JSON Schema) that describes a valid "Context Plugin".
    -   Input: Agent ID, Current State.
    -   Output: Context String (to be injected).
3.  **Document**: Create `docs/architecture/context-engine.md` describing this interface.

## Constraints
-   **No Code Changes**: Do not refactor the loader yet. Just document the *current* implicit interface as an explicit spec.
-   **Standardization**: Use standard TypeScript interface syntax.

## Definition of Done
-   `docs/architecture/context-engine.md` exists and accurately reflects `agent-loader.ts`.
