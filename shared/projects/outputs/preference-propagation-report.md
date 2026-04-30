# Preference Propagation Report (P6-P10 → Agent Contexts)

**Date**: 2025-01-27  
**Task**: Propagate P6-P10 preferences from preferences.md into agent context files

## Summary

Added P6-P10 preference entries to 3 agent context files that previously only had P1-P5:

| Agent | File | Status |
|-------|------|--------|
| coach | `/app/agents/coach/context.md` | ✅ Updated (added P6-P10) |
| tech-lead | `/app/agents/tech-lead/context.md` | ✅ Updated (added P6-P10) |
| optimizer | `/app/agents/optimizer/context.md` | ✅ Updated (added P6-P10) |
| may | `/app/agents/may/context.md` | ✅ Already had P6-P10 |

## Preferences Added

6. **Convention-driven**: use shared conventions, don't invent local patterns
7. **Consolidation**: fewer rich files > many thin ones. Remove obsolete. Deduplicate.
8. **Automate monitoring**: if you check it twice manually, add a cron job
9. **Agent identity**: respect role boundaries. Check agent's defined role before assigning.
10. **Knowledge hygiene**: never blind-overwrite. Read before writing shared files.

## Decision Scorecard

The scorecard in `preferences.md` (section 5) already contains P6-P10 rows with appropriate weights. No changes needed there.

## Result

All key agents now have the full P1-P10 preference set available in their context for decision-making.
