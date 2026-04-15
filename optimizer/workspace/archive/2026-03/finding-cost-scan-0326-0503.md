# Cost Scan — 2026-03-26 05:03 UTC

**Window**: Last ~5h (00:00–05:00 UTC), 60 sessions
**System Load**: 12 sessions/hr, 153 ops/hr

## Agent Cost Breakdown (ops)

| Agent | Ops | Sessions | Avg Ops/Session | % of Total |
|-------|-----|----------|-----------------|------------|
| optimizer | 369 | 14 | 26.4 | 48% |
| coach | 227 | 9 | 25.2 | 30% |
| tech-lead | 46 | 3 | 15.3 | 6% |
| bob | 43 | 5 | 8.6 | 6% |
| coder | 30 | 4 | 7.5 | 4% |
| scout | 24 | 2 | 12.0 | 3% |
| qa | 17 | 8 | 2.1 | 2% |
| may | 6 | 6 | 1.0 | 1% |
| evaluator | 6 | 9 | 0.7 | 1% |
| **TOTAL** | **768** | **60** | **12.8** | **100%** |

## Key Findings

### 1. Optimizer is the #1 cost consumer (48% of all ops)
- **Heartbeat sessions**: 47, 46, 43, 37, 20 ops = 193 ops in 5 sessions (avg 38.6)
- **Skill lifecycle sessions**: 57, 52, 20, 20, 10, 5, 4, 3 ops = 171 ops in 8 sessions
- One heartbeat session (s_1774494222739_352) used **46 bash calls** out of 56 total tool calls

### 2. Coach is #2 (30% of all ops)
- Growth-cycle workflow sessions: 56, 48, 28, 28 ops (avg 40 per fork/diagnose)
- Coach heartbeats are well-controlled: 13, 11 ops (within 15-op budget)
- The growth-cycle workflow is the main cost driver for coach

### 3. Combined optimizer + coach = 78% of system cost
- These two agents alone consume 596/768 ops
- All other 7 agents combined: 172 ops (22%)

### 4. Zombie requests still clogging DB
- 67 active requests, ~55 are stale "echo hello"/"echo testing" test requests
- Each agent scan through requests.db has to process all 67 (waste of context)

## Recommendations

### A. Optimizer heartbeat turn budget (NEW)
**Problem**: Optimizer heartbeats average 38.6 ops — no budget limit exists.
**Fix**: Add a 30-op turn budget to optimizer heartbeat.md (similar to coach's 15-op limit).
**Expected savings**: ~25% reduction in optimizer heartbeat cost (from ~40 to ~30 ops/session).
**Impact**: 6 heartbeats/5h * 10 ops saved = 60 ops/5h = ~8% system savings.

### B. Increase skill lifecycle cooldown to 12h (REINFORCE)
**Problem**: Two Phase 1 discovery sessions consumed 109 ops, both concluded "saturation."
**Fix**: Already have 6h cooldown. Increase to 12h. Each lifecycle run costs ~161 ops for diminishing returns.
**Expected savings**: 1 fewer lifecycle/day = ~161 ops saved.

### C. Zombie request cleanup (EXISTING, blocked on restart)
**Problem**: 55+ stale test requests polluting requests.db.
**Fix**: JS handler to auto-cancel CREATED test requests >24h old (proposed in finding-stale-requests-0326-0311.md).
**Status**: Blocked on process restart.

### D. Optimizer bash call reduction
**Problem**: One heartbeat used 46 bash calls. Optimizer is the top bash:other waster (72 calls in tool-quality report).
**Fix**: Self-discipline — favor `read` over `bash` for file reading, batch bash commands.
**Status**: Ongoing.

## Comparison with Previous Scans
- 22:34 scan: optimizer was already worst offender (78 wasted calls, 49% of all waste)
- 20:40 scan: 52 sessions in 4h (13/hr) — similar rate to now (12/hr)
- System rate stable, no new outliers or regression trends
