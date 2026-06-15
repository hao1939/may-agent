---
id: KE-2009
title: "System Health Snapshot 2026-06-15 19:34Z — Two Persistent Calibration Gaps"
date: 2026-06-15
author: arc
status: active
tags: [system-health, snapshot, false-good-rate, planning-update, calibration, coherence-audit]
related: [KE-943, KE-1994, KE-2006, KE-2007, KE-2008]
---

<ai_context>
summary: System health snapshot at 2026-06-15 19:34Z identifying two persistent calibration gaps. (1) evaluator.false-good-rate-sample has been above 20% since at least 2026-05-11 (35 days) — KE-943 said "propose recalibrating if above 20% for 24h" — nobody acted, and it's now at 24%. The heuristic good-session classifier is systematically too lenient. (2) planning_update interrupt rate worsened from 31.3% yesterday to 62.7% today, despite Spec 4 being proposed. Spec 4 is in work-queue as proposed (not approved). Guard noise and ghost metabolism both resolved (per KE-2007). DB size at 1,223 MB (target 1,200, threshold 2,000). Session error rate at 10.2% (target 10%, threshold 30%) — essentially at target. Evaluator→may message flood continues at 266/24h (KE-2008).
triggers: health snapshot, false-good-rate stale, planning-update worsening, coherence audit gap
</ai_context>

## Overall Status: Stable with Two Persistent Gaps

### Green Signals
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Handler success rate (6h) | 99.6% | 95% | ✅ |
| Session error rate (6h) | 10.2% | 10% | ✅ ~target |
| Evaluator meaningful review rate | 95.2% | 90% | ✅ |
| Failed session triage rate (3h) | 100% | 100% | ✅ |
| Guard triggered (24h) | 3,910 | — | ✅ Below 4,500 |
| Guard blocked (15m) | 0 | 0 | ✅ |
| Zombie sessions | 0 | 0 | ✅ |
| Message delivery rate | 100% | 100% | ✅ |
| Ghost metabolism (resume_failed) | 0 | 0 | ✅ Resolved |

### Gap 1: False-Good Rate — 35-Day Stale Action Item

`evaluator.false-good-rate-sample` = **24.0%** (target 5%, threshold 60%).

KE-943 (2026-05-11) noted this at 28% and wrote:
> "Monitor overturned metric — if it stays above 20% for another 24h,
> propose recalibrating the heuristic or LLM evaluation prompt."

It has been **35 days** since that action item. The metric has never
dropped below 20%. No calibration proposal has been filed.

**Why it matters:** 24% of sessions heuristically classified as "good"
are overturned on LLM review. This means the heuristic classifier is
systematically too lenient — roughly 1 in 4 "good" sessions isn't
actually good. This pollutes the `evaluation.success_candidate` pipeline
(467 candidates/24h, but ~112 of those are false positives) and dilutes
the learnings extracted from good sessions (412/24h, with ~99 learned
from actually-mediocre sessions).

**Action needed:** Propose tightening the heuristic good-session classifier
or adjusting the LLM evaluation prompt. This is an evaluator-domain
issue but the calibration gap is a system-level observation.

### Gap 2: Planning Update Interrupt Rate — Accelerating Degradation

| Window | planning_update interrupt % | Total sessions |
|--------|--------------------------:|---------------:|
| Yesterday (day -1) | 31.3% | 211 |
| Today (24h) | 62.7% | 279 |
| Last 12h | 60.7% | 122 |
| Last 3h | 57.6% | 33 |
| Last 1h | 58.3% | 12 |

The planning_update interrupt rate **doubled** from yesterday to today.
Average interrupted session duration: 247.7s — these are hitting a hard
timeout, not finishing early. 175 planning_update sessions interrupted
today, wasting ~12 hours of compute.

Spec 4 proposal (`agents/arc/workspace/proposals/2026-06-15-spec4-planning-update-timeout-fix.md`)
is in the work-queue as **proposed, not approved**. No code change has
been made. KE-1994 confirmed this is structural (not transient).

### Session Volume (24h)

| Agent | Total | Done | Error | Interrupted | Error% |
|-------|-------|------|-------|-------------|--------|
| evaluator | 1,310 | 1,283 | 27 | — | 2.1% |
| aks-explorer | 1,057 | 832 | 40 | 179 | 3.8% |
| may | 142 | 129 | 10 | — | 7.0% |
| scout | 62 | 57 | 5 | — | 8.1% |
| dev | 48 | 47 | 0 | — | 0% |
| arc | 47 | 45 | 1 | — | 2.1% |

Total: 2,666 sessions/24h. aks-explorer is 40% of all sessions and
produces 48% of all errors + 100% of all interruptions.

### Infrastructure

| Metric | Value | Notes |
|--------|-------|-------|
| DB size | 1,223 MB | Slightly above 1,200 target, well below 2,000 threshold |
| Handler fires/hr | 296 | Demand-driven, not anomalous |
| Event bus events/hr | 1,577 | Steady-state for current volume |
| Active sessions | 8 | Normal |

### Evaluator→May Message Flood (KE-2008)

evaluator→may messages: 266/24h (98/6h, 30/2h). Still at ~3× historical
rate. Not yet at critical level but signal dilution risk remains.

## Coherence Audit: Standing Orders

Reviewed `shared/standing-orders.md`. No stale references found —
all orders reference current tools (`agents.fork()`, `message()`),
current workflows, and active agents. ORDER-010 about Hao-only merges
remains accurate. No frozen agents referenced.

## Falsifiers

- F1: If false-good-rate drops below 20% in the next 7 days without
  a calibration change, the metric was transiently elevated and no
  action is needed. (But 35 days above 20% makes transience unlikely.)
- F2: If planning_update interrupt rate drops below 40% tomorrow without
  a code change, today's 62.7% was an anomalous spike, not a trend.
  (But yesterday's 31.3% was already above KE-1994's 30% structural
  threshold, so even a drop to 40% confirms structural waste.)
