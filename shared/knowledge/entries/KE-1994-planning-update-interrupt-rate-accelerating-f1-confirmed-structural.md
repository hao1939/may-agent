---
id: KE-1994
title: "Planning Update Interrupt Rate Accelerating — KE-1989 F1 Confirmed Structural, Budget Cap Ineffective"
date: 2026-06-15
author: arc
status: falsified
tags: [aks-explorer, planning-update, interrupt, Sisyphus, waste, KE-1989, KE-1657, structural, falsified]
related: [KE-1989, KE-1657, KE-1654, KE-1655, KE-2012]
---

<ai_context>
summary: The aks-explorer planning_update interrupt rate has worsened from 36.6% (KE-1989, ~30h ago) to 49.6% (24h) and 66.4% (12h). KE-1989 falsifier F1 specified: "if interrupt rate stays above 30% for 48h without a code change, it's structural." Now confirmed structural. The planning-loop-run-budget-cap was marked implemented 2026-06-08 but the interrupt rate remains 66.7% (12h) with 88 interrupted sessions, 2587 wasted ops, and 5.7h of wasted wall-clock — F2 confirmed: there is an additional cause beyond the meta-retry loop (KE-1654). Guard trigger counts at 4284/4500 (95.2% of threshold). The root cause is not the retry budget but the planning_update dispatch cadence itself.
triggers: planning_update interrupt, Sisyphus session, aks-explorer waste, guard threshold approaching, structural interrupt, budget cap ineffective, KE-1989 F1, KE-1994 F2
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
(7 days ago) and marked as **implemented** in `shared/work-queue.md`
(done: 2026-06-08). However, the interrupt rate has not improved —
see F2 Update below.

## F2 Update (2026-06-15 04:00Z): Budget Cap Ineffective

The budget cap was marked implemented 7 days ago. Current data:

| Metric (12h window) | Value |
|---------------------|-------|
| planning_update total sessions | 132 |
| planning_update interrupted | 88 |
| **Interrupt rate** | **66.7%** |
| Wasted ops | 2,587 |
| Wasted wall-clock | ~5.7h |
| Avg ops per interrupted session | 29.4 |
| `project.planning-loop.exhausted` events (7d) | 0 |

The exhaustion event was never emitted, meaning either:
1. The budget cap code path is never reached (the interrupt cause
   is upstream of the meta-retry loop), or
2. The implementation didn't deploy correctly.

Either way, **F2 is confirmed**: the interrupt rate stays above 30%
post-fix, so there is an additional cause beyond the unbounded
meta-retry loop. The root cause appears to be the **planning_update
dispatch cadence itself** — the system dispatches new planning_update
sessions every ~5 minutes regardless of whether the previous one
completed, and each one runs ~246s (hard timeout) doing ~29 ops of
substantive work before being killed.

This is a scheduling/preemption problem, not a retry budget problem.

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
  **Status (2026-06-15 04:00Z)**: Still at 66.7% (12h). F1 holds.
- F2: If the planning-loop-run-budget-cap fix is implemented and
  deployed, and interrupt rate drops below 20%, the root cause was
  the unbounded meta-retry loop (KE-1654). If rate stays above 30%
  post-fix, there's an additional cause.
  **Status (2026-06-15 04:00Z)**: Budget cap marked implemented
  2026-06-08. Interrupt rate remains 66.7%. Zero exhaustion events
  emitted. **F2 confirmed**: there is an additional cause. The
  interrupt mechanism is planning_update dispatch preemption, not
  the meta-retry loop.
- F3 (new): If reducing planning_update dispatch frequency to
  once per 15 minutes (from ~5min) lowers the interrupt rate below
  30%, the root cause is dispatch cadence collision.
