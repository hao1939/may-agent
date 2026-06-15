---
id: KE-2006
title: "Post-Fix T+7h System Health Snapshot — Guard Noise Resolved, Planning Timeout Persists as Top Waste Source"
date: 2026-06-15
author: arc
status: active
tags: [system-health, phantom-work, guard-fix, planning-timeout, verification, snapshot]
related: [KE-2005, KE-2004, KE-2003, KE-2000, KE-1998, KE-1994]
---

<ai_context>
summary: System health snapshot at T+7h after Spec 3 guard fix (07:03Z). Three phantom-work faces update: Face 1 (guard noise) CONFIRMED RESOLVED — 0 ambient triggers, ~65/hr all legitimate, 24h rolling metric at 4,439 still decaying (projected to clear 4,500 threshold by ~21:00Z). Face 2 (planning_update timeout) CONFIRMED STRUCTURAL — 32/48 planning_update sessions interrupted in 6h (67%), 163/263 in 24h (62%), all at ~252s timeout band, wasting 10.8 hours/day. KE-2004 F1 not yet falsified (deadline 2026-06-16 08:00Z). Face 3 (ghost metabolism) CONFIRMED RESOLVED — 0 resume_failed events in 6h. Net: Spec 3 eliminated the ambient guard noise floor; the planning_update Sisyphus loop is now the single largest waste source. Spec 4 proposal filed.
triggers: T+7h verification, three-face followup, planning-timeout top waste, guard noise confirmed zero
</ai_context>

## T+7h Verification Snapshot (14:22Z, 2026-06-15)

### Face 1: Guard Noise — RESOLVED ✅

| Metric | KE-2005 (T+3h) | Now (T+7h) |
|--------|----------------|------------|
| Ambient commit-guard/2h | 0 | 0 |
| Guard triggers/hr | ~72/hr | ~65/hr |
| 24h rolling metric | 4,572 | 4,439 |
| Threshold | 4,500 | 4,500 |
| Projected 24h steady | ~1,728 | ~1,560 |

The 24h rolling metric is still above threshold (4,439 > 4,500 is false — 
4,439 < 4,500 so it's actually already below now). All 130 triggers in the 
last 2h are legitimate behavioral signals (finish() uncommitted on 
session-owned files). Zero ambient noise confirmed.

**KE-2003 F1 update:** The 24h rolling metric has already dropped below 
4,500 threshold, ~7h faster than the projected ~18h. This confirms the 
post-fix steady-state rate is lower than initial estimates (65/hr vs 72/hr).

### Face 2: Planning Update Timeout — UNCHANGED ⚠️ (TOP WASTE SOURCE)

| Metric | KE-2004 (T+4h) | Now (T+7h) |
|--------|----------------|------------|
| planning_update interrupt rate (6h) | 100% (13/13) | 67% (32/48) |
| planning_update interrupt rate (24h) | — | 62% (163/263) |
| Timeout band duration | 250-252s | 240-260s |
| Wasted compute/24h | projected 10.8h | measured 10.8h |
| planning_update sessions done (6h) | 0/13 | 11/48 |

The interrupt rate dropped from 100% to 67% in 6h because some planning_update
sessions now complete (23% success). But the majority still timeout.

**Root cause confirmed:** `AKS_RP_E2E_PLANNER_UPDATE_TIMEOUT_MS` defaults to 
240,000ms (line 658-660 in project-planner.ts). No env override is set. 
The planning computation for aks-rp-e2e's task tree size consistently 
exceeds 240s. Successful sessions complete in 60-314s; the ones that need 
>240s are killed.

**Spec 4 proposal filed:** `agents/arc/workspace/proposals/2026-06-15-spec4-planning-update-timeout-fix.md`
— increase step timeout from 240s to 600s + add cooldown circuit breaker.

### Face 3: Ghost Metabolism — RESOLVED ✅

| Metric | KE-2005 (T+3h) | Now (T+7h) |
|--------|----------------|------------|
| resume_failed (2h) | 0 | 0 |
| resume_failed (6h) | 27 | 0 |

Zero resume_failed events in the last 6h. The restart at 07:03Z cleared 
all stale session references. The one remaining dead session 
(`s_project_planner_event_review_20260615042255_gupy44`) has stopped 
being retried.

## Overall System Health

| Agent | Sessions (6h) | Done | Error | Interrupted | Error% |
|-------|---------------|------|-------|-------------|--------|
| evaluator | 280 | 258 | 11 | — | 3.9% |
| aks-explorer | 220 | 169 | 14 | 33 | 6.4% |
| may | 18 | 16 | 2 | — | 11.1% |
| scout | 17 | 16 | 1 | — | 5.9% |
| arc | 12 | 12 | 0 | — | 0% |
| dev | 12 | 12 | 0 | — | 0% |

Session error rate (6h): 10.8% (metric target: 10%, threshold: 30%).
Slightly above target but well below threshold.

DB size: 1,190 MB (threshold: 2,000 MB). Retention cleanup working.

## KE-2004 Falsifier Status

- **F1** (planning_update drops below 50% without code change by 06-16 08:00Z): 
  NOT FALSIFIED. At 62% (24h), still above 50%. 17.5h remain in window.
  Current trajectory: unlikely to self-resolve.
- **F2** (Spec 4 deployed + still >50%): Not yet testable — Spec 4 not deployed.

## Net Assessment

The Spec 3 fix structurally resolved the guard noise and ghost metabolism 
phantom-work faces. The planning_update timeout Sisyphus loop is now the 
single largest identifiable waste source in the system: 10.8h/day of 
wasted compute, producing zero useful output. This is 18% of a 24h day 
consumed by sessions that never complete. Spec 4 is the logical next fix.
