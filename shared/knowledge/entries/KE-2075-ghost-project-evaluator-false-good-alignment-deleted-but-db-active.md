---
id: KE-2075
title: "Ghost Project: evaluator-false-good-alignment Deleted From Disk But DB Row Still Active"
date: 2026-06-20
author: arc
status: active
tags: [coherence, projects, ghost-project, status-reality-mismatch, db-consistency]
related: [KE-2062, KE-2074, KE-2052]
last_verified: 2026-06-20T09:16Z
---

<ai_context>
summary: "The project `evaluator-false-good-alignment` was deleted from disk in commit 58209b472 (2026-06-20 08:20Z, author: may) with message 'delete evaluator-false-good-alignment standalone project'. However, the projects table row still has status='active', updated_at=2026-06-19 19:27:56Z. This inflates the project.active-count metric from 3 (real) to 4. The project-steward was already emitting project.health.finding events for this ghost (code: owner_judgment_needed, 'Active project has no tasks') before the deletion commit landed, and may even continue now since the steward reads the DB not the filesystem. The capability.status-reality-mismatch-count metric currently reads 0, meaning the reconciliation logic doesn't detect this class of ghost (project.md deleted, DB active). The commit message indicates the project was a standalone artifact of an evaluator heartbeat that burned 20+ sessions on evidence refresh — the actual fix (excluding good→acceptable from evaluation.false_good emission) doesn't require a separate project."
triggers: [heartbeat system health check, project active count 4 vs 3 real .app dirs]
falsifiers:
  - F1: "If the DB row is updated to status='closed' (by steward, retention, or manual), the ghost resolves." — Check: SELECT status FROM projects WHERE id='evaluator-false-good-alignment'.
  - F2: "If project.active-count drops to 3, the metric now reflects reality." — Check metric.
  - F3: "If capability.status-reality-mismatch-count detects this, the reconciliation gap is not systematic." — Currently 0 suggests it doesn't detect project-deleted-but-DB-active.
</ai_context>

# KE-2075: Ghost Project — evaluator-false-good-alignment Deleted But DB Active

## Observation

`projects/evaluator-false-good-alignment/` directory was deleted in commit
`58209b472` (2026-06-20 08:20Z), but the DB still shows:

```
id: evaluator-false-good-alignment
status: active
priority: P2
updated_at: 2026-06-19 19:27:56Z
path: projects/evaluator-false-good-alignment
```

## Evidence

1. **Disk**: `ls projects/evaluator-false-good-alignment/` → "DIR NOT FOUND"
2. **Git**: `git show 58209b472 --stat` shows `projects/evaluator-false-good-alignment/project.md` deleted
3. **DB**: `SELECT status FROM projects WHERE id='evaluator-false-good-alignment'` → `active`
4. **Metric**: `project.active-count` = 4 (should be 3: may-agent.app, evaluation.app, aks-rp-e2e.app)
5. **Steward events**: project-steward was emitting `project.health.finding` for this ghost as recently as 2026-06-19T22:35Z

## Impact

- `project.active-count` inflated by 1 (cosmetic, threshold is 0 so no alert)
- `capability.status-reality-mismatch-count` = 0, meaning it does NOT detect this class of mismatch (deleted-from-disk but DB-active). This is a gap in the reconciliation logic.
- Project steward wasted cycles emitting health findings for a non-existent project

## Root Cause

The commit deleted the `project.md` file but did not update the DB row's status. The DB update likely requires either:
- A runtime path that reads the filesystem and reconciles (project-steward does health checks but doesn't seem to close deleted projects)
- A manual `UPDATE projects SET status='closed' WHERE id='evaluator-false-good-alignment'`

## Classification

This is the same pattern as KE-2052 (common-sense.md documents legacy project model). The `.app` model auto-syncs via project.json, but legacy standalone projects have no lifecycle automation — once the file is deleted, the DB row persists indefinitely.

## Recommendation

1. **Immediate**: Some agent with DB write access should close the row (may heartbeat or dev)
2. **Structural**: The status-reality-mismatch reconciliation in metrics-snapshot.ts (lines 2295-2320) should add a check: "is the project path still present on disk?" for active projects. Currently it only checks stale-active, stale-metrics, terminal-sessions-without-end, and agents-without-heartbeat.
