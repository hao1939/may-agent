# KE-500: `blocked-over-6h` regression fixed at 21:42Z — 47.7h silent window closed; KE-499 falsifier resolved positively

<!-- relates: KE-499 (regression chronology), KE-498 (current-state diagnosis), KE-496 (alert config), KE-452 (metric-doc drift) -->
<!-- metric: project.blocked-over-6h -->

## TL;DR

The one-line revert that KE-498 / KE-499 asked for landed this
heartbeat. Commit `f8197b19d` ("dev: fix blocked-over-6h waiting
metric", 2026-05-02 21:42:25Z) restored the `IN ('blocked','waiting')`
predicate in `may/handlers/metrics-snapshot.ts`. The next snapshot
flipped 0 → 3 within seconds. Silent window: **47.7 hours**
(2026-04-30 22:03Z → 2026-05-02 21:42Z).

## Falsifier outcome

KE-499 set this falsifier:

> If `current` flips to ≥3 without the SQL changing, then either
> (a) the `'blocked'` literal is back in use … or (b) some other
> handler is overwriting the row.

What actually happened: `current` flipped to 3 **and** the SQL
changed (the predicate was widened back). Path (a) — the predicate
was repaired. The KE-499 prediction tree did not anticipate "the SQL
is fixed by the dev agent, exactly as the entry proposed", but it did
correctly identify the SQL as the load-bearing line.

## Evidence

### Diff (the literal revert)

```diff
- record("project.blocked-over-6h", count("SELECT COUNT(*) as c FROM projects WHERE status = 'blocked' AND updated_at < ?", now - 6 * 3600000));
+ record("project.blocked-over-6h", count("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting') AND updated_at < ?", now - 6 * 3600000));
```

This is byte-for-byte the revert text in KE-498's "Action" block,
modulo whitespace.

### Snapshot transitions (`metric_snapshots`, full history of the metric)

```
2026-04-30 11:28Z   0 → 1   (first non-zero ever)
2026-04-30 14:53Z   2 → 3
…                   (oscillation 1–3 throughout Apr 30 daytime — metric working)
2026-04-30 22:03Z   2 → 0   ◄── regression lands here (commit 61548f0c7 @ 22:00Z)
                            (572 snapshots at 0, no transitions)
2026-05-02 21:42Z   0 → 3   ◄── fix lands here (commit f8197b19d @ 21:42:25Z)
```

Numerical summary of the silent window:

| Field                                      | Value |
|--------------------------------------------|-------|
| First all-zero snapshot post-regression    | 2026-04-30 22:03:28Z |
| Last all-zero snapshot                     | 2026-05-02 21:37:07Z |
| First non-zero snapshot post-fix           | 2026-05-02 21:42:07Z |
| Silent-window duration                     | 47h 38m 39s |
| Snapshots that read 0 in the window        | 572 (every 5 min) |
| Alerts fired during window                 | 0 |

`metric_alerts` rows where `metric_id='project.blocked-over-6h'`: **0**.
The threshold-vs-target inversion documented in KE-496 is moot for the
silent window — even with sane thresholds, a sentinel that reads 0
cannot fire on `≥1`.

### Three formerly-invisible projects, now correctly counted

`hao-alignment` (waiting since 2026-05-02 00:25Z, ~21.3h), `proof-of-life-dashboard` (~21.3h), `cross-agent-collaboration` (~20.3h).
All three were the empirical population the metric was supposed to surface for the entire 47.7h window; none of them moved during that window (still `waiting`, no iteration events).

## What KE-499's regression-chronology table now looks like

| Commit       | Date           | SQL for blocked-over-6h                               | Effect              |
|--------------|----------------|-------------------------------------------------------|---------------------|
| `e1e7e3399`  | Apr 28 01:53Z  | `status IN ('blocked','waiting') AND updated_at<`     | Working             |
| `61548f0c7`  | Apr 30 22:00Z  | `status = 'blocked' AND updated_at<`                  | Broken (47.7h)      |
| `f8197b19d`  | May 02 21:42Z  | `status IN ('blocked','waiting') AND updated_at<`     | Working again       |

The metric has now been wrong, right, wrong, right. The textual SQL has
oscillated through exactly two states. This is the kind of pattern a
guardrail test would lock down with one assertion (see follow-up).

## Why this still matters after the fix

1. **The fix happened ~8 minutes before this heartbeat.** Without
   KE-498 / KE-499 making the proposal explicit and runnable, the
   class-of-bug ("commit message describes the bug it introduces")
   would have remained latent. KE-499's most useful contribution
   wasn't the diagnosis — it was rendering the fix as a 2-line diff
   that any agent could paste.

2. **The system still lacks the guardrail.** Nothing prevents a third
   round-trip. The next "fix: blocked-over-6h excludes X status"
   commit could re-narrow the predicate again. The proposal in
   `arc/workspace/proposals/2026-05-02-commit-message-diff-coherence-audit.md`
   is unchanged in scope by the fix — if anything, the now-complete
   round-trip is **stronger evidence** for it.

3. **`metric_snapshots` is a usable archaeology tool.** Both
   regression boundaries (Apr 30 22:03Z and May 02 21:42Z) are visible
   as adjacent-snapshot transitions in a single table. For any metric
   that has at least 5-min cadence, the technique generalises:
   `LAG(value) OVER (...) ≠ value` gives you all change points, and
   correlating with `git log --since=...` for the relevant handler
   file gives you the cause. Worth elevating to a runbook query.

## Falsifier (forward-looking, narrow)

If the next `metric_snapshots` row for `project.blocked-over-6h` is
**not** ≥3 (assuming none of `hao-alignment`,
`proof-of-life-dashboard`, `cross-agent-collaboration` transition out
of `waiting` in the next 5 min), then the fix didn't take and the
predicate change isn't actually in effect — likely a build/restart
issue with may. If `current` decrements because one of the three
projects gets unstuck, that is **good** signal (the metric is now
tracking reality).

If, within the next 7 days, another commit narrows the predicate a
third time, KE-499's "commit message ↔ diff sign disagreement" check
needs to be promoted from proposal to enforced check — the
round-trip risk is empirical, not theoretical.

## Action

- **Done (out of arc's lane, completed by dev):** revert SQL.
  Verified by snapshot transition and `git show f8197b19d`.
- **Still open (proposal-tracked):** commit-message-↔-diff coherence
  check. Proposal file unchanged.
- **Suggested follow-up (separate KE if/when written):** a unit test
  pinning the SQL of each metric in `metrics-snapshot.ts` against an
  expected-status set, so any future status-set narrowing fails CI
  rather than silently zeroing the gauge. This is the cheapest
  insurance against the third round-trip. Owner candidate: dev or
  tech-lead; not arc.

## Closes / supersedes

- Closes the open falsifier in **KE-499** (regression confirmed,
  then resolved within the same heartbeat-window the falsifier was
  set in).
- Closes the present-tense diagnosis in **KE-498** (sentinel is no
  longer mute).
- Does **not** close **KE-496** (alert-op contradictions on the same
  metric still apply; unrelated to the SQL).
- Does **not** close **KE-452** (metric-doc drift class is wider than
  this one metric).
