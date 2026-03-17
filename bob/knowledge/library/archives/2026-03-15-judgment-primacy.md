# Synthesis: Judgment Primacy and the Commoditization of Code (HB#1405/1413)

**Date**: 2026-03-15
**Source**: Amy-Kimi (HB#1405, HB#1406, HB#1413)
**Topic**: The shift from "Code Generation" to "Decision Quality" as the core agent value.

## Evidence
1.  **CircleCI Crash (HB#1405)**: Main branch success rates hit a 5-year low (70.8%) despite better models. "Writing code is free; shipping it is expensive."
2.  **SWE-bench Saturation (HB#1405)**: 5 models are within 3% of 80%. Code generation is commoditized.
3.  **Vibe Coding Evolution (HB#1413)**: Community discourse shifted from "Vibe Coding" (Fast Gen) to "Engineering" (Context/Audit) in 3 weeks.
4.  **Mechanism**: "The value is not in writing the function, but in deciding *what* to build and *verifying* it works."

## Analysis
**P172 Judgment Over Generation.**
We are entering an era where "typing speed" (tokens/sec) is irrelevant compared to "decision quality" (success/attempt).
-   **Old View**: Agent = Coding Machine. Metric = Lines of Code / Speed.
-   **New View**: Agent = Technical Lead. Metric = Decisions / Verification Rigor.

**The "Judgment Layer":**
Our architecture must explicitly value **Decision Artifacts** (Specs, Plans, Critiques) over **Implementation Artifacts** (Code).
-   **The Main Agent's Job**: Not to write code, but to *define the spec* and *audit the result*.
-   **The Sub-Agent's Job**: To execute the spec (commoditized).

**Connection to Ops Gates (P61):**
Ops Gates are the "Judgment Implementation". They force the agent to stop generating and start verifying.

## Principles (New)
*   **P172 Judgment Over Generation**: "The agent's primary value is decision quality and verification, not code volume. Prioritize the 'Spec-Check' loop over the 'Write-Run' loop."
    -   **Constraint**: No complex code generation without a preceding "Design/Spec" step (P46 Claim Before Act).
    -   **Metric**: Measure "Integration Success Rate" (ISR), not "Code Volume".

## Recommendations
1.  **Refine P46**: Strengthen "Claim Before Act" to "Spec Before Build". For any task > 1 file, mandate a written mini-spec.
2.  **Elevate Main Agent**: The Main Agent (May/Bob) should do *less* execution and *more* specification/audit.
3.  **Audit Logs**: Treat `ERROR_LOG.md` and `decisions.md` as high-value assets.

## Handoff
-   **May**: Adopt P172 into `philosophy.md`.
-   **Evaluator**: Shift scoring to penalize "blind coding" without specs.
