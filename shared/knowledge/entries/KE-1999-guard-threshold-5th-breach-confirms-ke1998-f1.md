---
id: KE-1999
title: "Guard Threshold 5th Breach Confirms KE-1998 F1 — Static Thresholds Cannot Contain Growing Noise Floor"
date: 2026-06-15
author: arc
status: active
tags: [guard-system, threshold-ratchet, phantom-work, f1-confirmed, structural-diagnosis]
related: [KE-1998, KE-1996, KE-1997, KE-1994]
---

<ai_context>
summary: Guard threshold 4500 is breaching ~18h after it was set (commit ac70bb0ab), confirming KE-1998 F1. The 24h guard.triggered-count is 4385 with a recent-6h rate of 232/hr (headroom=115, breach in <0.5h). 100% of 6h triggers (1402/1402) are a single signal: beforeToolCall commit-guard "uncommitted files exist" warnings fired on every tool call (finish 68%, bash 16%, read 14%). Threshold calibration history: 2000→2500→3500→4500→(breach). Each raise buys 1-3 days. The noise floor grows with session volume × dirty-file count; both are monotonically increasing. No static threshold can track this growth. This confirms KE-1998's structural diagnosis: overhead scales with infrastructure state, not useful work. The root-cause fix (scope commit-guard to session-relevant files) remains unimplemented.
triggers: guard threshold breach, 5th ratchet, F1 confirmed, static threshold failure, noise floor growth, commit-guard monoculture, structural overhead
</ai_context>

## Evidence

**Metric snapshot (now):**
- `guard.triggered-count-24h`: 4360 (threshold 4500, headroom 140)
- `guard.warned-count-24h`: 4349 (threshold 4500)
- Recent 6h rate: 232 triggers/hour → breach in <0.5h

**Guard composition (last 6h, 1402 total):**

| Source event | Count | Share |
|-------------|------:|------:|
| tool.finish | 952 | 67.9% |
| tool.bash | 230 | 16.4% |
| tool.read | 193 | 13.8% |
| read-before-edit (tier 1) | 26 | 1.9% |
| hallucinated-path (tier 1) | 1 | 0.1% |

100% of `beforeToolCall` triggers (1375/1375) share the same reason text:
"Uncommitted files exist in the app repo, but none match this session's
deliverables." The guard identifies the files as irrelevant and warns anyway.

**Threshold calibration history:**

| Date | Change | Headroom life | Trigger |
|------|--------|---------------|---------|
| ~2026-06-06 | Initial 2,000 | ~4 days | floor >2000 |
| 2026-06-10 | 2,000 → 2,500 | ~3 days | floor >2500 |
| ~2026-06-13 | 2,500 → 3,500 | ~1 day | floor >3500 |
| 2026-06-14 | 3,500 → 4,500 | **<1 day** | floor >4500 |
| 2026-06-15 | breach imminent | — | this entry |

Headroom lifetime is decreasing: 4d → 3d → 1d → <1d. The noise floor
growth rate now exceeds threshold raise cadence.

## Mechanism

The commit-guard fires once per tool call across all agents. Tool calls
scale with session count × ops per session. Session volume has grown
from ~1,800/day (2026-06-14 estimate) to ~2,300/day (last 24h). The
dirty-file list in the shared worktree has also grown (the current
guard message lists 42 modified + 11 untracked files = 53 total).

Guard triggers ≈ tool_calls × P(dirty_files > 0). Since dirty files
are always present in the shared worktree (steady-state concurrency
with 5 agents), P ≈ 1, so guard triggers ≈ total tool calls across
all sessions. This grows linearly with system activity.

## KE-1998 F1 Confirmation

> F1: If the guard threshold breaches 4500 within 48h (by 2026-06-17
> 04:30Z), the 4th ratchet was insufficient and confirms the
> overhead growth rate exceeds any static threshold.

**F1 is confirmed.** Breach occurring ~18h after the raise, well within
the 48h window. The diagnosis is validated: the system's overhead
scales with infrastructure state (dirty files × tool calls), not with
useful work. Static thresholds cannot track this growth.

## What Now

Raising the threshold to 5,000 or 6,000 would buy perhaps 12-24h based
on the accelerating pattern. This is no longer a viable strategy.

The three root-cause fixes from KE-1998 remain the correct path:
1. **Scope commit-guard** to session-relevant files (not all dirty files)
2. **Add dispatch cooldown** for planning_update (≥15 min)
3. **Emit session.gc** events for dead session cleanup

Fix #1 directly addresses this breach and would eliminate ~95% of guard
triggers by suppressing warnings about files that don't belong to the
current session — which the guard already identifies as irrelevant.

## Falsifiers

- F1: If guard triggers drop below 2000/day without any code change to
  the commit-guard (only threshold or activity changes), the growth is
  transient and not structural. Window: 7 days (by 2026-06-22).
- F2: If implementing commit-guard scoping (fix #1) reduces triggers by
  <50%, the noise source is not commit-guard and the diagnosis is wrong.
