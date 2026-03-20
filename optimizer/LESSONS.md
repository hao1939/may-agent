# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure (heartbeat.md, TOOLS.md, DOMAIN.md) within 2 weeks, then is deleted._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

- **P53 Guard Recovery**: If bash returns "P53 Violation" for a command mentioning a protected file, switch IMMEDIATELY to `read()`. Do NOT retry similar bash commands.
- **Cross-Agent File Edits — Delegate to May**: Other agents' SOUL/DOMAIN/TOOLS/LESSONS and shared philosophy require delegation. Draft in workspace, send via `agents.send`.
- **Tool Argument Swap — bash vs read (C39, 20x+ sessions)**: You frequently swap the argument schemas between `bash` and `read`:
  - ❌ `bash({"path": "file.md"})` — bash takes `command`, not `path`
  - ❌ `read({"command": "git log"})` — read takes `path`, not `command`
  - ✅ `bash({"command": "git log"})` — correct
  - ✅ `read({"path": "file.md"})` — correct

- **Error Recovery — The Strategy Switch (FM-2.1, 17x sessions)**: When a tool call fails or is blocked, you MUST switch strategy on the very next attempt:
  1. **P53 bash block** → Switch to `read()` on known file paths. (Already above, reinforced here.)
  2. **ENOENT / path not found** → Use `bash({"command": "ls <parent-dir>"})` or `bash({"command": "find . -name '<filename>'"})` to discover the correct path. Do NOT guess another path.
  3. **EISDIR (read on a directory)** → Use `bash({"command": "ls <path>/"})` to list contents, then `read()` a specific file.
  4. **Same tool fails twice in a row** → STOP and switch approach entirely. Two failures = wrong strategy.
  5. **Permission block (WRITE BLOCKED)** → Draft in workspace, delegate via `agents({"action": "send", ...})`. Do NOT retry the edit.
- **FM-2.1 Sub-patterns (top 4 by frequency)**:
  1. `bash({})` / `read({})` / `agents({})` — empty args (8/17). Your model emits `{}` when uncertain. Pause and fill in the template from SOUL.md.
  2. `read({"path": "non/existent/file"})` — path guessing (4/17). Always `ls` or `find` first.
  3. `edit()` on files you can't write — wrong tooling (2/17). Check permissions mentally before editing.
  4. Claims without evidence — e.g., "Old vs New" tables without having read the file (3/17). Quote the source.

- **Verification Fallback Ladder (FM-3.3, 16x sessions)**: When your primary verification method fails or times out, do NOT skip verification. Walk this ladder:
  1. **Targeted test**: `npx vitest --run test/specific-file.test.ts` (NOT full suite — OOM risk)
  2. **Syntax check**: `node -c path/to/file.js` or `npx tsc --noEmit path/to/file.ts`
  3. **Read-back**: `read({"path": "changed-file", "offset": N, "limit": M})` targeting the changed lines
  4. **Existence check**: `bash({"command": "ls -la path/to/file && wc -l path/to/file"})`
  - You MUST complete at least one level of this ladder for every file you edit. No exceptions.
  - If level 1 times out → immediately try level 2. If level 2 fails → try level 3. Never stop at "it timed out."

- **Interleave Verification With Edits (FM-3.3, 16x sessions)**: Do NOT batch all edits then verify at the end.
  - After EACH `edit()` or `write()` call, run at least a read-back (ladder level 3) before the next edit.
  - This prevents the "ran out of turns before verification" failure mode.
  - Pattern: edit → read-back → edit → read-back → targeted test → done. NOT: edit → edit → edit → (oops, out of turns).

<!-- Graduated: Tool Precision→heartbeat, No Phantom Tools→TOOLS.md, No Idle Claims→heartbeat, Complete Heartbeat→heartbeat, Deliver→heartbeat, Always Verify→heartbeat, One Fix/Structural>Behavioral→SOUL.md, C40/C26/C23/C25/C22→shared/LESSONS.md -->
