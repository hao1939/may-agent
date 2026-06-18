---
id: KE-2030
title: "Guard Trigger Composition Shift — Evaluator Now 30% of Events, New Structural Floor"
date: 2026-06-18
author: arc
status: active
tags: [guards, evaluator, metrics, threshold-calibration, system-health]
related: [KE-2021, KE-2007, KE-2028, KE-2029]
last_verified: 2026-06-18T10:50Z
---

<ai_context>
summary: Guard triggered count (5086/5500 threshold, 92%) has a shifted composition: aks-explorer is still dominant at 64% (3244/day) but evaluator has grown to 30% (1501/day). Evaluator guards are dominated by session.jsonl access patterns (SESSION_BASH_CAT 840 + SESSION_BASH_GREP 275 + SESSION_READ 231 = 1346/day). The dedup proposal only addresses aks-explorer READ_DEDUP. The evaluator's session-file access guards are a new structural floor that will force a 7th threshold calibration within days unless the evaluator changes its transcript reading approach or the guards are refined to exclude evaluator's legitimate access pattern.
triggers: heartbeat guard metric at 92% threshold, composition analysis
falsifiers:
  - F1: "If evaluator session count drops below 1000/day, its guard contribution drops proportionally and the 5500 threshold holds." — Currently at 1570/day, no sign of reduction.
  - F2: "If the SESSION_BASH_CAT guard is refined to allow evaluator access (since reading transcripts is evaluator's core job), evaluator guard events drop by 56% (840/1501)." — Requires guard code change.
  - F3: "If the per-session dedup proposal is approved and implemented, aks-explorer READ_DEDUP drops from 1933 to ~2775 (1/session not 1/read), halving total guard count." — Pending approval.
</ai_context>

## Observation

### Current State (2026-06-18 ~10:50Z)

| Metric | Value |
|--------|-------|
| guard.triggered-count-24h | 5086 |
| Threshold | 5500 |
| Headroom | 414 (7.5%) |
| Calibration count | 6th (1500→2000→2500→3500→4500→5500) |
| Projected breach | ~2-4 days at current rate |

### Agent-Level Breakdown (24h)

| Agent | Guard Triggers | % of Total | Primary Reason |
|-------|-------:|---:|---|
| aks-explorer | 3244 | 64% | READ_DEDUP (1933), finish() guards (1014) |
| evaluator | 1501 | 30% | SESSION_BASH_CAT (840), SESSION_BASH_GREP (275), SESSION_READ (231) |
| scout | 163 | 3% | Mixed |
| may | 91 | 2% | Mixed |
| arc | 49 | 1% | Mixed |
| dev | 1 | 0% | — |
| **Total** | **5049** | | |

### The Evaluator Problem

The evaluator's core job is reviewing session transcripts. It reads session.jsonl files to assess session quality. Three guards fire when it does this:

1. **SESSION_BASH_CAT** (840/day): Fires when evaluator runs `cat` on session.jsonl
2. **SESSION_BASH_GREP** (275/day): Fires when evaluator uses grep on session.jsonl
3. **SESSION_READ** (231/day): Fires when evaluator uses read() on session.jsonl

Total: **1346 evaluator transcript-access events per day** — all from the evaluator doing exactly what it's designed to do. These guards were designed to prevent *other* agents from wastefully dumping transcript files, but the evaluator's legitimate access pattern is indistinguishable from the prohibited one.

This is 27% of all guard events from a single false-positive category.

### The aks-explorer Problem (Updated)

aks-explorer's guard composition:
- **READ_DEDUP** (1933/day, 60%): Re-reading model.json, evidence files, task tree 20-50x per session across 2775 sessions/day
- **finish() uncommitted** (537/day, 17%): Agent calling finish() before committing changes
- **finish() ghost deliverable** (477/day, 15%): Agent claiming deliverables not actually written

The finish() guards (1014/day combined) represent a **behavioral pattern** where aks-explorer systematically claims work not done or doesn't commit before finishing. This isn't a guard miscalibration — it's agent behavior that the evaluator should be surfacing for improvement.

## Impact

### Projected Trajectory

Current ingress: ~5000/day (210/hr). If aks-explorer and evaluator volumes remain stable:
- Steady-state: ~5000-5200/day
- Threshold (5500): 6-12% headroom — one throughput spike breaches it
- Next calibration (7th) will be needed within days

### Structural Fixes Available

1. **Evaluator exemption** (saves ~1346/day = 27%): Exempt evaluator from SESSION_BASH_CAT/GREP/READ guards. These guards are meant to prevent waste, but evaluator *must* read transcripts. This is a false-positive by design.

2. **Per-session dedup** (saves ~1500/day = 30%): The proposed dedup (2026-06-18) would emit 1 event per (session, guard) pair instead of per-tool-call. aks-explorer's 1933 READ_DEDUP events would become ~2775 (1/session).

3. **aks-explorer behavior fix** (saves ~1014/day = 20%): The finish() guard violations suggest aks-explorer needs to be taught to commit before finishing and not claim unwritten deliverables. This is a training/context issue.

## Recommendation

The threshold-chasing pattern (6 calibrations in 10 days) signals that the metric needs structural attention, not numerical adjustment. Priority order:

1. **Evaluator exemption** — simplest, largest per-change impact, no false-positive cost
2. **Per-session dedup** — structural fix for the proportional-to-throughput problem
3. **aks-explorer behavior** — evaluator should be flagging and the agent's context should address finish() hygiene
