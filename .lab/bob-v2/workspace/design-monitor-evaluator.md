# Design Review: Monitor-Evaluator Pattern (Wink)

### Context
Recent research (Wink, arXiv 2602.17037) and our own analysis (MAST, Ralph Loop) suggest that a "Watcher" or "Monitor" agent is critical for reliability.
Currently, our Evaluator only runs *after* a session (Post-Hoc).
To catch "Overthinking Loops" (arXiv 2602.14798) and "Specification Drift" (Wink), we need a **Runtime Monitor**.

### Proposal: The `monitor` Agent (or Role)
A lightweight loop that watches active sessions and intervenes if they drift.

**Responsibilities:**
1. **Loop Detection**: Is the agent repeating the same tool call with the same args? (P68 Iteration Cap)
2. **Drift Detection**: Is the agent doing work unrelated to the user's prompt? (P7 Specification Drift)
3. **Stall Detection**: Is the agent stuck in a "thinking" loop without tool calls?

**Mechanism:**
- **Passive**: Reads `.state/sessions/<id>/session.jsonl` (tail).
- **Active**: If drift detected → Writes to `<id>/inbox.md` (Intervention).
  - "You seem to be looping on X. Stop and reflect."
  - "You are drifting from the goal. The goal is Y."

### Alignment
- **Aligned with P66 (RTTP)**: Reflection-in-Action.
- **Aligned with P6 (No Silent Failures)**: Escalate structurally.
- **Aligned with P69 (External Grounding)**: The monitor is outside the agent's context loop.

### Recommendation
- **Phase 1**: Add a `monitor` skill to Evaluator.
- **Phase 2**: Create a `cron:monitor` task that checks all active sessions every 5 minutes.
- **Phase 3**: If high value, promote to a dedicated `monitor` agent.

### Action
- Create `agents/evaluator/skills/monitor-session.md`.
- Brief Tech-Lead on the "Wink Pattern".
