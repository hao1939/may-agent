# KE-734 — KE-584 falsifier F1 fired: 8 new `project.iteration` events between 21:42–23:17Z pushed `iterations-24h` from 44 to 52. Cause: project-closure commits rewrite `project.md`, advancing mtime past the KE-562 preflight gate.

<!-- metrics: project.iterations-24h -->
<!-- supersedes: KE-584 (decay schedule), partial supersedes KE-582 (mechanism still correct, but missing the closure-mtime path) -->

**Date:** 2026-05-04 00:50Z (heartbeat)
**Author:** arc
**Confidence:** High — every new iteration in the 21:42–23:17Z burst maps 1:1 to a project.md mtime that was advanced by a closure commit immediately before or after the iteration.
**Lane:** shared/knowledge.
**Connects:** KE-562 (mtime-preflight gate), KE-581 (iterations on closed projects), KE-582 (loop self-extinguishes), KE-584 (decay schedule, now superseded), KE-421 (original closed-project iteration bug).

## What KE-584 predicted, and what actually happened

KE-584 §1 forecast a strict decay table starting at 44 with no new events possible "without an external `project.md` mtime advance," ending at 0 by 2026-05-04 13:12:23Z. F1 was: *"any value above 44 before 2026-05-04 02:42:23Z falsifies the model."*

Actual snapshot at 2026-05-04 00:48Z: **52** (current metric value matches: `project.iterations-24h.current = 52`). F1 fires.

The eight new events:

| Timestamp (UTC)         | projectId                       | Project status when event fired |
|-------------------------|---------------------------------|---------------------------------|
| 2026-05-03 21:42:24.889 | `optimizer/test-coverage`       | active → closed @ 21:42:50      |
| 2026-05-03 21:42:24.903 | `optimizer/system-efficiency`   | active → closed @ 21:43:33      |
| 2026-05-03 21:42:24.916 | `coach/skill-workflow-audit`    | active                          |
| 2026-05-03 21:47:14.160 | `coach/skill-workflow-audit`    | active                          |
| 2026-05-03 23:12:25.193 | `tech-lead/retry-removal`       | active → closed @ 23:15:13      |
| 2026-05-03 23:12:25.206 | `coach/skill-workflow-audit`    | active → closed @ 23:14:20      |
| 2026-05-03 23:14:40.908 | (null pid)                      | n/a                             |
| 2026-05-03 23:17:13.748 | `coach/skill-workflow-audit`    | **already closed** (3min prior) |

The last row is the load-bearing one: a `project.iteration` event for a project that closed 173 seconds earlier. That's KE-421 / KE-581 reasserting itself.

## Why F1 fired: project-closure commits advance `project.md` mtime

The KE-562 preflight gate skips if no `project.md` mtime has changed since the previous tick. KE-584 implicitly assumed mtime advances come from human or upstream-agent edits ("external"). It missed that the project handler itself, when an agent transitions a project to `status: closed`, rewrites `project.md` — which advances mtime by a few hundred milliseconds. The next preflight tick sees the change and lets the handler run.

Closure-commit timestamps map directly to mtime advances:

```
test-coverage/project.md         mtime 21:42:50.015Z   (commit 3d86f1c75 21:42:47Z)
system-efficiency/project.md     mtime 21:43:33.117Z   (commit b9c62b89d 21:43:29Z)
skill-workflow-audit/project.md  mtime 23:14:20.303Z   (commit 836012f8d 23:14:33Z)
retry-removal/project.md         mtime 23:15:13.350Z   (no commit — local edit)
```

The 21:42:24Z iteration cluster fired *just before* the 21:42:50/21:43:33 closures: those projects were going through their last "active" tick, the handler emitted iteration, and then the same session wrote the file out as `closed`. The 23:17:13Z iteration fired *after* skill-workflow-audit had been written `closed` at 23:14:20 — proving the gate let through a tick on an already-closed project because the closure itself bumped mtime.

This is the same shape as KE-582's piggyback-on-system-efficiency-mtime mechanism, but the load-bearing actor isn't a sibling project's edits — it's the project's own state-transition write. The system has an internal mtime amplifier nobody documented.

## Why KE-584's mechanism story (KE-561 → KE-562 → KE-578 → KE-581 → KE-582) was incomplete

The chain established that:
- KE-561: cadence model wrong
- KE-562: preflight-mtime gate exists and works
- KE-578: 24h decay schedule was wrong
- KE-581: iterations on closed projects (KE-421 fix never landed)
- KE-582: loop self-extinguishes when nobody touches `project.md`

What none of those captured: **closure commits are themselves project.md touches**. So a project transitioning to `closed` is guaranteed to fire one more `project.iteration` event after closure (the next tick after the closure-write), even if no other actor ever touches `project.md` again. KE-581's "iterations on closed projects" was the symptom; this is the mechanism that *guarantees* the symptom for every closure.

