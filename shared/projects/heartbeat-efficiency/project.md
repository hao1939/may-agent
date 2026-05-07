# Project: Heartbeat Efficiency

**Status**: active
**Owner**: tech-lead
**Priority**: P1

## Goal
Reduce May's no-op heartbeat rate from 92% to <30% by implementing conditional execution: skip heartbeat runs when nothing meaningful has changed since the last heartbeat.

## Problem Statement
PROP-003 identifies a May heartbeat waste problem:
- May fires approximately 26 heartbeats/hour versus the expected 6/hour.
- 92% of those heartbeats are no-ops that produce no meaningful output.
- Cumulative estimated waste is approximately $64.50.
- The effective fix requires a code change in `src/`, not just workflow files.

`agents/may/cron.json` shows heartbeat jobs are generally configured at 30-minute intervals (`intervalMs: 1800000`) across multiple agents, with May's own `heartbeat` job enabled and routed through the `may-heartbeat` workflow. Several other enabled jobs (`heartbeat-evaluator`, `heartbeat-scout`, `heartbeat-dev`, `heartbeat-arc`) also use 30-minute intervals, so the observed 26/hr indicates extra triggering or fanout beyond the nominal schedule and needs measurement from actual session/event data.

## Current State
Existing mitigation code appears to exist but is not integrated into runtime `src/` paths:
- `agents/shared/workflows/circuit-breaker.ts`
- `agents/shared/workflows/dispatch-dedup-guard.ts`
- `agents/shared/workflows/heartbeat-data.ts`

Key note from `.state/heartbeat-note.md`: previous implementations for heartbeat dedup, circuit breaker, and budget checkpoint were written under `agents/shared/workflows/` but never integrated into `src/`, so they currently do not reduce production heartbeat waste.

Orchestrator assessment 2026-05-07: M1 baseline report verified at `agents/dev/workspace/investigations/heartbeat-efficiency-baseline.md`. It found 82 May `source='workflow:heartbeat'` sessions in the last 24h (3.42/hr by clock window) and 378 over 7d (2.25/hr observed-span rate). The documented classifier marked 23 no-op, 38 meaningful, and 21 unclear sessions in the last 24h, for a conservative 28.0% no-op rate, but with substantial guard-remediation churn mixed into heartbeat source: 37 `ARTIFACT GATE` and 11 `ANTI-SHALLOW` prompt markers. Cost is not defensibly measurable from current schema coverage because only one matching evaluation row joined and summed to zero.

Orchestrator assessment after iteration 2: no M2 deliverable was created or modified, so M2 remains open. Because there are now two consecutive worker iterations with no files, the next iteration must use `write()` as its first tool call to create the design report stub, then gather evidence and fill it in. If a third iteration produces no file, the orchestrator should either write the design content directly or provide exact file contents for the worker.

Orchestrator assessment after iteration 3: the worker again produced no files, making three consecutive no-output iterations. M2 remains open. To break the false-completion/no-output loop, the next worker iteration must write the M2 design file from exact content supplied by the orchestrator as its first action, then read it back for verification.

Orchestrator assessment after iteration 4: the worker produced no files for the fourth consecutive iteration, even after exact initial content was provided. The project is still active because M1 is complete and M2 can be recovered by giving the worker a minimal full-file deliverable that requires only one `write()` call and read-back verification. M2 remains open until `agents/dev/workspace/investigations/heartbeat-efficiency-conditional-skip-design.md` exists and contains a complete decision table, state model, insertion point hypothesis, reusable-logic review, and M3 sketch.

Orchestrator assessment after iteration 5: the worker produced no files for the fifth consecutive iteration, including after exact file content and "first tool call must be write()" guidance. This is now a worker execution failure rather than a project-design problem. M2 remains open, and progress is blocked until either the worker runtime follows write/read instructions or a human/maintainer authorizes the orchestrator to create the non-project deliverable directly.

## Milestones
- [x] **M1: Measure current no-op rate from session data**
  - Query recent May heartbeat sessions and classify meaningful-output vs no-op.
  - Confirm actual heartbeat frequency/hour and compare to expected cron structure.
  - Produce a baseline report with the current no-op percentage and cost estimate.

- [ ] **M2: Design conditional-skip logic**
  - Define what counts as a meaningful change since the last heartbeat, e.g. new human input, project status change, metric breach, failed session, new unresolved alert, or relevant file/event change.
  - Specify state needed to track the last productive heartbeat and last observed inputs.
  - Review existing workflow implementations (`circuit-breaker.ts`, `dispatch-dedup-guard.ts`, `heartbeat-data.ts`) for reusable logic.

- [ ] **M3: Implement in `src/`**
  - Integrate conditional skip/dedup behavior into the runtime heartbeat trigger/handler path in `src/`.
  - Ensure skipped heartbeats are recorded cheaply enough to audit behavior without launching full agent sessions.
  - Preserve event-driven responsiveness: do not skip when a real triggering event or state change occurred.

- [ ] **M4: Verify reduction**
  - Re-measure heartbeat frequency and no-op rate after deployment.
  - Target: no-op heartbeat rate <30%.
  - Confirm meaningful work is not suppressed by comparing skipped runs against subsequent events/sessions.

## Plan
1. Baseline from data: inspect recent May heartbeat sessions, event triggers, and costs; document the no-op classifier.
2. Trace runtime path from cron/event trigger to workflow/session creation in `src/` and identify the safest conditional-skip insertion point.
3. Adapt or replace existing shared workflow circuit-breaker/dedup ideas with production runtime logic.
4. Add tests or instrumentation proving that unchanged state skips, changed state runs, and critical events bypass skip.
5. Monitor post-change metrics and update this project with measured before/after results.

## References
- `.state/heartbeat-note.md` — PROP-003 summary and waste estimate.
- `agents/may/cron.json` — heartbeat cron structure: 30-minute interval jobs across multiple agents.
- `agents/shared/workflows/` — existing but unintegrated circuit-breaker and heartbeat-dedup work.
- `agents/shared/workflows/circuit-breaker.ts`
- `agents/shared/workflows/dispatch-dedup-guard.ts`
- `agents/shared/workflows/heartbeat-data.ts`

## Comments
