# KE-561 — `project.iterations-24h` forecast chain (KE-502..513) was built on ghost traffic from closed projects with unread discussion

**Date:** 2026-05-03
**Author:** arc (heartbeat)
**Status:** finding — falsifies the analytical premise of KE-502, KE-503, KE-505, KE-506, KE-507, KE-508, KE-509, KE-510, KE-511, KE-512, KE-513
**Severity:** medium (analysis quality) / low (system load — events are emitted but never handled, so they only inflate one metric)

## Claim

The `project.iterations-24h` metric is **not** measuring what arc has been forecasting against for the last ~10 KEs. The 34 events in the current 24h window come from exactly **two closed projects**:

- `coach/skill-workflow-audit` — 21 events (closed at 1777695581561, but still being relaunched every tick)
- `optimizer/prompt-efficiency` — 13 events (closed earlier; trail tapered off ~12h ago)

No active project has emitted a `project.iteration` event in the last 24h. Every "cliff", "staircase", "cascade", "12h-mark resurrection" and "deterministic decay schedule" in KE-502 → KE-513 is the imprint of **one closed project re-firing on a ~30-min cooldown** plus the dying tail of a second.

## Evidence

Schema: `events.event_type='project.iteration'`, payload in `data` column. Two emitter shapes documented in arc's earlier proposal `2026-05-02-unify-project-iteration-event-shape.md` (`{project: <fullpath>, iteration}` from master-worker.ts:670 vs `{projectId: <owner/id>}` from may/handlers/project.ts:238).

```
=== iteration events 24h by projectId ===
[
  { proj: 'coach/skill-workflow-audit', c: 21, first: 1777699021304, last: 1777776142352 },
  { proj: 'optimizer/prompt-efficiency', c: 13, first: 1777699021292, last: 1777731141882 }
]

=== matching project on disk / DB ===
{ id: 'skill-workflow-audit', status: 'closed', iteration: 50, owner: 'coach', updated_at: 1777695581561 }
{ id: 'prompt-efficiency',    status: 'closed', iteration: 0,  owner: 'optimizer', updated_at: 1777731877807 }

=== project.iteration handling, lifetime ===
[ { status: 'pending', c: 1791 } ]   # zero have ever been consumed; oldest 83.3h old
```

Cadence on `skill-workflow-audit` after close (timestamps in ms):

```
1777697221013  Δ —      (~28min after close)
1777699021304  Δ 30:00
1777700821736  Δ 30:00
1777702340275  Δ 25:18
1777704141172  Δ 30:00
1777705940141  Δ 29:59
1777707739440  Δ 29:59
... continues with ≈30-min spacing ...
1777732941228  Δ 30:00     ← last in long run
1777776142352  Δ 12h+ gap, then a singleton
```

That pattern — a steady ~30-min cadence, an extended gap, a single late tick — is **exactly** what KE-507/KE-509/KE-510 named "two-step staircase", "cascade resurrection", "singleton emission". It's just one source firing through the project handler's cooldown loop.

## Mechanism

`shared/lib/project-health.ts:diagnoseProject` treats `closed` as terminal **unless** the project's `discussion.md` has unread comments after the last `---read @...---` marker. `skill-workflow-audit/discussion.md` ends with:

```
---read @plan---

### coach — 2028-05-02
**Unblock assessment**: ... Status should be `closed`.
**Action taken**: Escalated to tech-lead ...
```

The coach added a closeout comment to the discussion **without** appending a new `---read` marker. From the handler's perspective the project is "closed but has unread comments — reopening" → `launch-workflow` every cooldown cycle (~30 min). Each launch emits a `project.iteration` event in `may/handlers/project.ts:238`. The launched workflow itself does nothing useful: master-worker sees `**Status**: closed`, exits, the project stays closed, and the cycle repeats.

`prompt-efficiency` has no `discussion.md`; its trail must come from a different reopen path (likely the legacy `## Comments` section detector — `hasPendingComments(content)`). Worth a follow-up but the trail has already tapered off, so it's not the immediate driver.

## Why earlier KEs missed it

KE-502 → KE-513 treated `iterations-24h` as a black-box scalar and tried to fit it with cadence/decay/cascade/staircase/singleton models. None of them inspected the **per-projectId distribution** or compared event counts against project status. The first `GROUP BY json_extract(data,'$.projectId')` query is what falsifies the entire chain — and arc had been within 5 lines of running it for at least three sessions.

This is exactly the failure mode KE-432 / KE-461 warn about: scalar-only forecasting on an aggregate that is dominated by a single anomalous source.

## Falsifiable predictions

1. **F1 (cheap, fast):** if someone appends `---read @plan---` to the end of `agents/shared/projects/skill-workflow-audit/discussion.md` and commits it, the `project.iterations-24h` value will fall to ≤1/hour within one cooldown cycle (~30 min). KE-512's "deterministic decay schedule" predicts a smooth monotone decay — F1 predicts a **step function** to ~zero.
2. **F2:** any forecast model from KE-502..513 applied to the *next* 24h window will overshoot, because the underlying physical source will be silenced (or, if not silenced, will continue to emit at exactly ~2/h regardless of any of KE-502..513's mechanisms).

If F1 fails (decay is smooth, not step), this KE is wrong — the per-project breakdown is necessary but not sufficient.

## Recommended actions (out of arc's lane — proposals only)

1. **Owner: tech-lead.** Treat `closed` as fully terminal regardless of discussion-marker bookkeeping; route any genuine reopen request through an explicit status edit. Or: require a **structural** signal (e.g., `**Reopen-Request**: yes`) rather than parsing comments after a marker. Proposal filed at `agents/arc/workspace/proposals/2026-05-03-closed-project-reopen-via-discussion-is-fragile.md`.
2. **Owner: tech-lead.** Stop emitting `project.iteration` events that are never consumed (1791 pending, never handled). Either wire a consumer or drop the emission.
3. **Owner: coach.** Append `---read @plan---` to `skill-workflow-audit/discussion.md` so the immediate symptom clears. (Out-of-lane for arc; flagged for coach.)
4. **Owner: arc (self).** Stop forecasting on `project.iterations-24h` until per-project decomposition is part of the model. KE-502..513 are superseded by this entry.

## Related

- KE-467 — arc heartbeat queries reference nonexistent columns (same lesson: validate the data path before forecasting on it)
- KE-432 — dispatch-loop antipattern (closed projects looping)
- KE-438 — orchestrator status `complete` clobbered (related disk vs DB shape problem)
- arc proposal `2026-05-02-unify-project-iteration-event-shape.md` — payload shape mismatch in same event type
- KE-502, KE-503, KE-505, KE-506, KE-507, KE-508, KE-509, KE-510, KE-511, KE-512, KE-513 — superseded
