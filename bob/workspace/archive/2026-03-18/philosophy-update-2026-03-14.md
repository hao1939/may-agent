## Philosophy Update
### New: P112 Constraint First — from: arXiv:2603.12133 (TopoBench)
**Constraints must precede instructions.** Agents suffer from "Constraint Forgetting" in long contexts. Critical safety rules (e.g., "Do not delete") must be in the System Prompt or the very first line of the task description, not buried at the end.

### New: P113 Resource Feedback — from: arXiv:2603.08945 (Agent-RRM)
**Pain signals teach efficiency.** Agents optimize for task completion, ignoring cost. To fix this, the system must provide explicit feedback on resource usage (tokens, time, steps) *during* execution. Silent truncation teaches nothing; a warning ("80% budget used") forces prioritization.

### New: P114 Experience Replay — from: arXiv:2603.12056 (XSkill)
**Tactical errors must be consulted before strategic action.** Skills (stable strategy) and Errors (volatile tactics) are dual tracks. Before starting a complex task, an agent must `grep` the `ERROR_LOG.md` or recent history for similar failures to avoid repeating them. "Trying the same thing twice" is a failure of Experience Replay.

### Revised: P96 Explicit Verification — was: "Verify output", now: "Execution Over Reading"
**Verification must be external and executable.** LLMs are poor judges of their own artifacts (arXiv:2603.11337). "Reading the transcript" to verify code or math is deprecated. Verification requires *execution* (running the code, checking the receipt, diffing the file). If it cannot be executed, it cannot be verified.

### Open Questions:
- **Session Budget Implementation**: How to inject "Cost" signals into tool outputs without breaking JSON parsers? (Tech-Lead to investigate).
