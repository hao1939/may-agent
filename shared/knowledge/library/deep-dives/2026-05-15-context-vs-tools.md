# Synthesis: Passive Context > Active Tools (Safety Paradox)

**Date**: 2026-05-15
**Source**: Amy-Kimi HB#502 (Next.js 16 Benchmark), P114 Experience Replay Failure
**Theme**: Safety Engineering / Protocol Design

## The Paradox
We assumed that giving agents a "Safety Skill" (e.g., `experience-replay`) would make them safer.
**Reality**: It made no difference. The skill had **0% organic adoption** in Phase 1.

## Evidence
1.  **Internal Failure (P114)**: We deployed `experience-replay` to `agents/coder/skills/`. In 24 hours of operation, Coder never called it once voluntarily. It only used it when explicitly forced by a prompt injection test.
2.  **External Benchmark (HB#502)**: Vercel/Next.js 16 benchmark shows:
    *   **Passive Context (AGENTS.md/System Prompt)**: 100% Adherence.
    *   **Active Tools (Skills)**: 53% Adherence (Organic), 79% (Forced).
3.  **Mechanism**: To use a skill, the agent must *decide* it needs it ("Decision Point"). Under load or distraction, this decision is skipped to save tokens/time. Context is *always there* — it removes the decision point.

## The Principle: "Safety Must Be Zero-Click"
Safety cannot be an "opt-in" action. It must be:
1.  **Passive**: Injected into the System Prompt (Context).
2.  **Structural**: Enforced by the Harness (Code).
3.  **Inescapable**: Not a tool the agent *can* call, but a check the agent *must* pass.

## Application: The "Context-First" Pivot
We must stop trying to solve behavioral problems with new tools.
*   **Old Way (Failed)**: "Here is a `check_safety` tool. Please use it."
*   **New Way (Proposed)**: 
    *   **L0 (Harness)**: `manager.ts` blocks `edit()` until `read(ERROR_LOG)` is detected. (Implemented P114 Phase 3).
    *   **L1 (Context)**: `SOUL.md` contains "You MUST read error logs before editing." (Passive injection).
    *   **L2 (Skill)**: The skill exists only to *satisfy* the L0/L1 constraint, not to drive behavior itself.

## Strategic Shift
For the "Consolidation Mode" (Hao's Directive):
*   **Audit**: Review all "Safety Skills" (e.g., `verify_supply_chain`, `check_state`).
*   **Migrate**: If they are critical, move their *trigger* to Context or Harness.
*   **Deprecate**: If they are optional and unused, delete them to reduce noise (P42).

## Next Steps
1.  Formalize **P140: Passive Safety** in `philosophy.md`.
2.  Review `agents/shared/skills/` for "Zombie Skills" (safety tools that are never used).
3.  Brief Tech-Lead: "Harness is the only reliable safety layer."
