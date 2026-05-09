---
id: v2-spec-coverage-buildout
owner: may
status: blocked
type: milestone
priority: P2
iteration: 4
workflow: project
stop_reason: 
resume_condition: 
---

# Project Proposal: v2 Spec Coverage Buildout

## Goal

Raise `v2.spec-coverage-rate` from the current 0.1364 baseline toward the declared target by adding working measurements for the unmeasured claims in `agents/shared/may-agent-docs/proposals/v2-spec.md`, or explicitly calibrating claims whose proposed measurements no longer match current v2 design.

This is a legitimate measurement gap, not a stale metric: the metric is computed from the current v2 spec and active metric registry, and it correctly reports that only 3 of 22 spec claims currently reference an active `capability.*`, `infra.*`, or `v2.*` metric in their `**Measurement.**` section.

## Signals

- `v2.spec-coverage-rate`: current 0.1364 (3/22), target 1.0, threshold 0.8.
- `proposals/v2-spec.md` wording drift: old metric-driven language can mislead agents into treating metrics as decisions instead of signals.

## Current State
Blocked: Worker failed 2 consecutive times.
## Evidence

- Source: `agents/may/handlers/metrics-snapshot.ts` defines built-in metric `v2.spec-coverage-rate` and computes it in `countSpecClaimCoverage()`.
- Computation: the handler scans `agents/shared/may-agent-docs/proposals/v2-spec.md` for claim headings matching `## Cn/In/Sn —`, extracts each claim's `**Measurement.**` section, finds metric IDs matching ``capability.*``, ``infra.*``, or ``v2.*``, and counts the claim covered if at least one referenced metric ID is present in the active metrics table.
- Current denominator: 22 claims (`C1`–`C10`, `I1`–`I4`, `S1`–`S8`).
- Current covered claims: `C8` via `capability.session-trace-completeness`, `C10` via `capability.status-reality-mismatch-count`, and `S6` via `v2.manager-loc` / `v2.runtime-glue-loc`.
- Current uncovered claims: `C1`, `C2`, `C3`, `C4`, `C5`, `C6`, `C7`, `C9`, `I1`, `I2`, `I3`, `I4`, `S1`, `S2`, `S3`, `S4`, `S5`, `S7`, `S8`.

## Proposed Plan

### Phase 0 — Ownership and calibration

- [ ] Assign `v2.spec-coverage-rate` an explicit owner or keep project ownership authoritative. Suggested: `may` owns the aggregate because capability/spec visibility is cross-cutting; `tech-lead` owns `infra.*`; `arc` owns `v2.*` structural metrics.
- [ ] Reopen or supersede `v2-conformance-and-visibility`, which is currently `done` while one of its declared metrics remains red.
- [ ] Decide whether threshold 0.8 is an immediate alert threshold or a milestone target. If this proposal is accepted as active work, keep the metric red; if work is intentionally deferred, set status/priority to match a paused roadmap rather than continuous alerting.

### Phase 1 — Quick coverage from existing data

Add metrics that can be computed mostly from existing tables/events/files:

- [ ] `capability.self-directed-iteration-rate-24h` for C1.
- [ ] `capability.unrecovered-breach-count-7d` and/or `capability.breach-time-to-recovery-p50-h` for C2.
- [ ] `capability.cross-domain-handling-rate` for C5.
- [ ] `capability.cost-per-day-usd`, `capability.concurrent-session-max-1h`, `capability.zombie-session-count`, and `capability.fork-loop-incidents-24h` for C7.
- [ ] `capability.process-uptime-h` and `capability.unexpected-restart-count-7d` for C9.
- [ ] `infra.sessions.start-end-balance-1h` and `infra.sessions.trigger-field-coverage` for I4.
- [ ] `v2.agent-config-bytes-p50` for S5.
- [ ] `v2.heartbeat-decision-rate` for S7.
- [ ] `v2.fork-on-breach-rate` for S8.

Expected impact if these land and are referenced in the spec: coverage can rise from 3/22 to roughly 13/22 before deeper instrumentation.

### Phase 2 — Structural/static checks

Add active metrics or live invariant tests for claims that are currently source-inspection-only:

- [ ] `v2.runagent-callsite-conformance` for S1.
- [ ] `v2.tool-surface-conformance` for S3.
- [ ] Decide whether S2 and S4 should be credited by live `infra.*` metrics only, or whether the coverage function should also recognize invariant tests as claimed in the spec maintenance section.

### Phase 3 — New instrumentation

Implement metrics that need new runtime counters or event-bus instrumentation:

- [ ] `infra.bus.subscriber-error-rate-1h`, `infra.bus.emit-latency-p99-ms`, and `infra.bus.dispatch-without-persist-count` for I1/S2.
- [ ] `infra.persist.write-failure-rate-1h`, `infra.persist.event-row-coverage`, and `infra.persist.wal-size-mb` for I2.
- [ ] `infra.messages.delivery-latency-p50-min`, `infra.messages.unread-age-p95-h`, `infra.messages.dropped-count-24h`, and `infra.messages.p0-immediate-trigger-rate` for I3/S4.
- [ ] `infra.sessions.resume-success-rate` and `infra.sessions.tool-sandbox-violations-24h` for I4.

### Phase 4 — Spec/design calibration

Some claims may be measuring stale behavior rather than desired behavior:

- [ ] Revisit C4. The spec itself says explicit message close-rate may be the wrong primary coordination signal because agents often coordinate through shared project files. Decide whether to add a stigmergy-aware metric or rewrite the C4 measurement.
- [ ] Revisit C3 and C6. Journal-reference and capability-trend measurements need precise definitions before implementation.
- [ ] Update `v2.spec-coverage-rate` if live tests should count as coverage. The maintenance section says "metric or live test", but current implementation only counts active metric IDs referenced in Measurement sections.

## Acceptance Criteria

- [ ] `v2.spec-coverage-rate` has an explicit owner or an active owner project.
- [ ] The stale contradiction is resolved: no `done` project claims ownership of a red long-running metric without a next action.
- [ ] At least 18 of 22 claims have active measurements (`v2.spec-coverage-rate` >= 0.8182), or the target/threshold is deliberately recalibrated with documented rationale.
- [ ] `v2-spec.md` and `metrics-snapshot.ts` are updated together for every added/removed claim measurement.
- [ ] Any claim intentionally covered by a live test rather than a metric is recognized by the coverage computation or the spec is changed to require metrics only.
- [ ] The proposal's measurements are phrased as validation signals for agent judgment, not automatic pass/fail decisions.

## Validation

- If accepted, `v2.spec-coverage-rate` rises because real measurements/tests were added or because stale claims were deliberately calibrated.
- The spec and metric implementation agree on what counts as coverage.
- The resulting work does not introduce a second conformance work mode separate from projects/heartbeats/signals.

## Journal

- 2026-05-07: Aligned project to shared work-context convention. Current judgment: keep as `pending-review`; do not implement until the unified work model is accepted for v2 conformance measurement.

## Comments
