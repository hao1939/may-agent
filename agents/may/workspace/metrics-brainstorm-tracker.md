# Metric System Design — Brainstorming Tracker

**Created:** 2026-04-15 ~14:08 UTC  
**Purpose:** Collect agent perspectives on metric system design before finalizing  
**Background:** Hao wants broader input. Current design at `agents/shared/may-agent-docs/design/metrics-system.md` (499 lines, DRAFT).

## Messages Sent

| Agent | Request ID | Sent | Response File | Status |
|-------|-----------|------|---------------|--------|
| Bob | req:38df9960 | 2026-04-15 14:08 | `agents/bob/workspace/metrics-brainstorm-response.md` | ✅ Done (89 lines) |
| Tech-lead | req:49a3a4cc | 2026-04-15 14:08 | `agents/tech-lead/workspace/metrics-brainstorm-response.md` | ✅ Done (73 lines) |
| Optimizer | req:97a27c01 | 2026-04-15 14:08 | `agents/optimizer/workspace/metrics-brainstorm-response.md` | ✅ Done (81 lines) |
| Coach | req:05323c9e | 2026-04-15 14:08 | `agents/coach/workspace/metrics-brainstorm-response.md` | ✅ Done (74 lines) |
| Scout | req:d6d82882 | 2026-04-15 14:08 | `agents/scout/workspace/metrics-brainstorm-response.md` | ✅ Done (91 lines) |

## What We Asked Each Agent

1. What metrics would YOU want to own and track?
2. How would you measure them? How often?
3. What would change in your heartbeat if you had a metrics query?
4. What's missing from the current design?

## Hao's Key Feedback (Relayed to All Agents)

1. **Drop fixed-interval snapshot** — different metrics need different intervals, owner decides cadence
2. **Don't retire existing mechanisms** — dispatch board, improvement queue, request DB run in parallel
3. **Simple lifecycle**: create → track → retire → archive
4. **Dashboard display** — metrics on web console, human-confirmed get top priority
5. **Agent ownership** — each agent OWNS their metrics, real input matters

## Next Steps

- [x] Wait for all 5 responses — ALL 5 DONE as of 14:30 Apr 15
- [ ] Synthesize all 5 responses + Bob's design into unified proposal → dispatched to Bob
- [ ] Present to Hao for review

## Notes

- Bob is already working on the unified metric system design (`agents/bob/workspace/unified-metric-system-design.md`) — his brainstorm response should complement that work.
- The brainstorm is specifically about what each agent would OWN — this is bottom-up input to complement the top-down design.
