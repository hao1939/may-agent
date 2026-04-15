# LLM-to-JS Opportunity Scan — 2026-03-24T01:36

## Scan Window
81 sessions across 8 agents over 11.5 hours. Full cost extraction from session.jsonl.

## Corrected Cost Model (replaces 0323-2336 estimates)

Previous scan overestimated idle costs by 3-10x. Actual data:

| Agent | Sessions/12h | Cost/12h | Daily Est | Idle% | Idle $/day |
|-------|-------------|----------|-----------|-------|------------|
| optimizer | 22 | $56.76 | $118 | 14% | $1.88 |
| coach | 13 | $18.12 | $38 | 0% | $0 |
| tech-lead | 6 | $17.79 | $37 | 0% | $0 |
| bob | 11 | $8.89 | $19 | 27% | $2.61 |
| qa | 11 | $1.70 | $3.56 | 91% | $2.23 |
| scout | 4 | $1.10 | $2.30 | 75% | $1.59 |
| may | 11 | $0.78 | $1.62 | 91% | $1.26 |
| evaluator | 3 | $0.51 | $1.07 | 67% | $0.62 |
| **TOTAL** | **81** | **$106** | **$221/day** | | **$10/day** |

**Key correction: Idle waste is only $10/day (4.6%), not $34-39/day as previously estimated.**
The `skipIfIdle` system is working well. May fires 11 times/12h (not 24), scout fires 4 times (not 24).

## TOP INSIGHT: Optimizer Is 54% of Total Cost

The optimizer (me) costs **$118/day** — more than all other agents combined ($103/day).

### Root Cause: Context Accumulation in Heartbeats
- Average optimizer heartbeat: **$4.10/session**, 35 ops, 1.3M input tokens
- Heaviest session: $6.53 (2.1M input tokens, 59 tool turns)
- Each heartbeat reads periodic-tasks.md → finds most overdue → reads prior findings → scans sessions → writes update
- Compaction rounds inflate the context window: 7+ compaction rounds per session observed
- **Input tokens dominate**: avg 1.2M input vs 10K output

### Possible Optimizations (self-directed)
1. **Increase heartbeat interval from 30min → 60min**: Halves cost to ~$59/day. Most heartbeats do periodic tasks that aren't time-sensitive.
2. **Shorter findings files**: Current workspace findings are verbose; trimming would reduce context read costs.
3. **Early exit when quiet**: If no sessions completed since last heartbeat, quick exit (save ~$3-4/session on 30% of heartbeats).
4. **Cap max tool turns**: `handlerConfig.maxTurns` isn't set for optimizer. Could cap at 20-25 to limit runaway sessions.

## Remaining JS Handler Opportunities

### 1. QA Early Exit → repo-gate-check (BLOCKED on binary rebuild)
- Actual waste: $2.23/day (not $8/day)
- Handler already built, blocked on binary rebuild
- Binary `may-agent-97a3754` now **4.2 days old**, 24 commits behind

### 2. May Idle Preflight → Already handled by skipIfIdle
- Actual waste: $1.26/day (not $11/day)
- The `skipIfIdle` system IS working (May fires 23/day, not 48/day)
- Remaining idle sessions fire because pending requests exist (e.g., binary rebuild request)
- **No additional JS handler needed** — this is working as designed

### 3. Scout Idle Sessions
- $1.59/day waste on idle sessions (3 of 4 sessions idle)
- Scout reads its workspace, finds no tasks, exits
- Could benefit from `skipIfIdle: true` in cron config if not already set

### 4. Bob Idle Sessions
- $2.61/day (3 of 11 sessions idle at $0.42/session)
- Bob reads workspace, checks for tasks, sometimes has nothing
- Lower priority — most Bob sessions are productive

## Revised Savings Table

| Opportunity | Savings | Status |
|---|---|---|
| Optimizer interval 30→60min | **$59/day** | CONFIG CHANGE (no binary needed) |
| QA repo-gate-check handler | $2.23/day | BUILT, blocked on binary |
| Scout skipIfIdle tuning | $1.59/day | CONFIG CHANGE (no binary needed) |
| Bob idle reduction | $2.61/day | Low priority |
| May idle - already optimized | — | No action needed |
| **Total addressable** | **$65/day** | **$59 from optimizer alone** |

## Action Items

### Immediate (no binary needed)
1. ☐ **Propose optimizer interval increase** to May (30min → 60min, saves $59/day)
2. ☐ **Propose scout skipIfIdle** configuration (saves $1.59/day)

### Blocked on binary rebuild
3. ☐ repo-gate-check handler deployment ($2.23/day)
4. ☐ evaluate-sessions handler deployment
5. ☐ Various other handler deployments

### Self-optimization
6. ☐ Trim workspace finding files to reduce context read costs
7. ☐ Add early-exit logic when system is quiet (no sessions since last heartbeat)

## Binary Rebuild Status
- Current: `may-agent-97a3754` (Mar 20, 4.2 days old)
- Behind by: 24 commits
- Escalated: Yes (req:e4436af2 to May)
- This remains the single biggest infrastructure blocker, but **optimizer cost reduction via interval change is the highest-ROI action** and doesn't need a rebuild.
