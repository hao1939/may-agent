# Proposal — `discussion.md` reopen path needs source-filter, not just status filter

**Date:** 2026-05-04
**Author:** arc
**Owner needed:** dev (with tech-lead review)
**Cross-links:** KE-746 (mechanism), KE-745 (symptom), KE-734 (different mechanism), and the prior proposal `2026-05-04-filter-closed-projects-from-iterations-24h-and-dispatch.md`.

## Problem (one paragraph)
The project-health handler re-launches closed projects whenever
`discussion.md` has any content past the last `---read @…---` marker.
Because the handler itself writes comments (via `appendComment` /
`add-comment` / `escalate` / `reactivate` paths) without appending a
`---read` marker, **agents close projects with self-authored rationale
notes that are then read as "unread human input" on the next tick** and
re-launched, in perpetuity. KE-746 documents the live case:
`coach/skill-workflow-audit` has been ghost-iterating on a perfect
30-minute cadence for ≥59 minutes after closure (3 ticks observed; the
loop has no termination condition).

## Fix
Land **both** of the following in the same change:

### (A) Status-based dispatcher filter (already proposed in 2026-05-04-filter-closed-projects-...)
Add `WHERE status NOT IN ('closed','archived','complete')` to the
project-loop's enumeration site. This stops dispatcher symptoms but does
**not** prevent `diagnoseProject`'s `closed-with-unread` branch from
firing on the cached projects, because `scanAllProjects` reads project
files directly from disk regardless of DB status. So (A) is necessary
for the iterations-24h metric and for stopping wasted handler invocations
downstream of dispatch, but it is not sufficient on its own.

### (B) Source-filter on `hasUnread` in `agents/shared/lib/project-health.ts`
The `closed`-branch (lines 155-168) and the `waiting/blocked`-branch
(lines 178-198) both compute `hasUnread` the same way. Both must change.
Two viable forms — pick one:

**B1 (simpler):** Require the unread block to contain a `### hao —`
heading (or any heading whose author isn't an agent name). Currently any
trailing text counts; change `hasUnread = !!unread` to
`hasUnread = /^###\s+hao\s+—/m.test(unread)`. This narrows the reopen
trigger to actual human input and matches the existing convention in
discussion.md files. Drawback: hard-codes "hao" as the only human owner.

**B2 (more robust):** Whenever any code path in `project.ts` writes
content into a project — `appendComment`, the `reactivate` flow that
flips status to `active`, the `add-comment` flow, or any future writer —
also append `\n---read @<reason>-<isoTs>---\n` to `discussion.md` if it
exists. That makes the handler's own writes self-marking and preserves
the original semantic ("unread" = "not yet processed by the loop").
Drawback: needs more touch points.

I lean **B2** because B1 is brittle to renaming the human owner and
silently regresses if a human posts under any other handle, but either
fix is sufficient.

### (C) (optional but cheap) Backfill the existing ghost
Append `\n---read @closure-2028-05-02---\n` to
`agents/shared/projects/skill-workflow-audit/discussion.md`. This stops
the live ghost loop the moment the change lands, even before (B) ships.
Out-of-lane for arc; should be done by dev or coach as part of this
change.

## Falsifier
After (B) lands and (C) is applied:
- No `project.iteration` events for `coach/skill-workflow-audit` past
  the change point until a new `### hao —` block is appended (or, under
  B2, until any new comment is appended that lacks a corresponding
  `---read` marker).
- `project.iterations-24h` drops by ~14 (the current 24h ghost count for
  this project) within 24h; full closed-project ghost traffic drops by
  ~22.

## Why this can't wait for "next refactor"
KE-745 → KE-746 is the *third* time this metric class has been shown
unsound (KE-561, KE-578, KE-745). KE-745 already noted "do not ship a
fourth heartbeat watching the same false reading." We now have a pinned
mechanism and a 90-line patch site. Shipping (A) without (B) will close
the metric symptom but leave handler-tick CPU spent on the reopen check
and leave the door open for the next agent that closes a project with a
trailing rationale comment to recreate the loop on a new project.

## Out of scope
- KE-734's mtime-gate revival path (separate mechanism, separate fix).
- Schema unification of `project.iteration` event payloads (KE-568 /
  arc proposal `2026-05-02-unify-project-iteration-event-shape.md`).
