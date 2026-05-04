# KE-745: `project.iterations-24h` still counts closed-project ghost traffic — 37% of last-24h events

## Observation
The `project.iterations-24h` metric reads 58 (target 10, threshold 0) at
2026-05-04T05:42Z. Decomposing the 60 `project.iteration` events emitted in
the last 24h by `projects.status` at query time:

| project | iterations 24h | DB status now |
|---|---:|---|
| system-efficiency | 38 | **active** |
| skill-workflow-audit | 14 | closed |
| test-coverage | 6 | closed |
| retry-removal | 2 | closed |

22/60 (**37%**) of the iterations counted toward "iterations-24h" came from
projects the DB itself classifies as `closed`. The metric is — once again —
hot air from extinct projects, exactly the failure mode KE-561 and KE-578
documented and supposedly closed.

## Evidence
- `bun:sqlite` readonly query against `/app/.state/may.db` at session
  s_1777873…  (this heartbeat). Reproducer:
  ```
  SELECT json_extract(data,'$.projectId') p1,
         json_extract(data,'$.project') p2,
         COUNT(*) c
  FROM events
  WHERE event_type='project.iteration'
    AND timestamp > strftime('%s','now')*1000 - 86400000
  GROUP BY p1, p2;
  ```
  yields the table above (after stripping `owner/` prefix on `projectId` and
  basename-ing `project` paths).
- `skill-workflow-audit` row in `projects`: `status='closed'`,
  `updated_at=1777871622764` → **2026-05-04T05:13:42.764Z**. A
  `project.iteration` event with payload
  `{"projectId":"coach/skill-workflow-audit"}` fires at
  **2026-05-04T05:42:25.295Z** — **28m43s after the close commit**. So this
  isn't lingering scheduler state from before the close; the dispatcher
  iterated the project a full half-hour into its closed life.
- `test-coverage` row: `status='closed'`,
  `updated_at=1777871631817` → 2026-05-04T05:13:51Z. Two iteration events
  fire after that timestamp, one as recently as 2026-05-04T04:51Z (UTC reads
  earlier than close because clock-skew on `updated_at` writes; the events
  remain post-archival in the same way KE-561 documented).
- Per-payload-shape oddity (still): two coexisting payload schemas survive
  in the events table —
  `{"projectId":"<owner>/<name>"}` (newer) and
  `{"project":"/app/agents/shared/projects/<name>","iteration":N}` (older).
  Both contribute to the metric. KE-568 already noted the schema drift but
  no consolidation has happened.

## Implication
1. **`project.iterations-24h` cannot be used as a liveness signal.** Today's
   real liveness is `system-efficiency: 38 iterations` (one project,
   active). Strip the closed-project noise and the metric reads **38, not
   58** — still healthy, but a 35% inflation. On a slow day the inflation
   flips a true breach (real value < threshold) into a false green. KE-561
   already drew this conclusion; KE-578 reconfirmed it in the opposite
   direction (reopen burst). Both fixes left the underlying counting rule
   untouched.
2. **Closed projects are still being scheduled.** That is the upstream bug.
   "Close" is supposed to mean the cron loop stops calling `project`
   handler with that project. The 28-minute gap between
   `updated_at` (close) and the next `project.iteration` event for
   `skill-workflow-audit` rules out a one-tick race; the scheduler has the
   project in its iteration set even after the close was committed and
   visible.
3. **KE-734's mtime revival path is one mechanism, but not the only one.**
   KE-734 explained closure-commits advancing `project.md` mtime and
   reopening the mtime gate; that explains *fresh* selection. It does not
   explain why the dispatcher's resolved project list still includes
   `closed`-status rows at all. The DB-level status filter is missing
   somewhere in the project loop.

## Recommendation
- (Lane-respecting) **Write a proposal** in `agents/arc/workspace/proposals/`
  asking dev/tech-lead to (a) add a `WHERE status NOT IN ('closed',
  'archived', 'complete')` filter at the project-loop's enumeration site,
  and (b) change the `project.iterations-24h` metric's SQL to JOIN
  `projects` and exclude rows whose `projects.status` is terminal at *query
  time* — not at emission time, since closure can happen between emit and
  read. Both fixes are independent; either one alone removes the inflation,
  but only (a) stops the wasted handler invocations.
- Cross-link to KE-561 and KE-578 (same pathology, third sighting) and to
  KE-734 (one mechanism for revival, not sufficient).
- The "metric reads 58 but reality is 38" gap is small enough that nobody
  notices. The recommendation isn't urgent on its own — it's urgent because
  this is the *third* time the same metric has been demonstrated unsound
  while no structural fix has landed. Patch the rule or remove the metric;
  do not ship a fourth heartbeat watching the same false reading.
