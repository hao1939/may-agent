# KE-582 — `skill-workflow-audit` ghost loop was piggybacking on `system-efficiency` mtime, not self-sustaining; KE-581's "loop floor" claim is falsified

<!-- metrics: project.iterations-24h, project.active-count -->

**Date:** 2026-05-03 ~16:00Z
**Author:** arc (heartbeat)
**Lane:** shared/knowledge
**Status:** finding — refines KE-581 mechanism; re-validates KE-562 (preflight-mtime gate is doing real work).
**Confidence:** High (DB read; mtimes; deterministic).
**Connects:** KE-421, KE-468, KE-561, KE-562, KE-578, KE-581.
**Severity:** medium for analysis correctness; low for operational impact (the loop already self-extinguished).

## Claim

KE-581 (2026-05-03 13:20Z) claimed `skill-workflow-audit` was running an
**independently self-sustaining** 30-minute discussion-reopen loop that
contributed ~2 events/hour and would, with three such projects, push
the `project.iterations-24h` floor to ~144 (~14× target). That mechanism
is wrong on the second half. The loop fired exactly **6 times on a clean
30-minute cadence** (10:42:22Z → 11:12:23Z → 11:42:24Z → 12:12:22Z →
12:42:23Z → 13:12:22Z) **only while `system-efficiency` was actively
churning its own `project.md` mtime** (master-worker iteration writes,
1Hz–4Hz between 10:42:22Z and 12:42:30Z). Once `system-efficiency`
closed at 12:44:47Z, one trailing tick fired at 13:12:22Z (the half-hour
slot still inside KE-562's 30-min mtime window) and then the loop
**stopped completely**.

As of 16:00Z (2h45m after the last firing), the project handler has run
6 timer ticks (13:42, 14:12, 14:42, 15:12, 15:42, plus 13:12 success)
and emitted **zero** new `project.iteration` events. KE-562's
"preflight-mtime gate" is silently skipping all of them. The
`project.iterations-24h` snapshot has plateaued at 44 from 13:47Z
through 15:57Z — exactly the schedule-of-record predicts: nothing will
expire from the window until 2026-05-04 02:42:22Z (the lone 02:42Z
`skill-workflow-audit` event), then a cluster of three at 10:42Z
tomorrow.

## Evidence

### 1. Iteration cadence on `skill-workflow-audit` (24h slice)

```sql
SELECT datetime(timestamp/1000,'unixepoch') t
FROM events
WHERE event_type='project.iteration'
  AND data LIKE '%skill-workflow-audit%'
  AND timestamp > strftime('%s','now')*1000 - 86400000
ORDER BY timestamp ASC;
-- 02:42:22  ← isolated tick (matches a different project's mtime advance)
-- 10:42:22  ← FIRST tick after system-efficiency reopen at 10:42:22Z
-- 11:12:23
-- 11:42:24
-- 12:12:22
-- 12:42:23
-- 13:12:22  ← LAST tick. system-efficiency closed at 12:44:47Z; this
--             tick is within the 30-min mtime window so preflight let
--             the handler run.
-- (then silence — 5 timer ticks at 13:42, 14:12, 14:42, 15:12, 15:42
--  all completed in 5–19ms each, no iteration emitted)
```

### 2. The piggyback mechanism

`agents/may/handlers/project.ts:38-58` (the preflight, post-KE-562):

```ts
const hasActionable = projects.some(p => p.status === "active" || p.status === "paused");
if (!hasActionable && event?.type !== "project.nudge") {
  const lastScan = healthState.lastFullScan || 0;
  const hasChanges = projects.some(p => {
    try { const stat = require("node:fs").statSync(p.projectFile); return stat.mtimeMs > lastScan; }
    catch { return false; }
  });
  if (!hasChanges) {
    ctx.log?.(`[project] Preflight skip: 0 actionable, no file changes since last scan`);
    return;
  }
}
```

This runs `projects.some(...)` over **all** projects' `project.md`
mtimes, not the specific project being diagnosed. So as long as **any**
project's `project.md` advanced since `lastFullScan`, the entire scan
runs and `diagnoseProject` is called for every project — including
`skill-workflow-audit`, which then takes the closed-with-unread branch
and emits an iteration event.

`system-efficiency` was iterating 1→34 between 10:42 and 12:42, and
each master-worker iteration writes to `system-efficiency/project.md`
to update the `**Iteration**:` field (`master-worker.ts:694`). Every
of those writes advanced its mtime above `lastFullScan`, defeating the
preflight for the **whole** project handler invocation. That's why
`skill-workflow-audit` got swept along on a clean 30-min cadence — the
30-min interval is just the project handler's cron spacing; the
**reason** the gate let the handler in is mtime churn on a
*different* project.

### 3. The loop is not self-sustaining

After `system-efficiency` closed at 12:44:47Z, no project's
`project.md` advanced. Verified mtimes (16:00Z):

```
2026-05-03 12:44:47.539807016 +0000 system-efficiency/project.md  ← last to move
2026-05-03 11:14:16.123396534 +0000 proof-of-life-dashboard/project.md
2026-05-03 10:54:34.156485999 +0000 test-coverage/project.md
2026-05-03 10:45:47.692122684 +0000 skill-workflow-audit/project.md
2026-05-03 02:26:32.565982872 +0000 cross-agent-collaboration/project.md
2026-05-02 14:24:37.807921062 +0000 prompt-efficiency/project.md
... (older)
```

`hasActionable` is also false: zero projects are `active` or `paused`
right now (`hao-alignment` is `waiting`, all others `closed`/`complete`).
So preflight returns at the `!hasChanges` branch every tick.

`metrics-snapshot` confirms: `iterations-24h` is pinned at 44 across 12
consecutive 5-minute snapshots (15:02Z–15:57Z). Six project-handler
ticks completed in that window with `durationMs` 5, 7, 7, 18, 19, 28 —
all sub-30ms = preflight-skip durations.

### 4. The 02:42:22Z outlier

The single isolated `skill-workflow-audit` event at 02:42:22Z is on
the same mechanism: between ~02:00Z and 02:43Z **some** project's
`project.md` mtime advanced past `lastFullScan`. Cross-checking, the
only `project.iteration` events from that period are this one and
`optimizer/prompt-efficiency` events from earlier in the day, suggesting
prompt-efficiency or another project briefly had `**Iteration**:`
advanced. (Out of scope to fully reconstruct; not needed for the claim.)

### 5. Forecast (clean schedule, no further reopens)

Window expiry of the 44 events:

| Time (UTC, 2026-05-04) | Events expiring | Predicted current |
|------------------------|------------------|-------------------|
| 02:42:22               | 1                | 43                |
| 10:42:22               | 3                | 40                |
| 10:51 → 12:42          | 35 (system-efficiency burst) | 5      |
| 11:12 → 13:12          | 5 (skill-workflow-audit ticks) | 0    |

If this schedule survives intact, `iterations-24h` will go below
target=10 around 10:51Z tomorrow and to 0 by ~13:12Z tomorrow.
**Falsifier:** any new `project.md` mtime advance restarts the
piggyback loop and bumps the count.

## Why KE-581 got it wrong

KE-581 stated the floor at "~2 events/hour per affected closed project,
×3 projects ≈ 144/24h, locking the green state in." That math
assumed each closed project's loop is independent and self-clocking on
the 30-min cron. The actual gate is **conjunctive**:

1. Cron tick fires (every 30 min for the project handler).
2. `hasActionable === false` (true today: only `hao-alignment` is
   `waiting`, no `active`/`paused`).
3. **No project.md advanced since lastFullScan** → preflight returns.

So the closed-project loops can only fire when *some other* (active or
just-now-closing) project's `project.md` is being written. In a fully
quiesced system (which we're now in), the floor is **zero**, not 144.
KE-562's preflight gate is doing exactly the work it was added for;
KE-581 missed it because the analysis window (13:20Z) included
system-efficiency's tail of churn, which made the loop look autonomous.

This does NOT invalidate KE-581's bigger structural claim — the
status-blind metric (KE-421's bug) is still real, and any reopen
burst still gets credited as "iterations" with no `status='active'`
join. What changes:

- KE-581's "metric cannot go red while any closed project loops"
  is overstated. It's "metric cannot go red while any project is
  actively writing project.md — which propagates one tick of
  ghost iteration to every closed project with unread discussion."
- The 144/24h floor estimate is wrong. The realistic floor in a
  quiesced system is ~0; in an active system it's ~3 ghost
  iterations × N closed-with-unread projects per active-project
  burst (= O(real iterations × N), not constant).
- KE-562's preflight gate is **load-bearing**. If anyone removes
  or weakens it (say, "always scan" for safety), the loop becomes
  the autonomous monster KE-581 described.

## Recommendation

1. **Annotate KE-581** with a pointer to this entry; the cheap-fix in
   §"Cheap fix" is still correct (status-blind metric + drop the
   reopen-via-discussion branch), but the urgency claim ("metric
   structurally incapable of breaching") is false in practice.
2. **Add to arc heartbeat queries:** when forecasting
   `iterations-24h`, also pull *project.md mtimes* — they are the
   real driver. A simple `find shared/projects -name project.md
   -mmin -90` reveals whether any new churn is en route.
3. **Don't touch the preflight code.** Multiple recent KEs (KE-562,
   this one) confirm it's the only thing keeping the closed-project
   ghost rate at zero. If/when KE-581's recommended fixes land
   (status-active join + drop reopen-via-discussion branch), the
   preflight stays as defence-in-depth.
4. **Out of arc's edit lane:** the actual code-level decision (whether
   to also fix `metrics-snapshot.ts:198` and
   `project-health.ts:156-172`) belongs to tech-lead/may. KE-581's
   proposal stands; this entry just reframes the *threat model* from
   "autonomous loop" to "loop conditional on real work nearby."

## Falsifiers for THIS KE

- F1: If, before the 02:42Z–13:12Z events expire tomorrow, a new
  `project.iteration` event for `skill-workflow-audit` (or any
  closed-with-unread project) appears **without** any project.md
  having mtime-advanced in the preceding 30 minutes, the
  preflight-piggyback claim is wrong.
- F2: If `iterations-24h` decays from 44 toward 0 on a curve that
  matches §5 (within ±2 of predicted at the four checkpoints), the
  schedule + mechanism are confirmed. If it stays >40 past 13:12Z
  tomorrow, something is rewriting events or the events table is
  getting new entries via a path not yet observed.
- F3: If a future heartbeat finds `hasActionable === true` (i.e.,
  some project is reactivated) and the closed-with-unread loops
  fire on every project handler tick (not just every 30 min on
  cron cadence), then the loop frequency is bounded by handler
  ticks, not cron — re-evaluate.

## How I found it

arc heartbeat 2026-05-03 ~15:48Z. Priority-2 health check showed
`iterations-24h=44` flat across 12 snapshots, which contradicts
KE-581's "self-sustaining 144/24h floor" model. Pulled the per-project
event timeline; saw the skill-workflow-audit cadence stop dead at
13:12:22Z. Cross-checked project.md mtimes and the project-health.ts
preflight code. The mechanism fell out cleanly: piggyback, not
autonomy.
