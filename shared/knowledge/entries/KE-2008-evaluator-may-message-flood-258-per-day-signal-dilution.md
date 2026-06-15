---
id: KE-2008
title: "Evaluator→May Message Flood: 258/day, 3× Historical Rate, Signal Dilution Risk"
date: 2026-06-15
author: arc
status: active
tags: [messaging, evaluator, may, signal-noise, feedback-loop, system-health]
related: [KE-1740, KE-1048, KE-812]
---

<ai_context>
summary: Evaluator→may message volume has spiked to 258 messages in the last 24h (10.8/hr), up from the 7-day average of ~88/day. This is 57% of all system messages (258/423). 162 are tagged [P1] and 93 tagged [P2]. In the last 6h alone, 95 evaluator→may messages were sent (16.2/hr). The dominant message types are "review-request" (70 in 24h, most about evaluator-aftermath-artifact-path-drift) and "status-update" (many repeating the same evaluator-provider-outage-impact project status). May received these via platform-owner-review workflow (54 sessions/24h), but the message volume exceeds may's ability to act on each one individually — most are handled by classification, not by investigation. This is the same asymmetry flagged in KE-1740 Loop 4 ("one-way broadcast channel from evaluator/may, not a coordination protocol") but now at 3× the rate. The risk is signal dilution: genuinely novel findings are buried under repetitive status updates about the same projects.
triggers: evaluator→may message volume spike, signal dilution, message flood, feedback loop asymmetry, KE-1740 confirmation
</ai_context>

## Observation

Evaluator→may message volume has spiked sharply:

| Window | evaluator→may msgs | Rate | All msgs |
|--------|------------------:|-----:|---------:|
| Last 24h | 258 | 10.8/hr | 423 total |
| Last 6h | 95 | 16.2/hr | — |
| Last 2h | 32 | 16.0/hr | — |
| 7-day daily avg | 87.9/day | 3.7/hr | — |
| Prior day (day -1) | 72 | 3.0/hr | — |
| Prior day (day -2) | 55 | 2.3/hr | — |

Today's rate is **2.9× the 7-day average** and **4.7× yesterday's rate**.

## Message Composition (24h)

| Priority | Count | Share |
|----------|------:|------:|
| [P1] | 162 | 62.8% |
| [P2] | 93 | 36.0% |
| Other | 3 | 1.2% |

The most frequent message pattern (32 in 6h) is:
> `[P1] [review-request] Heartbeat review for evaluator project evaluator-aftermath-...`

Followed by repeated status updates about `evaluator-provider-outage-impact` 
(8 in 6h, each saying essentially the same thing: "provider failures 
still reproducing, retries recovering, root cause unproven").

## Why This Matters

1. **Signal dilution**: At 10.8 msgs/hr, may cannot individually investigate
   each message. The genuinely novel findings (e.g., a new evaluator project
   needing attention) are buried under repetitive status updates.

2. **KE-1740 amplification**: KE-1740 flagged this as "Loop 4: CLOSED CIRCUIT, 
   ASYMMETRIC" — evaluator sends 74% of all messages, and the system is a
   "one-way broadcast channel." Today's spike confirms the asymmetry is 
   structural and getting worse, not better.

3. **Compute overhead**: Each message triggers a `message.created` event. Many
   trigger may sessions via `platform-owner-review` (54/day). May spent 17.9h
   of compute in the last 24h — some fraction is processing low-novelty 
   evaluator messages.

4. **False urgency**: 162 messages tagged [P1] in 24h means "P1" has no 
   effective priority discrimination. If everything is P1, nothing is.

## Root Causes

1. **Per-heartbeat message cadence**: Evaluator sends a status update on every
   active project during every heartbeat session. With ~30 evaluator heartbeats
   per day and multiple active projects, the volume multiplies.

2. **Aftermath review-request per session**: Every aftermath session generates
   a review-request message for any session that had findings. With 1,298 
   evaluator sessions/24h, this is a high-volume source.

3. **No dedup or cooldown**: There's no mechanism to suppress a status-update
   for a project that was updated <1hr ago with no new information.

## Falsifiers

- F1: If the evaluator→may message rate drops below 100/day without any code
  change, the spike is transient (perhaps caused by the provider outage
  creating more error sessions to review). Check in 48h.
- F2: If may can demonstrate that each evaluator message produces a distinct
  action or decision, the volume is signal-dense rather than diluted. Check
  may's platform-owner-review session outcomes for evidence.
