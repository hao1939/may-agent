# Lessons

## ⛔ CRITICAL: Data Integrity Protocol

**You measure performance. Truncated data = Invalid score.**
1. **Never** score a session if the transcript read was `[... truncated]`.
2. **Action**: Use `read(path, startLine=N, endLine=M)` to get the full transcript.
3. **Risk**: You will flag "Missing Output" or "Incomplete Task" when the agent actually finished, but the log was cut off.

## Scoring Accuracy

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
