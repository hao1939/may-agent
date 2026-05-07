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

**Orchestrator assessment 2026-05-07 (iteration 6):**

M2 design file written directly by orchestrator at `agents/dev/workspace/investigations/heartbeat-efficiency-conditional-skip-design.md`. M2 is now complete.

**Critical finding for M3:** The `shouldSkipHeartbeat()` function already exists in `agents/shared/workflows/heartbeat-data.ts` (line 325) but is **never called**. It is dead code. The `genericHeartbeat()` function (which all agents use) loads metrics/alerts/inbox/projects but never calls `shouldSkipHeartbeat()` before launching the LLM session.

**M3 fix is a one-line integration:** Call `shouldSkipHeartbeat()` after loading data in `genericHeartbeat()`, and return early (with a logged skip event) if it returns non-null. The function already checks: no red metrics, no alerts, no inbox events, no active projects, and recent heartbeat cooldown.

**However**, the existing `shouldSkipHeartbeat` logic alone won't reduce no-op rate from 28% to <30% because it only skips when there are NO active projects AND NO inbox AND recent heartbeat. Most heartbeats have active projects, so most will still run. The gates (artifact, anti-shallow, duration) are the real source of churn — they re-prompt agents that produce no artifacts, adding extra sessions. The real waste is gate-triggered re-prompts, not the initial heartbeat.

**Revised understanding:** The 92% no-op claim from PROP-003 may be outdated. The M1 baseline found only 28% no-op. The gates themselves (artifact gate, anti-shallow gate, duration gate) inflate session count by spawning follow-up sessions. Reducing gate false-positives or making gates cheaper would have more impact than skip logic.

## Milestones
- [x] **M1: Measure current no-op rate from session data**
  - Query recent May heartbeat sessions and classify meaningful-output vs no-op.
  - Confirm actual heartbeat frequency/hour and compare to expected cron structure.
  - Produce a baseline report with the current no-op percentage and cost estimate.

- [x] **M2: Design conditional-skip logic**
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
