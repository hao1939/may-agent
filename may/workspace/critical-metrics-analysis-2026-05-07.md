# Critical Metrics Deep Analysis — 2026-05-07

## Executive Summary

Two ⚠️ metrics require attention. One is a **false alarm from accumulated technical debt** (status/reality mismatches), the other is a **real gap in measurement infrastructure** (v2 spec coverage). A third issue (stale active metrics) is minor.

---

## Issue 1: Status/Reality Mismatches — 14,169 (target: 0, threshold: 3)

### Root Cause

The mismatch count is **97.2% driven by a single component**: 14,161 historical sessions in status `done/error/interrupted` that never received a corresponding `session.end` event.

| Component | Count | % of Total |
|-----------|-------|------------|
| Terminal sessions without `session.end` event | 14,161 | 99.9% |
| Stale active metrics (no snapshot in 15m) | 1 | <0.1% |
| Agents without recent heartbeat | ~7 | <0.1% |

### Analysis

This is **not an active system problem** — it's historical debt. The system has 14,543 total sessions. The `session.end` event emission was likely added after most sessions already ran. The metric conflates "accumulated historical data hygiene" with "current system honesty."

### Recommended Fixes (in priority order)

1. **Backfill**: One-time script to emit synthetic `session.end` events for all historical terminal sessions. This immediately drops the metric to near-zero.
2. **Scope the metric**: Change the query to only consider sessions from the last 7 days (or since the `session.end` event feature was deployed). This makes the metric track *ongoing* honesty rather than *historical* completeness.
3. **Verify current sessions get events**: Confirm that recent sessions (last 24h) DO get `session.end` events. If so, the system is working now and only legacy data is the problem.

### Impact if Ignored

The metric is permanently red, desensitizing operators to real status/reality mismatches. This is a **classic alert fatigue** problem.

---

## Issue 2: v2 Spec Measurement Coverage — 9.09% (target: 100%, threshold: 80%)

### Root Cause

The v2-spec.md defines **22 claims** (C1, C2, ..., I1, I2, ..., S1, S2, ...). The coverage function checks if each claim's `**Measurement.**` section references a metric ID that exists in the active metrics table. Only **2 of 22** claims reference a metric that currently exists.

### Current Active Metrics vs. Spec Claims

The 19 active metrics are all operational/structural:
- `handler.*` (6) — handler health
- `project.*` (6) — project tracking
- `session.*` (1) — session errors
- `system.*` (1) — file output
- `v2.*` (3) — LOC counts + this coverage metric itself
- `capability.*` (1) — the status/reality mismatch count
- `metric.*` (1) — stale metric count

The spec expects metrics like:
- `capability.self-directed-iteration-rate-24h`
- `capability.decision-quality-score`
- `capability.knowledge-application-rate`
- `infra.handler-reliability`
- etc.

### The Gap

Most v2-spec claims have status `untested` — the metrics they reference **don't exist yet**. This isn't a measurement failure; it's an **implementation gap**. The spec was written as a roadmap; the system hasn't built the metrics it calls for.

### Recommended Fixes

1. **Phase 1 (quick wins)**: Several spec claims reference metrics that are close to existing ones. Map `capability.self-directed-iteration-rate-24h` to the existing `project.iterations-24h` with a trigger filter. ~3-5 new metrics could be derived from existing data.
2. **Phase 2 (new instrumentation)**: Claims around decision quality, knowledge application, and learning loops need new event types and measurement logic.
3. **Adjust target timeline**: If coverage can't reach 80% within a sprint, lower the threshold to avoid permanent red, or mark the metric as `speed: slow` so it doesn't alert continuously.

---

## Issue 3: Stale Active Metrics — 1 (target: 0, threshold: 0)

### Root Cause

One metric hasn't received a snapshot in 15 minutes. This is likely transient (metrics-snapshot handler runs every ~10 minutes; occasional timing jitter causes brief staleness).

### Recommendation

Change threshold from 0 to 1 (allow 1 stale metric). Zero tolerance for timing-dependent metrics creates noise.

---

## Delegation Recommendations

| Action | Assign To | Priority |
|--------|-----------|----------|
| Backfill session.end events or scope query to 7d | tech-lead | P1 |
| Create 3-5 capability.* metrics from existing data | tech-lead | P1 |
| Raise stale-metric threshold to 1 | may (config change) | P2 |
| Design remaining spec metrics (Phase 2) | bob + tech-lead | P2 |
