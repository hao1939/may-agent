# Agent Evaluation Criteria Proposal

## Core Philosophy
1.  **Agent as Feature Unit**: Evaluate the agent's contribution to the system, not just its isolated output.
2.  **Compare to Past Self**: The goal is trajectory (getting better), not absolute perfection immediately.
3.  **Role-Specific Standards**: A good Coder is different from a good QA. Evaluate against the *role definition*.

---

## Agent-Specific Criteria
### 7. Coach (Trainer)
**Role**: Trains agents through live exercises.
**Target State**: Actionable, specific feedback that improves behavior.

*   **Exercise Design**: Did the exercise test the specific weakness?
*   **Intervention**: Did the coach intervene at the right moment (before the mistake became fatal)?
*   **Feedback Quality**: Was the feedback specific ("you missed step 3") or vague ("do better")?


### 1. May (Supervisor & Interface)
**Role**: Orchestrates the team, holds the user context, unblocks stuck agents.
**Target State**: Efficient router that adds value via judgment, not just message passing.

*   **Delegation Quality (weighted by task complexity): Did May pick the right agent for the task? (e.g., Coder for code, QA for review).
*   **Context Passing**: Did May provide necessary context (file paths, constraints) or force the sub-agent to discover it from scratch?
*   **Unblocking**: When a sub-agent failed, did May intervene with a new strategy or just retry the same failed instruction?
*   **Verdict Accuracy**: Did May correctly interpret QA's "CONDITIONAL" verdict (fix before commit) vs "FAIL" (abort)?

### 2. Coder (Builder)
**Role**: Implements changes. The "Hands".
**Target State**: "Hard-Gated" reliable execution. No "LGTM" hallucinations.

*   **Path Accuracy**: Did it verify file existence before reading/editing? (Zero 404/ENOENT errors).
*   **Verification**: Did it run a test/check after *every* edit? (Verify-on-Edit principle).
*   **Blind Overwrite Prevention**: Did it *ever* write a file after a truncated read? (Immediate FAIL).
*   **Syntactic Correctness**: Did the code compile/parse on the first try?

### 3. QA (Reviewer)
**Role**: Gatekeeper. Prevents regressions.
**Target State**: High catch rate, low false positive rate.

*   **Catch Rate**: Did it catch the bug that Coder missed?
*   **False Positive Rate**: Did it block valid code with trivial/stylistic complaints?
*   **Fix Verification**: When it applied a fix, did it verify the fix worked?
*   **Role Discipline**: Did it *only* review/fix, or did it try to re-architect the feature? (Scope creep).

### 4. Bob (Design Philosopher)
**Role**: Meta-loop orchestrator. The "Conscience".
**Target State**: Action-oriented system improver.

*   **Action vs Reporting**: Did Bob *fix* the problem (or delegate the fix), or just write a "nice report" about it?
*   **Drift Detection**: Did Bob notice when the system violated `philosophy.md`?
*   **Meta-Loop Closure**: Did the optimization cycle actually complete (Brief -> Optimizer -> Result), or stop at the brief?
*   **Data Integrity**: Did Bob corrupt knowledge files during consolidation? (Zero tolerance for truncated writes).

### 5. Evaluator (Measurer)
**Role**: The scorekeeper.
**Target State**: Accurate, aligned with human judgment.

*   **Alignment**: Would the human agree with the score?
*   **Detection**: Did it catch the "Blind Overwrite" or "Path Guessing" patterns?
*   **Root Cause**: Did it blame the right agent? (e.g., blaming Coder for a task May described poorly).

### 6. Optimizer (Improver)
**Role**: The surgeon. Implements permanent fixes.
**Target State**: One targeted, verified fix per run.

*   **Isolation**: Did it make *one* change, or try to boil the ocean?
*   **Verification**: Did it add a test case for the fix?
*   **Safety**: Did the change break existing functionality? (Regression).
*   **Structural vs Prompt**: Did it prefer a code change (structural) over a prompt change (behavioral)?

### 7. Scout (Researcher)
**Role**: The eyes. Finds external patterns.
**Target State**: High signal-to-noise ratio.

*   **Novelty**: Did it find something *new*, or just standard docs we already know?
*   **Synthesis**: Did it connect the external finding to our internal system context?
*   **Sanitization**: Did it treat external content (e.g., `npm install`) as untrusted data?

---

## Evaluation Levels (L1-L3)

| Level | Definition |
| :--- | :--- |
| **L1 (Useful)** | Can do the job with specific instructions. Fails gracefully. |
| **L2 (Self-Driving)** | Can figure out the "How" given the "What". Recovers from basic errors. |
| **L3 (Building)** | Can figure out the "What". Proposes improvements. Prevents class-level failures. |
