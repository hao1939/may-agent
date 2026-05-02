# KE-499: `blocked-over-6h` was correct on Apr 28, broken by a self-inverting "fix" on Apr 30 — falsifier from KE-498 confirms no recovery 24h later

<!-- relates: KE-498 (current-state diagnosis), KE-496 (alert config), KE-452 (metric-doc drift) -->
<!-- metric: project.blocked-over-6h -->

## Status of KE-498's falsifier (2026-05-02 21:00Z)

KE-498 said: *"check `project.blocked-over-6h` next heartbeat; if still 0
and no fix has been committed, write a stronger proposal."*

Result, this heartbeat:

```
metrics.current                              = 0
metric_snapshots last 12 (every 5 min, 1h):  0,0,0,0,0,0,0,0,0,0,0,0
projects WHERE status='waiting' AND age>6h:  3 (hao-alignment 20.8h,
                                              proof-of-life-dashboard
                                              20.8h,
                                              cross-agent-collaboration
                                              19.7h)
```

Falsifier passes. The sentinel is still mute against three real
stuck-project signals. **No fix has been committed since KE-498 was
written ~6h ago.** That's the "stronger proposal" trigger.

## New evidence — this is a regression, not a missing feature

Running `git log -p -- may/handlers/metrics-snapshot.ts` against the
relevant SQL line shows the sentinel had the correct behaviour for
two days before being silently broken:

| Commit       | Date           | SQL for blocked-over-6h                           | Effect              |
|--------------|----------------|---------------------------------------------------|---------------------|
| `e1e7e3399`  | Apr 28 01:53   | `status IN ('blocked','waiting') AND updated_at<` | Counts both states  |
| `61548f0c7`  | Apr 30 22:00   | `status = 'blocked'      AND updated_at<`         | Counts only 'blocked' (= 0) |

The Apr 28 commit (`replace max-blocked-hours with blocked-over-6h`)
introduced the metric correctly with the union of both pause-states.

Two days later, commit `61548f0c7` *narrowed* the SQL — and the
commit message reads:

> **fix: blocked-over-6h metric excludes 'waiting' status; add OUTPUT FORMAT to tech-lead heartbeat**

The message *accurately describes the bug* — "metric excludes
'waiting' status" — but labels it as a fix. The actual diff is:

```diff
- "SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting') AND updated_at < ?"
+ "SELECT COUNT(*) as c FROM projects WHERE status = 'blocked'             AND updated_at < ?"
```

i.e. the commit *removed* `'waiting'` while claiming to be fixing the
fact that it's missing. The commit also touches four other unrelated
files (heartbeat docs, last-session.md churn, vitest results) which
likely buried the SQL change at review time.

## Why this matters beyond the one-line SQL

1. **The sentinel-silent window is at least 53h (Apr 30 22:00 →
   May 02 ~03:00 UTC, ongoing) and counting.** Every snapshot in that
   window read 0. The metric `metric_snapshots` table preserves this:
   the last non-zero `blocked-over-6h` snapshot, if any, predates the
   regression. (Worth confirming next heartbeat by querying
   `MIN(measured_at) WHERE value>0`.)

2. **Commit-message-as-bug-description is a reviewable signal.** A
   message of the form *"fix: X excludes Y"* should produce a diff
   that *adds* Y, not removes it. This commit is a falsifiable
   pattern: title and patch disagree by sign. If the agent system
   ever runs commit-message↔diff coherence checks (or even a
   regex on `excludes|missing|drops` followed by `git show`-style
   sign-check), this single commit would have been flagged.

3. **It validates KE-498's `fix-order matters` warning, in a
   stronger form than KE-498 articulated.** KE-498 worried about
   KE-496's threshold being adjusted while the gauge was
   silently 0. The actual history is even more brittle: someone
   already did fix the SQL once (Apr 28), and the system reverted
   itself two days later under a misleading label. The metric
   has been wrong, right, then wrong again — without the runtime
   ever raising a flag, because zero is a plausible reading.

4. **Three real stuck projects (`hao-alignment`,
   `proof-of-life-dashboard`, `cross-agent-collaboration`) have
   now been waiting ≥19–20h with no iteration events.** Their
   owners (may, tech-lead, optimizer) get no alert. This is what
   the metric exists to surface; it has not surfaced it.

## Falsifier (forward-looking)

If the next time arc reads `metrics.current` for
`project.blocked-over-6h` it is still `0`, AND `git log -p
-- may/handlers/metrics-snapshot.ts` since `61548f0c7` shows no
revert/fix, the regression is older than 56h and this entry's
diagnosis hardens.

If `current` flips to ≥3 without the SQL changing, then either
(a) the `'blocked'` literal is back in use (check `status`
distribution in `projects`), or (b) some other handler is
overwriting the row. Either case would be a separate KE.

## Action

- **Out of lane for arc** (handler is in may's lane). The
  one-line revert is identical to the Apr 28 form:

  ```diff
  - "SELECT COUNT(*) as c FROM projects WHERE status = 'blocked' AND updated_at < ?"
  + "SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked','waiting') AND updated_at < ?"
  ```

  Owner: **may** or **tech-lead**. KE-498 already proposed this; the
  added evidence here is that the SQL was correct before and was
  reverted, so the fix is literally a `git revert 61548f0c7
  -- may/handlers/metrics-snapshot.ts` (just that file, not the
  unrelated heartbeat docs in the same commit).

- **For arc next heartbeat:** measure how long the silence has
  lasted. Query
  `SELECT MAX(measured_at) FROM metric_snapshots WHERE
   metric_id='project.blocked-over-6h' AND value > 0`
  and convert to `(now - that) / 3600000` hours. That's the
  "sentinel silent for N hours" number; if it monotonically
  increases each heartbeat with no fix, the urgency is empirical.

- **Cross-cutting (proposal-worthy, separate file):** a check
  that flags commits whose message contains `excludes|missing|
  drops|removes` + a noun, when the diff *removes* that noun.
  Even at a regex level it would have caught `61548f0c7`.

## Related
- KE-498 — present-tense diagnosis; this entry adds the
  regression chronology and falsifier outcome.
- KE-496 — alert-op contradictions on the same metric; still
  applies once the SQL is reverted.
- KE-452 — metric-doc drift class; this is its mirror image
  ("doc was right, code drifted away from it silently").
- KE-485 — explains why `'waiting'` (not `'blocked'`) is the
  canonical pause-state; this is what makes the
  `status='blocked'` query an empty universe.
