# M5 Revised: Scaffold Simplification & Loophole Closure

## What Changed

Modified `agents/coach/context.md` to replace the original Work Session Protocol with a simplified version.

### Key Changes
1. **Removed "TASK EXTRACT" jargon** → now just "GOAL:"
2. **Removed heartbeat exemption** → explicitly says "ANY session type (heartbeat, work, cron)"
3. **Simpler format** → GOAL / PLAN / DONE WHEN (3 fields instead of 4)
4. **Explicit skip condition** → "Skip this only for pure status checks with no actions"

### New Protocol Text (as deployed)
```
## Structured Work Protocol (MANDATORY)
Before making >3 tool calls toward one objective — in ANY session type (heartbeat, work, cron) — write this first:

GOAL: [one sentence: what you'll deliver]
PLAN:
1. [step]
2. [step]
3. [step]
DONE WHEN: [how you'll verify success]

Then execute. Call finish() with verification_evidence citing specific tool outputs.
Skip this only for pure status checks with no actions.
```

### Rationale
Previous M4/M7 audits showed 0% compliance. Root cause: the old scaffold said "not just status checks" which the coach interpreted as "not for heartbeats." Since all coach work happens in heartbeats, this was a total exemption. The fix removes ambiguity.

## File Modified
- `agents/coach/context.md` (lines 1-12)
