# Preferences Scorecard Update: P6-P10

**Date**: 2025-07-01
**Task**: Add git-signal-derived preferences (P6-P10) to decision scorecard and propagate to agent contexts.

## Changes Made

### 1. `agents/shared/projects/hao-alignment/preferences.md`

**Section 1 (Core Principles)**: Added full P6-P10 definitions with decision rules:
- P6: Convention-driven (shared conventions > per-agent rules)
- P7: Consolidation (fewer rich files, remove obsolete, deduplicate)
- P8: Automate monitoring (cron for recurring checks)
- P9: Agent identity (clear roles, bounded scope)
- P10: Knowledge hygiene (never blind-overwrite, sync state)

**Section 5 (Decision Scorecard)**: Added 5 new rows:
| Question | Weight | Source |
|----------|--------|--------|
| Does this follow shared conventions? | +2 | P6 |
| Does this consolidate/deduplicate? | +2 | P7 |
| Does this automate a recurring check? | +2 | P8 |
| Does this respect agent role boundaries? | +1 | P9 |
| Does this risk overwriting knowledge? | -3 | P10 |

### 2. `agents/may/context.md`

Added P6-P10 summaries to the "Hao's Preferences" section so May's dispatch decisions account for all 10 preferences. Also expanded anti-patterns list.

## Scorecard Impact

The expanded scorecard now covers both direct-signal preferences (P1-P5 from chat) and indirect-signal preferences (P6-P10 from git commits). Max possible autonomous score increased, and knowledge-destructive actions now carry a -3 penalty.
