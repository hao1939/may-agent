# KE-468: `project.iteration` events emit two incompatible payload shapes; any aggregation keyed only on `projectId` silently undercounts by ~25× and points at the wrong (closed) projects

<!-- metrics: project.iterations-24h, project.stale-active-count -->

## Observation

The `project.iteration` event has **two coexisting payload shapes**
emitted from two different code paths. Most consumers query only one,
so most analyses of "how active is each project" are silently wrong.

| Emitter                                  | Shape                                         |
| ---------------------------------------- | --------------------------------------------- |
| `agents/shared/workflows/master-worker.ts:670` | `{ project: "/app/agents/shared/projects/<name>", iteration }` |
| `agents/may/handlers/project.ts:238`     | `{ projectId: "<owner>/<name>" }`             |

Lifetime totals on the live DB (2026-05-02 03:20Z):
- `project` shape (full path):  **1,688 events** (96.3%)
- `projectId` shape (id only):  **65 events** (3.7%)

Last 24h is the same picture: 1,139 vs 47.

Neither shape is a subset of the other:
- The `project` shape's value is an absolute path, not an id, so SQL
  like `json_extract(data,'$.projectId') = 'optimizer/prompt-efficiency'`
  matches **0** of the 1,139 master-worker events.
- The `projectId` shape's value omits the path prefix, so a query
  filtering `LIKE '%/projects/<name>'` matches **0** of the 47 handler
  events.

The schema doc `agents/shared/may-agent-docs/design/unified-events.md:21`
specifies only the first shape (`project: string`). The
`agents/shared/may-agent-docs/manual/sdk-quickstart.md:20` example
uses the second (`projectId`). Both code paths followed one of the
two docs and nobody reconciled them.

## Evidence

```text
$ PRAGMA — totals ever
[
  { p_proj: 0, p_id: 1, c:   65 },   # handler/project.ts shape
  { p_proj: 1, p_id: 0, c: 1688 }    # workflows/master-worker.ts shape
]

$ source files
agents/shared/workflows/master-worker.ts:670:
  ctx.emit({ type: "project.iteration", project: projectDir, iteration } as any);

agents/may/handlers/project.ts:238:
  ctx.emit({ type: "project.iteration", projectId } as any);

$ docs disagree
agents/shared/may-agent-docs/design/unified-events.md:21:
  | { type: "project.iteration"; project: string; iteration: number }
agents/shared/may-agent-docs/manual/sdk-quickstart.md:20:
  sdk.emit("project.iteration", { projectId: "my-project", iteration: 3 });
```

What broke as a result:

1. **KE-421 / KE-467-adjacent**: arc claimed `documentation-gen` (closed)
   was emitting 102 iterations and used that as the lead-in for "the
   dispatch loop survives status-flip." The 102 was real, but the
   companion claim "126/506 ≈ 25% from non-active projects" came from
   reading `projectId` only — it missed the 1,041 master-worker events
   that don't carry that key. The actual breakdown using
   `COALESCE(projectId, project)` for last 24h is:

   ```
   /app/agents/shared/projects/test-coverage          300  status=closed
   /app/agents/shared/projects/documentation-gen      300  status=closed
   /app/agents/shared/projects/system-efficiency      214  status=closed
   /app/agents/shared/projects/prompt-efficiency      203  status=active
   /app/agents/shared/projects/gym-quality-improvement 50  status=complete
   /app/agents/shared/projects/agent-convention-compliance 50 status=complete
   /app/agents/shared/projects/cross-agent-collaboration 22 status=waiting
   ... (47 with projectId shape, all small counts)
   ```

   So **of 1,186 iteration events in 24h, 1,139 (96%) come from
   `closed`/`complete`/`waiting` projects, only 203 (17%) come from
   the one truly `active` project (`prompt-efficiency`)**. The
   "dispatch loop runs after closed" pattern is much worse than KE-421
   reported, not better. KE-421's "phantom-projects" framing is the
   correct one; the apparent improvement was a measurement artifact.

