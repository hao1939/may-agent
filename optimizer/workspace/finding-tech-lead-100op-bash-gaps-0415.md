# Finding: Tech-Lead 100-Op Heartbeat Bash Patterns (Apr 15)

**Date**: 2026-04-15
**Sessions analyzed**: s_1776261634460_23 (103 ops, interrupted), s_1776259835111_5 (100 ops, done)
**Comparison**: 44-op heartbeat s_1776260248991_13, plus 24 normal heartbeats (median 7 ops)

## Summary

Two tech-lead heartbeats hit 100+ ops today — 14× the median (7 ops). Both did extensive inline investigation instead of forking work. The heartbeat.md explicitly says "CRITICAL: Keep heartbeats lean. Fork all substantive work." These sessions violated that rule.

**Root cause**: The heartbeat entered investigation mode inline instead of dispatching. Once it started grep-chaining to trace code paths, it couldn't stop — each grep answer spawned 2 more greps.

## Tool Breakdown

| Session | bash | read | edit/write | agents/workflow | checkpoint | finish | Total |
|---------|------|------|------------|-----------------|------------|--------|-------|
| 103-op  | 103 (87%) | 14 (12%) | 0 | 0 | 1 | 0 | 118 |
| 100-op  | 98 (92%) | 2 (2%) | 2 (2%) | 2 (2%) | 1 | 1 | 106 |
| 44-op   | 40 (91%) | 2 | 4 | 0 | 0 | 1 | 47 |
| Normal  | ~4 | ~1 | 0-1 | 1 | 0 | 1 | 5-12 |

Bash calls dominate: 87-92% of all tool calls in bloated sessions.

## Bash Pattern Categories

### Pattern 1: Schema Discovery Loops (10-15 ops wasted per occurrence)
Both sessions repeatedly tried to query the DB, failed, discovered schema, retried.

**100-op session** (commands 39-45, 59-64):
- `sqlite3 .state/may.db "..."` → fails (sqlite3 not available)
- `bun -e "import Database from 'better-sqlite3'..."` → fails (wrong import)
- `bun -e "import { Database } from 'bun:sqlite'..."` → fails (wrong column name)
- Discovers `PRAGMA table_info(...)`, retries
- Same pattern repeated later for QA interrupt rate queries

**Estimated waste**: ~12 ops per session on DB schema discovery alone.

**Opportunity**: A purpose-built `query-db` tool or a `db-schema.md` file injected into session context. The sessions/evaluations/requests schema is stable — agents shouldn't rediscover it every session.

### Pattern 2: Grep Chains — Deep Code Tracing (40-60 ops)
The 103-op session traced `maxTurns` through the codebase: 60+ consecutive grep/sed commands searching for how turn budgets propagate through manager.ts → cron.ts → may.ts → types.ts → agent-loader.ts.

**Command sequence (103-op, commands 31-109)**:
```
grep maxTurns src/app/cron.ts
grep maxTurns src/app/may.ts  
grep maxTurns src/lib/manager.ts
grep TURN_BUDGET src/
sed -n '280,320p' src/lib/manager.ts
grep abort src/lib/manager.ts
grep timeoutMs src/lib/types.ts
sed -n '965,1010p' src/app/may.ts
... (78 more greps)
```

This is a classic Lens B flow-complexity trace — exactly the kind of work heartbeat.md says to **fork**.

**Estimated waste**: 60+ ops that should have been a single `workflow.run("lens-analysis", ...)` call.

**Opportunity**: This specific pattern (tracing a config value through the codebase) could use `scripts/code-search.sh` more effectively, but the real fix is **not doing it inline**. The heartbeat should fork after identifying the investigation target.

### Pattern 3: Git Branch Operations (10-15 ops)
The 100-op session spent ~15 ops on review branch management:
- Listing branches in both repos (main + agents subdir)
- Checking merge-base, diffing, running review-merge.sh
- Handling merge conflicts, stashing, manual merging
- Cleaning up branches

