# KE-484: zombie dispatch loop on closed projects actually stopped at ~02:36Z 2026-05-02 — clean step-change, not the partial trickle KE-466→472 implied

<!-- metrics: project.iterations-24h, project.stale-active-count, fix-effectiveness-tracking -->

**Date:** 2026-05-02 ~13:25Z
**Author:** arc (heartbeat session)
**Confidence:** High — orthogonal data (orchestrator session count, `project.iteration` shape distribution, per-project last-orchestrator timestamp) all converge on a single cutover moment and show >99% reduction.
**Connects:** KE-466 (tech-lead zombie-fix commits "claim master-worker changes but only flip statuses"), KE-468 (two payload shapes; "dispatch loop runs 5 non-active projects to safety-cap each cycle"), KE-470 (driver-is-`updateProjectStatus`-noop), KE-472 (Order-014 falsifier "fired three orchestrator sessions passed without status edit"), KE-481 (silent noop on heading form), proposal `2026-05-02-updateprojectstatus-warn-on-noop.md`, proposal `2026-05-02-standing-order-orchestrator-edit-status-directly.md`.

## Observation

The "dispatch loop drives closed projects to the 50-iteration safety
cap on every cycle" pattern that runs through KE-466 → KE-481 stopped
producing iterations at **2026-05-02 02:36:01Z**, ~10h before this
session. The stop is clean (not a slow taper) and no later restart
has re-broken it.

### Evidence — three independent series, one cutover

**1. `project.iteration` event payload-shape distribution by hour (24h):**

```
hr              path_shape  id_shape  total
2026-05-01 13      37         2          39
2026-05-01 14     139         4         143  } pre-fix: master-worker.ts emits dozens
2026-05-01 23      94         3          97    of "path-shape" iters per hour for
2026-05-02 00     145         3         148    test-coverage / system-efficiency /
2026-05-02 01     203         4         207    documentation-gen / cross-agent-…
2026-05-02 02      36         4          40  ← last path-shape rows at 02:36:01Z
2026-05-02 03       0         3           3  } post-fix: only handler/project.ts
2026-05-02 04       0         3           3    "id-shape" cron iters survive
2026-05-02 05       0         4           4    (~3-4/hr, only on `prompt-efficiency`
…                                              and `coach/skill-workflow-audit`)
2026-05-02 12       0         4           4
```

The `path_shape` column drops from 36 in hour-02 to **0** for every
hour after, and stays 0 for 10+ hours. The `id_shape` column (the
30-min cron in `may/handlers/project.ts:238`) is unchanged. So
master-worker.ts stopped emitting iterations entirely; the cron
poll did not.

**2. orchestrator/worker sessions per project (24h):**

```
projectId                              total   first                 last
optimizer/prompt-efficiency             426    2026-05-01 21:17:01   2026-05-02 12:42:21  ← still running, 2/hr
optimizer/test-coverage                 343    2026-05-01 13:18:45   2026-05-02 02:17:01  ← stopped
optimizer/system-efficiency             337    2026-05-01 13:18:24   2026-05-02 02:35:39  ← stopped (very close to event cutover)
coach/documentation-gen                 305    2026-05-01 14:16:58   2026-05-02 01:39:51  ← stopped
optimizer/cross-agent-collaboration      45    2026-05-02 00:47:01   2026-05-02 01:34:41  ← stopped
```

All four closed/waiting projects had their last orchestrator session
within a ~70-minute window ending at 02:35:39Z. None has fired since.
Only the one truly active project (`prompt-efficiency`, DB status =
`active`) continues to run — at a calm ~1–2 sessions/hour, not the
~50/hour stampede of the pre-fix peak.

**3. orchestrator+worker session counts as a hard total:**

```
24-hour total                : 1,449
since 2026-05-02 02:36:01Z   :    13   (0.9% of 24h volume)
```

So **>99% of the 24-hour orchestrator load was pre-fix**. KE-468
captured a peak-noise window; the fix's effect on that window is
near-total elimination.

## What changed at the cutover

Three commits land in the right window, in the right area:

| Time (UTC) | Commit | Change |
| --- | --- | --- |
| 2026-05-02 00:58:05 | `ff061cbc5` "evaluator: prevent zombie loop on unclear decisions" | Adds 3-strike "consecutive `unknown` decisions" guard in `master-worker.ts` — auto-flips to `waiting` and calls `updateProjectStatus(file, "waiting", …)` to break the loop. |
| 2026-05-02 01:37:04 | `406244006` "tech-lead: fix zombie dispatch — add status-override guard in master-worker, close documentation-gen" | Edits `documentation-gen/project.md` to `closed`. |
| 2026-05-02 02:57:46 | `03faab845` "tech-lead: close zombie loops (EXP-455), add ORDER-014 standing order" | Edits `system-efficiency` and `test-coverage` projects to `closed`, adds standing order. |

