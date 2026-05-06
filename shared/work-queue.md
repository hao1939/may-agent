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
- [ ] [P0] Add `"agent"` field to 5 silent cron entries (metric-alert-reactor/session-recovery/session-eval/escalation/context-learn — 0 lifetime fires; supersedes KE-455 remediation thread; KE-766) — agents/arc/workspace/proposals/2026-05-06-add-agent-field-to-silent-cron-entries.md (proposed: 2026-05-06)
- [ ] [P0] Fix event-only handler subscriptions (session-recovery never fires) — agents/arc/workspace/proposals/2026-05-01-fix-event-only-handler-subscriptions.md (proposed: 2026-05-01)
- [ ] [P0] Filter closed projects from iterations-24h — agents/arc/workspace/proposals/2026-05-04-filter-closed-projects-from-iterations-24h-and-dispatch.md (proposed: 2026-05-04)
- [ ] [P0] Fix evaluator output-shape regression (eval coverage 96% drop, ~2.5% capture for 5d) — agents/arc/workspace/proposals/evaluator-output-shape-collapse.md (proposed: 2026-05-06)
- [ ] [P0] Add work-queue triage to may's heartbeat (Approved gate has never fired, 5h post-launch) — agents/arc/workspace/proposals/2026-05-06-add-work-queue-triage-to-may-heartbeat.md (proposed: 2026-05-06)
- [ ] [P0] Fix loadAlerts() — drop `severity`, join on `metrics.owner` (one change, two bugs; supersedes KE-725 fix; heartbeat injections currently always show "None — all clear" while alerts open) — agents/arc/workspace/proposals/2026-05-06-fix-loadalerts-drop-severity-and-join-on-owner.md (proposed: 2026-05-06)
- [ ] [P0] Filter phantom dispatch-dedup completions out of `handler.heartbeat-coverage` (1-line duration filter; pairs with self-calibration P1 below; KE-760) — agents/arc/workspace/proposals/2026-05-06-filter-phantom-completions-from-heartbeat-coverage.md (proposed: 2026-05-06)
- [ ] [P1] Handler-load-failure visibility (emit handler.failed on import error) — agents/arc/workspace/proposals/2026-05-03-handler-load-failure-visibility.md (proposed: 2026-05-03)
- [ ] [P1] Fix metric-alert-reactor broken import — agents/arc/workspace/proposals/2026-05-03-fix-metric-alert-reactor-broken-import.md (proposed: 2026-05-03)
- [ ] [P1] Self-calibrating heartbeat-coverage metric (perpetual breach after 4-agent freeze, KE-756) — agents/arc/workspace/proposals/2026-05-06-self-calibrating-heartbeat-coverage-metric.md (proposed: 2026-05-06)
- [ ] [P1] Branch-aware breach message (counter+rate alerts emit "current=61 below threshold=0" — message lies, prompt to may misleads, KE-765) — agents/arc/workspace/proposals/2026-05-06-branch-aware-breach-message.md (proposed: 2026-05-06)
- [ ] [P1] Heartbeat header should consult `metric_alerts` (header says "All metrics healthy — no action needed" while 3 rate-mode alerts sit open right below; prompt is self-contradictory; pairs with branch-aware breach message above; KE-770) — agents/arc/workspace/proposals/2026-05-06-heartbeat-header-consult-metric-alerts.md (proposed: 2026-05-06)
- [ ] [P1] Add `metrics.config` column + drop runtime-guard branch in metrics-snapshot.ts (KE-769; v2 phase-4 ships writes against unmigrated schema; arch.md:179 promises a substrate that is unreachable today) — agents/arc/workspace/proposals/2026-05-06-add-metrics-config-column-and-drop-runtime-guard.md (proposed: 2026-05-06)
- [ ] [P2] Widen blocked-over-6h to include waiting status — agents/arc/workspace/proposals/2026-05-02-blocked-over-6h-include-waiting.md (proposed: 2026-05-02)


## Done


<!-- metric: count unchecked items in Approved section -->
<!-- source_command: awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l -->
