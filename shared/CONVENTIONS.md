# Conventions

*Mandatory protocols for all agents. Failure to follow these is a Performance Failure.*
*Source: `agents/shared/CONVENTIONS.md` (Canonical Registry)*

## Registry

<!-- CONVENTION_REGISTRY_START -->
| Code | Name | Rule | Check | Enforcement |
|------|------|------|-------|-------------|
| C1.1 | read-before-edit | read() before edit() | mechanical | injection + handler |
| C1.2 | complete-reads | Use offset for truncated reads | mechanical | injection |
| C1.3 | verify-writes | read() after edit()/write() | mechanical | injection + handler |
| C1.4 | finish-clearly | Last action must be finish() | mechanical | injection + handler |
| C1.7 | verification-evidence | Verify before finish(success) | mechanical | handler |
| C2.1 | precise-args | Don't hallucinate tool arguments | mechanical | handler |
| C2.2 | check-exit-codes | Verify bash exit codes | llm-judge | gym |
| C2.3 | no-interactive | No nano/vim/less | mechanical | handler |
| C3.1 | filesystem-truth | Persist important data to files | llm-judge | gym |
| C3.2 | workspace-isolation | Work in agents/[name]/workspace/ | mechanical | handler |
| C3.3 | safe-append | No write() on append-only files | mechanical | handler |
| C4.1 | sync-async | Use call() vs send() correctly | llm-judge | gym |
| C4.2 | handoff-protocol | Write artifact, then send() with path | llm-judge | gym |
| C4.3 | escalation-ladder | Self-fix → peer → supervisor → human | llm-judge | gym |
| C5.1 | claim-equals-proof | Claims backed by tool output | llm-judge | gym + handler |
| C5.2 | quote-sources | Cite line numbers and file paths | llm-judge | gym |
| C5.3 | no-guessing | Say "I can't see it" instead of guessing | llm-judge | gym |
| C6.1 | budget-awareness | Use grep, not 100 reads | mechanical | handler |
| C6.2 | clean-up | Delete temp files | mechanical | handler |
| C6.3 | scope-control | Don't over-refactor | llm-judge | gym |
| C6.4 | no-noise | Every output needs a consumer | llm-judge | gym |
| C6.5 | kv-cache | No volatile data in prompt prefix | infra | code |
| C7.1 | root-is-app | /app is root, no /home or ~ | mechanical | handler |
| C7.2 | no-cd-home | No cd /home or cd ~/ | mechanical | handler |
| C7.3 | relative-paths | Use relative or /app/ paths | mechanical | handler |
| C8.1 | plan-before-acting | State approach before tool calls | llm-judge | gym |
| C8.2 | promise-deliver-report | Promise → Deliver → Report pattern | mechanical | handler |
| C8.3 | one-thing-at-a-time | Small scope, verify between steps | llm-judge | gym |
| C9.1 | fail-gracefully | Handle errors, try alternatives | llm-judge | gym |
| C9.2 | dont-repeat | Different approach after failure | mechanical | handler |
| C9.3 | know-when-to-stop | Escalate after 5+ stuck turns | mechanical | handler |
| C9.4 | escalation-has-content | What/why/tried/need in escalation | llm-judge | gym |
| C10.1 | read-before-asking | Check docs before asking | llm-judge | gym |
| C10.2 | ask-with-context | Include what/tried/stuck/need | llm-judge | gym |
| C10.3 | share-learnings | Write discoveries to workspace | llm-judge | gym |
| C11.1 | safety-levels | Classify risk S0-S3 | llm-judge | gym |
| C11.2 | dont-lie | No false claims | llm-judge | gym |
| C11.3 | dont-fabricate | No invented data | llm-judge | gym |
| C11.4 | errors-are-information | Report errors accurately | llm-judge | gym |
| C12.1 | session-start | Read heartbeat.md first | mechanical | handler |
| C12.2 | session-end | finish() as last action | mechanical | handler |
| C12.3 | session-persist | Write journal before finish() | mechanical | handler |
| C13.1 | commit-own-work | git add <files> && git commit | mechanical | handler |
| C13.2 | only-commit-yours | Never git add -A | mechanical | handler |
| C13.3 | message-quality | Meaningful commit messages | llm-judge | gym |
<!-- CONVENTION_REGISTRY_END -->

## C1. Input/Output
1. **Always Read First**: Never assume file contents. `read()` before `edit()`.
2. **One Read at a Time**: Truncated reads are fatal. Use `offset` to get the rest.
3. **Success Requires Evidence**: Before calling `finish(success)`, run at least one verification command (grep, ls, test, read) to confirm your work is correct.
4. **Verify Writes**: After `edit()`/`write()`, `read()` the file to confirm success. "Successfully updated" without verification is a lie.
5. **Finish Clearly**: Your LAST action in a session must be `finish(status, result)`. Raw text "I'm done" is insufficient. Use `completed_items` to mark tasks done.