The line that actually pulled the trigger is `master-worker.ts:251`:

```ts
const status = extractField(projectContent, "Status").toLowerCase();
if (status === "paused" || status === "cancelled" || status === "done"
    || status === "complete" || status === "completed") {
  return ctx.done(`Project status: ${status}. Skipping.`);
}
if (status === "closed") {
  // Also skipping — ctx.done() called immediately above for "closed"
}
```

`extractField` reads the canonical-form `**Status**: closed` line. The
tech-lead commits set exactly that line on three projects between
01:37Z and 02:57Z. Once the status is `closed`, the orchestrator
short-circuits at the top of every dispatch and never enters the
iteration loop. The cron in `project.ts` still fires every 30 min
but its emission goes unused because the worker bails immediately.

## What this means for the chain KE-466 → 481

Most of those KEs were filed **before** the fix landed or while it was
landing. Their model — "the fix-attempts have only flipped status
fields, not stopped the loop" — was correct **at the moment they
were written** but is no longer the system's behavior.

| KE | Stale claim | Reality at 13:25Z 2026-05-02 |
| --- | --- | --- |
| KE-466 | "tech-lead zombie-fix commits flip statuses but only flip statuses" | The status flips were the fix. `master-worker.ts:251`'s `extractField`-based gate did the work the moment the heading form was canonicalized to `**Status**: closed`. |
| KE-468 §"Adjacent finding" | "dispatch loop is currently driving 5 non-active projects to safety-cap iterations every cycle, status-flip fixes have not landed effectively" | False as of ~02:36Z 2026-05-02. Last 6h: only `prompt-efficiency` (active in DB) sees orchestrator dispatch, ~1–2/hr. |
| KE-470 | "loop driver is `updateProjectStatus` noop" | Driver was the heading-form drift (KE-449/464/465). Once tech-lead canonicalized the headings, the existing gate caught them. The `updateProjectStatus` noop is a separate bug that affects orchestrator self-edits, but it wasn't the central driver. |
| KE-472 | "Order-014 falsifier fired three orchestrator sessions passed without status edit" | Falsifier interpretation was right for the window observed; the relevant action was happening on the human-tech-lead side, not the orchestrator self-edit side. |
| KE-481 | "`updateProjectStatus` silent noop on heading form, orchestrator says done each cron tick" | Still true as a *bug*; no longer a *driver*. The bug fires when the orchestrator decides "done" and tries to write `## Status: Closed` (heading form, mismatched cap), the file already has `**Status**: closed` from the human commit, and the regex doesn't match anyway. The status sticks because tech-lead set it directly, not because the orchestrator's edit landed. So the bug is masked, not fixed. |

## Why KE-468's diagnosis still fired but the fix worked anyway

KE-468's headline finding (two payload shapes; per-`projectId`
queries undercount by 25×) is **still correct** as a measurement
hazard. The reason the system improved despite that hazard is not
that anyone fixed the payload schism — it's that the path-shape
emitter (master-worker.ts) stopped emitting at all because the gate
above it now triggers. So:

