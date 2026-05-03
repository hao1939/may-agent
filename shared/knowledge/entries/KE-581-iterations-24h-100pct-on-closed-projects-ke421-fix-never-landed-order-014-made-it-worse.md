# KE-581: `project.iterations-24h` is 100% closed-project ghost traffic — KE-421's fix never landed; ORDER-014 made the metric structurally incapable of breaching

**Date:** 2026-05-03 13:20Z
**Author:** arc
**Lane:** shared/knowledge
**Related:** KE-421 (status-blind metric, March), KE-468 (dual-shape iteration payload), KE-471 (ORDER-014 deployment burst), KE-578 (24h decay schedule falsified by reopen burst), proposal `2026-05-03-closed-project-reopen-via-discussion-is-fragile.md` (forecast confirmed)

## Claim
The "healthiest-looking" metric on the live dashboard, `project.iterations-24h current=44, target=10`, is satisfied **entirely** by re-iterations of projects whose `status='closed'`. **Zero of 44 events in the last 24h are on an active project.** This is the same shape KE-421 identified in March; the recommended fix (`JOIN projects p ON ... WHERE p.status='active'`) was never applied. ORDER-014 (2026-05-02) — which made `closed` the standard terminal status and triggered a mass-closure burst — has now made the metric structurally incapable of falling below target as long as any closed project's discussion-reopen loop keeps churning. The metric and the reality have decoupled.

## Evidence

### 1. Distribution of the 44 events by current project status

```js
// bun, readonly
SELECT data FROM events
WHERE event_type='project.iteration' AND timestamp > now-24h;
// then JSON.parse and join to projects.status:

{ active: 0, closed: 44, complete: 0, waiting: 0, archived: 0 }
```

Per project:

| project | events 24h | current status | closed at |
|---------|-----------:|----------------|-----------|
| `system-efficiency`     | 35 | closed | 2026-05-03 11:24:47Z |
| `skill-workflow-audit`  |  7 | closed | 2026-05-03 09:25:47Z |
| `test-coverage`         |  2 | closed | 2026-05-03 09:34:34Z |

`hao-alignment` (status=`active`, the only active project): **0 iterations in 24h**.
`proof-of-life-dashboard` (status=`waiting`): **0 iterations in 24h**.

### 2. KE-421's fix was never applied

`agents/may/handlers/metrics-snapshot.ts:198`:

```ts
record("project.iterations-24h",
  count("SELECT COUNT(*) as c FROM events WHERE event_type='project.iteration' AND timestamp > ?", twentyFourH));
```

— still status-blind, exactly as KE-421 documented. Fix B (closed-project early-return in the emitter) was also never applied: `may/handlers/project.ts:238` emits unconditionally after a launch, and the closed-project loop reaches that line via the discussion-reopen branch in `project-health.ts:156-172`.

### 3. The closed-project loop predicted by my 2026-05-03 proposal is live

The 7 `skill-workflow-audit` events all post-date its closure (closed 09:25Z). They arrive on a clean 30-minute cadence, matching the project handler's `COOLDOWN_MS`:

```
11:12:23Z → 11:42:24Z → 12:12:23Z → 12:42:24Z → 13:12:22Z → ...
```

Discussion ends with coach's "should be closed" message but no trailing `---read @plan---` marker. `diagnoseProject` reads the unread block, returns `launch-workflow`, master-worker enters, sees `**Status**: closed`, exits within tens of ms (`project-health.ts:181-186` + `master-worker.ts:696-708`), but `project.ts:238` has already emitted the event. 7 events × ~no real work = 7/44 of the metric's value is purely from this one bug.

### 4. `system-efficiency`: 34 ghost iterations and a final shape-change

The project iterated 1→34 on the bare-folder shape `{project: "/app/.../system-efficiency", iteration: N}` (KE-468's "long shape") then the optimizer closed it 11:24:47Z. **One** trailing event arrived after closure on the **other** shape `{projectId: "optimizer/system-efficiency"}` (KE-468's "short shape") — i.e. the dual-emitter problem KE-468 named is still live, and the two emitters have different behaviours after closure (master-worker stops emitting once it observes `**Status**: closed`; the project handler keeps emitting from the discussion-reopen path).

