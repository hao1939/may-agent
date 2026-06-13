# Iter-13 — Investigation: `project.health.checked`

**Iteration:** 13  
**Date:** 2026-06-10  
**Trigger:** Iter-12 falsifier tripped — `project.health.checked` is a new event_type in the top-15 by 24h volume whose payload is a periodic snapshot.

## 1. Emitter

Single emitter: `agents/may/handlers/project-steward.ts:462`.

```ts
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
```

The emitter runs inside the project-steward handler's main loop, which iterates over every project on every `timer.tick`. One `project.health.checked` event is emitted per project per tick.

## 2. Consumers

**Zero consumers.**

- `handled_by` is NULL for all 37,326 rows (query: `SELECT handled_by, COUNT(*) FROM events WHERE event_type='project.health.checked' GROUP BY handled_by`).
- All 37,326 events have `status='pending'` — none were ever processed.
- `grep -rn 'health.checked'` across all `.ts`/`.js`/`.mjs` files returns only the emitter line and its test file. No handler subscribes to this event_type. No code queries the events table for it.
- The evaluator noted the anomalous volume in a deep-eval (`s_1780633944267_530.json`) but took no action.

## 3. Payload analysis

The payload is a textbook periodic snapshot:

```json
{
  "projectId": "dev/eval-llm-lane-restoration",
  "projectPath": "projects/eval-llm-lane-restoration",
  "status": "closed",
  "projectPolicy": "standard",
  "taskCounts": {"total": 0, "ready": 0, "running": 0, "done": 0, "pending": 0},
  "findingCount": 0,
  "projectMtime": 1779269847361.115
}
```

Every field is current-state, not a transition. There is no "old → new" delta, no triggering condition, no changed-from/changed-to pair. The same snapshot is re-emitted every tick regardless of whether anything changed.

## 4. Volume and cost

| Metric | Value |
|--------|-------|
| Total rows | 37,326 |
| First seen | 2026-06-03 |
| 24h volume | 2,809 |
| Per-project per-day | ~67 |
| Rank by 24h volume | #4 |
| Distinct projects | 44 |

Compare to iter-11's `context.read`: 156/day, 1 presence-based reader. `project.health.checked` is **18x the volume with zero readers.**

## 5. What project-steward already emits that encodes transitions

The same handler loop calls `emitFinding(ctx, project, report, finding)` for each finding — these *are* transitions (something changed or a condition was detected). The findings are the actionable output. The `project.health.checked` event adds no information the findings don't already cover, and it fires even when there are zero findings.

## 6. Options

| Option | Description | Cost | Benefit |
|--------|-------------|------|---------|
| **(a) Delete emission** | Remove the `ctx.sdk.emit("project.health.checked", ...)` call. | 3-line code change + test update. | Stops ~2,800 dead rows/day. Enforces the adopted rule. |
| **(b) Convert to transition** | Emit only when status or taskCounts change vs. previous tick. | Moderate — needs a state-diff mechanism (previous snapshot storage). | Preserves the event as a legitimate transition, but adds complexity for a signal nobody reads. |
| **(c) Accept and revise rule** | Acknowledge this is acceptable periodic emission; weaken the rule. | Zero code. | Keeps the record. But the record has zero consumers, so "keeping" it serves nothing. |

## 7. Recommendation to arc

Option (a). Zero consumers means zero migration risk. The emission is pure cost (2,800 pending rows/day that nothing reads). Converting to transition (b) adds complexity to preserve a signal nobody listens to. Revising the rule (c) surrenders the discipline for no benefit.
