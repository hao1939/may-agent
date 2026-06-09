# Proposal: Skip health-check event emission for terminal-status projects

**Date:** 2026-06-09
**Author:** arc
**Priority:** P2

## Problem

`project.health.checked` is the single largest event type in the system: 67,133 events (30.4% of all 221,010 events) over the last 8 days. Of those, **85.8% (57,614) are for projects in terminal status** (closed/done/archived) that never produce findings.

Breakdown:
| Status | Events | Unique Projects | Events with Findings |
|--------|--------|-----------------|---------------------|
| closed | 50,920 | 32 | 0 |
| done | 6,694 | 5 | 0 |
| waiting | 6,062 | 6 | 8 |
| active | 1,792 | 6 | 772 |
| paused | 1,664 | 2 | 0 |

Terminal-status projects produce zero findings, zero actions, and zero useful signal. The steward already short-circuits the health action to `skip` for these statuses (lines 187-206 of `shared/lib/project-health.ts`), but `project-steward.ts` unconditionally emits `project.health.checked` for every project in the scan loop (line 461).

This wastes:
- **~14.3 MB** of event data (average 260 bytes × 57,614 events) over 8 days
- **~7,200 events/day** that are never read, acted on, or used in metric calculations
- Write I/O and event-bus subscriber CPU per emit

The DB is currently 903 MB (threshold 2,000 MB), and event data growth is a known concern (see existing proposal `2026-05-27-db-retention-policy.md`). This is the single cheapest reduction: one conditional in one file eliminates 26% of all event volume.

## Proposed Change

In `agents/may/handlers/project-steward.ts`, around line 453-476, add a condition to skip the `project.health.checked` emit for terminal-status projects that have zero findings:

```typescript
const TERMINAL_STATUSES = new Set(["closed", "done", "complete", "completed", "archived"]);

for (let i = 0; i < projects.length; i++) {
  const project = projects[i];
  const report = reports[i];

  // Skip event emission for terminal projects with no findings
  if (TERMINAL_STATUSES.has(report.status) && report.findings.length === 0) {
    continue;
  }

  ctx.sdk.emit("project.health.checked", {
    projectId: report.projectId,
    projectPath: report.projectPath,
    status: report.status,
    projectPolicy: report.projectPolicy,
    taskCounts: report.taskCounts,
    findingCount: report.findings.length,
    projectMtime: safeMtime(project.projectFile),
  }, {
    owner: "may",
    source: "project-steward",
    urgency: "low",
  });

  for (const finding of report.findings) emitFinding(ctx, project, report, finding);
}
```

Note: terminal projects with findings (e.g., `closed` with unread comments) still emit events, preserving the discussion-reopen path.

## Expected Impact

- **~26% reduction** in total event volume (57,614 fewer events per 8-day window)
- **~14 MB** less event data per 8-day window
- `project.health.checked` drops from 67,133 to ~9,519 events (86% reduction)
- DB growth rate decreases by ~1.8 MB/day
- No change to finding metrics, steward logic, or active/waiting project visibility

## Risks

- **Metric counting**: The `project.health.finding-count` metric counts findings, not checks. Terminal projects have 0 findings, so the metric is unaffected.
- **Observability gap**: If someone monitors the count of `project.health.checked` events to verify steward liveness, fewer events might falsely suggest reduced coverage. Mitigated: the steward still runs for all projects and emits for non-terminal ones, proving liveness.
- **Discussion-reopen edge case**: A closed project with new unread comments already gets a finding from `analyzeProject` → the conditional preserves emission in that case.

## Validation

After deployment, verify:
1. `SELECT event_type, COUNT(*) FROM events WHERE event_type = 'project.health.checked' AND timestamp > ... GROUP BY event_type` shows ~85% fewer events
2. `project.health.finding-count` metric unchanged
3. Active/waiting/paused projects still emit health check events
