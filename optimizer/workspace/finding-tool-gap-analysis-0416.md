# Finding: Tool Gap Analysis — 6h Bash Pattern Scan (Apr 16)

**Date**: 2026-04-16 12:00 UTC  
**Method**: Queried sessions from last 6h (startedAt > cutoff), filtered opCount > 10. Examined 13 sessions across 6 agents. Compared against prior analysis (finding-bash-command-patterns-0411.md).

---

## Sessions Analyzed (last 6h, opCount > 10)

| Agent | OpCount | Task Summary | Verdict |
|-------|---------|-------------|---------|
| may | 89 | Metric System + Gym unified design | needs_improvement |
| scout | 50 | Create 10 gym scenarios | good |
| tech-lead | 47 | Fix error-log-scanner | acceptable |
| coach | 45 | Fast loop pilot | good |
| coder | 43 | Persistent task iteration 1 | good |
| may | 38 | Fork bob for system-gaps | — |
| tech-lead | 34 | Persistent-task context overflow | good |
| coach | 32 | EXP-168 dose-response design | good |
| optimizer | 30 | Pre-deploy gate scenarios | needs_improvement |
| coach | 29 | Fast loop gym trials | good |
| tech-lead | 28 | Web dashboard metrics view | good |
| tech-lead | 27 | Auto-resume for persistent tasks | needs_improvement |
| scout | 26 | Scout-specific gym scenarios | good |

**Total**: 518 ops across 13 sessions in 6h.

## Comparison with Apr 11 Analysis

The Apr 11 analysis found 626 bash calls across 18 sessions with:
- **26.5% GREP_SEARCH** (166 calls)
- **23.2% DB_QUERY** (145 calls)  
- **11.0% AGENT_FILE_READ** (69 calls)
- Universal fleet-status query in 10/18 sessions

### What Changed (5 days later)

1. **Op counts are significantly lower**: Apr 11 average was ~39 ops/session; Apr 16 average is ~40 but with much wider spread (89 to 26). The high-op sessions shifted from tech-lead/coach heartbeats to may dispatching and scout scenario creation.

2. **DB query patterns persist**: The `bun -e "import{Database}..."` pattern remains the standard DB access method. No purpose-built DB query tool was created despite the Apr 11 recommendation.

3. **Wasted calls dropped to ~0**: Evaluations show wastedCalls=0 across all evaluated sessions. The waste is no longer in retries/errors but in **verbose multi-step bash sequences** that could be single tool calls.

4. **New pattern: Persistent task management**: tech-lead spent 34+27 ops on persistent-task investigation and auto-resume. This is a new category not present in Apr 11 data.

## Top Automation Opportunities

### Opportunity 1: DB Query Helper (estimated 3-5 ops/session savings)

**Pattern**: Every agent that queries the DB writes the same boilerplate:
```
bun -e "import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); ..."
```
Then iterates with different queries, each requiring the full boilerplate.

**Current state**: No tool exists. The Apr 11 analysis recommended this. Still not built.

**Proposed**: `scripts/query.ts` — takes a SQL string, returns formatted results:
```bash
bun scripts/query.ts "SELECT agent,count(*) FROM sessions GROUP BY agent"
```

**Savings**: ~2-3 ops per session that touches DB (roughly 60% of sessions). At 13 sessions/6h, that's ~20-30 ops/6h.

### Opportunity 2: Gym Scenario Batch Creator (estimated 10-15 ops/session savings)

**Pattern**: Scout spent 50+26 ops creating gym scenarios. Coach spent 29 ops running gym trials. These involve:
1. Read existing scenarios for format reference
2. Write scenario YAML
3. Validate scenario runs
4. Repeat per scenario

**Current state**: `gym-run.sh` and `gym-batch.sh` exist for running, but no scaffolding tool for *creating* scenarios from a template.

**Proposed**: `scripts/gym-scaffold.ts` — generates scenario YAML from minimal input (name, description, expected-behavior, category).

**Savings**: Scout's 76 combined ops could drop to ~30 with scaffolding.

### Opportunity 3: Fleet Status One-liner (estimated 1 op/heartbeat savings)

**Pattern**: The Apr 11 analysis found identical fleet-status queries in 10/18 sessions. This pattern likely persists in heartbeats (not visible in the 6h window since heartbeat sessions are <10 ops and filtered out).

**Current state**: `scripts/agent-dashboard.sh` exists but agents don't consistently use it.

**Proposed**: No new tool needed. Push agents to use `scripts/agent-dashboard.sh` via heartbeat instructions.

## Summary

| Opportunity | Est. Savings | Effort | Status |
|-------------|-------------|--------|--------|
| DB Query Helper | 20-30 ops/6h | Low (1h) | **Recommended** — highest ROI |
| Gym Scaffold | 15-25 ops/6h | Medium (2h) | Recommended for scout/coach |
| Fleet Status Push | 5-10 ops/6h | Minimal | Push existing tool |

**Net estimated savings**: 40-65 ops per 6h window (~8-13% of total ops).

**Priority recommendation**: Build `scripts/query.ts` first — it's the simplest, most universal, and addresses the pattern that's been flagged twice (Apr 10 and Apr 11) without action.
