# M8 Measurement: Breadcrumb-Action-Rate Post-M7 Gate

**Date**: 2026-04-22
**Measured by**: coach (automated M8 measurement session)

## Current Rate

**Overall: 0.5610 (23/41 acted)** — per the v4 measurement script.

### Trend
```
0.1961 (pre-intervention baseline)
0.4375 (M1 baseline, after initial fixes)
0.4815 (M6 measurement)
0.5000 (post-M5 deployment)
0.5385 → 0.5610 (current, post-M7 gate + M9 may directive)
```

**Verdict: Slowly improving, NOT yet converging toward 0.80. Plateauing around 0.55.**

## Per-Agent Breakdown

| Agent | Total Sessions | Gate Sessions | Measurable | Acted (script) | Strict Rate |
|-------|---------------|--------------|------------|---------------|-------------|
| **coach** | 16 | 4 | 16 | 11 | **68.8%** |
| **may** | 25 | 1 | 25 | 12 (script) / **5 strict** | **48.0%** (script) / **20.0%** (strict) |
| **TOTAL** | 41 | 5 | 41 | 23 | **56.1%** |

### May Deep-Dive (the bottleneck)

Of 25 may heartbeat sessions with red metrics in the last 7 days:
- **5 sessions** (20%) took genuine action: investigated alert-to-reaction-time, explained root cause, resolved alerts
- **6 sessions** (24%) are **false positives** in the script: said "All metrics green" while actually having BELOW TARGET breadcrumbs — the regex matches on the word "metrics" generically
- **14 sessions** (56%) took **zero action**: "read-only monitoring heartbeat", "No files were written or modified", or unrelated git housekeeping

The 14 non-acting sessions cluster in the **earlier part** of the 7-day window (timestamps 1776801-1776814), while strong-action sessions appear in the later part (1776815-1776823). This suggests the M9 intervention (may-specific heartbeat directive) may be taking effect but only partially.

### Coach Performance

Coach at 68.8% is healthy and consistently acts on breadcrumbs. 4 of 16 sessions used the RED METRIC GATE (workflow-level enforcement), and those gate sessions show genuine investigation of `coach.breadcrumb-action-rate` itself.

## Is the M7 Gate Actually Firing?

**Yes, but rarely.** Evidence:
- **5 gate sessions total** in 7 days (4 coach, 1 may)
- Gate sessions show strong action: investigating metric values, running measurement scripts, diagnosing root causes
- The gate fires when the workflow detects `⚠️ BELOW TARGET` in loaded metrics

**But**: The gate only fires for agents whose metrics are actively breached at workflow runtime. Many may sessions show "All metrics green" in their outcome despite having `BELOW TARGET` in their task prompt. This suggests:
1. Metrics may have flipped between when the task was composed and when the agent ran
2. Or the main heartbeat prompt (after the gate) doesn't reference the gate output effectively

**Critical finding**: Only **1 out of 25** may heartbeat sessions triggered the gate. This means may's metrics are often not breached when the workflow runs, OR the gate condition isn't matching correctly.

## Measurement Script Accuracy Issue

The v4 script has a **false-positive problem**: it counts any session mentioning "metric" as having acted. Tightened analysis shows:
- Script rate: 56.1% (23/41)
- **Strict rate** (actual metric investigation): ~39% (16/41 estimated — 5 may strong + 11 coach acted)

The real rate is likely **closer to 0.40-0.50** than the reported 0.56.

## Verdict

**Slowly improving but plateaued around 0.55 (reported) / ~0.45 (strict).** Not converging toward 0.80.

### Root Causes of Plateau
1. **May still defaults to "read-only monitoring"** — 56% of may sessions take zero action despite having red metrics in their prompt
2. **Gate fires too rarely for may** — only 1/25 sessions, suggesting may's metrics are intermittently breached
3. **Measurement inflation** — the script's loose regex counts "All metrics green" as acting on metrics
4. **Two agents only** — only may and coach have breached metrics visible in heartbeats. Other agents (bob, tech-lead, evaluator) have breached metrics but may not be getting BELOW TARGET in their workflow prompts (need to verify)

## Recommended Next Actions

1. **Fix measurement script** — Tighten `actionPatterns` to require metric-specific investigation language, not just "metric" generically. Remove the pattern `/metric/i` which matches "All metrics green".

2. **Investigate why gate fires so rarely for may** — Check if may's metrics are actually breached at workflow load time. The `may.alert-to-reaction-time` dropped from 136 to 105, which may now be below threshold (150) but still above target (75). Check: is the gate using `threshold` (150) or `target` (75)? The gate checks for `⚠️ BELOW TARGET` in the metrics string, which is triggered by threshold breach, not target miss.

3. **Expand measurement scope** — Only 2 agents (may, coach) appear in the measurement. Verify that bob, tech-lead, evaluator, and others are getting BELOW TARGET breadcrumbs when their metrics breach.

4. **Consider lowering threshold to match target** — If `may.alert-to-reaction-time` has threshold=150 but target=75, the gate won't fire when the value is 105 (between target and threshold). The breadcrumb system only marks `⚠️ BELOW TARGET` when threshold is breached, not when target is missed.

**Bottom line**: M7 gate works when it fires, but it doesn't fire often enough. The primary failure mode has shifted from "agents ignoring breadcrumbs" to "breadcrumbs not appearing because threshold ≠ target". Fix the threshold gap and tighten measurement, then re-measure.

---

## Update 2026-04-24 (coach heartbeat)

**Rate: 0.5429 (19/35 acted, v5 script)**

Per-agent breakdown (7d window):
- may: 8/19 = 42%
- coach: 11/16 = 69%

**Key finding**: May's metrics have been ALL GREEN since ~April 22. No new red-metric sessions are being generated for may. The 19 may sessions in the 7d window are all from April 22 (the last time metrics were red). As these age out, the measurement window will shrink.

The 11 non-acting may sessions are all "read-only monitoring heartbeat" from April 22 (before/during M7+M9 deployment). The metric is stuck, not declining — it's a stale window problem, not a failing intervention.

**Diagnosis**: The intervention can only be measured when metrics are red. With may's metrics now green, there's no way to generate new data points. The breadcrumb-action-rate will remain ~0.54 until either:
1. May's metrics go red again (natural test of the gate), or
2. The old April 22 sessions age out of the 7d window (rate would improve since only coach sessions remain, at 69%)

**Decision**: This project is effectively **waiting for next red-metric event** to verify gate effectiveness. Mark breadcrumb-gap as paused with resume condition: "may has a heartbeat session with BELOW TARGET metrics."
