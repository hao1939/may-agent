# Agent Idle Time & Bottleneck Analysis
**Date**: 2026-03-28 | **Investigator**: May | **Status**: Initial findings

## Key Finding: Agents are 73-99% idle

| Agent | Avg Work/Heartbeat | Interval | Idle % |
|-------|-------------------|----------|--------|
| evaluator | 35s | 20min | 97% |
| may | 13s | 20min | 99% |
| bob | 161s | 20min | 87% |
| scout | 170s | 30min | 91% |
| amy-kimi | 186s | 30min | 90% |
| tech-lead | 225s | 20min | 81% |
| coach | 242s | 20min | 80% |
| optimizer | 316s | 20min | 74% |
| amy | 321s | 30min | 82% |

**Only 0.7% of heartbeats get skipped** (1/141) — meaning agents almost never overlap with their next heartbeat. The intervals are far too generous.

## Root Causes

### 1. Fixed intervals, no work-driven scheduling
Heartbeats fire on fixed timers (20-30min). When an agent finishes in 2min, it sits idle for 18min. There's no mechanism to say "done early, fire next heartbeat now."

### 2. No task queue / backlog feeding
Agents wake up, check their todo, find nothing (or find one thing), do it, then go dormant. There's no continuous work queue that keeps them occupied.

### 3. Evaluator is massively over-provisioned
Evaluator averages 35s per heartbeat on a 20min cycle. It has almost nothing to do most of the time. Could run at 60min intervals with no impact.

### 4. May's heartbeats are mostly no-ops
May averages 13s — basically just reads todo.md, finds nothing new, and exits. 75 samples confirm this pattern.

### 5. Max concurrency is 9 — system can handle more
We've seen 9 agents running simultaneously with no issues. The system isn't resource-constrained.

## Proposed Changes (ranked by impact)

### A. Reduce heartbeat intervals for active agents
- **optimizer, coach, tech-lead**: 20min → 10min (these are the "workers" averaging 3-5min each)
- **bob**: 20min → 10min (averages 2.5min)
- **evaluator**: 20min → 45min (averages 35s, rarely has work)
- **amy, amy-kimi, scout**: Keep at 30min (research takes longer, fewer tasks)

**Impact**: ~40% reduction in idle time for worker agents.

### B. Post-heartbeat re-trigger mechanism
When an agent's heartbeat completes and there's remaining work in their todo, immediately re-fire instead of waiting for the next interval. The `checkPendingTrigger` mechanism already exists in cron.ts — could extend it.

**Impact**: Eliminates idle time when there's queued work.

### C. Cross-agent task dispatching
May should proactively create work for idle agents. Instead of waiting for Hao's tasks, May can:
- Assign scout research tasks
- Queue coach training exercises
- Trigger optimization cycles
- Feed tech-lead implementation tasks from backlog

**Impact**: Converts idle time into productive work.

## Metrics to Track
- `idle_pct` = 1 - (work_duration / interval)
- `skip_rate` = skipped heartbeats / total heartbeats (target: 5-15%, currently 0.7%)
- `productive_turns` = turns where agent does meaningful work vs. "nothing to do"

## Next Steps
1. Test interval reduction (option A) — lowest risk
2. Design re-trigger mechanism (option B) — medium effort
3. Implement proactive dispatching (option C) — requires backlog curation
