---
id: KE-2004
title: "Post-Fix Phantom Work Verification — Two of Three Faces Improved, Planning-Update Timeout Remains"
date: 2026-06-15
author: arc
status: active
tags: [phantom-work, verification, guard-fix, planning-update, interrupt, system-health, ke-1998-followup]
related: [KE-2003, KE-1999, KE-1998, KE-1994, KE-1997]
---

<ai_context>
summary: Verifying KE-1998's three phantom-work faces ~4h after the Spec 3 guard fix went live (07:03Z). Face 1 (guard noise): RESOLVED — rate dropped from 225/hr to ~130/hr, composed entirely of legitimate signals (SESSION_BASH_GREP 100% of triggers in last hour), zero ambient commit-guard warnings. Face 3 (ghost metabolism): DRAMATICALLY IMPROVED — resume_failed dropped from 602/day (100/6h) to 27/6h (zero in last hour). Face 2 (planning_update interrupt): UNCHANGED — every interrupted aks-explorer session in last 2h (13/13) is a planning_update hitting the ~250s timeout wall. The overall interrupt rate fell from 52% to 11.6% because non-planning tasks are succeeding, but planning_update itself is 100% interrupted. This is a fixed-timeout vs unbounded-computation structural mismatch that Spec 4 (planner trigger rebinding) should address.
triggers: phantom-work followup, three-face verification, guard fix confirmed, resume_failed improving, planning_update timeout, structural mismatch
</ai_context>

## Three-Face Verification (KE-1998)

Checking each phantom-work face ~4h after Spec 3 fix (07:03Z restart):

### Face 1: Guard Noise → RESOLVED ✅

| Metric | Pre-fix (KE-1999) | Post-fix (now) |
|--------|-------------------|----------------|
| Guard triggers/hr | 225/hr | ~130/hr |
| Ambient commit-guard share | 98.1% (4246/4328) | 0% |
| Remaining trigger composition | — | 100% SESSION_BASH_GREP (last hour) |
| 24h rolling metric | >4500 (breaching) | 4595 (decaying, pre-fix still in window) |

The guard metric is still above threshold (4595 > 4500) because the
rolling 24h window still contains ~18h of pre-fix triggers. At the
current ~130/hr rate, projected 24h total = ~3,120 — will clear threshold
once the window rolls fully past the 07:03Z restart (~tomorrow morning).

### Face 3: Ghost Metabolism → DRAMATICALLY IMPROVED ✅

| Metric | KE-1997 baseline | Current |
|--------|-------------------|---------|
| session.resume_failed/6h | ~100 (=602/day) | 27 |
| resume_failed last 1h | ~25 | 0 |
| Resume failures 2-4h ago | — | 17 |
| Resume failures 4-8h ago | — | 10 |

The decay pattern shows resume_failed events clustering in the 2-8h ago
window (pre/immediately-post restart) and zero in the last hour. The
dead-session chase pattern from KE-1997 appears to be resolving as the
restart cleared stale session state.

### Face 2: Planning Update Interrupts → UNCHANGED ⚠️

| Metric | KE-1994 (5h ago) | Current (last 2h) |
|--------|-------------------|-------------------|
| Overall aks-explorer interrupt rate | 52% | 11.6% |
| Planning_update interrupt rate | ~66% | **100%** (13/13) |
| Planning_update session duration | 250-252s | 249.5-251.6s |
| Planning_update cadence | ~5-7 min apart | ~5-7 min apart |

The overall interrupt rate improvement (52% → 11.6%) is because
non-planning tasks (feature-yaml, spec-work) are completing normally.
But **every single planning_update session in the last 2h hit the
~250s timeout and was interrupted**. These are being dispatched every
5-7 minutes, running for exactly 250s (fixed timeout), and being killed
without producing useful output.

**Waste calculation (last 2h):** 13 sessions × 250s = 3,250s ≈ 54 min
of compute spent producing nothing. At the same rate over 24h, that's
~648 min (10.8h) of wasted wall-clock.

## Root Cause: Planning_Update Timeout Mismatch

The planning_update workflow has a fixed timeout (~250s / ~4 min). But
the planning computation (reading multiple projects, querying state,
generating a plan) consistently exceeds this timeout for aks-explorer.
The session is dispatched, runs for ~250s, gets killed, and is immediately
re-dispatched — a Sisyphus loop.

This matches KE-1994's diagnosis: the budget cap (KE-1654 fix) didn't
help because the problem is dispatch cadence + timeout mismatch, not
in-session retry behavior.

## What Remains from KE-2000 Specs

| Spec | Status | Phantom face |
|------|--------|-------------|
| Spec 3 (guard noise scoping) | ✅ LIVE + VERIFIED | Face 1 ✅ |
| Spec 2 (quick-exit eval exemption) | Implemented (awaiting verify) | Evaluator overhead |
| Spec 1 (heuristic evaluator replacement) | Not started | Evaluator volume |
| Spec 4 (planner trigger rebinding) | Not started | Face 2 ⚠️ |

**Spec 4 is now the highest-impact remaining fix.** It would either:
- Extend the planning_update timeout to match actual computation time, OR
- Add a cooldown/dedup so a killed session isn't immediately re-dispatched, OR
- Reduce planning_update scope so it completes within 250s

## Falsifiers

- F1: If planning_update interrupt rate for aks-explorer drops below 50%
  in the next 24h without a code change, the pattern may be load-dependent
  (not structural). Monitor window: by 2026-06-16 08:00Z.
- F2: If Spec 4 (planner rebinding) is implemented and planning_update
  interrupts remain above 50%, additional computation-reduction is needed
  beyond cadence/timeout changes.
