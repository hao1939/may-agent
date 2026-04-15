# Analysis Review — 2026-03-24 01:06 UTC

## Window: Last 5h (20:06 - 01:06 UTC)

### Volume
- **36 sessions** / 5h = 7.2/hr → ~172.8/day projected
- **1,218 ops** / 5h = 243.6 ops/hr → ~5,846/day projected
- **2 active sessions** now (coach + optimizer)

### Trend
- Previous (20:36): 101 sessions/20.6h = 4.9/hr
- Current: 7.2/hr — appears higher, but driven by **skill lifecycle burst** (8 sessions/312 ops in 2h window around 21:36-22:02)
- Excluding skill lifecycle: 28 sessions/5h = 5.6/hr — roughly steady
- System slowing overnight as expected

### Per-Agent Breakdown (5h)
| Agent | Sessions | Ops | % of Ops | Avg Ops/Session | Status |
|-------|----------|-----|----------|-----------------|--------|
| optimizer | 12 | 654 | 53.7% | 54.5 | Skill lifecycle + heartbeats |
| tech-lead | 3 | 165 | 13.5% | 55.0 | Normal heartbeats |
| coach | 3 | 146 | 12.0% | 48.7 | 1 cron + 2 heartbeats |
| bob | 4 | 103 | 8.5% | 25.8 | Normal, efficient |
| qa | 5 | 46 | 3.8% | 9.2 | Idle early-exits ✓ |
| may | 5 | 36 | 3.0% | 7.2 | Idle early-exits ✓ |
| evaluator | 2 | 35 | 2.9% | 17.5 | Normal |
| scout | 2 | 33 | 2.7% | 16.5 | Normal |

### Key Findings

1. **Optimizer still #1 spender (53.7%)** — skill lifecycle accounts for 312/654 = 47.7% of optimizer ops. 6h cooldown is working (only 1 lifecycle run in this window), but the 2-Phase-1 pattern (both P1s ran back-to-back: 79+74 ops) is wasteful. The second P1 was a stale discovery that found the same pattern already handled.

2. **Bash-as-cat: ELIMINATED** — 0 instances across all checked sessions. This is a durable fix.

3. **Idle sessions: 10/36 = 27.8%** — All May (5) and QA (5). Proper early exits (7-10 ops). This is GOOD — skipIfIdle working correctly.

4. **Coach bash-grep bypass: STILL ACTIVE** in cron:common-sense-verify task — 25 references to session.jsonl in 1 session (s_102, 64 ops, 172KB). Regular coach heartbeats (s_117, s_120) are clean. The bypass is task-specific, not agent-wide.

5. **Token-heavy sessions**: 
   - optimizer s_109 Phase 1: 500KB / 79 ops = 6.3KB/op average — reading many session.jsonl files for pattern discovery
   - tech-lead s_130: 288KB / 59 ops = 4.9KB/op 
   - bob s_127: 264KB / 26 ops = 10.2KB/op — high per-op size, likely reading large files

6. **Session timing**: Earlier window (20:06-22:06) had 22 sessions/776 ops; later (23:06-01:06) had 14 sessions/442 ops. ~36% decline overnight — natural cooldown.

### No New Outliers
No sessions > $2 (estimated). Top session ~$8-10 (optimizer Phase 1 at 500KB). No new waste patterns beyond known issues (coach grep bypass, optimizer lifecycle dominance).

### Action Items
- Coach bash-grep bypass: Already tracked in todo.md. Only affects cron:common-sense-verify, not general heartbeats.
- Skill lifecycle cooldown: Working as intended. No action needed.
- Binary rebuild: Still the #1 blocker for handler improvements ($34-39/day blocked savings).
