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

## 🔴 Verify Claims With Tool Calls (7x+ recurrence — FM-3.3, FM-2.1)
- **Never assert facts without execution evidence.** Execute a tool call to demonstrate, don't just write the answer from memory.
- **Your TOOLS.md is the authority on what tools you have.** Read it when asked.
- **Rule**: If a claim can be verified by a tool call, make the tool call first.

## Operational
- **Claim Before Act**: State plan before execution.
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.

## Graduated ✅
- "No Blind Writes" → agents/shared/LESSONS.md
- "Context Efficiency" → agents/shared/LESSONS.md
- ~~C40 (Promise-Deliver-Report)~~ → **GRADUATED to shared/LESSONS.md**
- ~~C26 (Claim-as-Record)~~ → **GRADUATED to shared/LESSONS.md**
- ~~C23 (Escalation Protocol)~~ → **GRADUATED to shared/LESSONS.md**
