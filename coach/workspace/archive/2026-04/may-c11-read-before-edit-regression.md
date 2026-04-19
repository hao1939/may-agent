# Brief: May C1.1 Read-Before-Edit Regression

**Date**: 2026-04-05
**Trigger**: Convention-check alert — May C1.1 dropped from 95.8% to 90% overall
**Actual severity**: WORSE than reported — last 5 sessions = 40% (2/5 pass)

## Root Cause Analysis

### Violation Pattern
| File | Violations | Sessions |
|------|-----------|----------|
| `dispatch-board.md` | 12x | 6+ sessions spanning weeks |
| `EXP-034-log.md` | 2x | 2 recent sessions |
| `EXP-035/design.md` | 1x | 1 session |
| `todo.md` | 2x | historical |
| Various heartbeat.md | 6x | 1 mass-edit session |

### Key Pattern
May edits workspace files she "knows" without reading them first. The #1 offender is `dispatch-board.md` — a file May updates nearly every heartbeat. May treats it as "her file" and guesses the oldText for edits.

### Recent Trend
- Last 5 sessions: **40%** (2/5 pass) — acute regression
- Previous 15 sessions: **80%** (12/15 pass) — already declining
- Overall: **93.6%** (380/406) — inflated by long history of passes

### Classification
This is a **process skill gap** (adding a step before edit) — HIGH effectiveness per KE-021 taxonomy. Same pattern as scout (90%→33%), bob (84.3%), tech-lead (80%). All received read-before-edit skill with positive expectations.

## Intervention

1. **L3 Skill**: `agents/may/skills/read-before-edit.md` — tailored to May's specific violation files (dispatch-board.md, EXP logs)
2. **L4 Context nudge**: Added to `agents/may/context.md` — one-liner pointing to skill

### Expected Impact
- Target: 40% → 90%+ within 24h
- Based on: Process skill HIGH effectiveness (KE-021), proven pattern for same skill on scout/bob/tech-lead
- Escalation: If no improvement in 5 sessions, add L5 workflow enforcement
