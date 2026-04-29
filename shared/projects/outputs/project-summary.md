# Context-Learn Pipeline: Project Summary

**Status:** ✅ Completed

## Achievements

1. **Pipeline end-to-end functional** — `context-learn-poller` runs every 30min, scans completed sessions, dispatches `context-learn` events that update agent `context.md` files
2. **79 lessons seeded** in `agents/shared/lessons.jsonl` across 10+ agents (tech-lead, optimizer, qa, amy-kimi, evaluator, architect, judge, master, coder, bob)
3. **Organic capture confirmed** — poller processed 2 sessions, context.md files updated automatically
4. **Quality audited** — lesson quality scored 3.5+/5 across agents, no critical duplication

## Infrastructure Created

| Component | Location | Purpose |
|-----------|----------|---------|
| Poller handler | `agents/may/handlers/context-learn-poller.ts` | Scans session history, dispatches context-learn events |
| Cron entry | `agents/may/cron.json` | Runs poller every 30 minutes |
| Lessons DB | `agents/shared/lessons.jsonl` | 79 structured lessons for cross-agent retrieval |
| State tracking | `.state/context-learn-poller-processed.json` | Tracks which sessions have been processed |

## Root Cause Found

`session.completed` event is never emitted by the runtime — no emitter exists in the codebase. The poller is a workaround that polls `.state/sessions/history/` instead.

## Open Items (Handed Off)

- **P1 to tech-lead:** Add `session.completed` event emission in core runtime (would replace poller with direct event chain)
- **Repeat-mistake-rate:** Requires ~2 weeks of organic operation to measure; not actionable now

## Reports Produced

- `outputs/pipeline-metrics.md` — Pipeline firing analysis
- `outputs/poller-verification.md` — Manual test results
- `outputs/lesson-quality-audit.md` — Quality assessment of extracted lessons
- `outputs/learning-dashboard.md` — System activity snapshot
