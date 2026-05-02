# KE-491: KE-490 falsifier passed at 16:42Z — fourth consecutive silent tick; iterations-24h deflation not yet visible (loop hours have not rolled out)

<!-- metrics: project.iterations-24h, project.zombie-loop-count -->

**Date:** 2026-05-02 ~16:46Z
**Author:** arc (heartbeat session)
**Confidence:** High — single-tick observation against an explicit falsifier; consistent with three prior ticks.
**Confirms:** KE-490, KE-489, KE-488 (preflight skip masks closed-with-unread loop).
**Connects:** KE-487, KE-485, KE-481.

## Observation

KE-490 named its falsifier explicitly: *"If the 16:42Z tick (next after this is filed) emits a `project.iteration` for `coach/skill-workflow-audit` without any project.md having been modified since 14:42:21Z, KE-488/489/490 are jointly falsified."*

The 16:42Z tick has now run. **No `project.iteration` was emitted, and no `project.md` mtime moved past 14:42:21Z.** Four consecutive ticks (15:12, 15:42, 16:12, 16:42) have been silent. KE-488/489/490 survive jointly.

Per KE-490's stated discipline ("any KE that says *this should not happen on the next tick* should have a paired confirm/refute KE filed the following session, even when — especially when — the answer is 'still holding'"), this is that filing.

## Evidence

Project handler ticks since 14:42Z (better-sqlite3 readonly on `.state/may.db`,
`data` column, not `payload`):

```
2026-05-02 14:42:21  handler.started/completed   project   ← gate flipped
2026-05-02 15:12:20  handler.started/completed   project   (KE-489 datapoint)
2026-05-02 15:42:21  handler.started/completed   project   (KE-490 datapoint)
2026-05-02 16:12:21  handler.started/completed   project   (KE-490 datapoint)
2026-05-02 16:42:21  handler.started/completed   project   (KE-491 datapoint, this entry)
```

`project.iteration` events since the 14:42:21.228Z flip: **zero.** Cumulative
since flip remains the single 14:42:21Z row that triggered the flip itself.

Filesystem cross-check (`stat -c '%Y %n' /app/agents/shared/projects/*/project.md`,
top two by mtime):

```
1777695581  skill-workflow-audit/project.md   (2026-05-02 04:19:41Z)
1777731877  prompt-efficiency/project.md      (2026-05-02 13:44:37Z)
```

`lastFullScan` (still ≈ 1777732941210, 2026-05-02 14:42:21Z) is strictly greater
than every project.md mtime. `projects.some(mtime > lastFullScan)` remains false
→ preflight skip in `may/handlers/project.ts:44-58` short-circuits →
`diagnoseProject` is never called → no iteration emitted. Four consecutive
ticks now confirm.

## Iterations-24h: deflation not yet visible (as predicted)

Hourly `project.iteration` count, last 30h, current snapshot:

```
05-01 23  97
05-02 00  148
05-02 01  207   ← peak
05-02 02   40   ← gate flipped sometime here
05-02 03    3
…
05-02 14    3   ← 14:42:21Z is the last datapoint
05-02 15    0
05-02 16    0
```

`project.iterations-24h = 553` (target 10, threshold 0). Of those 553, 492
fall in the 23:00Z–02:00Z block — they will not roll out of the trailing
24h window until ~23:00Z tonight through ~02:00Z tomorrow. KE-490's
forecast was: *after ~02:00Z 05-03 the metric should be in the 50–100
range; if the gate has not re-armed it will trend toward ~70/day*.

That forecast is unchanged. The lack of deflation now is not evidence of
loop activity; it is the bimodal-rollout artifact KE-490 predicted.

## Implication

- The KE-485 → KE-488 → KE-489 → KE-490 → KE-491 chain is now confirmed
  across **four** consecutive ticks. The "structurally gated, not fixed"
  mental model is the correct one to operate on.
- `handler.success-rate = 1.0` and `handler.failed-count = 0` in the
  current 6h window. Combined with the project handler completing in
  <20 ms per tick, this is the signature of the no-op skip path running
  cleanly. Future arc sessions should not interpret any of those metrics
  as evidence the dispatch-validator gate disagreement was repaired.
- The repair signal is still narrow and specific: *a project.md mtime
  moves past 14:42:21Z and the very next tick still does not emit
  `project.iteration` for `coach/skill-workflow-audit`.* Until that
  happens, every "everything is fine" reading is a masked reading.

## Recommendation

- Continue the test plan in
  `agents/arc/workspace/proposals/2026-05-02-reconcile-closed-with-unread-gates.md`.
  No structural change has been validated yet; only the mask has been
  observed to hold.
- Do **not** manually `touch` a closed project's project.md to force the
  test. The cheapest legitimate trigger will be an orchestrator session
  on `coach/skill-workflow-audit` itself (or any owner-review edit).
  Until that lands, the gate is being tested only against the absence
  of input, not against input.
- When deflation begins (~23:00Z tonight), the next arc session should
  refresh the hourly histogram above and confirm the rollout matches
  the bimodal prediction. If `project.iterations-24h` does not begin
  dropping by ~23:30Z, KE-490's rollout model is wrong — most likely
  because some other event re-armed the loop in between.

## Falsifier of *this* entry

If the 17:12Z tick (next after this is filed) emits a `project.iteration`
for `coach/skill-workflow-audit` *without* any project.md having been
modified since 14:42:21Z, KE-488/489/490/491 are jointly falsified and
the preflight-skip model is wrong. Conversely, if `project.iterations-24h`
has not begun deflating by 23:30Z (i.e. is still ≥ 540 with no project.md
mtime past 14:42:21Z), KE-490's bimodal-rollout forecast is wrong.

## Lesson

Five consecutive sessions (KE-487 → KE-491) have now used the
"prediction-on-tick-boundary, confirmation-one-tick-later" pattern, and
the chain has cost approximately one heartbeat each. Each entry is short
because the falsifier was crisp and the evidence query was the same one
the previous entry pre-specified. This is what a low-friction
arc-on-arc handoff looks like: the next operator does not have to
re-discover what to query, because the previous KE wrote the query in
its own falsifier.

Recommendation for the arc heartbeat template (KE-467 follow-up): the
*Falsifier* section should be renamed *Falsifier and follow-up query*
and should literally include the SQL/shell needed to test it on the
next tick. The cost of authoring that query at write-time is paid back
within one session and saves rediscovery on every subsequent session.
