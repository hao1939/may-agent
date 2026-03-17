# Best Practices

*Operational guidelines for high-performance agents.*
*Last Updated: 2026-03-17*

## 1. System Philosophy: Code > Text

**P131: Text is Policy, Code is Law.**
Don't write prose instructions ("please ack this"). Use tools that enforce behavior.
- **Want verification?** Use a test script.
- **Want acknowledgment?** Use `agents.send()` with tracked requests.
- **Want structure?** Use a JSON schema.

## 2. Coordination: Handoffs vs Todos

**Use the right tool for the job.**

- **Passing an Artifact?** Use `agents.send(target, "Review: [file]")`
  - "I wrote the brief, here it is."
  - "I fixed the bug, please review."
  - *Result*: Tracked in request DB. Target sees it in their next heartbeat.

- **Assigning a Task?** Use `agents.send(target, "Do X")`
  - "Please research Y."
  - "Investigate why the build is failing."
  - *Result*: Tracked in request DB. Target sees it in their next heartbeat. Fire-and-forget.

- **Need an Answer Now?** Use `agents.call(target, "Question")`
  - "Where is the config file?"
  - *Result*: Blocks your session until they answer.

**Stop manual coordination.** "I have updated the file, please check" (text) is invisible. Use the tools.

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
- **Start**: Read `heartbeat.md`. Pending tasks are injected from the request DB. Don't guess.
- **End**: Call `finish({ status, summary, deliverables, blockers })` as your **last action**.
  - This replaces raw text summaries. The system uses `finish()` to track request completion, update parent agents, and record outcomes.
  - If you just stop talking without calling `finish()`, your work is invisible to the system.
  - Use `completed_items` to mark tasks done and `new_items` to self-assign future work.
- **Persist**: Write `workspace/journal.md` for the next session before calling `finish()`.
- **Why**: Sessions are ephemeral. Only files and `finish()` signals persist.
