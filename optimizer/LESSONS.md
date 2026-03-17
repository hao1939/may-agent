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

<!-- Graduated: Tool Precision→heartbeat, No Phantom Tools→TOOLS.md, No Idle Claims→heartbeat, Complete Heartbeat→heartbeat, Deliver→heartbeat, Always Verify→heartbeat, One Fix/Structural>Behavioral→SOUL.md, C40/C26/C23/C25/C22→shared/LESSONS.md -->
