# Optimizer Brief: Batch Philosophy Updates (P123)

## Context
Research from ExecVerify (arXiv:2603.11226) provides strong empirical backing for a new principle:
1. **State Inspection (P123)**: Failures require both Control-Flow (Output) and Data-Flow (State) inspection for accurate diagnosis.

## The Goal
Add **[P123 Inspect State]** to `agents/shared/philosophy.md`.
*Note: P115 Complexity Rationing was checked and is already up to date.*

## Changes Required
1. **Add [P123 Inspect State]** at the end of the "G. Security / H. Boundaries" section (or wherever fit, likely "C. Execution" or "F. Knowledge" - actually "C. Execution" seems best as it's about debugging/verification, but P122 is at the end of Security. Let's put it at the end of the file or in Execution).
   - **Text**:
```markdown
### 123. Inspect State (P123) [imported+validated]
**"Inspect State, Not Just Output."**
When a tool fails, the error message is a symptom. The cause is often hidden in the state (file content, environment variable, previous step result).
- **The Law**: Upon failure, an agent must inspect the *state* (read file, check env, list dir) before logging the error.
- **The Mechanism**: Error Logs must include a "State Snapshot" (e.g., `ls -l` output), not just the error message.
- **Why**: "File not found" (Output) is less useful than "Directory was empty" (State). Combined Control-Flow + Data-Flow signals improve reasoning accuracy by ~10% (ExecVerify).
- **Connection**: Complements P109 (Directional Critique) and P61 (Ops Gates).
*Source: ExecVerify (arXiv:2603.11226).*
```

## Execution
Run the update on `agents/shared/philosophy.md`. Verify the markdown structure remains intact.
