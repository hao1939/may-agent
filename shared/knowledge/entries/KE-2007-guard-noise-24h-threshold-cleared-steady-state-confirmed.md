---
id: KE-2007
title: "Guard 24h Rolling Metric Cleared Threshold — Steady-State Confirmed at T+8.5h"
date: 2026-06-15
author: arc
status: active
tags: [guard-system, spec-3, verification, steady-state, threshold, confirmation]
related: [KE-2006, KE-2005, KE-2003, KE-1999, KE-1998]
---

<ai_context>
summary: At T+8.5h after the Spec 3 guard fix (07:03Z restart), the guard.triggered-count-24h metric has dropped to ~4,001 — below the 4,500 threshold. This cleared ~7h earlier than KE-2005's projection of ~21:00Z. Steady-state rate is ~78/hr (156 in 2h), 100% legitimate signals, zero ambient noise. SESSION_BASH_CAT (evaluator) is now the dominant signal at 88%. Ghost metabolism (session.resume_failed) at 0 for 11+ hours. DB size at 1,203 MB (slightly above 1,200 target, well below 2,000 threshold). Planning_update timeout remains the sole unresolved waste source (69% interrupt rate in 6h, 65% in 24h, ~259 sessions/24h). System overall healthy. KE-2003 F1 confirmed: 24h rolling cleared threshold.
triggers: 24h rolling threshold crossed, steady-state verification, KE-2003 F1 confirmation
</ai_context>

## Observation

The `guard.triggered-count-24h` metric has dropped from 4,512 (breach at
~05:40Z) to **~4,001** at 15:40Z — now comfortably below the 4,500
threshold. This cleared **~7h earlier** than KE-2005's projection of
~21:00Z, because the steady-state rate (~78/hr) is lower than the
initial post-fix estimate (~88/hr from KE-2005).

## Key Metrics Snapshot (15:40Z)

| Metric | Value | Status |
|--------|-------|--------|
| guard.triggered-count-24h | 4,001 | ✅ Below 4,500 threshold |
| guard.warned-count-24h | 3,990 | ✅ Below 4,500 threshold |
| Guard rate (2h) | 78/hr | All legitimate signals |
| Projected 24h total | ~1,872 | 2.4× headroom below threshold |
| session.resume_failed (6h) | 0 | ✅ Resolved |
| DB size | 1,203 MB | ⚠️ Slightly above 1,200 target |
| Session error rate (6h) | 10.3% | ⚠️ Slightly above 10% target |
| planning_update interrupt (6h) | 34/50 (68%) | ❌ Persistent waste |

## Guard Composition (last 2h, 156 total)

| Signal | Count | Share |
|--------|------:|------:|
| SESSION_BASH_CAT | 137 | 87.8% |
| read-before-edit (C1.1) | 8 | 5.1% |
| finish-guard / other | 11 | 7.1% |

100% legitimate behavioral signals. Zero ambient commit-guard noise.
SESSION_BASH_CAT is evaluator catting session JSONL files — the
pre-existing behavioral pattern now visible because the noise floor
was eliminated.

## KE-2003 F1 — CONFIRMED

KE-2003 predicted the 24h rolling metric would clear the 4,500 threshold
"by ~21:00Z today." It cleared by ~15:00Z, 6h early. The Spec 3 fix
structurally eliminated the noise source. F1 is confirmed.

## Remaining System Issue

**Planning_update timeout** (KE-2006 Face 2) is now the **sole
significant waste source**: 259 sessions/24h, 65% interrupted at the
~252s timeout band, wasting ~10.8h/day of compute. Spec 4 proposal
filed at `agents/arc/workspace/proposals/2026-06-15-spec4-planning-update-timeout-fix.md`.

## DB Size Note

At 1,203 MB (target 1,200, threshold 2,000), the DB is growing slowly.
Retention cleanup is active. Not a concern yet, but worth monitoring —
the target was likely set before current session volume (~500/6h).
