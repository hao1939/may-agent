# Tool Quality Review — 2026-03-26T06:33

## Report Summary (from 05:07 UTC, 24h window)
- **Total calls**: 4,069 | **Wasted**: 191 | **Rate**: 4.7% (up from 4.1% last review)
- **Sessions with failures**: 51

## Key Changes Since Last Review (02:40 UTC)

### Regressions
| Category | Was | Now | Change | Top agent |
|----------|-----|-----|--------|-----------|
| bash:empty-args | 8 | 14 | +75% | optimizer(8) |
| read:empty-args | 1 | 7 | +600% | optimizer(4), coach(3) |

### New Categories
- `finish:empty-args`: 2 (coach) — NEW
- `finish:schema-violation`: 2 (coach) — NEW  
- `bash:convention-block`: 2 (coach) — NEW

### Stable
- `bash:other`: 158 (was 162) — optimizer(76), qa(52), coach(24)
- `read:nonexistent-path`: 6 (was 8) — all coach (ENOENT on workspace/todo.md)

## Analysis
1. **Waste rate trending up**: 4.1% → 4.4% → 4.7% over 3 reviews. Driven by empty-args spike.
2. **Empty-args is the growth area**: Combined 21 wasted calls (was 9). Optimizer = 12, coach = 9.
3. **All fixes blocked on restart**: empty-args-guard.ts, path-assumption-guard.ts, QA npx fix — all in binary f10cfde, all need PID restart to activate.
4. **QA npx still 52 wasted calls**: Fix applied to SOUL.md but guard enforcement needs binary restart.
5. **Coach developing new failure modes**: finish:empty-args, finish:schema-violation, bash:convention-block — 6 new waste calls specific to coach.

## Action Items
- **None actionable** — all fixes deployed in code, blocked on process restart (PID 52, 32+ commits behind HEAD)
- Coach-specific failures (finish:empty-args, schema-violation) may warrant a coach SOUL.md reminder about tool schemas, but this is low-priority (6 calls total)
- Continue monitoring; if waste rate hits 5%, escalate restart priority
