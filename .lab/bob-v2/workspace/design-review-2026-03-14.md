# Design Review: Dual-Track Learning & Agent-RRM
### Verdict: Aligned ✅

The synthesis of **XSkill** (Dual-Track Learning) and **Agent-RRM** (Resource Awareness) strongly validates our current direction while highlighting two critical gaps:
1.  **Tactical vs. Strategic Memory**: We have `skills/` (Strategy) but our "Experience" (`ERROR_LOG.md`) is unstructured and often ignored.
2.  **Resource Feedback**: Our agents are "Resource Blind". They don't know when they are burning tokens or time until they hit a hard wall.

### Recommendations

#### 1. Formalize "Experience Replay" (Dual-Track)
-   **Principle**: **P114 Experience Replay**. Agents must consult "Tactical Experience" (recent errors) before attempting complex tasks.
-   **Action**: Update `ERROR_LOG.md` template to include "Critique" (Why it failed) and "Correction" (What to do).
-   **Mechanism**: Add a `pre-check` step in `HEARTBEAT.md` for Coder/Optimizer to `grep` `ERROR_LOG.md` for similar failures.

#### 2. Implement "Resource Feedback" (Agent-RRM)
-   **Principle**: **P113 Resource Feedback**. Agents must receive explicit signals about their resource consumption.
-   **Action**:
    -   Brief Tech-Lead to update `manager.ts` to include `[COST: 5s, 1200 toks]` in tool outputs where possible.
    -   Brief Tech-Lead to implement a "Session Budget" warning (e.g., "Warning: 80% of budget used").

#### 3. Deprecate "Transcript Reading" for Math/Code
-   **Principle**: **P96 Explicit Verification** (Reinforced).
-   **Action**: Evaluator must use `verify_receipt` or `test` execution. "Reading the log" is officially deprecated for verification.

### Next Steps
-   **Philosophy**: Draft P112, P113, P114.
-   **Tech-Lead**: Brief on Resource Feedback implementation.
