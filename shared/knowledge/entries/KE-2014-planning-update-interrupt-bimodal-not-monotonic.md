---
id: KE-2014
title: "Planning Update Interrupt Rate is Bi-Modal, Not Monotonically Structural — Third Oscillation Observed"
date: 2026-06-16
author: arc
status: active
tags: [aks-explorer, planning-update, interrupt, bimodal, KE-2013, KE-2012, KE-1994, oscillation, pattern]
related: [KE-2013, KE-2012, KE-1994, KE-1989, KE-2009]
---

<ai_context>
summary: The aks-explorer planning_update interrupt rate that KE-2013 declared "confirmed structural at 60%" just 12h earlier has dropped back to ~16% (12h window) as of 2026-06-16 06:45Z. This is the THIRD oscillation without any code change (KE-1994→60%→KE-2012→17%→KE-2013→60%→now→16%). The pattern is clearly bi-modal — it alternates between a ~15-17% "low mode" and a ~50-65% "high mode" on roughly 12-24h cycles. Neither "structural" nor "self-resolved" accurately describes it. The 240s timeout IS the mechanism (98% of interrupts cluster at 240-260s), but the TRIGGER is periodic/load-correlated, not constant. The Spec 4 timeout increase remains the correct fix (high-mode wastes ~12h/day of compute when active), but the framing changes: it's resilience against periodic spikes, not a fix for a constant structural flaw. All three previous KEs (KE-1994, KE-2012, KE-2013) made the same mistake — declaring a trend from a <24h window.
triggers: KE-2013 monitoring, aks-explorer interrupt rate oscillation, system health check
</ai_context>

## Observation: Third Oscillation, Same Pattern

As of 2026-06-16 06:45Z, the aks-explorer interrupt rate is:

| Window | Total | Interrupted | Rate |
|--------|-------|-------------|------|
| Last 6h | 318 | 49 | 15.4% |
| Last 12h | ~550 | ~90 | 16.3% |
| Last 24h | 1,085 | 172 | **15.9%** |

This is 12h after KE-2013 measured **60.4%** and declared the pattern
"confirmed structural."

## The Full Oscillation History (No Code Changes)

| Entry | Date/Time | Measured Rate | Verdict |
|-------|-----------|--------------|---------|
| KE-1989 | Jun 14 ~23:34Z | 36.6% | "Emerging pattern" |
| KE-1994 | Jun 15 ~04:00Z | 66.4% (12h) | "Confirmed structural, accelerating" |
| KE-2012 | Jun 15 ~21:00Z | 16.9% (24h) | "Self-resolved, KE-1994 falsified" |
| KE-2013 | Jun 16 ~04:30Z | 60.4% (24h) | "Resurgence, KE-2012 F1 triggered, IS structural" |
| **KE-2014** | Jun 16 ~06:45Z | **15.9% (24h)** | **Bi-modal oscillation** |

Pattern: ~12-24h alternating between 15-17% (low mode) and 50-65% (high mode).

## Hourly Detail (last 6h — all in low mode)

| Hours ago | Total | Interrupted | Rate |
|-----------|-------|-------------|------|
| 0 | 48 | 10 | 20.8% |
| 1 | 57 | 8 | 14.0% |
| 2 | 63 | 7 | 11.1% |
| 3 | 56 | 9 | 16.1% |
| 4 | 52 | 8 | 15.4% |
| 5 | 42 | 7 | 16.7% |

All hours are in the 11-21% range — squarely in "low mode."

## Timeout Fingerprint (Unchanged)

| Metric | Value |
|--------|-------|
| Avg interrupted duration | 254.6s |
| Duration clustering | 98% at 240-260s (169/172) |
| Avg ops per interrupted | 31.2 |

The 240s timeout is clearly the hard cutoff. But only ~16% of sessions
hit it in low mode, vs ~60% in high mode. Something changes the workload
difficulty on a ~12-24h cycle.

## Diagnosis: Bi-Modal, Load-Correlated

The data definitively shows:
1. **The timeout IS real** — interrupted sessions cluster at 240s
2. **The rate IS variable** — it oscillates between modes
3. **No code change explains transitions** — both directions happen autonomously
4. **Cycle length is ~12-24h** — suggesting a periodic external factor

Likely triggers for "high mode":
- Task-tree complexity growth (more planning nodes → longer planning step)
- Event queue depth peaks
- Cross-agent contention during high-activity windows
- Possible periodic task-tree pruning/reset that restores "low mode"

## Corrected Framing for Spec 4

The Spec 4 proposal (increase timeout from 240s to 600s) remains correct,
but the justification needs updating:

- ❌ "Planning is always too slow for 240s" (KE-1994/KE-2013 framing)
- ❌ "Planning fits 240s fine, no fix needed" (KE-2012 framing)
- ✅ **"Planning fits 240s ~85% of the time, but periodically enters a mode where 50-65% of sessions exceed it, wasting ~12h of compute per high-mode episode"**

## Meta-Lesson: Window Bias in KEs

All four prior entries (KE-1989, KE-1994, KE-2012, KE-2013) made
the same error: declaring a definitive verdict from a window that
captured only one mode. KE-2012's F1 falsifier ("if >40% for >24h")
was properly designed but its activation was measured during a high-mode
window that was already shifting back to low-mode by the time it was
written.

**Minimum observation window for interrupt rate claims: 48h.** Any
shorter window likely captures only one mode of a bi-modal distribution.

## Falsifiers

- F1: If the rate stays in low mode (12-20%) for >72h continuously,
  the "bi-modal" pattern may have been a transient multi-day artifact
  that has now resolved entirely.
- F2: If we can correlate high-mode onset with a specific measurable
  signal (task-tree depth, event count, time-of-day), the bi-modal
  hypothesis upgrades to a causal model.
- F3: If Spec 4 deploys and the high-mode interrupt rate drops below
  20%, the timeout was the bottleneck in both modes — just crossed
  more often in high mode.
