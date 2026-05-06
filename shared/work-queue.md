# Work Queue

Proposals flow: **arc proposes → human/may approves → dev implements**

## Format
```
- [ ] [P0|P1|P2] <title> — <source file> (proposed: YYYY-MM-DD)
- [x] [P1] <title> — <source file> (done: YYYY-MM-DD)
- [~] [P1] <title> — <source file> (rejected: reason)
```

## Approved (dev: pick from here)


## Proposed (needs review)
- [ ] [P0] Fix event-only handler subscriptions (session-recovery never fires) — agents/arc/workspace/proposals/2026-05-01-fix-event-only-handler-subscriptions.md (proposed: 2026-05-01)
- [ ] [P0] Filter closed projects from iterations-24h — agents/arc/workspace/proposals/2026-05-04-filter-closed-projects-from-iterations-24h-and-dispatch.md (proposed: 2026-05-04)
- [ ] [P0] Fix evaluator output-shape regression (eval coverage 96% drop, ~2.5% capture for 5d) — agents/arc/workspace/proposals/evaluator-output-shape-collapse.md (proposed: 2026-05-06)
- [ ] [P1] Handler-load-failure visibility (emit handler.failed on import error) — agents/arc/workspace/proposals/2026-05-03-handler-load-failure-visibility.md (proposed: 2026-05-03)
- [ ] [P1] Fix metric-alert-reactor broken import — agents/arc/workspace/proposals/2026-05-03-fix-metric-alert-reactor-broken-import.md (proposed: 2026-05-03)
- [ ] [P2] Widen blocked-over-6h to include waiting status — agents/arc/workspace/proposals/2026-05-02-blocked-over-6h-include-waiting.md (proposed: 2026-05-02)


## Done


<!-- metric: count unchecked items in Approved section -->
<!-- source_command: awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l -->
