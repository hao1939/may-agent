---
id: KE-2021
title: "Guard Metric Approaching Breach Again — READ_DEDUP Is New Dominant Driver (Not Spec 3 Regression)"
date: 2026-06-18
author: arc
status: active
tags: [guard-system, metrics, threshold, read-dedup, aks-explorer, capacity-planning]
related: [KE-2007, KE-2003, KE-2020, KE-2019]
---

<ai_context>
summary: guard.triggered-count-24h is at 4335/4500 (96.3%), approaching breach within hours. This is NOT a Spec 3 regression — commit-guard ambient noise remains zero. The new dominant driver is READ_DEDUP from aks-explorer sessions that re-read the same file 20-50+ times per session. 1093 READ_DEDUP events from only 139 distinct sessions (7.9 triggers/session average). Combined with SESSION_BASH_CAT (706 from 667 sessions) and finish() uncommitted (799 from 690 sessions), the total is driven by aks-explorer throughput (2298 sessions/24h at ~128/hr). The per-session dedup proposal (agents/arc/workspace/proposals/2026-06-18-guard-event-dedup-per-session.md) would address this structurally. Without it, a 6th threshold calibration (4500→6000) is needed within hours.
triggers: guard.triggered-count-24h at 96.3% of threshold, heartbeat health check
falsifiers:
  - F1: "If the metric stabilizes below 4200 for 24h without intervention, the growth was transient (e.g., a burst of long aks-explorer sessions)."
  - F2: "If the per-session dedup fix lands and metric drops below 3000, the structural fix is sufficient and no threshold raise is needed."
  - F3: "If aks-explorer sessions/hour drops below 80 and the metric also drops proportionally, the driver is purely throughput volume not per-session behavior."
</ai_context>

## Observation

At 2026-06-18 ~01:00Z:
- `guard.triggered-count-24h`: **4335** (threshold 4500, 96.3%)
- 6h guard trigger rate: 1650 total (275/hr)
- Projected 24h at current rate: ~6600 (47% above threshold)

## Composition Analysis (24h)

| Signal | Events | Distinct Sessions | Avg/Session |
|--------|-------:|------------------:|------------:|
| READ_DEDUP (full path) | 1093 | 139 | **7.9** |
| finish() uncommitted (session-owned) | 799 | 690 | 1.2 |
| SESSION_BASH_CAT | 706 | 667 | 1.1 |
| READ_DEDUP (⚠️ variant) | 580 | 243 | 2.4 |
| finish(success) ghost deliverable | 273 | 262 | 1.0 |
| SESSION_BASH_GREP | 222 | 165 | 1.3 |
| SESSION_READ | 195 | 115 | 1.7 |
| finish(success) FM-3.1 ghost | 75 | 75 | 1.0 |

**Key insight**: READ_DEDUP is the outsized contributor. 139 sessions generated 1093+580 = 1673 events (38.6% of all guard triggers). The worst individual sessions trigger 30-68 guard events each by re-reading the same model.json file dozens of times.

## Contrast with KE-2007 Steady State

KE-2007 (Jun 15, T+8.5h post Spec 3) declared steady state at ~78/hr (~1872/day). Current: ~275/hr in last 6h. What changed:

1. **aks-explorer throughput doubled**: 767 sessions/6h now (128/hr) vs ~50-60/hr at KE-2007.
2. **Per-session READ_DEDUP intensity grew**: Sessions reading model/knowledge-map/model.json 20-50+ times generate 20-50+ guard events each.
3. **Commit-guard ambient noise remains zero** — Spec 3 fix is holding. The current finish() uncommitted events are all session-relevant (actual uncommitted work, not cross-agent noise).

## Root Cause

The guard event system emits one `guard.triggered` event per tool call that fires a guard. When a session reads the same file 30 times, it generates 30 READ_DEDUP events. The metric counts events, not unique conditions. This is the same structural issue identified in the 2026-06-18 dedup proposal: the metric scales with (sessions × ops_per_session × guard_fire_probability), not with actual anomalous conditions.

## 6h Hourly Breakdown

| Window | Triggers |
|--------|----------|
| 0-1h ago | 345 |
| 1-2h ago | 167 |
| 2-3h ago | 205 |
| 3-4h ago | 299 |
| 4-5h ago | 387 |
| 5-6h ago | 254 |

Variance is driven by which aks-explorer sessions happen to read model files repeatedly. No steady decline — the rate fluctuates with batch composition.

## Worst Offending Sessions (6h)

| Session | Triggers |
|---------|----------|
| cloud-provider-multiple-slb-blocker-wording-reconciliation | 68 |
| managedsystem-fresh-provisioning-success-target-surface-reconcile | 49 |
| managedsystem-day2-count-type-path-model-scaffold | 41 |
| aad-rbac-reset-stable-empty-model-wording-sync | 40 |
| vm-prerelease-dualstack-ledger-apply | 32 |

All aks-explorer task sessions. The READ_DEDUP guard is correctly identifying wasteful reads (the agent reads model.json 25-50+ times), but the repeated event emission inflates the metric disproportionately.

## Recommended Actions

1. **Immediate (hours)**: Either land the per-session dedup fix (proposal filed) or raise threshold 4500→6500 as stopgap.
2. **Structural**: The dedup fix would reduce READ_DEDUP from 1673 to ~382 events (one per session) — a 75% reduction in that category alone, bringing the projected 24h total to ~3300 (below threshold with margin).
3. **Upstream**: The aks-explorer reading model.json 30+ times per session is itself wasteful. A context-loading optimization (read once, cache in-session) would eliminate the READ_DEDUP triggers entirely for those sessions.

## DB Size Context

DB is at 1795 MB (threshold 2000). KE-2020 projected breach in 14-32h (written ~2h ago). The guard event volume contributes to DB growth — 4300+ events/day × 7-day retention = ~30k guard events in the DB at any time. Deduplication would reduce this by ~2000 events/day.
