# KE-746: Ghost iterations of closed `skill-workflow-audit` have a mechanism — the `closed-with-unread` reopen path fires on coach's own closure comment

## What KE-745 left unexplained
KE-745 (this morning) showed that 22/60 (37%) of `project.iteration` events
in the last 24h came from rows the DB classified as `closed`, and noted "the
dispatcher has the project in its iteration set even after the close was
committed and visible." It cited KE-734's mtime-revival path as one mechanism
"but not the only one" and recommended a `WHERE status NOT IN (...)` filter
without identifying *what* keeps re-enrolling closed projects.

This entry pins the mechanism for the largest single ghost source
(`coach/skill-workflow-audit`, 14/60 = 23% of the 24h count).

## Observation — third ghost iteration on a 30-min metronome
After KE-745 published at 2026-05-04T05:42Z, a **third** ghost
`project.iteration` for `coach/skill-workflow-audit` fired at
**2026-05-04T06:12:25.808Z** — 59m02s after the project was closed at
05:13:42.764Z, exactly 30m00s after the prior ghost at 05:42:25.295Z, and
exactly 30m00s after the project handler's previous tick. The handler runs
on a 30-minute schedule (verified: `handler.started` events for `project` at
04:12, 04:42, 05:12, 05:42, 06:12, 06:17). Three consecutive ticks, three
ghost iterations of the same closed project, exact-cadence repeat.
That pattern rules out KE-745's "one-tick race" framing and KE-734's
mtime-gate path (the file mtime hasn't advanced since 05:13:42). The
project is enrolled in the iteration set on a *recurring* basis — every
tick re-enrolls it.

## Mechanism — `diagnoseProject` reopens any closed project with content past the last `---read` marker
`agents/shared/lib/project-health.ts:155-168`:
```ts
if (status === "closed") {
  let hasUnread = false;
  try {
    const discFile = project.projectFile.replace("project.md", "discussion.md");
    if (existsSync(discFile)) {
      const disc = readFileSync(discFile, "utf-8");
      const lastMarker = disc.lastIndexOf("---read @");
      const unread = lastMarker >= 0 ? disc.slice(disc.indexOf("\n", lastMarker) + 1).trim()
                                     : disc.replace(/^# Discussion\s*/, "").trim();
      hasUnread = !!unread;
    }
  } catch {}
  if (hasUnread) {
    return { type: "launch-workflow", reason: "closed but has unread comments — reopening", comment: "" };
  }
  return { ...skip, reason: "closed by human" };
}
```
A closed project with *any* trailing content past its last `---read @…---`
marker is launched as a workflow on every tick.

`agents/shared/projects/skill-workflow-audit/discussion.md` (full, 21
lines) has three `---read @plan---` markers at lines 6, 11, 16 — and then a
coach self-comment at the bottom dated 2028-05-02 (the one explaining
*why* the project was closed, signed by coach itself). No `---read` marker
follows that comment. So `lastMarker = 16`, `unread =` (the entire coach
closure note), `hasUnread = true`, → `launch-workflow` on every tick,
forever.

This is **coach's own closure-rationale comment causing coach's project
to be re-launched 30 minutes later, in perpetuity**. The project files's
`Status: closed` is honored by the SQL writeback (DB stays `closed`), but
the iteration/launch decision is made from `discussion.md` parsing, not
from the cached status — so the metric counts the ghost iterations and
the workflow runs anyway.

## Falsifier I would have run if I had a writable lane
Append `\n---read @closure-2028-05-02---\n` to
`agents/shared/projects/skill-workflow-audit/discussion.md`. Prediction:
no further `project.iteration` events for `coach/skill-workflow-audit`
until a new comment is added. (Cannot run from arc — out-of-lane edit;
would be silently stashed per KE-450/451.)

## Why KE-745's recommendation is necessary but not sufficient
KE-745 asked dev to add `WHERE status NOT IN ('closed', 'archived',
'complete')` at the project-loop's enumeration site. That stops the
specific dispatcher symptom but leaves the underlying logic — "closed
projects with unread comments should be re-launched" — intact. The
intent of that branch is "human posts a comment on a closed project →
reopen it"; it just has no notion of *which* commenter the unread mark
should disqualify. As it stands, **the project-health handler reads its
own writes**: the system re-launches closed projects whenever any agent
(including the closer) leaves a trailing comment without manually
appending a `---read` marker.

So a complete fix needs *both*:
1. **Status-based filter** at enumeration (KE-745's recommendation).
2. **Source filter** on `hasUnread`: ignore comments authored by
   non-human owners, OR require the unread block to contain a `### hao —`
   header, OR auto-append `---read @closure-<ts>---` whenever the
   project-health handler itself writes a comment via `appendComment` to
   a project whose Status is being set to closed/blocked.

(2) is the durable fix. (1) alone reduces the symptom but the
discussion-loop continues to spend handler ticks on the reopen check.

## Cross-links
- KE-745 — same-day discovery of 37% closed-project ghost traffic; this
  KE supplies the missing mechanism for the largest ghost source.
- KE-734 — mtime-gate revival (different mechanism; not load-bearing
  here — the file mtime hasn't advanced).
- KE-561, KE-578 — prior `iterations-24h` inflation incidents.
- arc/workspace/proposals/2026-05-04-filter-closed-projects-from-iterations-24h-and-dispatch.md
  — KE-745's proposal; needs the additional source-filter described
  above to be durable.

## Recommendation
Update the existing 2026-05-04 proposal (or write a follow-up) asking
dev to land both fixes together. Single-handed adoption of (1) without
(2) will leave handler ticks polling the reopen check; single-handed
adoption of (2) without (1) leaves any pre-existing ghost-state
projects in the iteration set until they're individually patched.
