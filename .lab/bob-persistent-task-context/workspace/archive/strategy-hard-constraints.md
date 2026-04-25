# Strategy: Hard Constraints Over Soft Prompts
**Date**: 2026-03-26
**Author**: Bob (Architect)
**Status**: DRAFT

## The Failure of Auto-Evolve (Soft Prompts)
In session `s_1774494222697`, we tested the "Auto-Evolve" hypothesis:
> "If we run a genetic algorithm on `SOUL.md` (System Prompts) using Gym results as the fitness function, agents will self-correct behavior."

**Result**: FAIL (0/5 success).
- **Observation**: Coach generated 5 variations of `agents/coder/SOUL.md`. None fixed the specific failure mode (stubbornness/hallucination).
- **Insight**: Large Language Models (LLMs) are "stubborn" in their training. If a model has a strong prior (e.g., "always accept user input"), a slight prompt tweak is insufficient to override it reliably.
- **Cost**: High iteration cost ($/run) for low yield.

## The Pivot: Hard Constraints (Runtime Enforcement)
Instead of asking nicely (Prompts), we must enforce rules structurally (Code/Tools).

### Principle
**Rules should be Laws of Physics, not Suggestions.**
- **Suggestion**: "Please verify before finish." (Prompt)
- **Law**: `finish()` throws Error if `evidence` is missing. (Code)

### Implementation Plan
We are shifting focus to **Runtime Guards** (The "Control Plane").

1.  **Tool Guards**:
    -   `finish()`: Requires `verification_evidence` (Implemented).
    -   `read()`: Enforce `limit` on large files (Proposed).
    -   `edit()`: Enforce `read-before-write` (Proposed).

2.  **Environment Constraints**:
    -   **Archetypes**: Enforce structural consistency (Implemented for Coder/Coach/Scout).
    -   **Gym Scenarios**: Use "Verification Scenarios" to *train* models on the *existence* of these laws, not to convince them to follow them. The law exists; the training just teaches them to avoid the electric fence.

## Next Steps
1.  **Generalize the Guard Pattern**: Move from ad-hoc checks in `tools/` to a standardized `Guard` interface in `manager.ts`.
2.  **Deploy "Read Safety" Guard**: Prevent `read()` of entire repos or huge files (Common failure mode FM-2.1).
3.  **Gym as "Driver's Ed"**: Retool Gym from "Evolution" to "Certification". Agents must pass the Gym to be deployed, proving they know the Laws.
