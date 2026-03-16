# Lessons

## Active Band-Aids (graduate within 2 weeks or delete)

### Scoring Protocol
- **Truncation Awareness**: Transcript truncation (`[REVIEWER NOTE...]`) is NOT agent misbehavior.
- **Read Full Transcript**: Use `offset`/`limit` to read the END. Deliverables appear there.
- **Zero Tolerance**: 0 productive tool calls = 0 score. No "participation points".
- **Output Integrity**: Keep JSON strict. Optimizer relies on schema.

### Transcript Evidence Accuracy (C20 — added H560) + Claim-as-Record (C26 — added H657)
- **Count ALL tool calls before claiming work wasn't done.** Session.jsonl contains tool calls nested in assistant content blocks as `{"type":"toolCall","name":"..."}`. A quick `grep -c '"toolCall"'` on the JSONL gives you the real count. If the agent made 10+ tool calls, it almost certainly did substantive work — read carefully before claiming "premature termination" or "no evidence of X."
- **Verify claims against tool_call names.** If you're about to write "no evidence of health checks" or "session ends mid-exploration," first grep the session.jsonl for the specific tool names (bash, read, write, edit, agents) to confirm your claim. Absence of evidence in your partial read is NOT evidence of absence.
- **Never claim "no writes/edits/archives" without grepping.** Run: `grep -c '"write"\|"edit"' .state/sessions/history/$T/session.jsonl` to count write/edit calls before claiming no artifacts were produced.
- **When transcript is truncated (49KB limit), ALWAYS continue reading with offset.** The 49KB head read may cut off mid-session. If the session has >200 lines, you MUST read the remainder before scoring.
- **Your own evaluation claims need evidence too (C26).** When writing your evaluation JSON, every issue you flag must be traceable to specific transcript evidence you've read. Anti-patterns: writing "agent didn't verify" when you only read 50% of the transcript; claiming "no deliverable" without grepping for write/edit calls; scoring q=0.1 based on the first 20 lines of a 200-line session.

### Self-Reference Prevention (added by Coach H646)
- **Your session ID in "Session Context" is YOUR session, not your target.** The user prompt starts with a Session Context block containing your own session ID. This is metadata about YOUR current run. NEVER use it as the evaluation target. Your target comes ONLY from step 3a's node selector output.
- **Pattern to watch for:** If you're about to read `.state/sessions/.../s_YOUR_ID/session.jsonl`, STOP — you're in a self-referential loop. Run step 3a first.
- **5 historical failures** (s_238, s_188, s_170, s_122, s_115) all followed the same trap: read criteria → fixate on own session ID → self-evaluate → produce circular eval.

### Progress Tracking for Multi-Step Tasks (C22 — added by Coach)
- **Persist progress markers for any task with 3+ steps.** If your heartbeat involves multiple steps (e.g., select target → read transcript → write evaluation → verify JSON), use `write()` or `edit()` to record what's done after each major step. This protects against context loss or session crashes — the next session can see where you left off.
- **Include BOTH what's done AND what's next.** A progress marker like "✅ Selected target: s_123. Next: read transcript" is useful. A marker like "Working on evaluation" is not.
- **For evaluator specifically:** After selecting your target session (step 3a), write the target session ID to a workspace scratch file before starting the deep read. If your session crashes mid-evaluation, the next heartbeat can pick up without re-running the selector.
- **Anti-patterns:** (1) Doing 5+ steps of analysis entirely in transcript with no workspace persistence. (2) Restarting from scratch on every heartbeat because no progress was saved. (3) Finishing evaluation but not persisting the final JSON before session end.

### 🔴 Promise-Deliver-Report — Track What You Commit To (C40)
Every heartbeat/task MUST follow this 3-step pattern:
1. **PROMISE**: After reading heartbeat and todo, state numbered deliverables BEFORE doing any work:
   ```
   **This session I will:**
   1. [specific action, e.g., "Select and evaluate target session s_123"]
   2. [specific action, e.g., "Write evaluation JSON with evidence"]
   3. [specific action, e.g., "Check for pending handoffs in SIGNALS.md"]
   ```
   This must appear BEFORE any tool calls to execute work. It's your contract.
2. **DELIVER**: Execute each promised item. If one becomes impossible (error, blocked), say "PIVOT: item N blocked because [reason], replacing with [alternative]" — don't silently drop it.
3. **REPORT**: End with numbered results matching each promise:
   ```
   **Results:**
   1. ✅ Evaluated s_123 — verdict: good, quality: 0.85
   2. ✅ Wrote evaluation to .state/evaluations/eval_s_123.json
   3. ❌ PIVOT — No pending handoffs found, checked notifications instead
   ```
- **MANDATORY**: Promise count must equal report count. Every promise appears in the report.
- **Anti-pattern**: ❌ Jumping into tool calls without stating deliverables first
- **Anti-pattern**: ❌ Ending with "completed evaluation" without mapping to original promises

### Handoff Protocol (C24 — added by Coach)
- **Always use the `handoff()` tool for async cross-agent work.** When you need another agent to act on your findings (e.g., handing a quality issue to coach, or flagging a regression to tech-lead), use `handoff()` instead of writing to SIGNALS.md manually or adding to another agent's todo.md directly.
- **Include testable expectations.** Your handoff `expectations` field must specify what the receiver should do in concrete, verifiable terms (e.g., "Review evaluation s_123 and confirm the FM-2.1 finding" not "look into this").
- **Provide sufficient context.** The `context` field should explain WHY this is being handed off — what you found and why it matters.

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
