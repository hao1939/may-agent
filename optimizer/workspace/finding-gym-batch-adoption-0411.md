# Finding: gym-batch.sh Adoption Gap & Coach EXP-136 Op Decomposition

**Date**: 2026-04-11  
**Scope**: Coach session analysis post gym-batch.sh merge (Apr 10 23:28 UTC)  
**Method**: Session JSONL tool-call extraction, DB analysis (.state/may.db), git history

## Executive Summary

**gym-batch.sh has ZERO adoption by Coach.** Despite being merged to main (5ca3bdf, Apr 10 23:28 UTC) and added to Coach's context.md, Coach continues using individual gym-run.sh calls. The most recent gym-heavy session (EXP-130, 88 ops) made 31 separate gym-run.sh calls that gym-batch.sh was designed to replace. gym-batch mentions in post-merge sessions are **context.md passthrough only** — Coach reads them during context loading but never executes the tool.

Separately, EXP-136 (the 98-op session) spent 40% of its ops on JSONL file scanning for FM-3.3 patterns — a data archaeology pattern that `session-query.ts` was designed to address but which Coach also doesn't use.

## Data

### gym-batch.sh Adoption: Zero

| Metric | Value |
|--------|-------|
| gym-batch.sh merge date | 2026-04-10 23:28 UTC (commit 5ca3bdf) |
| Coach sessions post-merge | 38 (through Apr 11 12:00) |
| Sessions with gym-batch in context | ~7 (loaded from context.md) |
| Sessions that EXECUTE gym-batch.sh | **0** |
| Sessions that still use gym-run.sh | All gym-heavy sessions (EXP-129-131) |

**Proof — EXP-130** (88 ops, s_1775867092608_1142, post-merge):
- 31 individual gym-run.sh bash calls (actual tool invocations)
- 0 gym-batch.sh calls
- 64 total gym-run.sh mentions (including output references)
- Pattern: `scripts/gym-run.sh kb-integration-discovery --agent coder` repeated ~12 times with minor variations

### Coach EXP Session Ops — Pre vs Post Merge

| Window | Sessions | Total Ops | Avg Ops | Max |
|--------|----------|-----------|---------|-----|
| Apr 10 00:00-12:00 (pre) | 46 | 1,064 | 23.1 | 94 |
| Apr 10 12:00-23:28 (pre) | 41 | 1,358 | 33.1 | 188 |
| Apr 10 23:28-Apr 11 12:00 (post) | 38 | 985 | 25.9 | 98 |

Average ops dropped from 33.1 → 25.9 post-merge, but this is **not attributable to gym-batch** — Coach shifted from gym-heavy experiments (EXP-124, EXP-127, EXP-128) to guard-analysis experiments (EXP-134-136) that use DB queries instead of gym trials.

### Gym-Heavy Sessions: Pre vs Post

Sessions with "Gym Trial" in task name:
- **Pre-merge**: 5 sessions, 403 ops, avg 80.6
- **Post-merge**: 2 sessions, 121 ops, avg 60.5

Sample sizes too small to draw conclusions. The 2 post-merge gym sessions (EXP-129 completion and EXP-130) both used gym-run.sh exclusively.

## EXP-136 Op Decomposition (98 ops, 116 tool calls)

The 98-op EXP-136 session is a guard-analysis experiment, not gym-heavy. Its op breakdown:

| Category | Tool Calls | % | Description |
|----------|-----------|---|-------------|
| JSONL scanning | 46 | 40% | grep/rg scanning session files for FM-3.3 patterns |
| Git analysis | 16 | 14% | git log/show checking guard deployment history |
| DB queries | 12 | 10% | bun -e Database() queries against .state/may.db |
| DB discovery | 11 | 9% | Schema exploration, finding correct DB path |
| Writing | 10 | 9% | write, edit, checkpoint, finish, git commit |
| File ops | 12 | 10% | mkdir, ls, find for file management |
| Context read | 3 | 3% | Initial context loading |
| Other | 6 | 5% | Miscellaneous |

**Key waste**: 
1. **DB discovery (11 ops)**: Coach spent 11 ops discovering that `may.db` is empty and the real data is in `.state/may.db`. This is the same pattern every agent hits.
2. **JSONL scanning (46 ops)**: Manually grepping through session JSONL files for FM-3.3 guard blocks. This is exactly what `session-query.ts` could help with, though the query tool doesn't support content search (only metadata filtering).

## Blockers to Adoption

### gym-batch.sh
1. **Context.md mention is passive** — Coach reads it but doesn't change behavior. The tool needs to be integrated into Coach's *experiment execution workflow*, not just mentioned in context.
2. **No example in experiment templates** — Coach designs experiments from scratch each time. No template says "use gym-batch.sh for running trials."
3. **Habit inertia** — Coach has 100+ sessions of muscle memory with `scripts/gym-run.sh <scenario> --agent <name>`. The gym-batch.sh interface is different enough to require conscious switching.

### session-query.ts
1. **Not in Coach's context.md** — Coach doesn't know it exists.
2. **Doesn't support content search** — The tool filters by metadata (agent, ops, time) but not by session content (e.g., "find sessions with FM-3.3 blocks").
3. **Historical data gap** — DB only has sessions through filesystem sync; session-query works on DB data.

## Recommendations

### Immediate (would save ~10-20 ops per gym-heavy session)
1. **Add gym-batch.sh to Coach experiment template** — When Coach designs an experiment, the design template should include "Execution: `scripts/gym-batch.sh --scenario X --variants baseline,variant --trials N`" as the default.
2. **Add explicit instruction to Coach's heartbeat.md or context.md**: "For gym trials, use `scripts/gym-batch.sh` instead of individual `scripts/gym-run.sh` calls."

### Medium-term
3. **Extend session-query.ts** to support `--grep <pattern>` for content search within session JSONLs.
4. **Create a shared "DB path" constant** — Every agent wastes 5-11 ops discovering `.state/may.db`. A documented constant or helper would eliminate this.

## Cost Estimate

- Coach runs ~3-5 gym-heavy sessions/day (avg 72 ops each)
- gym-batch.sh would save ~10-20 ops per session (replacing 10-26 individual calls with 1)
- **Savings: 30-100 ops/day (~$1.50-5/day)**
- This is a **real but modest** improvement. The bigger win is fixing the DB discovery pattern (saves ~8 ops × ~5 data-analysis sessions/day = ~40 ops/day).
