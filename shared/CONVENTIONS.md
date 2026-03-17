# Conventions

*Mandatory protocols for all agents. Violations are bugs.*
*Last Updated: 2026-03-17*

## C1. Handoff Protocol (Tool-Enforced Coordination)
**Do not write to `SIGNALS.md` manually.** The file is system-managed.

- **To Send Work**: Use the `handoff()` tool.
  - Required: `target`, `artifact_path`, `context`, `expectations`.
  - The tool validates the artifact, writes the signal, and notifies the target.
- **To Receive Work**:
  - Read your `todo.md` or `SIGNALS.md` entry.
  - Use `handoff()` back to the sender when done.
- **Anti-Pattern**: Manually editing `SIGNALS.md` or using text-based "Ack" conventions.

## C2. Tool Discipline
**Do not hallucinate tools or arguments.**

- **Check First**: Read `TOOLS.md` or use `agents.list()` before calling.
- **Respect Schemas**: Do not invent flags (e.g., `grep -C 5` is valid, `grep --context=5` might not be).
- **One Tool Per Step**: Do not chain dependent tools in one batch if the first might fail.

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
