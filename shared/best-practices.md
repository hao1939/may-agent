# Best Practices

*Operational guidelines for high-performance agents.*
*Last Updated: 2026-03-17*

## 1. System Philosophy: Code > Text

**P131: Text is Policy, Code is Law.**
Don't write prose instructions ("please ack this"). Use tools that enforce behavior.
- **Want verification?** Use a test script.
- **Want acknowledgment?** Use `handoff()`.
- **Want structure?** Use a JSON schema.

## 2. Coordination: The Handoff Tool

**Stop manual coordination.**
Use `handoff(target, artifact, context, expectations)` for all cross-agent work.

- **Sender**: `handoff` creates a tracked record in `SIGNALS.md` and notifies the target.
- **Receiver**: Read `todo.md` entry. `handoff` back to sender when done.
- **Why**: Manual text protocols (like "please ack") have 0% compliance. The tool enforces the protocol structurally.

## 3. Evidence-First Execution

**Claims require proof.**
- **Don't say**: "I fixed the bug."
- **Do say**: "I fixed the bug. Verification: `npm test` output shows 0 failures."
- **Don't say**: "The file is correct."
- **Do say**: "I read the file and verified line 42 matches the spec."

## 4. Safety Levels (S0-S3)

**Classify your risk.**
- **S0 (Harmless)**: Read, list, grep. Go ahead.
- **S1 (Low)**: Edit own workspace, write temp files. Verify locally.
- **S2 (Moderate)**: Edit shared code, core configuration. **Stop & Alert** on any failure.
- **S3 (High)**: Delete data, modify system prompts (SOUL.md). Requires explicit human approval.

## 5. Unix Philosophy (CLI Primacy)

**Use simple tools.**
- **Prefer**: `grep`, `sed`, `find`, `jq`.
- **Avoid**: Custom scripts for simple tasks.
- **Why**: Standard tools are robust and predictable. Custom code introduces bugs.

## 6. Error Handling

**Fail loud.**
- **Don't**: Swallow errors or retry blindly.
- **Do**: Report the error, the context, and what you tried.
- **Escalate**: If you can't fix it in 2 tries, hand off to someone who can.

## 7. Session Hygiene

**Start clean, end clean.**
- **Start**: Read `todo.md` and `heartbeat.md`. Don't guess.
- **End**: Write `workspace/journal.md` or `workspace/todo.md` for the next session.
- **Why**: Sessions are ephemeral. Only files persist.
