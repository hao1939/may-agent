# Finding: Scout Pilot Already Implemented at Framework Level

**Date**: 2026-03-24
**Request**: req:0de8f770 (task 2: Scout Prompt Pilot)
**Brief**: agents/bob/workspace/brief-scout-prompt-pilot.md

## Summary

The "Slim Scout" experiment proposed creating `agent.slim.json` to validate that a stripped-down system prompt (SOUL + common-sense + tools only) improves instruction adherence. However, **this simplification is already the production default for ALL agents**.

## Evidence

In `src/lib/manager.ts` lines 354-365, the system prompt builder explicitly states:

```
// Files NO LONGER loaded (removed as part of prompt simplification):
//   DOMAIN.md — merged into SOUL.md or moved to knowledge/
//   TOOLS.md — redundant with tool schema descriptions
//   LESSONS.md — proven lessons promoted to SOUL.md or common-sense.md
//   shared/LESSONS.md — same
//   knowledge/INDEX.md — agent reads on-demand, not preloaded
//   shared/INDEX.md — same
```

The system prompt now loads exactly:
1. `SOUL.md` — agent identity, role, methodology, skills
2. `common-sense.md` — shared behavioral rules
3. Generated runtime sections (environment, tools list)

This matches the brief's "Variant" exactly. There is no "Control" to compare against — the fat prompt loading (SOUL + DOMAIN + TOOLS + LESSONS + INDEX) no longer exists in the codebase.

## Scout-Specific

Scout's directory confirms this:
- `SOUL.md` — exists, contains full identity + methodology + skills + constraints
- `DOMAIN.md` — does NOT exist
- `TOOLS.md` — does NOT exist  
- `LESSONS.md` — does NOT exist
- `INDEX.md` — does NOT exist

Scout is already running the slim configuration. Creating `agent.slim.json` would be identical to `agent.json`.

## Recommendation

The pilot as designed is redundant. The hypothesis ("context bloat causes instruction drift") can be validated by comparing gym scores before vs. after the prompt simplification was deployed — a retrospective analysis rather than a new A/B test. However, this requires gym data from both periods, which may not exist in `may.db`.

**Next steps for Bob**: Consider whether a different experiment would be more valuable — e.g., testing whether adding context back (re-loading DOMAIN.md for specific agents) degrades performance, or testing the prompt simplification on an agent that still has large SOUL.md files.
