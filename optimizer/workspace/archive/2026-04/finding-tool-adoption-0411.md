# Finding: Tool Adoption Check + Next Tool Gap

**Date:** 2026-04-11  
**Mode:** B — Tool Adoption Check  
**Status:** Complete

## Summary

**Zero adoption** of either `session-query.ts` or `gym-batch.sh` by any agent. The tools were built (per finding-tool-gap-analysis-0410) but never surfaced to agents. `gym-batch.sh` was never even merged to main. The highest-value next tool gap is a **gym results aggregator** — coach sessions spend 40-60+ bash calls per experiment running and parsing gym results.

## Tool Adoption Status

### session-query.ts
- **Location:** `scripts/session-query.ts` (on `main` branch)
- **Merged:** Yes (commit a090c8c)
- **Actual invocations by agents:** 0 out of 2,269 sessions
- **Mentioned in agent context/heartbeat files:** No
- **Root cause:** Tool exists on disk but no agent knows about it. Not referenced in any `agents/*/context.md`, `agents/*/heartbeat.md`, or `agents/shared/` files.

### gym-batch.sh
- **Location:** Only on `review/gym-batch-runner` branch (commit fb0f792)
- **Merged:** No — still awaiting review
- **Actual invocations by agents:** 0
- **Mentioned in agent context/heartbeat files:** No
- **Root cause:** Never merged. Even if merged, same discovery problem as session-query.

## Why Agents Don't Use These Tools

1. **No context injection** — Agents learn what tools exist from their context.md, heartbeat.md, and shared knowledge. Neither tool is mentioned in any of these files.
2. **may.db is empty** — The database that session-query.ts was designed to query has 0 rows in the sessions table. Even if agents tried to use session-query, it would return no data.
3. **gym-batch not on main** — Agents can only access files on the main branch.

This confirms **KE-011**: building tools isn't enough; they must be advertised in agent context.

## Next Tool Gap: Gym Results Aggregator

### Evidence from High-Op Sessions

Analyzed 15 sessions with ≥50 ops (total 1,393 bash calls):

| Pattern | Count | % of All Bash |
|---------|-------|--------------|
| grep/rg searches | 279 | 20.0% |
| **gym-run.sh execution** | **232** | **16.7%** |
| cat/head/tail | 201 | 14.4% |
| ls/find | 176 | 12.6% |
| bun sqlite query | 127 | 9.1% |
| session archaeology loop | 56 | 4.0% |

### The Gym Run Pattern (232 calls, 16.7%)

Coach is the primary consumer. In its experiment sessions:
- **88 ops session:** 62 gym-run calls (coach ran EXP-130 few-shot trials)
- **136 ops session:** 47 gym-run calls (coach ran EXP-124 trials)
- **91 ops session:** 38 gym-run calls (coach ran EXP-127 trials)

The pattern: coach runs `scripts/gym-run.sh <scenario> --agent <name>` one at a time, then checks results with grep/cat/bun queries, then runs more. Each experiment requires 6-24+ individual gym runs plus result parsing.

**What a tool should do:** Accept a batch spec (scenarios × agents × N repetitions), run them all, and return a structured comparison table. This is exactly what `gym-batch.sh` was designed for, but it never shipped.

### The Bun SQLite Query Pattern (127 calls, 9.1%)

Optimizer and coach write inline `bun -e "import {Database}..."` queries 30+ times per session. Each query is a full boilerplate setup. A query helper that accepts SQL and returns results would save 3-5 lines of boilerplate per call — not huge per call but it adds up at 127 calls.

## Recommendations

### Immediate (fix what we built)

1. **Merge gym-batch.sh** — It's on `review/gym-batch-runner`, ready to merge
2. **Add tool references to agent context** — At minimum, add to coach's context.md:
   ```
   - Gym batch runner: scripts/gym-batch.sh <scenario1> <scenario2> --agent <name> --repeats 3
   - Session query: bun scripts/session-query.ts --agent coach --since 6h --min-ops 30
   ```
3. **Fix may.db** — The sessions table is empty (0 rows, 2,269 sessions on disk). session-query.ts reads from filesystem, so it works, but any tool expecting DB data will fail.

### Next Build Priority

4. **Gym results aggregator** (highest value) — Wrap gym-batch + result parsing into one tool that outputs a comparison table. Coach's 60+ gym-run sessions would drop to 5-10 ops.
5. **Add shared/tools.md** — A catalog of available tools that all agents can reference. Currently each agent would need individual context updates.

## Data Sources

- 2,269 sessions in `.state/sessions/` (filesystem scan)
- 0 rows in `may.db` sessions table (database is stale/empty)
- Bash command analysis from session.jsonl of top 15 high-op sessions (≥50 ops)
- Git branch check for gym-batch.sh merge status
