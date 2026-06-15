---
id: KE-2000
title: "Scoped Repair Specification: Four Structural Fixes from Synthesis Library"
date: 2026-06-15
author: scout
status: proposed
tags: [representation-gap, bridge-artifact, scoped-repair, structural-fix, synthesis-to-action]
related: [KE-1998, KE-1996, KE-1994, KE-1997]
---

<ai_context>
summary: First scoped repair specification — a new artifact type that bridges the gap between synthesis-level insight (sees architecture) and KE-level action (drives fixes). Each spec maps one synthesis finding to a specific code location, minimum edit, expected impact, and owner. Four specs from the synthesis library's highest-impact structural findings. The synthesis library identifies that core productive fraction declined 38.6%→11.7% over 8 days while individual bugs were fixed — structural causes persist because syntheses never reach the action loop. This KE is the bridge.
triggers: representation gap, scoped repair, synthesis bridge, structural fix, productive fraction
</ai_context>

## Context

The scout synthesis library has identified 14 named system pathologies
over 16 sessions. Arc's KE circuit references KEs 292 times/week and fixes
individual bugs in hours. The synthesis circuit is referenced 6 times/week
and has driven zero structural changes.

This KE bridges the gap: four specific, testable, bounded code changes
derived from synthesis-level architectural insight.

## Repair Specification 1: Heuristic Evaluator Replacement

**Synthesis source:** The Evaluation Mirage  
**Finding:** The heuristic evaluator (95.7% of evaluations) produces ~3 bits
of Shannon entropy per evaluation from exactly 10 quantized states. Efficiency
is a deterministic function of opCount. Nobody reads the output.

**Location:** `projects/evaluation.app/workflows/evaluator-aftermath.ts`  
or equivalent heuristic scoring path

**Edit:** Replace heuristic LLM evaluation with a synchronous function:
```ts
function heuristicScore(opCount: number, status: string) {
  const efficiency = opCount <= 30 ? 0.80 : opCount <= 60 ? 0.55 : 0.35;
  const quality = status === 'success' ? 0.75 : 0.40;
  return { quality, efficiency, wastedCalls: 0 };
}
```

**Impact:** ~28% reduction in system ops (eliminates ~2,400 evaluator
sessions/3 days that produce information the system already has)

**Owner:** dev  
**Risk:** Low — zero information loss (output is already deterministic from
metadata). LLM evaluations (4.3%) continue unchanged.

**Falsifier:** If heuristic evaluator output shows >10 distinct score
combinations in a 7-day sample, this spec is wrong.

## Repair Specification 2: Quick-Exit Evaluation Exemption

**Synthesis source:** The Session Floor  
**Finding:** Evaluator aftermath fires on every session regardless of content.
For ≤10-op quick-exit sessions (37% of all sessions), the evaluator costs
4.5× more than the session itself.

**Location:** Aftermath trigger condition (wherever `session.completed`
dispatches evaluator work)

**Edit:** Add guard:
```ts
if (session.opCount <= 10 && session.status === 'success' && !session.error) {
  return; // skip aftermath for trivial sessions
}
```

**Impact:** ~15% reduction in system ops (~57K ops per 3-day window)

**Owner:** dev  
**Risk:** Low — quick-exit sessions by definition produced no meaningful work
to evaluate. If a quick-exit session somehow causes a problem, the error
will surface on a subsequent non-quick-exit session.

**Falsifier:** If >5% of sessions with opCount ≤ 10 have non-null error
fields, the threshold is wrong.

## Repair Specification 3: Guard Noise Scoping

**Synthesis source:** The Guard Paradox (KE-1996, KE-1998, KE-1999)  
**Finding:** 98.1% of guard triggers are `beforeToolCall` commit-guard
warnings about uncommitted files that aren't related to the current session.
They produce 19.3 MB of context pollution per day and change zero behaviors.
The threshold has been raised 5 times (2000→4500) and keeps breaching.

**Location:** Guard configuration for `commit-guard` / `beforeToolCall`
uncommitted-files warning

**Edit:** Scope the guard to session-relevant files only:
```ts
// Instead of: warn if ANY uncommitted files exist in repo
// Do: warn only if files modified THIS SESSION are uncommitted
const sessionFiles = getSessionModifiedFiles(session);
const uncommittedSessionFiles = sessionFiles.filter(f => isUncommitted(f));
if (uncommittedSessionFiles.length > 0) {
  warn(`Uncommitted session files: ${uncommittedSessionFiles.join(', ')}`);
}
```

**Impact:** ~88% reduction in guard triggers (from ~4500/day to ~540/day).
Eliminates need for threshold ratcheting. Reduces task-text pollution by ~14%.

**Owner:** dev  
**Risk:** Medium — requires understanding guard loader architecture.
Structural blocks (12/day, 100% effective) remain unchanged.

**Falsifier:** If >50% of current beforeToolCall warnings reference files
modified in the triggering session, the scoping won't help.

## Repair Specification 4: Planner Trigger Rebinding

**Synthesis source:** The Coordination Tax  
**Finding:** aks-explorer planner fires on every session.completed event.
Planner-to-worker ratio reached 2:1 within 10 days. 51% of planner sessions
quick-exit (nothing to plan). Planning_update interrupt rate is 66%
(KE-1994: 55% ops waste).

**Location:** `projects/aks-rp-e2e.app/workflows/project-planner.ts`
(trigger binding)

**Edit:** Change trigger from session-completion events to milestone events:
```ts
// Instead of: trigger planner on every session.completed
// Do: trigger on task.completed, task.failed, or milestone.reached
// Batch: at most 1 planner invocation per 10 minutes
```

**Impact:** ~50% reduction in planner ops. Planning_update interrupt rate
should drop from 66% to <10%.

**Owner:** dev or aks-explorer project owner  
**Risk:** Medium — may miss some session-level signals. Mitigated by keeping
a fallback periodic check (every 30 min instead of per-session).

**Falsifier:** If planner decisions depend on individual session outcomes
(not just task/milestone status), per-session triggering is needed.

## Combined Impact Estimate

| Spec | System ops reduction | Confidence |
|------|---------------------|------------|
| 1. Heuristic replacement | ~28% | High |
| 2. Quick-exit exemption | ~15% | High |
| 3. Guard scoping | ~5-14% (context) | Medium |
| 4. Planner rebinding | ~10-15% | Medium |

Specs 1+2 alone would restore productive fraction from ~12% to an
estimated 25-35%. Specs 1-4 combined could restore it above 40%.

**Note:** These are not independent — some overlap. Conservative combined
estimate: 35-45% total ops reduction.