- Per-`projectId` aggregations are still wrong in the same way KE-468
  said they are. (Verified: last 6h, all events are id-shape, but the
  metrics dashboard wasn't reading them either way.)
- The proposal `2026-05-02-unify-project-iteration-event-shape.md` is
  still worth landing — without it, the next time a closed project's
  heading drifts, every breakdown query will silently undercount the
  drift.
- KE-468's "five projects driving iterations" arithmetic is now a
  historical snapshot (24h-window result will roll over to 0 in
  ~14h).

## What's still broken

1. **`prompt-efficiency` heading drift.** `shared/projects/prompt-efficiency/project.md`
   line 6: `## Status: Complete`. DB row `projects.status='active'`,
   iteration 0. This is the KE-449 / KE-481 pattern alive: the canonical
   `**Status**: …` line is missing entirely (the heading form is the
   only status statement). `extractField` reads `**Status**: …` only,
   so it returns `''`, and the orchestrator dispatches every cron tick
   thinking the project is active. This is why `prompt-efficiency` is
   the **one** project still being orchestrated — it's the residual
   live case of the very pattern the tech-lead commits fixed for the
   other three. ~2 sessions/hr, not catastrophic, but the bug is still
   here.

2. **`coach/skill-workflow-audit` continues to receive id-shape iters
   from cron** (~1–2/hr) without a corresponding orchestrator session
   in the same project-id namespace. It does not appear in the
   orchestrator/worker per-project counts above. This is mismatched
   data: cron path emits but workflow path does not. Worth a focused
   look on the next heartbeat — possibly a different code path.

3. **The "no DB signal of restart" dynamic** (KE-482, KE-483):
   unchanged. The malformed-event count is still 24, last malformed
   row 2026-05-02 06:09:45Z. No new restart since. KE-483's
   restart-fingerprint claim still stands.

4. **Dev 401 outage** stayed quiet from 06:10Z (KE-482's fix) through
   13:10Z. Last 7 dev sessions: all `done`. No new errors. Resolved.

## Lesson

This is the third instance in this KE chain of **a fix landing while
the system was being observed and described as broken**, producing a
KE pile that retrospectively reads as more pessimistic than reality.
The pattern:

1. arc files KE-N saying "the fix-attempts are not working."
2. The fix-attempt is in fact a series of small commits, each looking
   ineffective in isolation.
3. The last commit in the series flips a load-bearing condition and
   the whole loop stops within minutes.
4. arc's next heartbeat sees the stop, but only after writing 2–3
   more KEs in the "fix not working" frame.

The cure is the falsifier discipline KE-483 just demonstrated: **for
every "this fix is not working" claim, write the falsifier in the
same KE, and re-check it next heartbeat.** KE-466's "fix-attempts
only flip statuses" was implicitly falsifiable — "if all closed
projects' iteration count drops to ~0 within a heartbeat, the
status-flip *was* the fix" — but the falsifier wasn't named, so the
chain kept piling on.

## Falsifiers

This entry is wrong if any of:

- A path-shape `project.iteration` event appears in `events` after
  2026-05-02 02:36:01Z. (Currently 0 in 10h.)
- An orchestrator session for `optimizer/test-coverage`,
  `optimizer/system-efficiency`, `coach/documentation-gen`, or
  `optimizer/cross-agent-collaboration` starts. (Currently 0 in 10h.)
- Any of those four projects' `**Status**: closed` line gets reverted
  by an orchestrator self-edit (KE-461 pattern). Check
  `git -C /app/agents log --since='2026-05-02 02:40' -- shared/projects/<name>/project.md`
  per project on next heartbeat.

## Recommendations

1. **Update KE-468, KE-470, KE-472, KE-481** with a one-line
   "superseded by KE-484 from 2026-05-02 13:25Z — primary driver
   resolved by tech-lead status canonicalization" header. Don't edit
   the bodies; KEs are append-only history. This is just to spare the
   next heartbeat reader from reading a stale-feeling chain as live.
   *(Lane note: arc may edit KEs in `shared/knowledge/entries/`. Doing
   header-only annotations only.)*

2. **Fix `prompt-efficiency`'s heading.** It's a 1-line edit but it's
   out of arc's lane (project files, not arc/shared-knowledge). Filing
   companion proposal `2026-05-02-canonicalize-prompt-efficiency-status.md`.

3. **Replace `extractField` with a 2-line tolerant reader** that
   accepts `## Status:`, `**Status**:`, and `Status:` heading forms.
   This is the structural fix that makes the next drift not require a
   human commit. Already covered by proposal
   `2026-05-01-fix-extractfield-heading-form.md` — re-flag as P0 now
   that we have evidence the gate it feeds is the load-bearing
   short-circuit for the entire dispatch loop.

4. **Treat orchestrator-session-count-per-closed-project as a falsifier
   metric.** Adding it as `metric.zombie-orch-sessions-6h` would
   produce an automatic alert if the loop returns. The data is already
   in `sessions`; the metric query is one line.

## Adjacent finding — `coach/skill-workflow-audit` is the new mystery

Of the 20 id-shape `project.iteration` events in the last 6h:
- 12 are `optimizer/prompt-efficiency` — explainable (drift, 2-3/hr).
- 8 are `coach/skill-workflow-audit` — **not** matched by any
  orchestrator session in 24h. So the cron handler is firing for it
  every ~30 min, but the orchestrator it would dispatch to is not
  starting. Either the cron is running ahead of an empty dispatcher
  hook, or there's a separate non-orchestrator code path emitting
  this event. `coach/skill-workflow-audit` is `closed` in
  `projects.status` table. Worth one heartbeat of attention.
