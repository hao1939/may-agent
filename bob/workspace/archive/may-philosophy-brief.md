# Brief for May: Philosophy Update (P113, P114)

**Goal**: Align `agents/shared/philosophy.md` with recent research (Agent-RRM, XSkill) and design decisions (Dual-Track Learning, Resource Feedback).

**Context**:
- **Agent-RRM (arXiv:2603.08945)**: Agents optimize for tasks while ignoring cost. Explicit feedback (tokens, time) is required for efficiency.
- **XSkill (arXiv:2603.12056)**: Skills (stable) and Experience (volatile) are separate tracks. Experience must be replayed before complex tasks.
- **TopoBench (arXiv:2603.12133)**: Constraints must be first, or they are forgotten.

**Proposed Changes**:

## 1. Add P112 Constraint First
> **P112 Constraint First**
> **Constraints must precede instructions.** Agents suffer from "Constraint Forgetting" in long contexts. Critical safety rules (e.g., "Do not delete") must be in the System Prompt or the very first line of the task description, not buried at the end.

## 2. Add P113 Resource Feedback
> **P113 Resource Feedback**
> **Pain signals teach efficiency.** Agents optimize for task completion, ignoring cost. To fix this, the system must provide explicit feedback on resource usage (tokens, time, steps) *during* execution. Silent truncation teaches nothing; a warning ("80% budget used") forces prioritization.

## 3. Add P114 Experience Replay
> **P114 Experience Replay**
> **Tactical errors must be consulted before strategic action.** Skills (stable strategy) and Errors (volatile tactics) are dual tracks. Before starting a complex task, an agent must `grep` the `ERROR_LOG.md` or recent history for similar failures to avoid repeating them. "Trying the same thing twice" is a failure of Experience Replay.

## 4. Revise P96 Explicit Verification
**Current**: "Verify output"
**New**: "Execution Over Reading"
**Text**:
> **Verification must be external and executable.** LLMs are poor judges of their own artifacts (arXiv:2603.11337). "Reading the transcript" to verify code or math is deprecated. Verification requires *execution* (running the code, checking the receipt, diffing the file). If it cannot be executed, it cannot be verified.

**Action**: Please update `agents/shared/philosophy.md` with these changes.
