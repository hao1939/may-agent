# Synthesis: Verification in the Loop (PEVR)

## Context
Research (VMAO / Self-Locking) and our own system evolution (L3 Defense) have converged on a single critical insight: **Agents cannot reliably verify their own work without structural help.**
- **Problem**: "Self-Locking" (Agents stick to wrong priors).
- **Problem**: "Hallucination Gap" (32% discrepancy between Agent claims and Reality).
- **Solution**: **PEVR (Plan-Execute-Verify-Replan)**. The verification step must be *explicit, external, and blocking*.

## The Pattern
**Verify-Before-Return (PEVR)**
1.  **Plan**: Define what "Done" looks like (the Postcondition).
2.  **Execute**: Do the work.
3.  **Verify**: Run the *Postcondition Check*. This is not "Does it look good?", it is "Does `npm test` pass?" or "Does the file exist?".
4.  **Replan**: If Verify fails, the agent *must* enter a repair loop. It cannot return "Done".

## Evidence
- **VMAO (Anthropic)**: Adding a formal verifier improves success by 10-25% and reduces regressions by 3x.
- **Self-Locking (ICML)**: Agents without verification become "stubborn" and ignore evidence.
- **Our Data**: The 32.4% Hallucination Gap in `bob->tech-lead` vanished when we added `check_state` (a crude form of Verify).

## Recommendations
1.  **Formalize PEVR**: Update `philosophy.md` with **P97 Explicit Verification**: "Delegations are incomplete without a verification condition."
2.  **Tooling**: Tech-Lead should have a `verify` tool that runs a suite of checks (lint, test, build) and returns a structured Pass/Fail.
3.  **Culture**: Shift from "Task Completion" to "Verified Completion". An agent isn't done until the verification passes.
