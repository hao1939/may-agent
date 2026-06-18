---
id: KE-2026
title: "Work Queue Stale Proposal Triage — Two Proposals Resolved Without Implementation"
date: 2026-06-18
author: arc
status: active
tags: [work-queue, proposal-triage, staleness, capacity-planning]
related: [KE-2023, KE-2024, KE-938]
---

<ai_context>
summary: Two pending proposals in work-queue.md were stale — their premises had been resolved by the system evolving past them. (1) WAL checkpoint fix (proposed 2026-06-16, P1): WAL shrank from 1356 MB to 4 MB between proposals; checkpoint already works; proposal's measurement-fix is moot (<0.2% measurement error). (2) Deactivate orphaned project.reconcile.* metrics (proposed 2026-06-15, P1): all 3 metrics already have status='retired' in the DB, no longer active or inflating capability.status-reality-mismatch-count. Both marked [x] closed in work-queue.md. Pattern: proposals decay faster than the approval queue clears them when the underlying system is under active development. Currently 8 unchecked proposals remain in the Proposed section, of which 3 are P1 (DB threshold raise, Spec 4 planning timeout, metrics.config column).
triggers: heartbeat coherence audit, work-queue review
falsifiers:
  - F1: "If another proposal in the current queue is found stale within 48h, the decay rate exceeds the review cadence and a work-queue hygiene pass should be scheduled."
</ai_context>

## Observation

During heartbeat work-queue review (2026-06-18 ~05:10Z), found two proposals whose premises had been resolved:

### 1. WAL Checkpoint Fix (proposed 2026-06-16, P1)

**Original premise**: "metric reports 1351 MB (.db only) but true disk usage is 2708 MB (includes 1356 MB WAL)"

**Current state**: WAL is 4 MB. Checkpoint is working correctly. DB metric (1918 MB) reflects actual size. The problem this proposal addressed (unmeasured WAL inflation) resolved itself between 2026-06-16 and 2026-06-17. KE-2023 had already documented this.

### 2. Deactivate Orphaned project.reconcile.* Metrics (proposed 2026-06-15, P1)

**Original premise**: "3 owned metrics left active; inflates capability.status-reality-mismatch-count (P0) by 3"

**Current state**: All 3 metrics (`project.reconcile.trigger-count`, `.launched-count`, `.event-latency-ms`) already have `status='retired'` in the DB. They are no longer included in active metric computations.

## Remaining Active Proposals (8 unchecked)

| Priority | Proposal | Status |
|----------|----------|--------|
| P1 | Raise DB threshold 2000→2500 | **Critical** — breach in ~3h |
| P1 | Spec 4: planning_update timeout | Active need |
| P1 | Add metrics.config column | Active need |
| P2 | Guard threshold 4500→6000 | Superseded by 5500 calibration |
| P2 | Guard event dedup per-session | Active need |
| P2 | Fix false-good metric vocabulary | Active need |
| P2 | Heartbeat-as-agency metrics drift | Active need |
| P2 | Telegram-notifications.md gap | Active need |

**Note**: The P2 guard threshold raise to 6000 (proposed 2026-06-18) may be partially stale — threshold was already raised to 5500 by commit 3de3d78e2. The proposal description says "6th calibration; at 4385/4500" but current threshold is 5500, not 4500. The directional fix (raise) is still relevant but the specific values are wrong.

## Pattern

Proposals decay faster than the ORDER-010 approval queue processes them when the system is under active development. This is expected — it means the system is self-healing — but stale proposals in the queue create noise for reviewers and can mislead arc into believing problems still exist.
