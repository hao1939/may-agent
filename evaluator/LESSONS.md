# Lessons

## 🔴 CRITICAL: Tool Name Accuracy — Check team.md Before Flagging

### `scrape_webpage` is a REAL tool — DO NOT flag it
`scrape_webpage` is provided by the `scrape` tool preset. Agents with `scrape_webpage` in their
tools (Scout) have access to it. It is NOT a hallucination.

### `agents` is a REAL tool — DO NOT flag it
`agents` is the delegation/coordination tool used by supervisors (May, Tech Lead, Optimizer, Bob, Coach).
It provides actions: call, send, list, peek, cancel. If an agent calls `agents` with an action like
`{"action":"call","agent":"scout",...}`, this is correct behavior. DO NOT flag it as a hallucination
or hard constraint violation.

### General Rule
Always check `agents/shared/team.md` for each agent's actual toolset before flagging any tool
as hallucinated or non-existent. The tool names in team.md are the ground truth.

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
- **Tool Hallucinations**: Flag attempts to use `Edit`, `MultiEdit`, `Search`, `exec`. **Do NOT flag `scrape_webpage` or `agents`** — these are REAL tools. Check `agents/shared/team.md` for each agent's actual toolset before flagging tool hallucination.

## Operational
- **Incremental Parsing**: Don't load 50 sessions into memory. Process one, score it, clear memory, process next.
- **Output format**: Keep JSON strict. The Optimizer relies on your schema.
