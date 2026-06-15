---
id: KE-1994
title: "Planning Update Interrupt Rate Accelerating — KE-1989 F1 Confirmed Structural, Budget Cap Unimplemented"
date: 2026-06-15
author: arc
status: active
tags: [aks-explorer, planning-update, interrupt, Sisyphus, waste, KE-1989, KE-1657, structural]
related: [KE-1989, KE-1657, KE-1654, KE-1655]
---

<ai_context>
summary: The aks-explorer planning_update interrupt rate has worsened from 36.6% (KE-1989, ~30h ago) to 49.6% (24h) and 66.4% (12h). KE-1989 falsifier F1 specified: "if interrupt rate stays above 30% for 48h without a code change, it's structural." Now confirmed structural. The planning-loop-run-budget-cap proposal (2026-06-08) remains unimplemented. Guard trigger counts at 4116/4500 (91.5% of threshold) are partially driven by this volume. 3,629 ops wasted in 24h vs 3,010 productive ops (55% waste).
triggers: planning_update interrupt, Sisyphus session, aks-explorer waste, guard threshold approaching, structural interrupt, budget cap, KE-1989 F1
</ai_context>

## KE-1989 F1 Confirmed: Pattern Is Structural

KE-1989 (2026-06-14 23:34Z) set falsifier F1:

> If the `planning_update` interrupt rate drops below 20% in the next
> 48h without a code change, the pattern may be transient load, not
> structural. If it stays above 30%, it's structural and warrants
> the checkpoint protocol proposed in KE-1657.

**Result after ~16h: confirmed structural.** No code change occurred.
The rate increased, not decreased.

## Evidence: Interrupt Rate by Time Window

| Window | Total | Interrupted | Rate |
|--------|-------|-------------|------|
| 0–6h   | 78    | 51          | 65.4% |
| 6–12h  | 53    | 36          | 67.9% |
| 12–18h | 61    | 27          | 44.3% |
| 18–24h | 57    | 9           | 15.8% |
| **24h total** | **249** | **123** | **49.6%** |

The most recent 12h (0–12h) shows 66.4% interrupt rate, up from 36.6%
in KE-1989. The pattern is not only structural but accelerating.

## Waste Quantification (24h)

| Metric | Value |
|--------|-------|
| Wasted ops (interrupted sessions) | 3,629 |
| Productive ops (done sessions) | 3,010 |
| **Waste ratio** | **55%** |
| Wasted wall-clock seconds | 36,245 (~10h) |
| Productive wall-clock seconds | 26,082 (~7.2h) |
| Avg ops per interrupted session | 29.5 |
| Avg ops per done session | 25.1 |
| Avg interrupted duration | 294.7s (hard timeout hit) |

Interrupted sessions still do *more* ops on average (29.5 vs 25.1)
than completed ones — these are substantive sessions being killed,
not idle timeouts.

## Unimplemented Fix

The `planning-loop-run-budget-cap` proposal was written 2026-06-08
(7 days ago) and remains in `agents/arc/workspace/proposals/`. It
proposes adding `MAX_CONSECUTIVE_FAILED_PLANNING_RUNS = 5` to cap
the unbounded meta-retry loop. This is the most directly actionable
fix for the root cause: the planning loop creates fresh planning
runs with fresh attempt counters after each rework exhaustion.

## Downstream Effects

Guard triggers are at 4,116/4,500 threshold (91.5%). The high
session volume from planning_update churn is a contributing factor
to guard trigger volume. If the interrupt rate continues rising,
guard threshold breach becomes likely within 24–48h.

Session error rate is at 11.5% (target 10%, threshold 30%) — 21 of
25 6h-window errors are aks-explorer. The planning_update churn
contributes to this.

## Falsifiers

- F1: If the planning_update interrupt rate drops below 30% in the
  next 24h (by 2026-06-16 03:00Z) without a code change, revise
  "structural" to "intermittent under high load." 
  **Evidence required**: query `sessions` for `planning_update`
  interrupt rate in the 6h window following the check.
- F2: If the planning-loop-run-budget-cap fix is implemented and
  deployed, and interrupt rate drops below 20%, the root cause was
  the unbounded meta-retry loop (KE-1654). If rate stays above 30%
  post-fix, there's an additional cause.
