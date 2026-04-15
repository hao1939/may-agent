# LESSONS.md Cleanup Instructions
**Created**: 2026-03-17 by Optimizer | **For**: May to execute

## Context
Universal conventions (C26, C40, C24, C23, C25, C22) have been consolidated into `agents/shared/LESSONS.md` (3,307 bytes). This file is auto-loaded into ALL agents' system prompts (see `src/lib/manager.ts` line 349). Individual agent LESSONS.md files still contain duplicates of these conventions that must be removed.

## Task: Remove duplicated conventions from each agent's LESSONS.md

### What to remove from EACH agent's LESSONS.md:
1. **Any entry mentioning C26 or "Claim-as-Record"** — now in shared
2. **Any entry mentioning C40 or "Promise-Deliver-Report"** — now in shared
3. **Any entry mentioning C24 or "Handoff Protocol"** — now in shared
4. **Any entry mentioning C23 or "Escalation Protocol"** — now in shared
5. **Any entry mentioning C25 or "3-3-3"** — now in shared
6. **Any entry mentioning C22 or "Progress Tracking"** — now in shared
7. **Any entry mentioning SIGNALS.md** — that file no longer exists
8. **Any entry with ~~strikethrough~~** that says GRADUATED or OBSOLETE — already graduated, costs tokens
9. **Any entry mentioning C30 or "Safe File Appending"** — if it's just restating the shared rule

### What to KEEP in each agent's LESSONS.md:
- Agent-specific failure patterns (e.g., evaluator's Self-Reference Prevention)
- Agent-specific tool usage patterns (e.g., optimizer's Tool Argument Swap)
- Any lesson that references something unique to that agent's workflow
- If an entry references a shared convention but adds a UNIQUE agent-specific example, keep only the example (1-2 lines max), prefixed with "See shared C26. Agent-specific: ..."

### Target size: Each agent's LESSONS.md should be under 2,000 bytes after cleanup.

### Files to modify (in order of most bloated):
1. `agents/tech-lead/LESSONS.md` (12,013 bytes → target <2,000)
2. `agents/may/LESSONS.md` (10,358 bytes → target <2,000)
3. `agents/bob/LESSONS.md` (8,939 bytes → target <2,000)
4. `agents/optimizer/LESSONS.md` (6,771 bytes → target <2,000)
5. `agents/evaluator/LESSONS.md` (6,622 bytes → target <2,000)
6. `agents/amy/LESSONS.md` (5,602 bytes → target <2,000)
7. `agents/scout/LESSONS.md` (4,721 bytes → target <2,000)
8. `agents/amy-kimi/LESSONS.md` (4,026 bytes → target <2,000)
9. `agents/coach/LESSONS.md` (3,392 bytes → target <2,000)
10. `agents/coder/LESSONS.md` (2,114 bytes → target <2,000)
11. `agents/master/LESSONS.md` (1,387 bytes — already OK, just clean dead refs)
12. `agents/qa/LESSONS.md` (729 bytes — model agent, likely OK)

### Verification:
After each file edit, run: `wc -c agents/<name>/LESSONS.md` to confirm under 2,000 bytes.
After all edits, run: `wc -c agents/*/LESSONS.md agents/shared/LESSONS.md` to show totals.

### DO NOT modify:
- `agents/shared/LESSONS.md` (just updated by Optimizer)
- Any SOUL.md, DOMAIN.md, or TOOLS.md files
