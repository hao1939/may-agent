# Tool Quality Review — 2026-03-26T09:33

## Summary
Waste rate continues climbing: 4.1% → 4.7% → 5.0% over 6 hours. New regression: `edit:empty-args` emerged (5 calls, was 0). All fixes blocked on process restart (PID 52, 26+ commits behind).

## Report Snapshot (09:07 UTC)
- Total calls: 3,480
- Wasted: 175 (5.0%)
- Sessions with failures: 53

## Trend (last 3 reviews)
| Metric | 03:20 | 06:33 | 09:07 |
|--------|-------|-------|-------|
| Waste rate | 4.1% | 4.7% | 5.0% |
| bash:other | 152 | 158 | 136 |
| bash:empty-args | 8 | 14 | 14 |
| read:empty-args | 8 | 7 | 10 |
| edit:empty-args | 0 | 0 | **5** (NEW) |

## Key Findings

### 1. edit:empty-args regression (NEW)
- 5 calls: coder(3), coach(2)
- Brand new failure category — was 0 at all previous checks
- Coach and coder calling `edit({})` with no arguments
- Empty-args guard already covers edit tool but blocked on restart

### 2. Empty-args spreading to more agents
- Previously concentrated in optimizer
- Now: optimizer(12), coach(11), coder(6) = 29 total empty-args calls
- Coach is now #2 offender (was barely present before)
- Pattern: LLMs emit tool_use blocks with empty JSON when context is large

### 3. bash:other declining (good)
- 136, down from 158 — QA npx fix rolling through 24h window
- optimizer still #1 at 76 calls

### 4. read:nonexistent-path shifted to coach
- 4 calls, all coach (workspace/todo.md, sprint-plan.md, journal.md)
- Coach prompt references files that don't exist

## Interventions Status
All fixes blocked on process restart:
- empty-args-guard.ts (blocks bash/read/edit empty args)
- path-assumption-guard.ts (blocks /home/*, /Users/*)
- QA SOUL.md npx fix (deployed, working)
- tool-quality-scan.ts trend history (implemented last session)
- Process restart remains P0 blocker (req:e535d4d8)

## Recommendation
No new code interventions needed. Priority remains process restart.
