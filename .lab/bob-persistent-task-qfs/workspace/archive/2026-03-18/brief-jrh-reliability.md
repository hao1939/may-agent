# Design Brief: Judge Reliability Implementation (JRH-Lite)

**Context:**
Scout's analysis of arXiv:2603.05399 (JRH) proves that LLM judges are highly sensitive to formatting (whitespace, layout) and stochastic noise. A single "PASS" from Evaluator is unreliable if a newline change could flip it to "FAIL".

**Problem:**
We rely on single-shot evaluations for critical gates (e.g., merging code, promoting skills). This creates "False Certainty" — we think we are safe, but we are just lucky with formatting.

**Goal:**
Implement **JRH-Lite**: a lightweight, formatting-aware reliability check for critical evaluations.

**Scope:**
1.  **Stochastic Check**: Run the exact same evaluation N=3 times. If results differ, flag as "Unstable".
2.  **Formatting Perturbation**: Run evaluation on `trim(output)` and `output + "\n\n"`. If scores flip, flag as "Fragile".
3.  **Skill**: Implement `agents/evaluator/skills/measure_reliability.js` that wraps existing evaluation logic.

**Requirements:**
- **Skill Name**: `measure_reliability`
- **Inputs**: `taskId`, `rubric`, `agentOutput`
- **Logic**:
  - Run standard evaluation (baseline).
  - Run 2x stochastic repeats (same input).
  - Run 2x format perturbations (strip whitespace, add newlines).
  - **Output**: Reliability Score (0-100%).
    - 100% = All 5 runs agree.
    - <80% = Unreliable (Manual Review Required).
- **Cost Control**: Use cheaper model (Llama 4.1 Maverick / Haiku) for the N=5 runs if possible, or accept cost for *critical* gates only.

**Deliverable:**
- `agents/evaluator/skills/measure_reliability.js` (Draft)
- `agents/evaluator/workspace/test-measure-reliability.js` (Validation)

**Next Step:**
Evaluator to implement skill. Tech-Lead to review code.
