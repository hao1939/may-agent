# Mode D — Workflow Health (2026-04-18 ~00:00 UTC)

**Window:** last 6h (≈18:00–00:00 UTC).
**Prior baseline:** `finding-mode-d-workflow-health-20260417-2200.md` (22:00 UTC).
**Budget used:** ~5 ops.

## Summary

No regression this cycle. **tech-lead improved from 0% → 20%** (3/15 workflow sessions) — the prior 22:00 R1 dispatch may be landing, or noise. Every other agent is stable ±5pp vs 22:00. No high-op non-workflow session >36 ops in the window, and the single 36-op (scout audit) and 25/22/16/16/15-op tech-lead heartbeats don't map to any existing workflow.

**Decision: NO_DISPATCH.** The previous two cycles already dispatched targeted fixes (tech-lead inline-diagnostic tweak Apr 17 ~23:30, cron:project-resume budget stanza at 16:00); per KE-123 don't-stack rule we hold. Rotate D → A.

## Adoption Table (6h)

| agent     | wf |  n  | avg | total | max | adoption% | Δ vs 22:00 |
|-----------|---:|----:|----:|------:|----:|----------:|-----------:|
| coder     | 10 |  10 |  7.8|   78  | 11  | **100.0** |  0         |
| optimizer | 13 |  26 | 13.2|  344  | 34  |  50.0     |  0         |
| bob       | 10 |  23 |  9.0|  208  | 18  |  43.5     |  0         |
| coach     |  5 |  19 | 14.3|  271  | 59  |  26.3     | **+6.3**   |
| **tech-lead** | 3 | 15 | 11.1| 166 | 25 | **20.0** | **+20.0** ✅ |
| qa        |  1 |  14 |  7.6|  106  | 20  |   7.1     |  0         |
| scout     |  0 |  13 |  5.3|   69  | 36  |   0.0     |  -7.1      |
| may       |  0 |  13 |  4.0|   52  | 10  |   0.0     |  0         |
| evaluator |  0 |  41 |  0.0|    0  |  0  |   0.0     |  0 (all n/a) |

Notes:
- evaluator: 41 sessions × 0 opCount — these are JS-only evaluation jobs with no tool calls; adoption metric is n/a.
- scout Δ is noise: 1 audit session out of a window with small n.
- tech-lead +20pp is the standout. Hypothesis: the 23:30 UTC prompt tweak (bloat-reducing guidance) + randomness. n=3 too small to call causation.

## Regressions (>10pp or persistent 0% fixable)

**None.** The only negative Δ is scout -7.1pp (1 non-workflow audit session — inherently manual task, no workflow match). may at 0% is chronic but heartbeat-only (13/13 at avg 4 ops — already lean); no target.

## Anti-Pattern Spotcheck

Top non-workflow sessions ≥15 ops this window:

| session | agent | ops | task |
|---|---|---:|---|
| s_1776453350862_574 | scout | 36 | Audit 3 recent tech-lead commits (audit task — no workflow fits) |
| (various) | tech-lead | 15–25 | heartbeats (no workflow applies) |
| (one) | coach | 21 | cron:common-sense-verify (cron task — inherently single-shot) |
| (one) | qa | 16 | Review-and-merge call (verify-wrap candidate, but n=1) |

**No repeat of the 74/76-op inline P0 pattern** from the 22:00 window. The tech-lead inline-refactor anti-pattern did not reappear; either the dispatch is landing or we got lucky. Either way, no fresh signal.

qa 16-op review-and-merge is a weak candidate for `verify-wrap`, but single-sample and within normal range — below dispatch threshold.

## Recommendations

### NO_ACTION_NEEDED

**Justification:**
1. **No regression signal** — every agent is flat or improved vs 22:00 baseline.
2. **tech-lead adoption improved +20pp**, suggesting prior Mode D R1 fix (cron:project-resume budget) and Mode C dispatch (23:30 inline-diagnostic) are in their observation window. Stacking another intervention now would violate KE-123 (behavioral interventions degrade when combined — -12 to -15pp).
3. **No high-op outlier** this window (max non-workflow = 36, a one-off audit). The actionable pair (tech-lead 74 + coach 76) from 22:00 did not recur.
4. **Zero-adoption agents are chronic cases**: may (heartbeat-only, already lean at 4 ops), evaluator (JS-only, n/a), scout (13 sessions, one-off audits). None have inline-heavy sessions that match an existing workflow.

### Rotation

D → **A** (Session Archaeology) next cycle. Look for high-op outliers in the next 6–12h window; re-check whether tech-lead's +20pp adoption holds or reverts.

## NO_DISPATCH
