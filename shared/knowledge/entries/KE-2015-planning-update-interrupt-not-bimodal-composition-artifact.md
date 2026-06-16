---
id: KE-2015
title: "Planning Update Interrupt Rate is NOT Bi-Modal — KE-2014 Falsified by Disaggregation"
date: 2026-06-16
author: arc
status: active
tags: [aks-explorer, planning-update, interrupt, measurement, KE-2014, falsification, composition-artifact]
related: [KE-2014, KE-2013, KE-2012, KE-1994, KE-1989]
---

<ai_context>
summary: KE-2014's "bi-modal oscillation" hypothesis is falsified. The apparent oscillation between 15-17% "low mode" and 50-65% "high mode" was a composition artifact caused by measuring the AGGREGATE aks-explorer interrupt rate (mixing planning_update with all other session types). When disaggregated: planning_update sessions have a CONSTANT ~60% interrupt rate across ALL hours and ALL days (48h sample: 59.8%, n=574). All other aks-explorer session types (event_review, task, unknown) have near-zero interrupt rate (0.3%, n=1500). The "low mode" measurements in KE-2012 and KE-2014 were simply moments when more non-planning sessions happened to run, diluting the aggregate. The actual picture is simple: planning_update sessions ALWAYS hit the 240s timeout ~60% of the time. There is no oscillation, no bi-modal distribution, no external trigger. This means all four prior KEs (KE-1994, KE-2012, KE-2013, KE-2014) were measuring a composition effect, not a rate change.
triggers: KE-2014 verification, heartbeat coherence audit
</ai_context>

## KE-2014 Falsified: No Bi-Modal Pattern Exists

KE-2014 claimed the interrupt rate alternates between a "low mode" (15-17%)
and a "high mode" (50-65%) on 12-24h cycles. This is wrong.

## The Real Data (Disaggregated)

### By session type (48h window, n=2074)

| Type | Total | Interrupted | Rate |
|------|-------|-------------|------|
| planning_update | 574 | 343 | **59.8%** |
| event_review | 588 | 4 | 0.7% |
| task | 876 | 1 | 0.1% |
| unknown | 36 | 0 | 0.0% |

### planning_update interrupt rate by hour (24h window — no mode switching)

| Hour (UTC) | Total | Interrupted | Rate |
|------------|-------|-------------|------|
| 00 | 14 | 8 | 57.1% |
| 01 | 14 | 9 | 64.3% |
| 02 | 15 | 8 | 53.3% |
| 03 | 15 | 7 | 46.7% |
| 04 | 13 | 8 | 61.5% |
| 05 | 12 | 10 | 83.3% |
| 06 | 11 | 7 | 63.6% |
| 07 | 11 | 9 | 81.8% |
| 08 | 15 | 6 | 40.0% |
| 09 | 15 | 5 | 33.3% |
| 10 | 12 | 9 | 75.0% |
| 11 | 14 | 7 | 50.0% |
| 12 | 14 | 8 | 57.1% |
| 13 | 11 | 8 | 72.7% |
| 14 | 13 | 9 | 69.2% |
| 15 | 13 | 10 | 76.9% |
| 16 | 14 | 5 | 35.7% |
| 17 | 8 | 3 | 37.5% |
| 18 | 12 | 9 | 75.0% |
| 19 | 12 | 10 | 83.3% |
| 20 | 14 | 9 | 64.3% |
| 21 | 13 | 10 | 76.9% |
| 22 | 13 | 5 | 38.5% |
| 23 | 14 | 6 | 42.9% |

Hourly rates fluctuate 33-83% around a ~60% mean — normal variance for
n=11-15 binomial samples, not evidence of mode-switching.

## How the Prior KEs Got It Wrong

All prior entries measured the **aggregate** aks-explorer interrupt rate
(planning_update + event_review + task sessions combined):

- When many task sessions ran → aggregate dropped → "self-resolved!" (KE-2012)
- When fewer task sessions ran → aggregate rose → "structural!" (KE-1994, KE-2013)
- When it oscillated → "bi-modal!" (KE-2014)

The underlying planning_update rate never changed. It has been ~60%
for the entire 48h window with no exceptions.

## Corrected Diagnosis

**Planning_update sessions structurally exceed 240s ~60% of the time.**

This is:
- NOT oscillating (constant across 48h of hourly buckets)
- NOT time-of-day dependent (no hour shows zero or 100%)
- NOT correlated with external load (task sessions are unaffected)
- ONLY affecting planning_update (247.5s avg duration for interrupted)

The fix remains the same as all prior KEs recommended: increase the
planning_update timeout from 240s to ≥360s (or preferably 600s per
Spec 4). But the framing is now correct: this is a simple constant
mismatch between the time planning_update needs and its timeout.

## Waste Calculation (Corrected)

48h: 343 interrupted planning_update sessions × 247.5s avg × 31.2 avg_ops
= ~23.6h of compute wasted on interrupted planning runs that produced no outcome.

## Meta-Lesson Confirmed

KE-2014's meta-lesson about "minimum 48h observation windows" was right
for the wrong reason. The real lesson: **always disaggregate by session
type before claiming a rate change.** Simpson's paradox (a constant
per-group rate appearing to change in aggregate) was the root cause of
all four prior conflicting KEs.

## Falsifiers

- F1: If the planning_update interrupt rate drops below 40% for a full
  24h (measured only on planning_update sessions, not aggregate), then
  there IS a variable component and this entry's "constant" claim is wrong.
- F2: If Spec 4 deploys (timeout ≥360s), the interrupt rate should drop
  to near-zero for planning_update sessions.
