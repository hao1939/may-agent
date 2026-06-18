---
id: KE-2032
title: "Project Steward Emitting Health Findings for 7 Non-Existent Evaluator Projects"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, project-steward, evaluator, false-positive, noise, metrics]
related: [KE-2030]
last_verified: 2026-06-18T12:05Z
---

<ai_context>
summary: The project-steward is emitting `project.health.finding` events for 8 evaluator "calibration" sub-projects, of which 7 do not exist on disk and none are registered in the `projects` DB table. These phantom findings drive the `project.health.finding-count` metric (currently 1, previously 4) and trigger `project.owner-judgment-needed-count` alerts. 25 such findings emitted in 24h — all noise. The steward appears to be reading project IDs from event history or task tree references rather than from actual `project.md` files on disk. This is a false-positive pattern in the steward's project discovery, not a real project health issue.
triggers: heartbeat coherence audit, project.health.finding-count metric = 1
falsifiers:
  - F1: "If the projects actually exist somewhere the steward discovers (e.g., task tree branches, event-created registry), the findings are legitimate." — Needs steward code audit.
  - F2: "If evaluator creates these project.md files in a future session, the findings become real." — Would shift from noise to signal.
</ai_context>

## Observation

### Health Finding Events (24h)

| Phantom Project ID | On Disk? | In DB? | Findings (24h) |
|-------------------|----------|--------|----------------|
| evaluator/evaluator-owner-review-request-quality | No | No | 5 |
| evaluator/evaluator-repair-execution-downgrade-calibration | No | No | 5 |
| evaluator/evaluator-interrupted-success-receipt-calibration | No | No | 4 |
| evaluator/evaluator-planner-aftermath-calibration | **Yes** | No | 3 |
| evaluator/evaluator-planner-task-tree-deliverable-guard-calibration | No | No | 2 |
| evaluator/evaluator-scout-heartbeat-canonical-path-calibration | No | No | 2 |
| evaluator/evaluator-transcript-guard-noise-calibration | No | No | 2 |
| evaluator/evaluator-worker-forbidden-path-attribution-calibration | No | No | 1 |
| **Total** | 1/8 | 0/8 | **24** |

Only `evaluator-planner-aftermath-calibration` has an actual `project.md` on disk. None are registered in the `projects` DB table (only `evaluator-quality-gap-calibration` is registered, which is a different project and isn't generating findings).

### All findings have the same code

Every finding is `owner_judgment_needed` with message "Active project has no tasks; owner should create the next task slice or close the project." This is correct for `evaluator-planner-aftermath-calibration` (which exists but has no tasks), but meaningless for the 7 non-existent projects.

### Metric Impact

- `project.health.finding-count`: currently 1, was 4 earlier today — all from this source
- `project.owner-judgment-needed-count`: same driver
- Both metrics have `threshold: 0` and `alert_op: >`, meaning any finding triggers an alert
- Alert #1937 (P1) has been open since these findings started

### Root Cause Hypothesis

The steward's project discovery appears to resolve project IDs from some source beyond `projects/*/project.md` files on disk — possibly from the evaluator's task tree branches, event history references, or an in-memory registry populated by evaluator sub-project creation events. The evaluator created these as logical sub-projects during sessions but may not have written `project.md` files (or the files were cleaned up / never committed).

The steward then treats these discovered IDs as "active projects with no tasks" and emits findings.

## Impact

- 24 false-positive health finding events per day
- P1 alert #1937 staying open due to phantom projects
- Evaluator receiving `owner_judgment_needed` events for projects it cannot act on (no files on disk)
- Noise in the project health metric that obscures real findings

## Recommendation

1. **Evaluator** should either create the missing `project.md` files or close/archive the sub-project references that spawned these IDs
2. **Steward** should validate that a `project.md` file exists on disk before emitting health findings (defense against phantom project IDs)
3. The one real project (`evaluator-planner-aftermath-calibration`) either needs tasks added or should be closed if its goal is met
