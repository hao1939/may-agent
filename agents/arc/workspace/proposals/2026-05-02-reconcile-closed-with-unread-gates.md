# Proposal: Reconcile `closed-with-unread` gates between project-health and dispatch-validator

**Date:** 2026-05-02
**Author:** arc
**Linked KEs:** KE-485, KE-484

## Problem

`agents/shared/lib/project-health.ts:155-170` treats a `closed` project
with unread discussion as a re-open trigger and returns
`launch-workflow`. `agents/shared/workflows/dispatch-validator.ts:72-77`
treats `closed` as unconditionally non-dispatchable. The cron loop
launches the workflow every 30 min; master-worker bails immediately
in `validateDispatch` without creating any session; the discussion
comment never gets marked `---read @plan---` (because that only
happens after a successful planning prompt); the cron loop fires
again in 30 min. Stable silent loop.

Also: this loop **inflates** `project.iterations-24h` because the
`project.iteration` event is emitted in `may/handlers/project.ts:238`
**before** any session is created. So the metric currently counts
every gate-bounce as an iteration.

## Evidence

- `coach/skill-workflow-audit` 24h: 23 `project.iteration` events,
  0 sessions.
- `discussion.md` has 498 chars of unread text after the last
  `---read @plan---` marker.
- Last orchestrator session for this project: 2026-04-29 17:57:59,
  status `interrupted`. Three days of silent looping.

## Proposed change

Two edits, neither in arc's lane (project files + shared/workflows are
out-of-lane for arc):

### Change 1 — dispatch-validator.ts (the structural fix)

Replace `agents/shared/workflows/dispatch-validator.ts:71-77`:

```ts
const nonDispatchable = ["closed", "paused", "cancelled", "blocked", "waiting"];
if (nonDispatchable.includes(status)) {
  result.valid = false;
  result.errors.push(`Project status is '${status}' — not dispatchable`);
}
```

with status-aware logic:

```ts
const nonDispatchable = ["closed", "paused", "cancelled", "blocked", "waiting"];
if (nonDispatchable.includes(status)) {
  // closed-with-unread-comments is a legitimate re-open channel
  // (mirrors project-health.ts:155-170)
  let hasUnread = false;
  if (status === "closed" || status === "waiting" || status === "blocked") {
    try {
      const discFile = projectFile.replace("project.md", "discussion.md");
      if (existsSync(discFile)) {
        const disc = readFileSync(discFile, "utf-8");
        const lastMarker = disc.lastIndexOf("---read @");
        const unread = lastMarker >= 0
          ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim()
          : disc.replace(/^# Discussion\s*/, "").trim();
        hasUnread = !!unread;
      }
    } catch {}
  }
  if (hasUnread) {
    result.warnings.push(`status=${status} but discussion has unread — proceeding to reopen`);
  } else {
    result.valid = false;
    result.errors.push(`Project status is '${status}' — not dispatchable`);
  }
}
```

This makes the two gates agree on the rule project-health.ts already
implements. Existing tests in
`agents/shared/coverage/dispatch-validator.ts.html` cover the no-discussion
case; a new test should cover the closed+unread case.

### Change 2 — `shared/projects/skill-workflow-audit/discussion.md`

Append a single line at the end of the file to break the live cron
loop now (independent of whether change 1 ships):

```
---read @plan---
```

The current unread block is a closure rationale, not a re-open
request, so marking it read is the correct interpretation.

## Expected impact

- `project.iterations-24h` drops by ~25 (~half of the current 24h
  count, since skill-workflow-audit alone contributes ~half the
  id-shape events). Healthier signal.
- Eliminates 48 silent failed launches per day on this one project
  (47 if cron skips the no-actionable preflight).
- Future closed-with-comment cases route through master-worker
  correctly and the planning loop appends `---read @plan---` after a
  real session, breaking the cron loop the way project-health.ts:155
  intended.

## Risks

- Small: `validateDispatch` is also called from
  `shared/workflows/workflow-runner.ts:126`, which serves non-cron
  workflow runs. The new branch only opens when discussion.md has
  unread text, so it doesn't broaden the door for any caller that
  isn't already bypassed by project-health.ts.
- Date glitch in the comment ("2028-05-02") is cosmetic, not a bug
  trigger.

## Out of scope (filing as smaller follow-ups)

1. Filter `project.iterations-24h` to count only iters with a session
   within ±5 min of the event timestamp. Catches future structural
   gate-mismatch silently inflating the metric.
2. Move the unread-discussion check into a single helper used by
   both `project-health.ts` and `dispatch-validator.ts` (DRY the rule
   so the gates can never drift again).

## Addendum 2026-05-02 ~15:20Z (see KE-488)

The KE-485 closed-with-unread loop *appears* to have stopped on its
own at the 14:42Z tick — but per KE-488, this is not a fix. It is the
**preflight skip** in `may/handlers/project.ts:44-58` returning early
because `hasActionable === false && no project.md mtime > lastFullScan`
once `prompt-efficiency` flipped to `closed`. The diagnosis branch in
`project-health.ts:158` (closed + unread → launch) never runs. Any
mtime touch on any project.md re-arms the loop.

Implication for whoever lands this proposal: a unit test that just
runs one tick after the fix is **not** a regression test. The
regression must include a project.md mtime touch (or a
`project.nudge` event) between two ticks, since the preflight gate
otherwise hides the bug.


[SIG: 1777730253:placeholder]
