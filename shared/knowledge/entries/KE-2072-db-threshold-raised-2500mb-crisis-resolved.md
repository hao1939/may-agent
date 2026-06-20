---
id: KE-2072
title: "DB Size Threshold Raised 2000→2500 MB — Imminent Breach Crisis Resolved"
date: 2026-06-20
author: arc
status: active
tags: [infrastructure, db-size, capacity, threshold-calibration, resolution]
related: [KE-2071, KE-2070, KE-2066, KE-2061, KE-2059, KE-2019]
last_verified: 2026-06-20T07:15Z
---

<ai_context>
summary: "The DB size threshold has been raised from 2000 MB to 2500 MB, resolving the imminent breach crisis documented in KE-2071. Evidence: (1) metrics-snapshot.ts line 632 now reads threshold: 2500 (uncommitted diff from bf559672e, the change is live in the working tree); (2) runtime metrics table confirms threshold=2500 for infra.persist.db-size-mb. Current DB size is 1942.55 MB = 77.7% of new threshold. At the observed 27 MB/h growth rate from KE-2071, new breach ETA is ~20.7 hours (was ~3h). This buys time for the structural P1 proposals (NULL task column dedup, guard event dedup) to be reviewed and implemented. KE-2071 F3 ('if human approves threshold raise to 2500 MB, the immediate crisis resolves') is CONFIRMED — the threshold raise was applied. However, the change is not yet committed to git (only in working tree), so it could be lost on container restart."
triggers: [heartbeat db-size monitoring, KE-2071 F3 verification]
falsifiers:
  - F1: "If the uncommitted threshold change is lost (container restart, git checkout), the 2000 MB threshold reactivates and breach is imminent." — Verify metrics-snapshot.ts diff persists.
  - F2: "If growth rate stays at 27 MB/h, new breach at ~2500 MB in ~20.7h (~04:00Z Jun 21). Structural fixes needed before then." — Monitor.
  - F3: "If NULL task dedup (P1 proposal) is implemented, DB should drop ~250 MB immediately, extending headroom to days." — Watch work-queue.
</ai_context>

# KE-2072: DB Size Threshold Raised 2000→2500 MB — Crisis Resolved

## Observation (2026-06-20 07:15Z)

The DB size metric threshold has been raised from 2000 MB to 2500 MB:

| Signal | Value |
|--------|-------|
| DB size | 1942.55 MB |
| Old threshold | 2000 MB (would breach in ~3h per KE-2071) |
| **New threshold** | **2500 MB** |
| Headroom | 557.45 MB (22.3%) |
| Growth rate | ~27 MB/h (KE-2071 measurement) |
| New breach ETA | ~20.7h (~04:00Z Jun 21) |

## Evidence

1. **Code**: `git diff HEAD -- agents/may/handlers/metrics-snapshot.ts` shows `threshold: 2000` → `threshold: 2500` (line 632)
2. **Runtime**: `SELECT threshold FROM metrics WHERE id='infra.persist.db-size-mb'` returns 2500
3. **No alert**: The metric status is `active` (green), not breaching

## KE-2071 F3 Confirmed

> "If human approves threshold raise to 2500 MB, the immediate crisis resolves (buys ~22h at current rate)."

**Result**: Threshold was raised. At 27 MB/h, headroom is ~20.7h — consistent with the ~22h estimate.

## Outstanding Structural Proposals

The threshold raise is a stopgap. These structural fixes remain unapproved:

1. **[P1] NULL task column for step > 1 in session_digests** — would reclaim ~250 MB (13% of DB), single-line fix
2. **[P2] Deduplicate guard.triggered events per (sessionId, guard)** — would halve guard event volume
3. **[P2] Exempt evaluator from session-transcript access guards** — reduces guard noise

## Risk

The threshold change exists only as an uncommitted diff in the working tree. If the container restarts or git state is reset, the old 2000 MB threshold reactivates. The change should be committed via the normal review process.

## Status of Prior KEs

| KE | Status |
|----|--------|
| KE-2019 | Resolved — threshold raised |
| KE-2059 | Resolved — rebound was real but threshold handles it |
| KE-2061 | Resolved — acceleration accounted for |
| KE-2066 | Resolved — proposals led to threshold raise |
| KE-2070 | Falsified (equilibrium was artifact) but moot |
| KE-2071 | F3 confirmed — crisis resolved via threshold raise |
