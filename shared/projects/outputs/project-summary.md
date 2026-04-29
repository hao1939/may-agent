# Context-Learn Pipeline: Project Summary

## Status: COMPLETED

## Objectives Achieved

1. **Pipeline end-to-end functional**: `context-learn-poller` runs every 30min via cron, scans `.state/sessions/history/` for new sessions, dispatches `context-learn` events that update agent `context.md` files
2. **79 lessons seeded** in `agents/shared/lessons.jsonl` across 10+ agents (tech-lead, optimizer, qa, amy-kimi, evaluator, architect, judge, master, coder, bob)
3. **Organic capture confirmed**: Poller processed 2 sessions, context.md files updated automatically
4. **Lesson format defined**: JSONL with agent, category, content, source fields; retrieval via grep/jq
5. **Quality audited**: Context.md additions rated 3-5/5 for actionability

## Infrastructure Created

| Component | Location | Purpose |
|-----------|----------|---------|
| Poller handler | `agents/may/handlers/context-learn-poller.ts` | Scans sessions, dispatches context-learn events |
| Cron entry | `agents/may/cron.json` | Runs poller every 30 minutes |
| Lessons DB | `agents/shared/lessons.jsonl` | 79 extracted lessons from agent context files |
| State tracking | `.state/context-learn-poller-processed.json` | Tracks which sessions have been processed |

## Reports Produced

- `outputs/memory-audit.md` — Initial audit of memory files across agents
- `outputs/pipeline-metrics.md` — Analysis of pipeline firing rate and root cause diagnosis
- `outputs/poller-verification.md` — Test results confirming poller works
- `outputs/lesson-quality-audit.md` — Quality assessment of context.md additions
- `outputs/learning-dashboard.md` — System activity snapshot

## Open Items (Handed Off)

- **P1 to tech-lead**: Add `session.completed` event emission in core runtime (would replace poller with direct event triggering)
- **Deferred**: `repeat-mistake-rate` metric — requires ~2 weeks of organic operation to measure

## Root Cause Found

The original pipeline was dead because `session.completed` events are never emitted by the runtime. The poller is a pragmatic workaround that polls session history instead of waiting for events.
