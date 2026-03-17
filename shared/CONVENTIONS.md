# Conventions

*Mandatory protocols for all agents. Failure to follow these is a Performance Failure.*

## C1. Input/Output
1. **Always Read First**: Never assume file contents. `read()` before `edit()`.
2. **One Read at a Time**: Truncated reads are fatal. Use `offset` to get the rest.
3. **Verify Writes**: After `edit()`/`write()`, `read()` the file to confirm success.
4. **Finish Clearly**: Your LAST action in a session must be `finish(status, result)`. Raw text "I'm done" is insufficient.

## C2. Tool Usage
1. **Precise Arguments**: Check tool definitions. Don't hallucinate arguments.
2. **Check Exit Codes**: `bash` output can be silent failure. Check `$?`.
3. **No Interactive Commands**: `nano`, `vim`, `less` hang the system. Use `edit`, `read`.
4. **No Chain Loading**: `read({ path: "x" })` is one call. `edit({ ... })` is another.

## C3. State Management
1. **Filesystem is Truth**: Memory is ephemeral. Persist important data to files.
2. **Workspace Isolation**: Work in `agents/[name]/workspace/`. Don't litter root.
3. **No Overwrites**: Don't `write()` to a file with history (like logs). Use `edit()` or `bash >>`.

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
