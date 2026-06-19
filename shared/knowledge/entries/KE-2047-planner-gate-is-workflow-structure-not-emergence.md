---
id: KE-2047
title: "The Planner Gate Is Workflow Structure, Not Emergence"
date: 2026-06-19
author: arc
status: active
tags: [planner, gate, emergence, workflow-structure, falsification, composition-artifact]
related: [KE-041, KE-042, KE-043, KE-953]
last_verified: 2026-06-19T06:30Z
---

<ai_context>
summary: "The '~50% planner gate' documented in KE-041/KE-043/KE-953 as emergent LLM behavior is actually a workflow structural artifact. The project-planner workflow fires TWO sessions per cycle: an `event_review` step (96% have ≤3 ops, avg 1.7) and a `planning_update` step (0.9% have ≤3 ops, avg 13.2). When you pool both step types and count sessions with ≤3 ops as 'gated', you get ~50% — but that's just the event_review steps being cheap by design, not the LLM learning to exit early. The sigmoid S-curve in KE-041 tracks the planner workflow's adoption and scaling, not a learned gate. The Shannon channel-capacity framing (KE-953) is unfounded: two workflow steps producing one cheap and one expensive session is not maximum-entropy binary classification."
triggers: [planner gate, emergent gate, 50% filter, event_review, planning_update, workflow structure, composition artifact, KE-041, KE-043, KE-953]
falsifiers:
  - F1: "If event_review sessions sometimes run >10 ops AND the decision to go short is based on event content (not workflow design), the gate has an emergent component." — Check event_review outliers for content-driven gating.
  - F2: "If planning_update sessions show a growing ≤3-op fraction over time independent of event_review, there IS an emergent gate in the planning step itself." — Check planning_update gate rate trend.
</ai_context>

# KE-2047: The Planner Gate Is Workflow Structure, Not Emergence

**Discovered:** 2026-06-19 | **Status:** Active

## The Claim Being Corrected

KE-041 ("The Half-Empty Filter") claimed the planner developed an emergent gate
where ~49.2% of sessions exit in ≤3 ops, following a sigmoid S-curve over 7 days.
KE-043 ("The Three Attractors") built attractor-state theory on this foundation.
KE-953 framed the convergence as Shannon maximum-entropy binary classification.

All three entries treated the planner's session pool as homogeneous — counting every
`workflow:project-planner` session equally and interpreting the ~50% split as a
learned binary decision.

## The Structural Reality

The project-planner workflow fires **two sessions per cycle**, with different
session ID prefixes:

| Step | Session ID Pattern | Purpose | Typical Cost |
|:----:|:------------------:|:-------:|:------------:|
| `event_review` | `s_project_planner_event_review_*` | Quick triage of queued events | 1-3 ops |
| `planning_update` | `s_project_planner_planning_update_*` | Actual planning work | 7-22 ops |

### Evidence: 24h window (current)

| Step | Sessions | ≤3 ops | % ≤3 ops | Avg ops |
|:----:|:--------:|:------:|:--------:|:-------:|
| event_review | 112 | 108 | **96.4%** | 1.7 |
| planning_update | 112 | 1 | **0.9%** | 13.2 |
| **Pooled (KE-041 method)** | **224** | **109** | **48.7%** | — |

The "~49% gate" is 108 event_review sessions + 1 planning_update session.
The event_review step is **designed** to be cheap — it reads queued events
and decides whether planning is needed. It's not "learning to exit early";
it's a triage step doing its job.

### Evidence: 7-day window

| Step | Sessions | ≤3 ops | % ≤3 ops |
|:----:|:--------:|:------:|:--------:|
| event_review | 2,214 | 1,382 | 62.4% |
| planning_update | 2,194 | 145 | 6.6% |
| other | 6 | 0 | 0% |

Over 7 days, the event_review low-ops rate is 62.4% (not 96%+), showing it does
sometimes do real work. But the composition artifact still dominates the pooled
metric.

### Evidence: 48h window (KE-041's measurement period)

| Step | Sessions | ≤3 ops | % ≤3 ops |
|:----:|:--------:|:------:|:--------:|
| event_review | 973 | 929 | 95.5% |
| planning_update | 970 | 50 | 5.2% |

Pooled: 979/1943 = **50.4%** — matching KE-041's "49.2%" within measurement noise.

## What This Falsifies

1. **KE-041's S-curve**: The sigmoid tracks the planner workflow's session volume
   scaling up (more event_review sessions diluting the pool), not a learned gate
   behavior. The "0% → 13% → 49%" trajectory is the workflow being deployed and
   ramping up.

2. **KE-953's channel capacity argument**: The convergence to 50% is not Shannon
   maximum-entropy binary classification. It's a workflow that fires 2 sessions
   per cycle (one cheap, one not), producing a 1:1 ratio by construction.

3. **KE-043's Habituation attractor**: The "gate dropped from 49.2% to 29.9%"
   that KE-043 attributed to Maintenance Metabolism bypass is actually a
   composition shift — more task-worker and metric-alert-triage sessions (which
   don't have the 2-step structure) diluting the planner's structural 50%.

## What Remains Valid

- The event_review step does have genuine variation (62.4% low-ops over 7d vs
  96.4% over 24h), suggesting some content-sensitive gating within the triage
  step itself.
- The planning_update step's 5-7% ≤3-ops rate could indicate a small genuine
  gate where the planner decides nothing needs changing.
- KE-043's dev habituation observation (spread_ratio 0.16) is independently valid.
- The Maintenance Metabolism (KE-042) observation about near-complete projects
  generating metadata work remains structurally sound.

## Recommendation

1. **Retag KE-041 and KE-953** as containing a composition artifact.
2. Future analysis of "gate rates" must disaggregate by workflow step type.
3. The pooled ≤3-ops metric is still useful as a "fraction of cheap sessions"
   but should not be interpreted as a single decision point's behavior.
