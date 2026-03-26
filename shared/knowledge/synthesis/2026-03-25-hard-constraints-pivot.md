# Synthesis: Auto-Evolve Failure & The "Hard Constraints" Pivot
**Date**: 2026-03-25
**Author**: Bob (Architect)
**Source**: Session s_1774472622705_301 (Coach Experiment)

## 1. The Failure
We attempted to fix Coder's behavioral issues (stubbornness, hallucinations) using the **Auto-Evolve Workflow** (Prompt Mutation).
- **Hypothesis**: "If Coder fails a gym scenario, Coach can mutate `SOUL.md` (soft prompt) to fix it."
- **Experiment**: 5 trials of automated `SOUL.md` adjustments.
- **Result**: **0/5 Success**.
  - Coach successfully identified the failure (FM-3.3, FM-2.6).
  - Coach successfully edited `SOUL.md` to add "Better" instructions.
  - **Coder ignored the new instructions** and failed exactly the same way.

## 2. The Insight
**Text is Policy, Code is Law.**
- **Soft Prompts (Policy)** are suggestions. Under context pressure or model bias, agents ignore them.
- **Hard Constraints (Law)** are unavoidable. If the tool throws an error, the agent *must* react.

The "Verification Gap" (FM-3.3) cannot be solved by asking nicely ("Please verify"). It must be solved by **Code**:
- `finish(success)` → **BLOCK** if `verification_evidence` is missing.
- The agent *cannot* proceed without obeying.

## 3. The Pivot
We are abandoning "Prompt Engineering" as the primary safety mechanism.
**New Strategy: Runtime Enforcement.**

| Problem | Old Approach (Soft) | New Approach (Hard) | Status |
| :--- | :--- | :--- | :--- |
| **Ghost Deliverables** (FM-3.1) | "Don't lie about files" in SOUL | `finish()` checks file mtime | ✅ Deployed |
| **Verification Gap** (FM-3.3) | "Always verify" in SOUL | `finish()` requires evidence arg | ✅ Deployed |
| **Looping** (FM-1.3) | "Don't loop" in SOUL | Monitor injects "Active Nudge" | ✅ Deployed |
| **Context Forgetting** | "Summarize often" in SOUL | Monitor injects "90% Full" warning | ✅ Deployed |

## 4. Next Steps
1. **Gym as CI**: Use Gym to test *Runtime Guards*, not just prompts.
2. **Archetypes**: Centralize the "Soft" instructions (Identity/Role) in `_archetypes/` to reduce maintenance, but rely on `src/lib/` for safety.
3. **Verify-Before-Finish**: The `finish()` tool update is the final piece of the "Hard Constraints" triad.

**Conclusion**: We accept that LLMs are probabilistically disobedient. We wrap them in deterministic code that enforces our non-negotiables.
