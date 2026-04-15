# Tool Quality Review — 2026-03-26T13:33

## Summary
Waste rate **5.1%** (176/3445 calls). Essentially flat vs last review (5.0%). No new interventions needed.

## Trend (last 5 reviews)
- 4.1% → 4.7% → 5.0% → 5.0% → **5.1%** (plateaued)

## Key Changes
| Category | Previous | Current | Trend |
|----------|----------|---------|-------|
| bash:other | 136 | 126 | ↓ improving |
| bash:nonexistent-path | 0 | 16 | ↑ **NEW regression** |
| bash:empty-args | 14 | 10 | ↓ improving |
| read:empty-args | 7 | 10 | ↑ worsening |
| edit:empty-args | 5 | 5 | → stable |

## Analysis
- **bash:nonexistent-path regression**: All 16 from coder, all `/home/user` errors. This is the known FM-2.1 pattern — `path-assumption-guard.ts` in binary f10cfde catches this but needs process restart.
- **bash:other declining**: 136→126 (↓7.4%), optimizer contribution dropped 48→48 (flat), QA dropped 44 (from 48 prior).
- **empty-args declining** for bash (14→10) but rising for read (7→10). Coach is the main new offender.
- **Overall**: All known interventions are deployed in code, blocked on process restart. No new actionable findings.

## Action
None. All fixes blocked on restart (req:e535d4d8).
