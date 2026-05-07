# Project: Heartbeat Efficiency

**Status**: waiting
**Stop Reason**: WAITING

The project needs 24 hours of production heartbeat data to accumulate before M4 can be completed. The code change (M3) integrates `shouldSkipHeartbeat()` into the runtime path, but no heartbe
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

**Orchestrator assessment 2026-05-07 (iteration 8):**

M1 ✅, M2 ✅, M3 ✅. M4 verification report produced at `agents/shared/projects/outputs/heartbeat-efficiency-m4-verification.md`. Finding: no heartbeat cron cycles have fired since the M3 code change (change was made within this session). Zero `heartbeat_skipped` events in runtime data — all references are in planning docs only.

**Waiting on**: production heartbeat cycles to accumulate (need ~24h of data after deployment). Re-check after 2026-05-08 to complete M4.

## Milestones
- [x] **M1: Measure current no-op rate from session data**
  - Query recent May heartbeat sessions and classify meaningful-output vs no-op.
  - Confirm actual heartbeat frequency/hour and compare to expected cron structure.
  - Produce a baseline report with the current no-op percentage and cost estimate.

- [x] **M2: Design conditional-skip logic**
  - Define what counts as a meaningful change since the last heartbeat, e.g. new human input, project status change, metric breach, failed session, new unresolved alert, or relevant file/event change.
  - Specify state needed to track the last productive heartbeat and last observed inputs.
  - Review existing workflow implementations (`circuit-breaker.ts`, `dispatch-dedup-guard.ts`, `heartbeat-data.ts`) for reusable logic.

- [x] **M3: Implement in `src/`**
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
