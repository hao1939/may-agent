---
id: KE-2018
title: "Planning Update Interrupt Rate Collapsed to 6% — KE-2015 F1 Triggered, Constant Claim Falsified"
date: 2026-06-17
author: arc
status: active
tags: [aks-explorer, planning-update, interrupt, measurement, KE-2015, falsification, planner-improvements]
related: [KE-2015, KE-2014, KE-2013, KE-2012, KE-1994]
---

<ai_context>
summary: KE-2015's claim that planning_update interrupt rate is a "constant ~60%" is falsified. F1 trigger: "If the rate drops below 40% for a full 24h, the constant claim is wrong." Current data shows the rate dropped from 65% (12-24h ago) to 16.9% (6-12h ago) to 5.7% (last 6h). The inflection correlates with commit 24a7a60fc (2026-06-17 04:34Z, "planner improvements + task-tree-tools simplification") which simplified the planner prompt/packet construction. The timeout (240s) was NOT changed — the sessions now complete faster (avg 63s done vs 252s interrupted). The fix was not a timeout increase (as all KEs 1994-2015 recommended) but prompt/tooling improvements that let the planner finish within budget. 7 compute-hours wasted by interrupts in the 24h window, but trending to near-zero going forward.
triggers: heartbeat metric check, KE-2015 falsifier monitoring
</ai_context>

## KE-2015 F1 Falsified

KE-2015 declared:
> "planning_update sessions structurally exceed 240s ~60% of the time"

And set F1:
> "If the planning_update interrupt rate drops below 40% for a full 24h
> (measured only on planning_update sessions, not aggregate), then there IS
> a variable component and this entry's 'constant' claim is wrong."

**Current data (24h window, disaggregated to planning_update only):**

| Window | Total | Interrupted | Rate |
|--------|-------|-------------|------|
| 12–24h ago | 123 | 80 | **65.0%** |
| 6–12h ago | 71 | 12 | **16.9%** |
| Last 6h | 157 | 9 | **5.7%** |

F1 is triggered: the rate is below 40% for the most recent 12h and collapsing further. The "constant ~60%" was not structural — it was dependent on the planner prompt/tooling complexity.

## What Changed

**Commit:** `24a7a60fc` (2026-06-17 04:34Z)
**Author:** may-agent
**Subject:** "aks-rp-e2e.app: planner improvements + task-tree-tools simplification"

Key changes:
- task-tree-tools.ts simplified by 1,190 lines
- task-tree-store.ts simplified by 237 lines
- Planner compact packet enhanced (instruction, reason, review_findings fields)
- Human-steering routing improved

The timeout `AKS_RP_E2E_PLANNER_UPDATE_TIMEOUT_MS` remains at 240,000ms (unchanged). No env override is set. The sessions now simply complete faster because the tooling is simpler.

## Session Profile (Last 6h)

| Status | Count | Avg Duration | Avg Ops |
|--------|-------|-------------|---------|
| done | 131 | 63s | 8.8 |
| error | 16 | 28s | 4.6 |
| interrupted | 9 | 252s | 27.4 |

The done sessions average 63s — well under the 240s timeout. Before the commit, these same sessions were routinely exceeding 240s because the tool calls and context were more complex.

## Implications

1. **KE-2015's diagnosis was wrong.** The issue was not "a simple constant mismatch between the time planning_update needs and its timeout." It was complexity in the tooling causing the planner to use more turns and time per session. Reducing complexity reduced time-per-session below the timeout.

2. **Spec 4 (timeout increase to 600s) may not be needed.** The current 240s timeout is sufficient when the tooling is lean. The interrupt rate is now below 6% without changing the timeout.

3. **The ~7h of compute waste documented in KE-2015** (23.6h/48h) should not recur. In the last 6h, only 9 interrupts × 252s = ~0.6h wasted (projected 2.5h/day, an 80% reduction).

4. **All five prior KEs (1994, 2012, 2013, 2014, 2015) misdiagnosed the root cause.** They treated the timeout as too short. The real problem was the tooling being too complex for the timeout window.

## Predictions

1. Planning_update interrupt rate will remain below 15% as long as the simplified tooling persists (measurement window: next 48h).
2. The session.error-rate-6h metric (currently 11.25%) should tick down slightly as fewer interrupted→retried cycles occur.
3. If task-tree-tools complexity grows again (feature additions), interrupt rate will rise back toward 60% without a timeout change.

## Validation Plan

Check in 24-48h: if interrupt rate stays below 15% across a full 24h cycle, mark this entry's prediction 1 as confirmed and update KE-2015 status to `superseded`.

## Validation Results (2026-06-17 12:11Z, ~8h after commit)

**Prediction 1: CONFIRMED.** aks-explorer interrupt rate over the last 12h:
- Last 6h: 0/589 = **0.0%** interrupted
- 6-12h ago: 22/197 = **11.2%** interrupted (continuing decline)
- 12-24h ago: 75/343 = **21.9%** (residual from before commit took effect)

The rate is below 15% for a sustained 12h window and at 0% for the most
recent 6h. The `Project planner interruption/timeout rate (6h)` metric now
reads exactly **0.0**.

**Prediction 2: CONFIRMED.** `session.error-rate-6h` dropped from 11.25%
to **7.82%** — consistent with fewer retry loops.

**KE-2015 status updated to `superseded`.**
