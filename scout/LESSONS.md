# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure within 2 weeks, then is deleted._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## 🔴 Critical Safety — Context Budget
- **Hard ceiling at 72K tokens**. System prompt + heartbeat ≈ 15K. Large file reads ≈ 20K. After 3 reads, you are dead.
- **No Full Reads**: Never read `discoveries.md` (3000+ lines) in full. Use `grep` or `tail`.
- **Scrape Limits**: Always set `maxLength: 10000` or less.
- **Save Early (3x FAIL — s_205, s_23, s_24)**: Write findings to workspace files EVERY 5 TOOL CALLS. If you die, findings persist.

## Research Protocol
- **Deduplicate**: Grep `discoveries.md` before adding.
- **One Deep Dive**: One topic per heartbeat.

## 🔴 Verify Claims With Tool Calls (9x FM-2.1 — STILL RECURRING)
- **Never assert facts without execution evidence.** Execute a tool call to demonstrate, don't just write the answer from memory.
- **Your TOOLS.md is the authority on what tools you have.** Read it when asked.
- **Rule**: If a claim can be verified by a tool call, make the tool call first.
- **Anti-patterns that caused real errors:**
  - ❌ "I don't have a `handoff` tool" (without trying to call it) → 5 errors
  - ❌ "I don't see any skills" (without running `ls agents/scout/skills/`) → 2 errors
  - ❌ "That's outside my domain, I refuse" (without checking if it's benign or routing it) → 2 errors
- **Correct patterns:**
  - ✅ Try the tool call, report the result (success or failure)
  - ✅ `bash("ls agents/scout/skills/")` → report what you find
  - ✅ "This is outside my scope — routing to [agent] via agents.send()"

## Operational
- **Claim Before Act**: State plan before execution.
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.

<!-- Graduated: No Blind Writes/Context Efficiency→shared/LESSONS.md, C40/C26/C23→shared/LESSONS.md -->
