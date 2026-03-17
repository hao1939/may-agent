# Conventions

*Mandatory protocols for all agents. Violations are bugs.*
*Last Updated: 2026-03-17*

## C1. Coordination Protocol (Tool-Enforced)
**Use the right tool. Text is invisible.**

- **Passing Artifacts / Assigning Tasks**: Use `agents.send(target, "Review file X / Do Y")`
  - Tracked in request DB. Target sees it in their next heartbeat. Fire-and-forget.
  - For artifact handoffs, write the file first, then send with the file path in the message.
- **Blocking Questions**: Use `agents.call(target, "Question")`
  - Blocks until answered.
- **Completing Work**: Use `finish({ status: "success"|"failure"|"blocked", summary: "...", deliverables: [...], blockers: [...] })`
  - **Mandatory** as the final action of every session. Raw text endings are deprecated.
  - `status`: "success", "failure", or "blocked".
  - `summary`: What you did.
  - `deliverables`: Files you created or modified (verified to exist on disk).
  - `blockers`: Required when status is "blocked" — what's blocking and who can unblock.
- **Anti-Pattern**: "I have updated the file, please check" (Manual text is invisible).

## C2. Tool Discipline
**Respect the Interface.**

- **Check First**: Read `TOOLS.md` or use `agents.list()` before calling.
- **No Hallucinations**: Do not invent flags (e.g., `grep --context` vs `grep -C`).
- **Use `finish()`**: End every session with `finish({ status, summary, ... })`. Do not just stop talking.

## C3. Verification First
**Trust but verify.**

- **Read Before Write**: Never overwrite a file without reading it first.
- **Verify After Write**: Always read back your edit or run a test to confirm it worked.
- **No Blind Assumptions**: Do not assume a file exists or has specific content. Check.

## C4. Evidence Discipline (Claim-as-Record)
**Every claim must be backed by a tool call in the current session.**

- **Citation**: "I fixed the bug" is invalid. "I fixed the bug, verified by `npm test` output in step 3" is valid.
- **State**: "The file is empty" is invalid. "The `read` output shows the file is empty" is valid.
- **No Memory**: Do not rely on memory of previous sessions. If you didn't read it *this* session, you don't know it.

## C5. Path Safety
**Stay within bounds.**

- **Root**: Project root is `/app`. Use relative paths or `/app/...`.
- **No Home**: Do not access `/home/`, `/Users/`, or `~/`. They do not exist.
- **Workspace**: Use your agent's `workspace/` for temporary files.

## C6. Error Handling
**No silent failures.**

- **Report**: If a tool fails, report it. Do not pretend it worked.
- **Retry Smart**: If blocked, change approach. Do not retry the exact same failing call.
- **Escalate**: If you can't fix it, hand off to an agent who can (or to human).
