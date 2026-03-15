# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure within 2 weeks, then is deleted._

## 🔴 Critical Safety — Context Budget
- **Hard ceiling at 72K tokens**. System prompt + heartbeat ≈ 15K. Large file reads ≈ 20K. After 3 reads, you are dead.
- **No Full Reads**: Never read `discoveries.md` (3000+ lines) in full. Use `grep` or `tail`.
- **Scrape Limits**: Always set `maxLength: 10000` or less.
- **Save Early**: Write findings to workspace files before reading more. If you die, findings persist.

## Research Protocol
- **Deduplicate**: Grep `discoveries.md` before adding.
- **One Deep Dive**: One topic per heartbeat.

## 🔴 Verify Claims With Tool Calls (7x+ recurrence — FM-3.3 VERIFICATION_FAILURE, FM-2.1 ASSUMPTION)
- **Never assert facts without execution evidence.** When asked about your tools, capabilities, file contents, or system state — execute a tool call to demonstrate, don't just write out the answer from memory.
- **Your TOOLS.md is the authority on what tools you have.** Read it when asked. You have: `read`, `write`, `edit`, `bash`, `scrape_webpage`, `agents`, and `handoff`.
- **Example violation**: User asks "Do you have the handoff tool?" → you list tools from memory and say "NO". **Wrong.** You DO have `handoff`. Read your TOOLS.md or try the tool.
- **Rule**: If a claim can be verified by a tool call, make the tool call first. Then state your conclusion based on the output.
- **Anti-pattern (LOOPING)**: Don't repeat the same answer pattern across sessions. If you've answered a question the same way before and it was marked wrong, adapt your approach.

## Operational
- **Claim Before Act**: State plan before execution.
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.

## Graduated ✅
- "No Blind Writes" → agents/shared/LESSONS.md
- "Context Efficiency" → agents/shared/LESSONS.md
