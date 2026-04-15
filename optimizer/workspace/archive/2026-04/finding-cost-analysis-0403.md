# Finding: Agent Cost Analysis (2026-04-03)

## Summary
Analyzed 3 days of agent operations to identify cost patterns and optimization opportunities.

## Key Metrics (3-day average)

| Agent | Total Ops | Sessions | Avg Ops/Active | Active Rate | Daily Ops |
|-------|-----------|----------|----------------|-------------|-----------|
| Bob | 665 | 32 | 37 | 56% | ~222 |
| Coach | 495 | 10 | 55 | 90% | ~165 |
| Optimizer | 404 | 18 | 24 | 94% | ~135 |
| Amy-kimi | 306 | 21 | 16 | 38% | ~102 |
| QA | — | 20 | 4 | 44% | ~39 |
| **Total heartbeats** | **~2086** | — | — | 48.8% | **~695** |

## Key Findings

### 1. Idle Rate is Managed
51.2% of all heartbeats are idle (0 ops). The `skipIfIdle` mechanism works — these cost near-zero. No action needed.

### 2. Coach is Most Expensive Per-Session
Coach averages **55 ops per active session** (90% active rate). The expensive sessions involve extensive DB querying (100+ bash calls) for analysis and experiment work. This is inherent to coach's role — it requires judgment across many data sources.

### 3. Error Sessions Waste ~75 ops/3d
11 error sessions in 3 days, mostly API timeouts. 75 ops lost total — modest waste. The turn-limit error (coach at 41/40) suggests coach needs slightly higher budget or better early-stopping.

### 4. No Tool Bloat
Tool usage is concentrated: bash (72.4%), read (16.7%), edit (6.1%), finish (2.5%). Custom tools are minimal (only amy-kimi has one). The `system_status` tool is rarely used (1 call in 50 sessions) — agents prefer bash DB queries.

### 5. Biggest Saving: Reduce Per-Session Ops
Since idle sessions are already cheap, the main optimization lever is reducing ops in active heartbeats. Created `scripts/agent-dashboard.sh` that provides a system overview in ONE call (vs ~20 DB queries agents currently do). If adopted, could save 5-10 ops per active heartbeat.

## Action Items
- ✅ Created `scripts/agent-dashboard.sh` for efficient system overview
- Consider mentioning dashboard in agent heartbeat prompts
- Monitor coach's 55-ops-per-session average — may need investigation of specific patterns
- The `system_status` tool could potentially be deprecated in favor of bash dashboard
