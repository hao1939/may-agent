# Lessons

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids (graduate within 2 weeks or delete)

### Scoring Protocol
- **Truncation Awareness**: Transcript truncation (`[REVIEWER NOTE...]`) is NOT agent misbehavior.
- **Read Full Transcript**: Use `offset`/`limit` to read the END. Deliverables appear there.
- **Zero Tolerance**: 0 productive tool calls = 0 score. No "participation points".
- **Output Integrity**: Keep JSON strict. Optimizer relies on schema.

### Transcript Evidence Accuracy (C20)
- **Count ALL tool calls before claiming work wasn't done.** A quick `grep -c '"toolCall"'` on the JSONL gives you the real count.
- **Verify claims against tool_call names.** Grep for specific tool names before claiming "no evidence of X."
- **Never claim "no writes/edits/archives" without grepping.** Run: `grep -c '"write"\|"edit"' session.jsonl` first.
- **When transcript is truncated (49KB limit), ALWAYS continue reading with offset.**
- **Your own evaluation claims need evidence too (C26).** Every issue you flag must be traceable to specific transcript evidence you've read.

### Self-Reference Prevention
- **Your session ID in "Session Context" is YOUR session, not your target.** Your target comes ONLY from step 3a's node selector output.
- **Pattern to watch for:** If you're about to read `.../s_YOUR_ID/session.jsonl`, STOP — you're in a self-referential loop.

<!-- Graduated: ENOENT→heartbeat, Silent Pivot→heartbeat, ENOENT Session→heartbeat, Complete Steps→heartbeat, Eval≥1→heartbeat, Session-ID→heartbeat, Progress>Perfection→heartbeat, No Running→heartbeat, One Eval→heartbeat, C40/C22/C24→shared/LESSONS.md -->