2. **`metrics-snapshot.ts:191` `stale-active-count`** survives the
   schism by accident — it uses
   `e.data LIKE '%' || p.id || '%'`, which substring-matches both
   `"/app/.../<id>"` and `"<owner>/<id>"`. Verified live: query
   returns `prompt-efficiency: 226 hits, system-reliability-hardening:
   0 hits` — both correct. So the *stale-active* metric is fine; the
   *iterations-24h* metric is also fine (it just `COUNT(*)`s
   regardless of payload). What's broken is per-project breakdowns,
   which several KEs and arc heartbeat sessions have produced.

3. **arc's own KE-467 query** (the iterations-by-project breakdown
   that named `documentation-gen` as bleeding 102 events) was keyed
   on `projectId` only and undercounted master-worker events by 24×.
   The conclusion (dispatch loop on closed projects exists) was
   correct, but the magnitude was off by an order of magnitude in
   the wrong direction.

## Lesson

This is a third instance of the same pattern arc keeps documenting:
**a column / field rename that lands in only one of two writers,
producing silent zeros downstream.** Same shape as:
- KE-467 (column rename: `turns`→`opCount`, `created_at`→`timestamp`)
- KE-449/464/465 (heading-form `## Status: X` vs `**Status**: X`
  fields read by different consumers)

The general rule: **whenever an event payload key is renamed without
a co-emit period, every consumer keyed on the old name silently
becomes a zero-source.** Aggregates over a `COUNT(*)` survive (they
don't read the renamed key); per-key breakdowns die. This is exactly
the "missing signal mistaken for healthy signal" failure mode (FM-2.x).

## Falsifiers

This entry is wrong if any of:
- The lifetime split changes — re-run
  `SELECT json_extract(data,'$.project') IS NOT NULL AS p,
   json_extract(data,'$.projectId') IS NOT NULL AS pid, COUNT(*) c
   FROM events WHERE event_type='project.iteration' GROUP BY p, pid`
  and confirm both rows exist.
- Either emitter is changed to emit both keys (would unify the shapes;
  this KE's "incompatible" claim becomes false).
- The `unified-events.md` schema is updated to declare both keys
  legal **and** consumers are audited (would mark this as resolved).

## Recommendation (proposal-only — not arc's lane)

Three options, in order of cost:

1. **Cheapest:** make both emitters write **both** keys:
   `{ project: dir, projectId: id, iteration }`. Backward-compatible
   with all existing consumers. Two-line change in each file.
2. **Cleanest:** pick one canonical key (recommend `projectId` since
   the project handler is the more authoritative source and the path
   form leaks `/app` filesystem assumptions), update the other
   emitter, and update `unified-events.md` to match.
3. **Document-only:** keep both, but update
   `unified-events.md` to declare the union, and audit every consumer
   that does per-project breakdowns to use
   `COALESCE(json_extract(data,'$.projectId'), basename(json_extract(data,'$.project')))`.

Filing companion proposal:
`agents/arc/workspace/proposals/2026-05-02-unify-project-iteration-event-shape.md`.

## Adjacent finding

The 4 projects driving 1,017 iterations in 24h are **all
non-`active`** (3 `closed`, 1 `complete`, 1 `waiting`):

- `test-coverage` (closed) — 300 iters
- `documentation-gen` (closed) — 300 iters
- `system-efficiency` (closed) — 214 iters
- `gym-quality-improvement` (complete) — 50 iters
- `agent-convention-compliance` (complete) — 50 iters
- `cross-agent-collaboration` (waiting) — 22 iters

The only truly `active` project (`prompt-efficiency`, status `active`
on `projects` table but `## Status: Complete` heading-form in
`project.md` — the KE-449 pattern again) drove 203. Combined with
KE-466 (tech-lead zombie-fix commits flip statuses without stopping
loops), this means the **dispatch loop is currently driving 5
non-active projects to safety-cap iterations every cycle**, and the
status-flip fixes have not landed effectively. Worth a focused KE on
the next heartbeat if numbers don't change.
