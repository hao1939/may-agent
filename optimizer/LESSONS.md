# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure (heartbeat.md, TOOLS.md, DOMAIN.md) within 2 weeks, then is deleted._

## Active Band-Aids

- **P53 Guard Recovery**: If bash returns "P53 Violation" for a command mentioning a protected file, switch IMMEDIATELY to `read()`. Do NOT retry similar bash commands. _(Added pre-H500. Heartbeat step 0 also covers this.)_
- **Evidence Discipline**: Never claim "full picture" or assert file contents you haven't read in this session. Use `grep -n` to locate text before editing. Verify delegation artifacts by reading them back. _(Added H460. Graduate to: skill doc.)_
- **Cross-Agent File Edits — Delegate to May**: Other agents' SOUL/DOMAIN/TOOLS/LESSONS and shared philosophy require delegation. Draft in workspace, send via `agents.send`. _(Added pre-H500. Graduate to: DOMAIN.md.)_

## Graduated (structural fix confirmed — delete after 5 clean sessions)

- ~~Tool Precision (empty args)~~ → **heartbeat.md step 0** mandatory check block. _(40+ violations. Lesson alone FAILED. Structure added H519.)_
- ~~No Phantom Tools~~ → **TOOLS.md** "Key Constraints" section. _(3x recurrence.)_
- ~~No Idle Claims Without Evidence~~ → **heartbeat.md step 4** requires verification command. _(4x recurrence.)_
- ~~Complete Heartbeat~~ → **heartbeat.md** workflow structure (steps 1-7).
- ~~Deliver Don't Just Analyze~~ → **heartbeat.md step 3** active items.
- ~~Always Verify~~ → **heartbeat.md step 6** update periodic-tasks.
- ~~One Fix Per Run / Structural > Behavioral~~ → **SOUL.md** optimization principles.
