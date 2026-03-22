# Agent Common Sense

*Owners: Coach (behavioral) + Bob (infrastructure). Maintained collaboratively.*
*Source: `agents/shared/common-sense.md` (Agent-Facing Injection)*
*Registry: `agents/shared/CONVENTIONS.md` (Canonical)*

## What This Document Is

This defines what every agent should "just know" to be a functional team member.
The goal: if you dropped a brand new agent into this system with zero training, it should be able to contribute useful work by following these fundamentals.

---

## 1. Input/Output (C1)

### 1.1 Read Before Edit (C1.1)
Never assume file contents. Always `read()` a file before you `edit()` it.

### 1.2 One Read at a Time (C1.2)
Truncated reads are fatal. If a read is truncated, use `offset` to get the rest. Never write to a file based on a partial read.

### 1.3 Verify Writes (C1.3)
After every significant action (file edit, command, config change), verify it worked. Read the file back. Run the test. Check the output. "Successfully updated" without verification is a lie.

### 1.5 No Ghost Deliverables (C1.5)
Never list a file in `deliverables` (finish) or `artifact` (send) unless you have verified it exists on disk in **this** session.
- **Bad**: `finish(deliverables: ["report.md"])` (when report.md was never written)
- **Good**: `write("report.md")` -> `read("report.md")` -> `finish(deliverables: ["report.md"])`
- **Why**: "I thought I wrote it" is the #1 cause of task failure. Prove it exists first.

### 1.6 Finish Clearly (C1.4)
Your LAST action in a session must be `finish(status, result)`. Raw text "I'm done" is insufficient. Use `completed_items` to mark tasks done and `new_items` to self-assign future work.

---

## 2. Tool Usage (C2)

### 2.1 Precise Arguments (C2.1)
Check tool definitions. Don't hallucinate arguments. Use the exact schema provided.

### 2.2 Check Exit Codes (C2.2)
`bash` output can be silent failure. Always check `$?` or look for error messages in the output.

### 2.3 No Interactive Commands (C2.3)
`nano`, `vim`, `less` hang the system. Use `edit()` and `read()` instead.

---

## 3. State Management (C3)

### 3.1 Filesystem is Truth (C3.1)
Memory is ephemeral. Persist important data to files. If you don't write it down, it didn't happen.

### 3.2 Workspace Isolation (C3.2)
Work in `agents/[name]/workspace/`. Don't litter the root. Move completed task files to `archive/` to keep context clean.

### 3.3 Safe Append (C3.3)
Never `write()` to an append-only file (like logs or journals) — it overwrites the whole file. Use `edit()` with `oldText` targeting the end, or `bash` with `>>`.

### 3.4 Context Pruning (C3.4)
*Owner: Coach*
Don't let your workspace become a landfill. When a task is done, move the artifacts to `workspace/archive/`.
- **Prefer Archive over Delete**: Use `mv file.md archive/` instead of `rm file.md`. You might need that context later.
- **Pattern**: `mkdir -p workspace/archive` -> `mv workspace/*.done workspace/archive/`.

---

## 4. Collaboration (C4)

### 4.1 Sync vs Async (C4.1)
- `agents.call(target, task)`: Blocking. Use for immediate answers.
- `agents.send(target, message)`: Async. Use for handing off work.
  - `send()` auto-deduplicates: if an identical active request exists, the send is skipped. Use `force: true` to override.

### 4.2 Handoff Protocol (C4.2)
Write the artifact (brief, code, doc) to a file first. Then `agents.send(target, "Task description. Artifact: path/to/file")`. Never paste full file content in the message.

### 4.3 Escalation (C4.3)
1. Self-fix (2 retries).
2. Peer consult (`call`).
3. Supervisor report (`send` to May).
4. Human escalation (`[HUMAN-NEEDED]`).

---

## 5. Evidence (C5)

### 5.1 Claim = Proof (C5.1)
"Tests passed" must be backed by `bash` output in the transcript. "File looks correct" must be backed by `read` output.

### 5.2 Quote Sources (C5.2)
When synthesizing, quote the line numbers or file paths.

### 5.3 No Guessing (C5.3)
If you can't see it, say "I can't see it." Don't hallucinate file contents or system state.

---

## 6. Resource Hygiene (C6)

### 6.1 Budget Awareness (C6.1)
Don't read 100 files to find one line. Use `grep`. Check opBudget regularly. If <20%, stop exploring and wrap up.

### 6.2 Clean Up (C6.2)
Delete temp files (`rm`) before finishing.

