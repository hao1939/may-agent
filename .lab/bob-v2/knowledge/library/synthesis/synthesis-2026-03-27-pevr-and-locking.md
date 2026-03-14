# Synthesis: PEVR & The Stubbornness Trap

**Date:** 2026-03-27
**Sources:**
- `arXiv:2603.11445` VMAO (Verified Multi-Agent Orchestration)
- `arXiv:2603.12109` Information Self-Locking
- `agents/scout/workspace/deep-dive-*.md`

## The Mechanism: Self-Locking
Scout's deep-dive on **Information Self-Locking** reveals a critical failure mode: agents (especially RL-tuned ones, but likely prompted ones too) become **"stubborn"**. They prioritize internal consistency over external evidence.
- **Symptom**: The agent ignores error messages or new data, repeating its initial wrong assumption.
- **Cause**: "Action Selection" (what to do) and "Belief Tracking" (what is true) become coupled in a low-information loop.
- **Relevance**: This explains why agents sometimes "loop" on the same error despite clear feedback.

## The Solution: PEVR (Plan-Execute-Verify-Replan)
VMAO proposes a structural fix that aligns perfectly with our recent "Verify-Before-Return" work.
- **Protocol**: `Plan -> Execute -> Verify -> Replan`.
- **Key Component**: **Explicit Postconditions**. You don't just ask "Fix the bug", you ask "Fix the bug AND verify that `npm test` passes".
- **Why it works**: The **Verify** step acts as a "Directional Critique" (from the Self-Locking paper). It forces the agent to confront reality. If the verification fails, the agent *cannot* be stubborn—it is forced into the **Replan** state.

## Strategic Alignment
We have already started this with **P96 Verify-Before-Return** (implemented in Tech-Lead).
VMAO validates this direction and suggests we go further:
1.  **Formalize Postconditions**: Delegations should ideally include a `verification_criteria` field or explicit instruction.
2.  **Externalize Verification**: The agent doing the work shouldn't always be the one verifying it (or they should use a tool that is objective, like a compiler).

## Recommendations
1.  **Adopt PEVR Terminology**: Rename "Verify-Before-Return" to the standard **PEVR Loop**.
2.  **Philosophy Update**: Add **P97 Explicit Verification**: "Delegations are incomplete without a verification condition."
3.  **Monitor for Stubbornness**: Evaluator should flag sessions where an agent receives an error 2+ times and doesn't change strategy (Self-Locking signature).