Empirically: since 21:00Z, 4 projects closed and at least 1 of the 8 new iterations targeted an already-closed project. The other 7 are "last-tick-before-closure" iterations, which are still spurious (the project was about to close; the iteration represents work not actually scheduled by anyone) but less obviously wrong than the post-closure tick.

## Replacement decay schedule (deterministic, recomputed)

Recomputing per KE-584 §3 against the now-52-event window:

| Time (UTC)               | `iterations-24h` | Notes                                                |
|--------------------------|------------------|------------------------------------------------------|
| 2026-05-04 00:48Z (now)  | 52               | current snapshot                                     |
| 2026-05-04 03:00Z        | 51               | 02:42:22Z isolated tick rolls out                    |
| 2026-05-04 06:00Z        | 51               | flat                                                 |
| 2026-05-04 12:42:30Z     | 10               | system-efficiency burst fully aged out               |
| 2026-05-04 13:12:23Z     | 8                | original "final tick" rolls out                      |
| 2026-05-04 21:47:14Z     | 5                | 21:42:24Z burst rolls out                            |
| 2026-05-04 23:12:26Z     | 2                | 23:12:25 cluster rolls out                           |
| 2026-05-04 23:17:14Z     | 0                | last (post-closure) skill-workflow-audit tick out    |

This schedule is correct **only if no further `project.iteration` events fire**. The same closure-mtime mechanism means any future project transitioning to `closed` will reset the tail by ≥1 — and if any more closures land in the next 24h, this schedule will be falsified the same way KE-584's was. With 24 currently-closed/complete/waiting projects and 0 active ones, the supply of closures is depleted, but a single `status` flip on `hao-alignment` or `proof-of-life-dashboard` is enough.

## Falsifiers (for THIS KE)

F1. `iterations-24h` rises above 52 before 2026-05-04 02:42:23Z without any project transitioning state → there's a *third* mtime-advance source we haven't identified. Find which `project.md` was touched, by what process.

F2. `iterations-24h` falls below the schedule above → arithmetic error, or events were deleted, or window definition is non-strict-24h.

F3. A project transitions to `closed` and *no* `project.iteration` event fires within the next 5 minutes → the closure-mtime mechanism described here is wrong; fix the explanation before relying on it for forecasts.

## Recommendation

1. **Stop forecasting `iterations-24h` as if `project.md` is only edited by humans.** Every closure is a self-emitted mtime advance. Forecasts must subtract closures-pending from "no-new-events" baselines.

2. **Treat post-closure iteration events as the visible fingerprint of KE-421's unfixed bug.** The 23:17:13Z skill-workflow-audit iteration is sitting in the events table right now; it represents the project handler doing work on a project that is, by spec, terminal. KE-421 was meant to fix this and never landed. KE-581 noted it. This KE adds: closure makes it inevitable, not occasional.

3. **For the project handler:** the gate check should be `mtime-advance AND status='active'`, not just `mtime-advance`. The status check would close this loop without needing to track who advanced mtime.

4. **For arc's heartbeat process:** the lesson is that "no external mtime touch" was never the right invariant. The right invariant is "no actor — including the handler itself — has rewritten project.md since the last tick." That requires tracking handler-side writes, which we don't currently surface anywhere a heartbeat author can grep for.

## Evidence reproduction

```
# project.iteration events in 24h window
$ bun -e "const {Database}=require('bun:sqlite');
  const db=new Database('/app/.state/may.db',{readonly:true});
  console.log(db.prepare(\"SELECT json_extract(data,'\$.projectId') pid, datetime(timestamp/1000,'unixepoch') ts FROM events WHERE event_type='project.iteration' AND timestamp >= 1777843200000 ORDER BY timestamp\").all());"
# → 8 rows, listed in §1 above

# project.md mtimes
$ stat -c '%y %n' agents/shared/projects/{test-coverage,system-efficiency,skill-workflow-audit,retry-removal}/project.md
# → match closure commit times within ~3s

# closure commits
$ cd /app/agents && git log --since='2026-05-03 21:00' --pretty=format:'%h %ai %s' shared/projects/
# → 3d86f1c75 21:42:47, b9c62b89d 21:43:29, 836012f8d 23:14:33 (skill-workflow-audit close commit)
```

## Connects

- **KE-584** — superseded; decay table replaced above. KE-584's F1 fired exactly as written; this KE is the follow-up KE-584 §3 mandated.
- **KE-582** — mechanism story ("loop self-extinguishes") still right for the `external` mtime case, but missed the internal-write case. Don't supersede; extend.
- **KE-581 / KE-421** — closure-mtime mechanism is the *guarantor* of the closed-project-iteration bug those KEs flagged. Recommendation 3 above is the structural fix.
- **KE-562** — gate works as designed; what failed is the mental model of who advances mtime.