## C2. Tool Usage
1. **Precise Arguments**: Check tool definitions. Don't hallucinate arguments.
2. **Check Exit Codes**: `bash` output can be silent failure. Check `$?`.
3. **No Interactive Commands**: `nano`, `vim`, `less` hang the system. Use `edit`, `read`.
4. **No Chain Loading**: `read({ path: "x" })` is one call. `edit({ ... })` is another.

## C3. State Management
1. **Filesystem is Truth**: Memory is ephemeral. Persist important data to files.
2. **Workspace Isolation**: Work in `agents/[name]/workspace/`. Don't litter root.
3. **Safe Append**: Never `write()` to an append-only file (like logs or journals) — it overwrites the whole file. Use `edit()` with `oldText` targeting the end, or `bash` with `>>`.

## C4. Collaboration
1. **Sync vs Async**:
   - `agents.call(target, task)`: Blocking. Use for immediate answers.
   - `agents.send(target, message)`: Async. Use for handing off work.
2. **Handoff Protocol**:
   - Write the artifact (brief, code, doc) to a file.
   - `agents.send(target, "Task description. Artifact: path/to/file")`.
   - Never paste full file content in the message.
3. **Escalation**:
   - Self-fix (2 retries).
   - Peer consult (`call`).
   - Supervisor report (`send` to May).

## C5. Evidence
1. **Claim = Proof**: "Tests passed" must be backed by `bash` output in transcript.
2. **Quote Sources**: When synthesizing, quote the line numbers or file paths.
3. **No Guessing**: If you can't see it, say "I can't see it." Don't hallucinate.

## C6. Resource Hygiene
1. **Budget Awareness**: Don't read 100 files to find one line. Use `grep`.
2. **Clean Up**: Delete temp files (`rm`) before finishing.
3. **Scope Control**: Don't refactor the whole system when asked to fix a typo.
4. **No Noise**: Don't write lengthy reports nobody reads. Every output should have a consumer.
5. **KV-Cache Discipline**: No volatile data (timestamps, heartbeats) in the system prompt prefix.

## C7. Environment (P13)
1. **Root is `/app`**: The system runs at `/app`. This is the only root. There is no `/home`, no `~`, no `/Users`.
2. **No `cd`**: Never prefix bash commands with `cd /home/...` or `cd ~/...`. Your cwd is always `/app`.
3. **Paths**: Use relative paths or absolute `/app/...` paths. All project files are under `/app`.

## C8. Execution Pattern
1. **Plan Before Acting**: State your approach in 2-3 steps before making tool calls.
2. **Promise-Deliver-Report**: Promise deliverables, execute them, report results.
3. **One Thing at a Time**: Don't try to fix 5 things in one session. Do one, verify, then the next.

## C9. Resilience
1. **Fail Gracefully**: If a tool call fails, don't stop. Understand the error, try a different approach.
2. **Don't Repeat Yourself**: If you tried something and it failed, don't try the exact same thing again.
3. **Know When to Stop**: If you've been stuck for 5+ turns on the same problem, escalate.
4. **Escalation Content**: Provide what/why/tried/need context, not just "I'm stuck".

## C10. Getting Help
1. **Read Before Asking**: Check workspace files and knowledge before asking.
2. **Ask with Context**: Provide what/tried/stuck/need.
3. **Share Learnings**: Write discoveries to workspace files.

## C11. Integrity (Safety Levels)
1. **Safety Levels**:
   - **S0 (Harmless)**: Read, list, grep. Go ahead.
   - **S1 (Low)**: Edit own workspace, write temp files. Verify locally.
   - **S2 (Moderate)**: Edit shared code, core configuration. **Stop & Alert** on any failure.
   - **S3 (High)**: Delete data, modify system prompts (SOUL.md). Requires explicit human approval.
2. **Don't Lie**: No false claims about verification.
3. **Don't Fabricate**: No invented data or tool outputs.
4. **Errors are Information**: Report errors accurately, don't hide them.

## C12. Session Lifecycle
1. **Start**: Read `heartbeat.md` first. Pending tasks are injected.
2. **End**: `finish()` as the last action.
3. **Persist**: Write `journal.md` before finishing.

## C13. Git Discipline
1. **Commit Your Own Work**: `git add <files> && git commit` before finishing.
2. **Only Commit Your Files**: Never `git add -A`.
3. **Message Quality**: Meaningful messages (feat/fix/chore).
