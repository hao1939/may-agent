---
title: "6th threshold calibration: guard.triggered-count-24h 4500→6000"
date: 2026-06-18
author: arc
status: proposed
priority: P2
related: [KE-2021, KE-2007, KE-2003]
---

# Proposal: Raise guard.triggered-count-24h threshold from 4500 to 6000

## Problem

The `guard.triggered-count-24h` metric is at **4385/4500 (97.4%)** as of
2026-06-18 ~01:00Z and will breach within 1-2 hours. Current ingress is
~200/hr; rolling-off events from 24h ago were only ~17/hr (a quiet period).
Net growth is ~183/hr → breach in ~0.6h.

This is the **6th threshold calibration** in 10 days:
```
d950cdf52  → 1500
9da357108  1500 → 2000
483ca44d8  2000 → 2500
d5a0dfbb6  2500 → 3500
ac70bb0ab  3500 → 4500
(this)     4500 → 6000
```

## Why This Keeps Happening

The root cause is documented in the dedup proposal (2026-06-18):
- Guard events fire per-tool-call, not per-session
- aks-explorer reads the same file 20-50x per session → 20-50 READ_DEDUP events
- aks-explorer throughput grew 7x (from ~50/hr to ~128/hr)
- Metric scales with (sessions × ops × guard-fire-probability)

The structural fix (per-session dedup) is proposed but not yet approved.

## Current Composition (24h)

| Signal | Events | % of total |
|--------|-------:|---:|
| READ_DEDUP (model.json) | 838 | 19% |
| finish() uncommitted | 726 | 17% |
| SESSION_BASH_CAT | 710 | 16% |
| READ_DEDUP (⚠️ variant) | 230 | 5% |
| SESSION_BASH_GREP | 225 | 5% |
| finish(success) ghost deliverable | 204 | 5% |
| SESSION_READ | 202 | 5% |
| Other | ~1250 | 28% |

## Proposed Change

In `src/metrics/metrics-snapshot.ts` (or equivalent metric config):

```typescript
// guard.triggered-count-24h threshold
- threshold: 4500,
+ threshold: 6000,

// guard.warned-count-24h threshold (mirrors triggered)
- threshold: 4500,
+ threshold: 6000,
```

## Why 6000

- Current 3h rate: 200/hr → projected 24h steady-state: ~4800/day
- 6000 gives 25% headroom above 4800 projected steady-state
- If aks-explorer sessions grow another 25% (possible), we'd reach ~6000 → at that point the dedup fix is essential
- This is explicitly a stopgap; the dedup proposal is the real fix

## Risk

Low. This is the same calibration pattern that's been applied 5 times.
The metric still fires alerts if something truly anomalous happens
(e.g., a guard starts blocking every session at 10x the normal rate).

## Requires

ORDER-010 compliance: src/ change needs Hao's approval.
