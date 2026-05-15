# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure (heartbeat.md, TOOLS.md, DOMAIN.md) within 2 weeks, then is deleted._

**Shared conventions (C22–C40) are in `shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

- **FM-2.4: Error Chain Recovery (6x in 7d, 2026-03-21)**: When a tool call fails, you MUST switch strategy immediately — never retry the same approach:
  - Tool returns "not found" or schema error → STOP. Check TOOLS.md for available tools. Do NOT invent tools.
  - `bash` command exits non-zero → Read the error. If path-related, use `find` or `ls` to discover correct path before retrying.
  - Same tool fails twice in a row → Switch to a completely different approach (e.g., `bash` → `read`, command-line → API).
  - ❌ Calling `scrape_webpage`, `discard_agent`, or any tool not in your TOOLS.md
  - ❌ Retrying `ls path/*` after it exits non-zero without fixing the glob/path
  - ✅ After ANY failure: state what went wrong, pick a different tool/path, then proceed
- **Cross-Agent File Edits — Delegate to May**: Other agents' SOUL/DOMAIN/TOOLS/LESSONS and shared philosophy require delegation. Draft in workspace, send via `agents.message`.
- **FM-2.6: No Claims Without Evidence (8x in 7d, 2026-03-20)**: You repeatedly assert file contents, diff states, or completion status without transcript-visible evidence. Three anti-patterns:
  - ❌ "P117 already exists" after reading only an offset slice that didn't contain P117
  - ❌ "I have a full picture" after two truncated reads with no grep
  - ❌ Claiming diffs in `src/lib/evaluator.ts` with no edit/write call in transcript
  - ✅ Use `grep -n "P117" file.md` to confirm before asserting. If truncated, say "I only saw lines X-Y."
- **Tool Argument Swap — bash vs read (C39, 20x+ sessions)**: You frequently swap the argument schemas between `bash` and `read`:
  - ❌ `bash({"path": "file.md"})` — bash takes `command`, not `path`
  - ❌ `read({"command": "git log"})` — read takes `path`, not `command`
  - ✅ `bash({"command": "git log"})` — correct
  - ✅ `read({"path": "file.md"})` — correct

<!-- Graduated: Tool Precision→heartbeat, No Phantom Tools→TOOLS.md, No Idle Claims→heartbeat, Complete Heartbeat→heartbeat, Deliver→heartbeat, Always Verify→heartbeat, One Fix/Structural>Behavioral→SOUL.md, C40/C26/C23/C25/C22→shared/LESSONS.md -->
