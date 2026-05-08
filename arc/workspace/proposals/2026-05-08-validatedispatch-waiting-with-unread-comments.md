# Proposal: Teach validateDispatch about waiting/blocked + unread comments (KE-902)

**Date:** 2026-05-08
**Author:** arc
**Priority:** P1
**KE:** KE-902 (full diagnosis), connects KE-485 (closed-form fix)

## Problem

`shared/lib/project-health.ts:229-247` returns `launch-workflow` for
projects in `waiting`/`blocked` status when discussion.md or
`## Comments` has unread content. `shared/workflows/dispatch-validator.ts:72-78`
then unconditionally rejects those statuses, master-worker.ts:516
calls `ctx.escalate(...)`, and the 24h `ESCALATION_COOLDOWN_MS` is
**not** updated on this path — so the same project re-escalates on
every cron tick.

Live cluster (DB query in KE-902): 5 escalations from
`shared/projects/v2-spec-coverage-buildout` between 05:46Z and 09:28Z
on 2026-05-08, all identical text, all `may` agent.

KE-485 fixed the symmetric bug for `closed` (master-worker has a
discussion.md unread-comments branch at master-worker.ts:543+). The
fix was never propagated to `waiting`/`blocked`.

## Proposed change

**Preferred (option a):** In `shared/workflows/dispatch-validator.ts`,
move the unread-comments exemption out of master-worker into the
validator. For statuses in `["closed", "waiting", "blocked"]`, before
adding the "not dispatchable" error, check both:

1. `discussion.md` for content after the last `---read @` marker
2. project.md for a `## Comments` section (legacy)

If either has content, allow dispatch with a `result.warnings.push("relaunching due to unread comments")`. Master-worker's existing `closed`-branch handling can then be simplified or removed.

**Fallback (option c):** In `shared/workflows/master-worker.ts:515`,
when `validateDispatch` rejects, write `now` to
`healthState.projects[relPath].lastEscalation` before calling
`ctx.escalate(...)`. This restores the 24h cooldown's load-bearing
guarantee even if the root-cause inconsistency is left in place.
Cheap, doesn't fix the busy loop, but stops the human-visible burst.

## Impact

- Stops the v2-spec-coverage-buildout escalation cluster (and any
  future waiting/blocked + comments project entering the same loop).
- Restores project-health's "max 1 escalation per project per day"
  guarantee.
- Removes a misleading user-visible escalation reason ("not
  dispatchable" when project-health *just* told the workflow to
  dispatch).

## Risk

Low. Option (a) makes `validateDispatch` consistent with its only
caller's expectations. Option (c) is a 1-line additive write on an
already-rare error branch.

## Lane

Both files (`shared/workflows/dispatch-validator.ts`, `shared/workflows/master-worker.ts`) are out of arc's edit lane — proposal only.
