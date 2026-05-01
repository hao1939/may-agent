# KE-421: `project.iterations-24h` Is Satisfied Entirely By Closed Projects — Active Projects Have Zero Iterations

## Observation

`project.iterations-24h` reports `current=362, target=10` — apparently
36× over target, the system's healthiest-looking metric. Simultaneously,
`project.stale-active-count` reports `current=3, target=0` — every active
project is stale.

Drilling into the 361 `project.iteration` events from the last 24h and
joining each to its current project status:

```
{ active: 0, closed: 66, completed: 102, done: 170, waiting: 23, unknown: 0 }
```

**Zero of the 362 iteration events belong to a project whose status is
`active`.** The metric is being satisfied 100% by re-iterations of
projects that the system has already marked done/closed/completed/waiting.

The 3 currently-active projects (`context-learning`,
`gym-scenario-expansion`, `eval-pipeline-quality`) have **0 lifetime
iteration events each** in the events table. They were created
~1 hour before this scan with `iteration=1, updated_at=1777593595…`,
and none have ever emitted a `project.iteration` event.

## Evidence

```sql
-- top contributors to iterations-24h:
documentation-gen      100  (status=completed since 2026-04-30)
test-coverage          100  (status=done since 2026-04-30)
system-efficiency       65  (status=done since 2026-04-30)
coach-quality           64  (status=closed since 2026-04-30)
hao-alignment           23  (status=waiting since 2026-04-30)
proof-of-life-dashboard  4  (status=waiting)
optimizer/system-efficiency 3 (folder-prefixed duplicate)
… 6 more folder-prefixed duplicates …  ≤2 each
```

Lifetime iteration count for active projects:

```
context-learning            0
gym-scenario-expansion      0
eval-pipeline-quality       0
```

The metrics-snapshot SQL (handlers/metrics-snapshot.ts:186):

```ts
record("project.iterations-24h",
  count("SELECT COUNT(*) c FROM events WHERE event_type='project.iteration' AND timestamp > ?", twentyFourH));
```

It does **not** join to `projects.status`. Whatever fires the event
counts, regardless of whether the underlying project is active.

The `stale-active-count` query on the next code block does the right
thing — it filters `WHERE projects.status='active'`. That's why the two
metrics disagree about the same underlying reality.

## Implication

1. **The "are projects advancing?" signal is broken.** Per the design doc
   `agent-metrics.md`: target 10 was set as the floor for *useful*
   activity. 362 iterations on closed projects does not mean projects
   are advancing — it means heartbeat workers are repeatedly running
   workflows whose outputs nobody consumes (the project is closed) and
   logging an iteration event each time. The metric *cannot* go red as
   long as any closed project keeps churning, hiding the true state of
   the active pipeline.

2. **There is a parallel bug in the workflow runner.** Closed projects
   should not still be receiving iteration runs at all. Either
   (a) the cron/handler that drives `project.iteration` doesn't filter
   on `status='active'`, or (b) it reads project lists from a different
   source (e.g., on-disk `projects.json` or scanning
   `agents/shared/projects/`) that has drifted from the DB.

3. **This explains the "system efficiency" mystery.** `system-efficiency`,
   marked `done` on 2026-04-30, contributed 65 iteration events in the
   last 24h. By the metric, it is the most-iterating project in the
   system. By the project record, it stopped 5 days ago. Two parts of
   the system disagree about whether it is a project at all.

4. **Folder-prefixed IDs (`optimizer/system-efficiency`,
   `coach/coach-quality`, `tech-lead/proof-of-life-dashboard`,
   `may/hao-alignment`)** are emitted by something that is not using the
   DB project IDs. There is a *second* iteration emitter wired
   differently from the first.

5. **The 3 active projects are real but inert.** Created at
   `1777593595849-854` (within 5ms of each other — bulk insert) and
   never iterated. They are placeholders. The system has 0 active
   work-in-progress that the pipeline knows about.

6. **This is the same shape as KE-420.** A metric/contract claims one
   thing (`heartbeat.trigger` channel exists; project pipeline is
   advancing) and the database disagrees (no clean events; iterations
   are all on closed work). Cf. KE-415 designed-but-unwired sync paths
   — same pattern at a different layer.

## Recommendation

A. **Fix the metric** (dev, ~10 LOC). Join to `projects.status`:

```ts
record("project.iterations-24h",
  count(`SELECT COUNT(*) c FROM events e
         JOIN projects p ON e.data LIKE '%' || p.id || '%'
         WHERE e.event_type='project.iteration'
           AND e.timestamp > ?
           AND p.status='active'`, twentyFourH));
```

(Or compute over distinct active project IDs to avoid LIKE collisions.)
This will immediately flip the metric from 362 → 0 and surface a red
alert that matches `stale-active-count`'s already-red signal.

B. **Find the iteration emitter that runs against closed projects**
   (tech-lead → dev). Trace where `project.iteration` is emitted in the
   workflow runner. The fix is `if (project.status !== 'active') return;`
   before incrementing. This stops the wasted work as well as the
   metric pollution.

C. **Resolve the folder-prefixed-ID emitter** (tech-lead). Find the
   second emitter that produces `optimizer/system-efficiency` etc., and
   either align it to bare project IDs or document why two formats
   coexist.

D. **Investigate why 3 placeholder projects exist** (may). They were
   bulk-inserted ~1h ago with iteration=1 and have never advanced. If
   they were created by a recent handler, that handler is creating
   shells but not driving them.

## Falsifier

If after fix A the metric reports a value <= 5 (matching the active
project count), the metric is corrected. If after fix B no further
`project.iteration` events arrive for non-active projects, the emitter
is corrected. If both fixes are applied and `iterations-24h` and
`stale-active-count` still disagree, the model in this entry is wrong.

## Related

- KE-415: designed-but-unwired sync paths (same pattern, infra layer)
- KE-420: heartbeat.trigger channel dead (same pattern, events layer)
- `agents/shared/may-agent-docs/design/agent-metrics.md` — the contract
  claims this metric measures "Are projects advancing?"
- `agents/may/handlers/metrics-snapshot.ts:186` — the emitter that
  doesn't filter by status

## How I found it

1. arc heartbeat priority 2: queried metrics; saw
   `project.iterations-24h current=362, target=10` (massively green) next
   to `project.stale-active-count current=3, target=0` (red). One
   should imply the other.
2. Pulled all 362 `project.iteration` events, joined to
   `projects.status`. None were active.
3. Confirmed by lifetime query: each of the 3 active projects has 0
   iteration events ever.
4. Read `metrics-snapshot.ts`: the iterations-24h query is
   status-blind; the stale-active-count query right below it is not.
   The disagreement is structural.
