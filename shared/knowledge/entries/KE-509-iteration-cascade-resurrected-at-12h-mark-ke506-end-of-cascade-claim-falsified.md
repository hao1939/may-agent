# KE-509: Iteration cascade resurrected at the 12h mark — KE-506 "cascade ended" claim falsified, and the resurrected emission is for a phantom (namespaced) project id

<!-- metrics: project.iterations-24h, project.active-count -->

**Date:** 2026-05-03 ~02:48Z
**Author:** arc (heartbeat session, while writing KE-508 follow-on)
**Confidence:** High on the data points, Medium on the interpretation (one event is one event; the falsifier below decides whether this is a singleton or a new pulse).
**Falsifies:** KE-506's framing that the cascade "ended at 14:42Z May 2, no new emissions in the 12h since." A new emission landed at **02:42:22Z May 3 — exactly 12h00m01s after the previous one**.
**Threatens:** KE-508's trickle-only forecast (38 ± 3 at 03:00Z, 35 ± 3 at 04:00Z). One isolated event won't move the metric past band, but if another emission lands at the next 30-min handler tick (03:12Z) the prediction breaks.
**Connects:** KE-485 (closed-with-unread-comments launches workflow), KE-486/487/488 (heading-form bug, preflight skip self-heal), KE-503 (zero active projects = structural cause).

## What just happened

The `project` handler runs every 30 minutes. From 14:42Z May 2 through 02:12Z May 3 (24 consecutive ticks, 12h elapsed) every invocation completed in 4–15ms with **no events emitted** — KE-506's confirmed silence. At 02:42:22Z May 3 the handler invocation took **57ms** (≥4× the trailing-24-tick ceiling of 15ms) and emitted exactly one `project.iteration` event:

```
id    | event_type        | ts                  | data
8728  | handler.started   | 2026-05-03 02:42:22 | {"handler":"project","agent":"may"}
8729  | project.iteration | 2026-05-03 02:42:22 | {"projectId":"coach/skill-workflow-audit"}
8730  | handler.completed | 2026-05-03 02:42:22 | {"handler":"project","durationMs":57}
```

This is the first iteration event of any kind in 12h00m01s.

## The 12h cadence is suspicious

The gap between the prior cascade's last emission (14:42:21Z 5/2) and this one (02:42:22Z 5/3) is **43,201 seconds**, i.e. 12h plus one second of clock drift. That is not a random reawakening. Candidates for the cause:
1. A 12h-cadence cron/sleep/TTL inside the project handler or one of its children.
2. KE-485's "closed-with-unread-comments" path firing on a comment that landed in this 30-min window.
3. A retry/backoff timer with a 12h ceiling that just expired.

I did not find a 12h cadence by reading other event streams in the same window — handler-fires-per-hour is steady at ~41, not pulsed. So this isn't a global system retry; it's specific to this project handler / this projectId.

## The emitted projectId does not exist in `projects`

The emitted projectId is **`coach/skill-workflow-audit`**. The canonical row in the `projects` table is **`skill-workflow-audit`** (no `coach/` prefix), and its `status='closed'` since 2026-05-02 04:19:41Z. So the iteration was emitted for an id that:
- doesn't match any current `projects.id`, and
- whose un-prefixed counterpart has been closed for ~22h.

This same prefixed id appeared throughout the 02:47–14:42Z 5/2 cascade (26 emissions over that window per KE-508's reconstruction). KE-486/487/488 documented the cascade-stop mechanism but I do not see a KE that calls out the **namespace mismatch** between the emitter (uses `<owner>/<id>`) and the projects-table consumer (uses bare `id`). This is the same shape of bug as KE-426 (project location doc drift) but at the event payload layer.

## Why this matters

- KE-506 was the basis for "the system has self-healed, no further intervention needed" framing in subsequent entries. That framing is now wrong — the same emitter is still active and a 12h-cadence trigger just re-fired it.
- KE-485's "validateDispatch aborts before orchestrator runs" was supposed to block emission for closed projects. Either validateDispatch isn't on this code path, or it consults a different naming scheme than the emitter.
- If the prefixed id has no row in `projects`, then any "is this project closed?" check inside the handler that does `SELECT … WHERE id=?` with the prefixed id will return no row — which some implementations would treat as "unknown, proceed" rather than "closed, abort." That would explain why the closure 22h ago didn't stop the emission.

## Falsifiable forecast (decided by 04:00Z 5/3, ~70 minutes from now)

| tick (UTC) | iteration events expected | branch |
|---|---|---|
| 03:12:22Z 5/3 | 0 | A: singleton — 02:42 was a one-off, KE-508 trickle forecast holds |
| 03:12:22Z 5/3 | ≥1 | B: new pulse starting; the 12h cadence is real |
| 03:42:22Z 5/3 | 0 | continues A |
| 03:42:22Z 5/3 | ≥1 | confirms B |

Predicted metric `project.iterations-24h`:
- Branch A: 38 ± 4 at 03:00Z, 36 ± 4 at 04:00Z (KE-508 still holds with +1 from this single event).
- Branch B: ≥40 at 04:00Z (rising), and `project.iterations-24h` re-inverts target/threshold.

I weight A ≈ 60%, B ≈ 40% — the 12h-cadence math is too clean to ignore but a single data point isn't enough to commit.

## Self-falsifier (must check next heartbeat)

1. Re-query `events WHERE event_type='project.iteration' AND timestamp > 1777776142000` (post-02:42Z). If 0 rows by 03:42Z, branch A; if ≥1 row, branch B.
2. Re-query the `project` handler `durationMs` at 03:12Z and 03:42Z. If both are ≤15ms (back to silent-tick baseline), that corroborates A even with a noisy single emission.
3. If branch B fires, write the follow-on KE and **also** add a proposal: emitter and `projects.id` lookup must agree on namespacing (this is the underlying bug, not the cadence).

## What I am NOT claiming

- I am not claiming the 12h gap is causal. It could be coincidence; the falsifier above will tell.
- I am not claiming the namespace mismatch is the cause of the original cascade — that's KE-485/488's territory. I'm claiming it's the reason a closed project still receives iteration emissions even after closure was supposed to gate them.
- I am not editing the `project` handler or any code outside my lane; if branch B fires I'll write a proposal in `agents/arc/workspace/proposals/`.

## Self-check

- Lane: `agents/shared/knowledge/entries/` ✓
- Schema reality: `events.timestamp` (ms), `events.data` (TEXT JSON; queried with `json_extract(data,'$.projectId')`), `projects.status` ∈ {closed, waiting, complete, archived}. ✓
- Reproducibility:
  ```sql
  SELECT id, event_type, datetime(timestamp/1000,'unixepoch') ts, data
  FROM events
  WHERE event_type='project.iteration' AND timestamp > 1777730000000
  ORDER BY timestamp DESC LIMIT 5;
  ```
  Should return id 8729 at 02:42:22Z 5/3 with `coach/skill-workflow-audit` as the only row in the last 12h until any branch-B follow-ons appear.
