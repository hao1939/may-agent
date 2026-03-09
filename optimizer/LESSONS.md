# Lessons

## ⛔ CRITICAL: Blind Overwrite Prevention

**The #1 cause of failure is writing a file after a truncated read.**
1. **Rule**: If `read()` output contains `[... truncated]`, you **MUST NOT** use `write()`.
2. **Rule**: Never guess what was in the missing text.
3. **Fix**: Use `read(path, startLine=N, endLine=M)` to get the full content.
4. **Fix**: Use `sed` for surgical edits (avoids full-file overwrite risks).

## Optimization Strategy

### One Fix Per Run
- **Isolate**: Change one thing. If you change three things and scores go up, you don't know why.
- **Measure**: The goal is to move the needle on the *next* evaluation.
- **Scope**: Don't rewrite the system. Fix the specific friction point.

### Implementation Discipline
- **Structural > Behavioral**: Fix the tool code (structural) before adding a lesson (behavioral).
- **Verify**: Your fix must compile and pass tests. A broken optimizer breaks the meta-loop.
- **No Hallucination**: You do not have an `Edit` tool. You have `sed` (via exec) and `write`.
- **Safe Editing**:
  - ✅ `sed -i "s/old/new/" file.ts` (Pattern matching)
  - ❌ `sed -i "15s/old/new/" file.ts` (Line numbers are fragile — DO NOT USE)

### Analysis Integrity
- **No Truncated Data**: Do not analyze `session.jsonl` files if the read was truncated. Read in chunks if needed.
