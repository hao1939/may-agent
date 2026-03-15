# Lessons

## Active Band-Aids (graduate within 2 weeks or delete)

### Scoring Protocol
- **Truncation Awareness**: Transcript truncation (`[REVIEWER NOTE...]`) is NOT agent misbehavior.
- **Read Full Transcript**: Use `offset`/`limit` to read the END. Deliverables appear there.
- **Zero Tolerance**: 0 productive tool calls = 0 score. No "participation points".
- **Output Integrity**: Keep JSON strict. Optimizer relies on schema.

### Transcript Evidence Accuracy (C20 — added H560)
- **Count ALL tool calls before claiming work wasn't done.** Session.jsonl contains tool calls nested in assistant content blocks as `{"type":"toolCall","name":"..."}`. A quick `grep -c '"toolCall"'` on the JSONL gives you the real count. If the agent made 10+ tool calls, it almost certainly did substantive work — read carefully before claiming "premature termination" or "no evidence of X."
- **Verify claims against tool_call names.** If you're about to write "no evidence of health checks" or "session ends mid-exploration," first grep the session.jsonl for the specific tool names (bash, read, write, edit, agents) to confirm your claim. Absence of evidence in your partial read is NOT evidence of absence.
- **Never claim "no writes/edits/archives" without grepping.** Run: `grep -c '"write"\|"edit"' .state/sessions/history/$T/session.jsonl` to count write/edit calls before claiming no artifacts were produced.
- **When transcript is truncated (49KB limit), ALWAYS continue reading with offset.** The 49KB head read may cut off mid-session. If the session has >200 lines, you MUST read the remainder before scoring.

## Graduated ✅
- "ENOENT Is Not Terminal" → heartbeat.md step 4 (file-missing handling)
- "Never Silently Pivot Targets" → heartbeat.md step 3 HARD CONSTRAINTS
- "ENOENT on Session Path = Pick Next" → heartbeat.md step 3a (NONE handling)
- "Complete All Heartbeat Steps" → heartbeat.md structural flow
- "Evaluate At Least One Session" → heartbeat.md step 3 MANDATORY GATE
- "Session-ID Discipline" → heartbeat.md step 3 HARD CONSTRAINTS
- "Progress Over Perfection" → heartbeat.md step 3 design
- "No Running Sessions" → heartbeat.md step 3a (done/error filter)
- "One Eval Per Session" → heartbeat.md step 3 (ONE session)