**Estimated waste**: 15 ops for branch merge work that should be a `workflow.run("implement-and-verify", "merge review branches...")`.

### Pattern 4: Proof-of-Life Handler Tracing (12 ops)
The 100-op session spent 12 ops tracing where proof-of-life.ts is loaded:
- Searching cron.ts, cron-handlers/, handlers/
- Checking agent-loader.ts for handler loading
- git checkout to restore files, git diff to check state

This is exploring the handler registration system — again, investigation work that should be forked.

### Pattern 5: Repeated PATH Setup (minor but symptomatic)
Both sessions have many `export PATH=".state/.bun/bin:$PATH" && bun -e "..."` calls. Each adds 50+ chars of boilerplate. This is a known issue (session s_1776240068573_8 at 08:01 today was literally "Fix PATH env for bash tool").

## Why Heartbeats Go Long

The pattern is consistent across all 3 bloated heartbeats:

1. **Normal start** (ops 1-5): Read todo.md, run snapshot query, check dispatch board
2. **Trigger**: Something interesting found (QA interrupts, stale branches, maxTurns mystery)
3. **Investigation begins inline** (ops 6-15): "Let me just check one thing..."
4. **Grep avalanche** (ops 15-100): Each answer raises a new question, agent keeps grepping
5. **No exit ramp**: Agent never pauses to fork — the sunk cost of investigation keeps it going

The 24 normal heartbeats (median 7 ops) follow the same steps 1-2 but then **fork the work** at step 3.

## Actionable Recommendations

### R1: DB Schema Injection (saves ~10 ops per bloated session)
Inject a 5-line schema reference into heartbeat context:
```
## DB Quick Reference
Tables: sessions(sessionId,agent,task,status,kind,startedAt,opCount,...), evaluations(sessionId,...), requests(requestId,...)
Access: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});..."
```
This eliminates the sqlite3→better-sqlite3→bun:sqlite→wrong-column discovery chain.

### R2: Grep-Chain Circuit Breaker (saves 40-60 ops per occurrence)
Add to heartbeat.md Step 2 DECIDE:
```
**Grep-chain detector**: If you've run 5+ consecutive grep/sed commands on the same topic, STOP. 
You are investigating, not dispatching. Fork this work immediately.
```
This is the single highest-value intervention. The 103-op session ran 78 consecutive greps on one topic.

### R3: Branch Merge Workflow (saves ~15 ops per occurrence)
The 100-op session did manual branch merging inline. This should always be:
```javascript
workflow.run("implement-and-verify", "Merge review branches: <list>. Verify: tsc --noEmit passes.")
```
Or even better — `scripts/batch-merge.sh` already exists (built in session s_1776241927088_24 at 08:32 today).

### R4: Investigation Forking Enforcement (systemic fix)
The heartbeat already says "Must-fork tasks: Multi-file code analysis, Architecture review across modules." But the agent ignores this when curious. Possible reinforcement:
- Add a self-check after Step 1: "Did I identify work? → Fork it NOW. Do not investigate."
- The `Must-fork` list is too long (6 items). Simplify to: "If you need more than 3 bash calls to answer, fork it."

## Impact Estimate

| Fix | Sessions affected today | Ops saved per occurrence | Daily savings |
|-----|------------------------|------------------------|---------------|
| R1: DB schema | 2 of 3 bloated + some normal | ~10 | ~20-30 |
| R2: Grep circuit breaker | 2 of 3 bloated | ~50 | ~100 |
| R3: Branch merge workflow | 1 of 3 bloated | ~15 | ~15 |
| R4: Fork enforcement | All 3 bloated | ~60 | ~180 |

**Total potential savings**: ~200 ops/day from tech-lead heartbeats alone. This represents ~3 unnecessary sessions worth of compute.

## Cross-Agent Applicability

The grep-chain pattern is not unique to tech-lead. Any agent doing code investigation (coder, optimizer) could benefit from R2. The DB schema issue (R1) affects all agents that query may.db.