### 6.3 KV-Cache Discipline (C6.5)
No volatile data (timestamps, heartbeats) in the system prompt prefix. Static context first, dynamic context last.

---

## 7. Environment (C7, P13)

### 7.1 Root is `/app` (C7.1)
The system runs at `/app`. This is the only root. There is no `/home`, no `~`, no `/Users`.

### 7.2 No `cd` (C7.2)
Never prefix bash commands with `cd /home/...` or `cd ~/...`. Your cwd is always `/app`.

### 7.3 Paths (C7.3)
Use relative paths or absolute `/app/...` paths. All project files are under `/app`.

---

## 8. Execution Pattern (C8)

### 8.1 Plan Before Acting (C8.1)
State your approach in 2-3 steps before making tool calls. If the approach is wrong, you (or the caller) can catch it early.

### 8.2 Promise-Deliver-Report (C8.2)
1. **Promise**: You may use read-only tools (`read`, `grep`, `ls`) to gather context first. Then, **BEFORE any state-changing action** (`write`, `edit`, `bash` execution), you must state numbered deliverables:
   "**This heartbeat I will:** 1. ... 2. ..."
2. **Deliver**: Execute each promised item.
3. **Report**: End with numbered results matching each promise (✅/❌).

### 8.3 One Thing at a Time (C8.3)
Don't try to fix 5 things in one session. Do one, verify, then the next. Small scope = reliable results.

---

## 9. Resilience (C9)

### 9.1 Fail Gracefully (C9.1)
If a tool call fails, don't stop. Understand the error, try a different approach.

### 9.2 Don't Repeat Yourself (C9.2)
If you tried something and it failed, don't try the exact same thing again. Change your approach.

### 9.3 Know When to Stop (C9.3)
If you've been stuck for 5+ turns on the same problem, you won't solve it by trying harder. Escalate with context.

### 9.4 Escalation Content (C9.4)
"I'm blocked" is useless. "I'm blocked on X because Y. I tried A and B. I think the issue is C." That's actionable.

---

## 10. Getting Help (C10)

### 10.1 Read Before Asking (C10.1)
Check workspace files, knowledge files, shared docs, and the codebase before saying "I don't know how."

### 10.2 Ask with Context (C10.2)
When requesting help, provide: what you're trying to do, what you've tried, where you're stuck, and what specific help you need.

### 10.3 Share Learnings (C10.3)
If you discover something useful, write it to your workspace or shared knowledge. The next session will benefit.

---

## 11. Integrity (C11)

### 11.1 Safety Levels (C11.1)
- **S0 (Harmless)**: Read, list, grep.
- **S1 (Low)**: Edit own workspace.
- **S2 (Moderate)**: Edit shared code. Stop & Alert on failure.
- **S3 (High)**: Delete data, modify system prompts. Requires human approval.

### 11.2 Don't Lie (C11.2)
If you didn't run the test, don't say "tests pass." If you didn't read the file, don't describe its contents.

### 11.3 Don't Fabricate (C11.3)
No invented metrics, no hallucinated file contents, no made-up error messages. Everything you claim must be backed by a tool call in your transcript.

### 11.4 Errors are Information (C11.4)
An error isn't a failure — it's data. Report it accurately. Don't hide errors, don't minimize them.

---

## 12. Session Lifecycle (C12)

### 12.1 Start (C12.1)
Read `heartbeat.md` first. Pending tasks are injected automatically.

### 12.2 End (C12.2)
`finish()` as the last action.

### 12.3 Persist (C12.3)
Write `workspace/journal.md` before calling `finish()`.

---

## 13. Git Discipline (C13)

### 13.1 Commit Your Own Work (C13.1)
Before calling `finish()`, commit the files you changed in this session to the agents/ git repo. Group related changes into one commit with a meaningful message.

```bash
cd /app/agents && git add <specific-files-you-changed> && git commit -m "<type>: <what you did and why>"
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`. Example: `feat: add error-recovery gym scenario` or `chore: archive stale workspace files`.

### 13.2 Only Commit Your Files (C13.2)
Only `git add` files you actually modified. Never `git add -A` or `git add .` — that sweeps up other agents' uncommitted work.

### 13.3 Message Quality (C13.3)
Bad: `auto: 5 files changed`. Good: `coach: add growth-cycle experiment results`. The message should tell a future reader *what* changed and *why* without looking at the diff.

### 13.4 Not Required for All Agents (C13.4)
If you're unsure about git or your changes are minor (journal updates, periodic-tasks rotation), it's fine to skip. A safety-net process will commit orphaned changes periodically. But if you made something meaningful — a new skill, a config change, a design doc — commit it yourself.
