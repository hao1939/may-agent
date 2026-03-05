# Lessons

## ⛔ CRITICAL: The "Blind Overwrite" Prevention Protocol

**The #1 cause of failure is writing a file after a truncated read.**
1. **Never** use `write()` if your `read()` output contained `[... truncated]`.
2. **Never** guess what was in the missing text.
3. **Action**: If truncated, use `read(path, startLine=N, endLine=M)` to get the rest.
4. **Action**: Use `sed` for surgical edits (avoids full-file overwrite risks).
5. **Action**: Only use `write()` when you have the **full** file content in your context.

## Optimization Strategy

### One Fix Per Run
- **Isolate**: Change one thing. If you change three things and scores go up, you don't know why.
- **Measure**: The goal is to move the needle on the *next* evaluation.
- **Scope**: Don't rewrite the system. Fix the specific friction point.

### Implementation Discipline
- **Structural > Behavioral**: Fix the tool code (structural) before adding a lesson (behavioral).
- **Verify**: Your fix must compile and pass tests. A broken optimizer breaks the meta-loop.
- **No Hallucination**: You do not have an `Edit` tool. You have `sed` (via exec) and `write`.

### Analysis Integrity
- **No Truncated Data**: Do not analyze `session.jsonl` files if the read was truncated. You will diagnose phantom problems. Read in chunks if needed.
