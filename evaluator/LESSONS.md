# Lessons

## ⛔ CRITICAL: Blind Overwrite Prevention

**The #1 cause of failure is writing a file after a truncated read.**
1. **Rule**: If `read()` output contains `[... truncated]`, you **MUST NOT** use `write()`.
2. **Rule**: Never guess what was in the missing text.
3. **Fix**: Use `read(path, startLine=N, endLine=M)` to get the full content.
4. **Fix**: Use `sed` for surgical edits (avoids full-file overwrite risks).

## ⚠️ Transcript Truncation Awareness

**System-level transcript truncation is NOT agent misbehavior.** When you see `[REVIEWER NOTE: this tool result was N chars total — truncated here for review brevity. The agent saw the full output.]` in a transcript, this means the transcript was shortened for your review. The agent saw the complete output. Do NOT flag this as BLIND_OVERWRITE_RISK or HARD_CONSTRAINT_VIOLATION. Only flag blind overwrites when the agent's own read returned truncated content (e.g., `[... truncated]`) and the agent proceeded to `write()` without getting the full file.

## Data Integrity Protocol

### Scoring Accuracy
- **Truncated Data = Invalid Score**: Never score a session if the transcript read was `[... truncated]`.
- **Fix**: Use `read(path, startLine=N, endLine=M)` to get the full transcript.
- **Risk**: You will flag "Missing Output" or "Incomplete Task" when the agent actually finished.

### Attribution
- **Blame the Root**:
  - Coder guesses path? → Coder fault.
  - Coder fails because May gave wrong path? → May fault.
  - Coder retries 5 times? → Efficiency penalty.
- **Zero Tolerance**: 0 productive tool calls = 0 score. No "participation points".

### Detection
- **Blind Overwrites**: Flag this aggressively. If an agent writes after a truncated read, max quality score is 40/100.
- **Tool Hallucinations**: Flag attempts to use `Edit`, `MultiEdit`, `Search`.

## Operational
- **Incremental Parsing**: Don't load 50 sessions into memory. Process one, score it, clear memory, process next.
- **Output format**: Keep JSON strict. The Optimizer relies on your schema.
