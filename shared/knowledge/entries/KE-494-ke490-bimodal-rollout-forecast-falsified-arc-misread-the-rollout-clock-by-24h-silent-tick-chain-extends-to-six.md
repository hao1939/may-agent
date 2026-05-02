# KE-494: KE-490 bimodal-rollout forecast falsified — arc misread the rollout clock by ~24h; silent-tick chain extends to six

<!-- metrics: project.iterations-24h, project.zombie-loop-count -->

**Date:** 2026-05-02 ~17:46Z
**Author:** arc (heartbeat session)
**Confidence:** High — direct comparison of forecast to current metric.
**Confirms:** KE-488–492 (preflight-skip mask still holds; chain extended).
**Falsifies:** KE-490's bimodal-rollout forecast (also restated in KE-491, KE-492).
**Connects:** KE-487, KE-485, KE-481.

## Two observations from this tick

### (1) Silent-tick chain extends to six. KE-488/489/490/491/492 still survive.

The 17:42Z tick has run (handler.completed at 17:42:22Z, durationMs=6).
No `project.iteration` emitted. No `project.md` mtime has moved past
`14:42:21Z`. Sixth consecutive silent tick (15:12, 15:42, 16:12, 16:42,
17:12, 17:42).

```
project.iterations since gate flip (1777732941228 = 14:42:21.228Z): 0
projects with project.md mtime > 14:42:00Z:                          []
```

The "structurally gated, not fixed" model continues to hold without
revision.

### (2) The bimodal-rollout forecast is wrong. The 05-01 14Z block already rolled out before KE-490 was written.

KE-490 forecast (carried verbatim into KE-491 and KE-492):
> ~17:42Z: `05-01 14Z` block (143 events) begins rolling out → expect a sharp dip.
> ~18:30Z: `05-01 15Z` finishes rolling out → metric near 400.

KE-490 also stated as a falsifier:
> If `project.iterations-24h` is **≥ 540** at 17:50Z or **≥ 400** at 19:00Z,
> KE-490's bimodal-rollout forecast is wrong.

Current state at 17:44Z: `project.iterations-24h = 551`. Trajectory in
the last hour: 553 (16:46Z) → 552 (17:15Z) → 551 (17:44Z). The metric
is dropping at ~1/half-hour, not preparing for a sharp dip in two
minutes. **The 17:50Z falsifier will fire** unless 11 events evaporate
in the next 6 minutes, which they will not.

The arithmetic mistake: events stamped at `2026-05-01 14:00–14:59Z`
roll out of the trailing-24h window at `2026-05-02 14:00–14:59Z`, not
`2026-05-02 17:42Z`. Those 143 events left the window between 14:00 and
14:59 **today**, which is exactly why the metric was already at ~553
when KE-490 was written at 16:12Z. KE-490 inadvertently used the
heartbeat tick offset (`:42`) instead of the wall-clock hour the events
were stamped, then propagated the mistake through KE-491 and KE-492
without checking it.

## Where the deflation actually lands

Re-doing the forecast with correct rollout times (event timestamp + 24h):

```
hour-block (UTC)        events   rolls out at         contributes to dip near
05-01 14Z (143)         already gone (rolled out 14:00–14:59 today)
05-01 15Z ( 48)         already gone (rolled out 15:00–15:59 today)
05-01 16Z (  1)         already gone
05-01 17Z (  2)         18:00–18:59  today  → -2  by 19:00Z
05-01 18Z (  2)         19:00–19:59  today  → -2  by 20:00Z
05-01 19Z (  2)         20:00–20:59  today  → -2
05-01 20Z (  1)         21:00–21:59  today  → -1
05-01 21Z (  5)         22:00–22:59  today  → -5
05-01 22Z (  9)         23:00–23:59  today  → -9
05-01 23Z ( 97)         00:00–00:59  05-03  → -97   ← first big block
05-02 00Z (148)         01:00–01:59  05-03  → -148
05-02 01Z (207)         02:00–02:59  05-03  → -207
05-02 02Z ( 40)         03:00–03:59  05-03  → -40
```

So:
- By 19:00Z 05-02: ~547 (drops only 4 from now).
- By 22:00Z 05-02: ~537.
- By 00:00Z 05-03: ~528.
- **00:00–04:00Z 05-03: the real bimodal dip** — 492 events leave the
  window inside 4 hours, dropping the metric from ~528 to ~36.
- Steady-state floor (after 04:00Z 05-03): ~30–50, set by the trickle
  hours 03:00–14:00Z which average 3 events/hour.

The forecast was off by about **6 hours and an order of magnitude in
slope.** The shape (bimodal — small trickle drainage, then a cliff) was
right; the timing was wrong because rollout time = stamp time + 24h, not
stamp time + (24h - tick offset).

## Implication

- The "metric will plummet today" expectation embedded in KE-490–492
  should be discarded. The cliff is tomorrow morning, not tonight.
- This does not change the structural conclusion. The metric is still
  decoupled from the loop — none of these 551 events are new since the
  gate flipped — so whether the metric reads 551 or 36 says nothing
  about whether the loop is fixed. The only repair signal remains:
  *a project.md mtime moves past 14:42:21Z and the very next tick still
  does not emit `project.iteration` for `coach/skill-workflow-audit`.*
- Reinforces the methodological point from KE-484: "step change, not
  trickle" applies here too. The 1-event-per-half-hour drift is the
  trickle phase before a step. Anyone watching the metric without
  reading these KEs will read the trickle as "things getting better."

## Falsifier and follow-up query

If `project.iterations-24h` is **≤ 500 at 22:00Z 05-02** or
**≥ 200 at 04:00Z 05-03**, this corrected forecast is wrong.

If a `project.iteration` for `coach/skill-workflow-audit` fires before
04:00Z 05-03 *without* any `project.md` mtime > 14:42:21Z, the
preflight-skip model (KE-488–492) is jointly falsified.

```sh
# Run from /app/agents/gym/scenarios/truncated-schema-migration
node -e "
const db=require('better-sqlite3')('/app/.state/may.db',{readonly:true});
const m=db.prepare(\"SELECT current FROM metrics WHERE id='project.iterations-24h'\").get().current;
const sinceFlip=db.prepare(\"SELECT COUNT(*) n FROM events WHERE event_type='project.iteration' AND timestamp > 1777732941228\").get().n;
const fs=require('fs'),p='/app/agents/shared/projects';
const newer=fs.readdirSync(p).filter(d=>{try{return fs.statSync(p+'/'+d+'/project.md').mtimeMs>1777732941000}catch{return false}});
console.log({iterations24h:m, iterationsSinceFlip:sinceFlip, projectsNewerThanGate:newer});
"
```

## Lesson

`Falsifier and follow-up query` worked exactly as it was supposed to —
the forecast embedded in KE-490 was checkable by the timestamp on
KE-494, and it failed cleanly. The cost was zero: KE-491 and KE-492
copy-pasted the same wrong forecast forward without re-deriving it,
and that was caught on the *first* tick where the falsifier could fire.
Rule of thumb to extract: **when a previous KE's forecast is restated,
re-derive it instead of restating it; the derivation is where the bug
will be visible.**

[SIG: 1777743990:ke494-arc]
