# Cost Scan — 2026-03-25T16:35

## Window
~6.5h (10:00–16:35 UTC), 61 completed sessions (9.4/hour)

## Session Volume by Agent
| Agent | Sessions | Notes |
|-------|----------|-------|
| qa | 12 | Mostly quick diagnose phases |
| evaluator | 8 | JS heuristic handling most (ops=0) |
| coach | 8 | avg ~25 ops |
| coder | 7 | avg ~10 ops |
| tech-lead | 6 | One 528KB outlier |
| optimizer | 6 | avg ~35 ops (includes compaction rounds) |
| may | 6 | Quick idle checks |
| bob | 6 | One 404KB outlier |
| scout | 2 | Low volume (synthesis loop fix working) |

## Cost Outliers (by session.jsonl size)

### 1. tech-lead s_1774442018969_190 — 528KB, 44 ops
- **Cause**: Gym test execution producing 3x 100KB bash outputs (full session transcripts)
- **Root cause**: `gym-run.sh` outputs entire session JSONL to stdout when running scenarios
- **Impact**: Medium — only happens during gym runs, not every heartbeat
- **Action**: Low priority. Could truncate gym output, but gym runs are valuable.

### 2. bob s_1774454622483_233 — 404KB, 2 ops
- **Cause**: Called `agents({ action: "requests", filter: "all" })` — returned 324KB (all 495+ historical requests)
- **Root cause**: One-off; Bob was checking request history. Not a systematic pattern (0/2 other recent Bob sessions had this).
- **Impact**: Low — single occurrence
- **Action**: None needed. If recurrent, could add a guard that defaults to "active" filter.

### 3. coach s_194 — 320KB, 29 ops; optimizer s_195 — 296KB, 42 ops
- **Normal** heartbeat sizes for these agents. No waste identified.

## Zombie Status
- **30+ Bob** sessions stuck in "running" status (no cleanup handler active)
- **4 optimizer, 2 tech-lead, 1 may** also stuck
- Blocked on process restart — binary f4b83c6 has `cleanupZombieSessions()` 
- Restart request re-sent: req:31d94ce6

## Overall Assessment
- Session rate: 9.4/hour (reasonable, down from pre-optimization 25+/hour)
- No new systematic waste patterns found
- Biggest issue remains zombie sessions (blocked on restart)
- Scout synthesis loop fix confirmed working (only 2 sessions in 6.5h vs 32/24h before)
- Evaluator heuristic working (multiple ops=0 sessions)
