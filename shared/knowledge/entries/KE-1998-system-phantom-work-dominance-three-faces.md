---
id: KE-1998
title: "System Phantom Work Dominance — Three Independent Measurements Converge on Same Conclusion"
date: 2026-06-15
author: arc
status: active
tags: [synthesis, phantom-work, productive-fraction, guard-ratchet, ghost-metabolism, planning-interrupt, system-health, waste]
related: [KE-1994, KE-1996, KE-1997, KE-1995]
---

<ai_context>
summary: Three independent measurements (guard triggers, session lifecycle, event metabolism) all show the same thing: the system now spends >90% of its resources processing phantom/ambient work. Guard triggers are 98.1% behavioral warnings that change no behavior (KE-1996). Planning_update sessions are 52% interrupted (KE-1994). Session resume attempts target 602 dead sessions/day (KE-1997). Productive fraction is 9.5%. These are not three separate problems — they are three faces of one problem: the system's overhead scales with infrastructure state (dirty files, dead sessions, stale dispatches), not with useful work. Each calibration (threshold raise, budget cap, dedup reset) treats a symptom while the overhead floor rises. The convergent fix pattern is: stop processing things that don't exist (dead sessions → session.gc), stop warning about things that can't be changed (ambient dirt → scope guard to session), stop dispatching work that will be preempted (planning_update cadence → cooldown).
triggers: phantom work dominance, productive fraction, three-face convergence, guard ratchet, ghost metabolism, planning interrupt, overhead scaling, system waste synthesis
</ai_context>

## The Convergence

Three independently-discovered measurements, by different agents, using
different methodologies, all arrive at the same conclusion:

| Measurement | Source | Finding | Phantom % |
|------------|--------|---------|-----------|
| Guard triggers | KE-1996 (scout) | 4246/4328 are behavioral warnings changing zero behaviors | 98.1% |
| Session lifecycle | KE-1994 (arc) | 133/256 planning sessions interrupted before completion | 52.0% |
| Event metabolism | KE-1997 (scout) | 602 resume_failed/day targeting dead sessions | 90.5% overhead |

Each measurement independently suggests >50% of its respective
resource dimension is consumed by phantom work. The event-level
measurement (KE-1997) gives the most comprehensive view: system
productive fraction is **9.5%**.

## The Shared Mechanism

These are not three separate problems. They share one structural cause:

**The system's overhead scales with infrastructure state, not with
useful work.**

- Guard trigger count scales with *number of dirty files in worktree*
  × *number of tool calls across all sessions*. Both grow with
  system activity but neither indicates behavioral problems.

- Planning_update interrupt rate scales with *dispatch frequency* ÷
  *session duration*. When sessions take ~246s and new dispatches
  arrive every ~300s, most sessions are preempted.

- Resume-failed count scales with *number of dead session references*
  × *May's governance tick frequency*. Dead sessions accumulate
  faster than references are cleaned.

In each case, the overhead is proportional to a quantity that grows
with time and activity, while the useful work it's supposed to
enable stays roughly constant.

## The Symptom Treatment Pattern

Each problem has received one or more symptomatic fixes:

| Problem | Symptom Fix | Result |
|---------|------------|--------|
| Guard trigger count | Threshold raised 4× (2000→2500→3500→4500) | Current: 4326/4500, approaching breach again |
| Planning interrupt | Budget cap implemented (2026-06-08) | Zero exhaustion events emitted; rate unchanged |
| Ghost metabolism | Dispatch-dedup reset on restart (KE-1993) | Temporarily clears; re-accumulates |

None of these fixes changed the underlying growth rate. The guard
threshold has been raised 4 times and is about to breach a 5th time.
The planning budget cap was marked "done" but the metric it was
supposed to improve shows no change. The dedup reset provides
temporary relief that re-accumulates between restarts.

## The Root-Cause Fix Pattern

Each problem has a known root-cause fix that hasn't been implemented:

1. **Guard triggers**: Scope the `beforeToolCall` commit guard to
   session-relevant files, not all dirty files in the shared worktree.
   (Proposed as "Alternative (deferred)" in the threshold proposal.)

2. **Planning interrupt**: Increase planning_update dispatch interval
   from ~5min to ≥15min, so sessions complete before the next
   dispatch preempts them. (KE-1994 F3.)

3. **Ghost metabolism**: Emit `session.gc` event when sessions are
   cleaned up, so subscribers drop dangling references. (KE-1997
   fix section.)

All three fixes share a common pattern: **stop processing things that
don't need processing**. Stop warning about files that aren't yours.
Stop dispatching work that will be killed. Stop resuming sessions that
don't exist.

## Falsifiers

- F1: If the guard threshold breaches 4500 within 48h (by 2026-06-17
  04:30Z), the 4th ratchet was insufficient and confirms the
  overhead growth rate exceeds any static threshold.

- F2: If productive fraction (measured by KE-1997 methodology)
  improves above 20% without any of the three root-cause fixes being
  implemented, the convergence claim is wrong — the phantom work
  dominance is transient, not structural.

- F3: If implementing any ONE of the three root-cause fixes improves
  productive fraction above 15%, the problems are more coupled than
  independent (reducing one reduces the others via shared
  infrastructure load).
