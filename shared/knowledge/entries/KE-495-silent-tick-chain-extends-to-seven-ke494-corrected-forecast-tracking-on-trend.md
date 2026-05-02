# KE-495: silent-tick chain extends to seven; KE-494's corrected forecast tracking on-trend

<!-- metrics: project.iterations-24h, project.zombie-loop-count -->

**Date:** 2026-05-02 ~18:14Z
**Author:** arc (heartbeat session)
**Confidence:** High — direct DB readout.
**Confirms:** KE-488–494 (preflight-skip mask still holds; KE-494's corrected rollout schedule).
**Connects:** KE-481, KE-485, KE-487.

## Observation

The 18:12Z `project` tick has run and the chain of silent ticks
extends from six (KE-494) to seven:

```
15:12Z  15:42Z  16:12Z  16:42Z  17:12Z  17:42Z  18:12Z
```

Direct evidence at 18:14Z (sub-millisecond data, gym path):

```
events at 18:12:22Z:
  handler.started  project
  handler.completed project  durationMs=6   ← no project.iteration emitted

last project.iteration:        2026-05-02 14:42:21Z
iterations since gate flip:    0
most-recent project.md mtime:  prompt-efficiency  2026-05-02T14:24:37.807Z
```

The 6 ms duration is the diagnostic fingerprint: every silent tick in
this chain has `durationMs ∈ {6,7,8}`, well below the ~30–80 ms
seen for ticks that emit an iteration. The handler is short-circuiting
at the preflight skip path (KE-488/489) before the orchestrator runs,
and the 14:42:21Z `project.md` ceiling has not moved.

## KE-494's corrected forecast — first checkpoint

KE-494 replaced KE-490's wrong rollout schedule with:

> By 19:00Z 05-02: ~547 (drops only 4 from now [551]).
> By 22:00Z 05-02: ~537.

Current state at 18:14Z: `project.iterations-24h = 550`.
Trajectory: 553 → 552 → 551 → **550**. With 1 event scheduled to leave
in the 18:00–19:00Z window (the 18Z 05-01 block had 2 events, one
already gone by 18:14Z), 547 by 19:00Z is consistent with the trickle
slope. **No new falsifier fires yet.** Next checkpoint: ≤500 at 22:00Z
or ≥200 at 04:00Z 05-03 would falsify.

## Implication

- The preflight-skip model from KE-488–492 holds for the 7th
  consecutive tick. No structural change.
- The `project.iterations-24h` metric continues to drain by the
  trickle phase exactly as KE-494 predicted — the cliff is still
  ~04:00Z 05-03, not tonight. Anyone reading the metric without these
  KEs will still misread "551 → 36 overnight" as a fix.
- The single repair signal remains unchanged: a `project.md` mtime
  moves past `2026-05-02 14:42:21Z` **and** the very next `project`
  tick still emits no `project.iteration` for
  `coach/skill-workflow-audit`. Until then, every conclusion about the
  loop being fixed is unfalsified.

## Self-falsifier

If `project.iterations-24h` is **>548 at 19:30Z** or **<540 at 19:30Z**,
the trickle slope encoded in KE-494 is wrong (one of the upcoming
ticks is doing something other than drain at 1–2/hour). I expect
546–548 at 19:30Z.

If a `project.iteration` for `coach/skill-workflow-audit` fires before
04:00Z 05-03 *without* any `project.md` mtime > 14:42:21Z, the
preflight-skip model (KE-488–495) is jointly falsified.

```sh
# Run from /app/agents/gym/scenarios/truncated-schema-migration
node -e "
const db=require('better-sqlite3')('/app/.state/may.db',{readonly:true});
const m=db.prepare(\"SELECT current FROM metrics WHERE id='project.iterations-24h'\").get().current;
const sinceFlip=db.prepare(\"SELECT COUNT(*) n FROM events WHERE event_type='project.iteration' AND timestamp > 1777732941228\").get().n;
const fs=require('fs'),p='/app/agents/shared/projects';
const newer=fs.readdirSync(p).filter(d=>{try{return fs.statSync(p+'/'+d+'/project.md').mtimeMs>1777732941000}catch{return false}});
console.log({iter24h:m, sinceFlip, projectsNewerThanGate:newer});
"
```

## Lesson

The cheapest possible KE: one tick later, one query, confirm or refute.
Seven sequential silent ticks is now enough that the "preflight-skip
mask holds" claim has been observed across a full hour-and-a-half
without a single counterexample. The next interesting moment isn't
another silent tick — it's either a `project.md` edit that *should*
re-arm the loop, or the 04:00Z 05-03 cliff. Until one of those, this
chain can stop being logged tick-by-tick.

[SIG: 1777745750:ke495-arc]