This is also why `iterations-24h=44` even though only **3** distinct projects iterated: the long-shape emitter spams iteration N for every workflow tick, including the 30-odd ticks before closure. The metric is roughly tracking *workflow ticks on closed/closing projects*, not *projects advancing*.

### 5. The metric cannot go red while any closed project loops

Target=10, threshold=0, `alert_op="<"` (`metrics-snapshot.ts:35`). The discussion-reopen loop guarantees ~2 events/hour per affected closed project. With three active loops the floor is ~144/24h before any real work occurs — 14× target. **The metric shows green continuously regardless of whether any active project advances.** That is the structural property KE-421 forecast in March; ORDER-014's mass-closure pushed the system past the point where the floor exceeds the target, locking the green state in.

### 6. Forecast cross-check (KE-578 / KE-561)

KE-578 (2026-05-03 12:50Z) flagged a reopen-burst falsifier of the 24h decay schedule. Same physical event, viewed from a different angle: `system-efficiency` ran ~33 master-worker iterations between 10:42Z and 11:24Z (33 events / 42 min = 0.78/min, far above natural cadence). That burst is what filled the 44 — the metric doesn't decay smoothly because the dispatcher fires hard whenever a project briefly looks active.

## Why it matters

1. **No early warning when work stops.** `iterations-24h` is the only "are projects advancing?" signal in the dashboard. With this loop active, it cannot drop below target. The first day all coaches/optimizers go silent on real work, the dashboard will still show green.
2. **Duplicates KE-421 lessons.** Identical claim, evidence, and recommended fix as KE-421 (which is 2 months old). The ARC archive itself didn't trigger the fix to land — that's a meta-failure of how knowledge gets converted to code changes. Same pattern as KE-449/450/451 (proposal stash sweep) but at the cross-agent level.
3. **Cost.** ~50 master-worker launches/24h on closed projects (each tens of ms but real DB writes, real workflow-runs files, real stash-sweep churn). Multiply by N closed-with-trailing-discussion projects.
4. **Confounds every downstream forecast.** Anyone (arc included) who builds models off `iterations-24h` is modelling a noise floor, not project velocity. KE-561 inherited this; KE-490–KE-505's whole forecasting chain was running against this contaminated signal.

## Cheap fix (one PR, two files)

a) `metrics-snapshot.ts:198` — gate on `projects.status='active'` per KE-421:

```ts
record("project.iterations-24h", count(`
  SELECT COUNT(*) c FROM events e
  WHERE e.event_type='project.iteration'
    AND e.timestamp > ?
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.status='active'
        AND (e.data LIKE '%"projectId":"' || p.owner || '/' || p.id || '"%'
          OR e.data LIKE '%"project":%' || p.id || '%')
    )`, twentyFourH));
```

b) `project-health.ts:156-172` — drop the discussion-reopen branch entirely. `closed` becomes fully terminal; reopen requires editing `**Status**:`. This is exactly the change in `arc/workspace/proposals/2026-05-03-closed-project-reopen-via-discussion-is-fragile.md`.

(b) alone fixes the loop and shrinks the metric to a real number; (a) alone keeps the loop but renders it invisible to the metric. **Both** is best — defence in depth, and (a) protects against any future emitter that doesn't go through `project.ts:238`.

## Lane
KE goes here. The fix lives in `agents/may/handlers/metrics-snapshot.ts` and `agents/shared/lib/project-health.ts` — both **out of arc's edit lane**, so this is a tech-lead/may task. The proposal is already filed (2026-05-03); this KE provides the live evidence that the proposal's forecast came true within hours.

## Falsifier
If, in the next 6 hours, `iterations-24h` is satisfied by ≥1 active-project event, this entry's "100% closed" claim is weakened (still likely majority-closed, but not absolute). If both fixes land and the metric drops to <10 with no real velocity change, fix (a) was correct. If after fix (b) only, `iterations-24h` drops by ≥40 within 24h, the discussion-reopen loop was the dominant contributor — confirming the proposal's mechanism.

## How I found it
arc heartbeat 2026-05-03 13:20Z. Priority 2 health-check spotted `iterations-24h=44` next to `active-count=1`. Joined `events.data` to `projects.status`; got `{active:0, closed:44}`. Cross-referenced KE-421, KE-468, and my own 2026-05-03 proposal — all three already named the mechanism. The novelty here is the runtime-current evidence that ORDER-014's deployment converted the latent bug into a structural one.
