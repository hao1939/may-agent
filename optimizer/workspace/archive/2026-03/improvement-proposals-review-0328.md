# Improvement Proposals Review — Cycle 17
**Date**: 2026-03-28T09:06 UTC
**Previous**: Cycle 16 (2026-03-27T03:03)

## Changes Since Cycle 16

### New Commits: 26 (since 2026-03-27T03:03)
Key themes:
1. **Context Learning (full pipeline)** — 8 commits: mechanical extraction, LLM merge, A/B comparison, backfill script, deployed to all agents
2. **Guard Revert** — Per Hao directive (2f9d2ef), all harness guards reverted. Philosophy shift: guards add complexity without proven value
3. **Skills Loading Fix** — P0: agent skills/*.md now loaded into system prompt (2f1ab59)
4. **Infrastructure** — Podman support, LiteLLM compose, new models (gpt54, gemini3flash), retryable errors
5. **maxTurns Enforcement** — 31895e7: my finding from 2026-03-27T17:34, now in code
6. **Circuit Breaker Gap** — d3b04e9: my fix for job-handler mode
7. **Gym DB Fixes** — 3 commits fixing batch_id migration for k3s

### Process Status
- **Running PID**: 52 (may-agent-b9ef77e, from Mar 24)
- **Latest binary**: may-agent-87653e5 (symlinked, built Mar 27)
- **HEAD**: 31895e7 (1 commit ahead of binary, 64 ahead of PID)
- **Restart still blocked** — PID 52 running 4+ days. All improvements blocked.

### Skill Count
- Agent-specific: 39 files across agents/*/skills/
- Shared: 12 files in agents/shared/skills/
- Total: 51 skill files (down from 54 — guard-related skills may have been removed with guard revert)

### Handlers: 22 (unchanged)
### Cron entries: 47

## System Health

### Activity
- System very quiet (Bob + coach + optimizer active)
- All recent sessions completing "done"
- 30+ zombie Bob sessions from Mar 25 persist (blocked on restart)

### Test Suite
- 5097 passed, 28 failed (all from dependency cache tests + 1 env issue)
- No real test failures in project code

### Tool Quality
- Last known: 2.8% waste (improving trend: 4.7→4.3→2.8)
- Report generation still blocked on restart

### Context Learning (NEW)
- 6 agents have context.md files
- Mechanical + LLM merge extraction pipeline
- A/B test: "no measurable improvement" (59b5da1) but deployed anyway
- Context files contain useful facts (env paths, tool availability, patterns)

## Blocked Items (ALL waiting on process restart)
1. maxTurns enforcement (31895e7)
2. Circuit breaker job-handler coverage (d3b04e9)
3. Skill lifecycle early-exit (in binary)
4. Coach bash-grep session-read-guard (in binary)
5. Tool quality report generation
6. Zombie session cleanup
7. Path assumption guard
8. Empty args guard
9. Context learning activation (if not already active)
10. All monitoring infra (requests.db, session-outcomes.jsonl, job-history.jsonl)

## Key Insights

### Guard Revert Impact
Hao's directive reverted all harness guards. This means:
- finish-guard.ts, session-read-guard.ts, path-assumption-guard.ts — all reverted from HEAD
- The "Hard Constraints" strategy (runtime guards) is officially deprioritized
- New direction: **Context Learning** as the improvement mechanism
- Optimizer context.md already includes "Don't add harness guards without gym evidence"

### Context Learning vs Guards vs Skills
The system has tried three improvement approaches:
1. **Guards** (runtime enforcement) — REVERTED per Hao. Too much complexity.
2. **Skills** (prompt-based teaching) — SATURATED at 51 files. 3 consecutive no-new-skill.
3. **Context Learning** (automated fact extraction) — NEW. A/B shows no measurable improvement yet, but infrastructure is deployed.

### Optimizer ROI Assessment
My deployed improvements since inception:
- **High ROI**: Cron interval fix (69% session reduction), evaluator cascade fix, idle-skip verification, coach cost reduction proposals
- **Medium ROI**: Tool quality scanning, bash sub-classification, maxTurns finding
- **Low ROI**: Skill lifecycle (51 skills, saturation, unclear behavioral impact), improvement proposals meta-reviews
- **Blocked ROI**: Everything waiting on restart (10+ items)

## Recommendations

1. **Stop skill lifecycle** — Formally mark as COMPLETE/SATURATED. 3 consecutive no-new-skill runs confirmed. Further cycles waste ~160 ops each.
2. **Focus on restart unblocking** — The single highest-ROI action is getting PID 52 restarted. 64 commits of improvements sitting unused.
3. **Evaluate context learning** — Once restart happens, check if context.md facts actually reduce tool errors. This replaces guards/skills as the improvement vector.
4. **Reduce periodic task overhead** — 5 per-heartbeat tasks rotate every session. With 30min intervals, each gets checked every 2.5h. Consider dropping to 3 (analysis review, cost scan, LLM-to-JS) and making handler health + tool quality bi-daily since they've been stable/blocked for days.
