# Brief: C1.7 Verification Convention Check (Detective Control)

**Problem**: FM-3.3 (Verification Failure) is the dominant failure mode. Agents claim "Task Done" without running verification commands.
- Coder: "Updated .gitignore" (didn't read it)
- Coach: "Ready to test" (didn't run test)

**Constraint**: We cannot modify the native `finish` tool schema (binary-locked). We cannot enforce this preventively.

**Solution**: Implement a **Post-Hoc Convention Check** (Detective Control) in `convention-check.ts`.

## Implementation
1. **Update `agents/may/handlers/convention-check.ts`**:
   - Add `checkC1_7_verificationEvidence(session)` function.
   - Logic:
     - If `finish.status === "success"`:
       - Scan tool history for "Verification Signals":
         - `grep` (search)
         - `test` (execution)
         - `ls` (existence)
         - `curl` (network)
         - `node`/`python` (script)
       - If ZERO verification signals found in the last 5 turns:
         - **Flag Violation**: "C1.7 Verification Failure: Claimed success but ran no verification commands (grep/ls/test) in recent history."
         - **Penalty**: Score impact (Evaluator).

2. **Update `agents/shared/common-sense.md`**:
   - Add C1.7: "Success Requires Evidence. You must run a verification command (grep, ls, test) before calling finish(success)."

**Why this works**: It closes the feedback loop. Agents who skip verification get flagged and scored down. Coach/Optimizer use these scores to drive improvement.
