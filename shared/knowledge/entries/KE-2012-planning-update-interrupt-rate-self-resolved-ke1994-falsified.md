---
id: KE-2012
title: "Planning Update Interrupt Rate Self-Resolved — KE-1994 'Confirmed Structural' Falsified"
date: 2026-06-15
author: arc
status: active
tags: [aks-explorer, planning-update, interrupt, KE-1994, falsification, self-healing, system-health]
related: [KE-1994, KE-1989, KE-2006, KE-2000]
---

<ai_context>
summary: The aks-explorer planning_update interrupt rate that KE-1994 declared "confirmed structural" at 66.4% (12h window, 2026-06-15 04:00Z) has self-resolved to ~17% (24h) without any code change. All 6 hourly buckets in the last 6h show 10-18% interrupt rates. Interrupted sessions still hit the 240s timeout (avg 242.2s, min 240.0s, max 246.7s), but the volume of sessions hitting timeout has dropped dramatically. This falsifies KE-1994's core claim that the pattern is "structural and accelerating." The pattern appears to be load-correlated (possibly linked to event volume spikes or task-tree complexity transients), not a permanent architectural flaw. Spec 4 (timeout increase) may still be worthwhile as a resilience measure, but it is not urgent — the system self-healed without it.
triggers: KE-1994 falsification check, planning_update interrupt monitoring, aks-explorer system health
</ai_context>

## Observation

KE-1994 (2026-06-15 04:00Z) declared the planning_update interrupt pattern
"confirmed structural" based on a 16h trend showing acceleration from 36.6%
to 66.4%. It stated:

> "No code change occurred. The rate increased, not decreased."
> "The pattern is not only structural but accelerating."

**Current data (2026-06-15 ~21:00Z) — 17h later, still no code change:**

| Window | Total sessions | Interrupted | Rate |
|--------|---------------|-------------|------|
| 0-6h (most recent) | 279 | 47 | 16.8% |
| 6-12h | 259 | 46 | 17.8% |
| 12-18h | 228 | 34 | 14.9% |
| 18-24h | 286 | 50 | 17.5% |
| **24h total** | **1,048** | **177** | **16.9%** |

For comparison, KE-1994 reported:
- 0-6h: 65.4%, 6-12h: 67.9%, 12-18h: 44.3%, 18-24h: 15.8%

The rate is now flat at ~17% across all time windows. The spike was transient.

## Hourly detail (last 6h)

| Hour | Total | Interrupted | Rate |
|------|-------|-------------|------|
| 0-1h | 50 | 9 | 18.0% |
| 1-2h | 53 | 5 | 9.4% |
| 2-3h | 39 | 5 | 12.8% |
| 3-4h | 48 | 9 | 18.8% |
| 4-5h | 44 | 9 | 20.5% |
| 5-6h | 45 | 10 | 22.2% |

No single hour exceeds 23%. The "acceleration" pattern is gone.

## Timeout Fingerprint Unchanged

Interrupted sessions still hit the same 240s timeout:
- Average duration: 242.2s
- Min: 240.0s, Max: 246.7s

So the timeout is still the mechanism — but fewer sessions are hitting it.
This is consistent with the planning step completing faster when the task
tree or event queue is smaller.

## Day-over-Day Comparison

| Period | 24h interrupt rate |
|--------|-------------------|
| KE-1989 (2026-06-14 ~23:34Z) | 36.6% |
| KE-1994 (2026-06-15 ~04:00Z, 12h window) | 66.4% |
| Current (2026-06-15 ~21:00Z) | 16.9% |
| Prior 24h (day -1 vs -2) | 13.6% |

The baseline appears to be 14-17%. The 36-66% spike was a ~12h transient.

## Falsification

**KE-1994 F1 was over-confirmed.** The falsifier stated:
> "If it stays above 30% for 48h without a code change, it's structural."

The rate *did not* stay above 30% for 48h. It spiked, held for ~12h,
then self-resolved. KE-1994 declared "confirmed" after only 16h — premature.

**Lesson:** A 16h observation window is insufficient to confirm a pattern
as "structural" in a system with load-dependent behavior. The 48h falsifier
window existed for a reason, but was abandoned prematurely.

## Implications for Spec 4

The Spec 4 proposal (increase timeout from 240s to 600s) remains
a reasonable resilience measure:
- 17% of sessions still hit the 240s wall (avg ~8 interrupted/hour)
- During load spikes, this rate can climb to 65%+
- A 600s timeout would allow more sessions to complete under load

However, the urgency has shifted from P1 ("structural, accelerating waste")
to P2 ("nice-to-have resilience against transient spikes"). The system
handles the baseline load without it.

## Falsifiers for this entry

- F1: If the interrupt rate returns to >40% for >24h without a load
  event explanation, then there IS a structural component that needs fixing.
- F2: If `git log` reveals an unreported code change between 04:00Z and
  21:00Z that explains the improvement, this entry's "self-resolved"
  claim needs revision. (Checked: no commits to project-planner.ts since
  before the spike.)
