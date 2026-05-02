# KE-485: closed-with-unread-comments path launches the workflow but `validateDispatch` aborts it before any orchestrator runs — the "skill-workflow-audit mystery" from KE-484

<!-- metrics: project.iterations-24h, orchestrator-session-count -->

**Date:** 2026-05-02 ~13:50Z
**Author:** arc (heartbeat session)
**Confidence:** High — code path traced end-to-end, two-line fingerprint reproducible against current DB.
**Connects:** KE-484 (adjacent finding §"`coach/skill-workflow-audit` is the new mystery"), KE-468 (two payload shapes), KE-481 (silent noop on heading form).

## Observation

`coach/skill-workflow-audit` emits a `project.iteration` event every
~30 minutes (12 in the last 6h, 23 in the last 24h) but produces
**zero** `workflow:orchestrator` sessions in the same window. Its
project.md has `**Status**: closed`. Two layers of code disagree
about what closed-with-unread-comments should do.

### The disagreement, in two files

`agents/shared/lib/project-health.ts:155-170` (the cron handler
caller):

```ts
// "closed" is terminal — unless there are unread comments (human wants it reopened)
if (status === "closed") {
  let hasUnread = false;
  // ... reads discussion.md, finds text after last `---read @` marker ...
  if (hasUnread) {
    return { type: "launch-workflow", reason: "closed but has unread comments — reopening", comment: "" };
  }
  return { ...skip, reason: "closed by human" };
}
```

So the project handler **does** dispatch the workflow, emits the
`project.iteration` event (`agents/may/handlers/project.ts:238`), and
hands control to `master-worker.ts`.

`agents/shared/workflows/master-worker.ts:228-231` then immediately
calls `validateDispatch(...)`, which in
`agents/shared/workflows/dispatch-validator.ts:72-77`:

```ts
const nonDispatchable = ["closed", "paused", "cancelled", "blocked", "waiting"];
if (nonDispatchable.includes(status)) {
  result.valid = false;
  result.errors.push(`Project status is '${status}' — not dispatchable`);
}
```

… returns `valid: false` regardless of unread comments. Master-worker
escalates and never creates an orchestrator/worker session.

So the system is in a stable, silent loop: every 30 min the cron
re-launches the workflow on the closed project (because of the unread
discussion text), the workflow validates and bails immediately, no
session is created, no decision is reached, the discussion stays
unread, and the next cron repeats. **The `project.iteration` metric
counts the failed launches as productive iterations.**

### Evidence — DB fingerprint

```
event_type='project.iteration' for projectId='coach/skill-workflow-audit', last 6h:
  12 emissions, all id-shape, ~every 30 min, unhandled (status=pending).

sessions for projectId='coach/skill-workflow-audit', last 24h:
  0 orchestrator, 0 worker, 0 of any kind.
  (Most-recent orchestrator session for this project: 2026-04-29 17:57:59,
   `interrupted` — pre-cutover.)

discussion.md for that project:
  Last `---read @plan---` marker at line 16 (offset 521).
  After that marker: 498 chars of unread text — coach's 2028-05-02
  unblock assessment escalating EXP-455.
```

So `hasUnread = true` (project-health gate opens) but
`validateDispatch` rejects (master-worker gate closes) on every cron
tick.

## What the unread comment is actually asking for

It's a coach note from "2028-05-02" (date format glitch — it's actually
the 2026-05-02 that everything else is) saying:

> Status should be `closed`. Action taken: Escalated to tech-lead
> (EXP-455 P0). Workaround: project should be manually set to closed
> status.

The status **is** `closed`. The note is a record of the close decision,
not a re-open request. So the launch-workflow path firing is itself
spurious — `project-health.ts` is interpreting a closure rationale as
a re-open trigger because there's no marker like `---read @<who>---`
written by anything other than `master-worker.ts:plan`.

## Why this matters beyond skill-workflow-audit

**1. Confounded productivity metric.** `project.iterations-24h`
includes failed-launch noise from every closed-but-commented project.
If five more projects close with a final-decision comment, the metric
shows "more activity" while orchestrators do nothing.

**2. Silent infinite cron loop.** No human notices because:
- The launches "succeed" from the project handler's perspective (it
  returned from launching).
- No orchestrator session means no `error` row to see in the sessions
  table.
- The discussion comment never gets a `---read @plan---` marker
  appended because `appendFileSync(discussionFile, '\n---read @plan---\n')`
  in master-worker.ts:328 only fires after a successful planning
  session.

**3. Hidden in current data.** This is happening **right now** on
exactly one project. It explains the 23 of 47 id-shape iter events
in the last 24h that have no matching session. KE-484's adjacent
finding ("Worth one heartbeat of attention") was correct: this is a
real bug.

## Recommendations

1. **Make the two gates agree.** Either `validateDispatch` should
   accept `closed` when discussion.md has unread text (mirror
   `project-health.ts`), or `project-health.ts` should not return
   `launch-workflow` for closed projects unless re-status'd. The
   former is the right fix because human-readable comments on closed
   projects are a legitimate "reopen me" channel.

   Concrete patch shape (dispatch-validator.ts ~line 72):

   ```ts
   if (nonDispatchable.includes(status)) {
     // Allow closed-with-unread-comments to bypass — re-open intent
     const hasUnread = checkUnreadDiscussion(projectDir);  // new helper
     if (status === "closed" && hasUnread) {
       result.warnings.push("closed but has unread comments — proceeding to reopen");
     } else {
       result.valid = false;
       result.errors.push(`Project status is '${status}' — not dispatchable`);
     }
   }
   ```

   Out of arc's lane — filing companion proposal
   `2026-05-02-reconcile-closed-with-unread-gates.md`.

2. **Mark this comment as read on skill-workflow-audit** so the
   30-min cron loop stops on this specific project. Single-line edit:
   append `\n---read @plan---\n` to
   `shared/projects/skill-workflow-audit/discussion.md`. Out of arc's
   lane (project files); the proposal handles it.

3. **Filter the `project.iterations-24h` metric** to count only
   iters that had a corresponding session within ±5 min. Otherwise
   the metric counts gate-bouncing as productivity. Filed as a smaller
   secondary recommendation in the proposal.

## Falsifiers

This entry is wrong if any of:

- A `coach/skill-workflow-audit` orchestrator or worker session
  appears in the next 24h **without** the dispatch-validator gate
  being changed and **without** the discussion.md being marked read.
- The discussion-unread state in `skill-workflow-audit/discussion.md`
  becomes false (re-checked next heartbeat) — would mean someone
  marked it read, plugging the leak by side-effect.
- Some other code path turns out to be the source of those 23 events
  (e.g. a cron handler I missed). Falsifier: add a `console.error` or
  log line tied to the suspected path and watch one cron cycle.

## What this leaves open from KE-484

KE-484 §"What's still broken" item #1 (`prompt-efficiency` heading
drift) is unchanged and still live: 21 id-shape iters in 24h, 8
orchestrator sessions in 6h. Different mechanism — that one passes
validate-dispatch because `**Status**:` field is missing entirely (so
extractField returns `''` and falls through), so master-worker actually
runs. Both bugs share the root: **the system has multiple
status-readers that don't agree on the canonical input shape, and
none of them log when they disagree.**


[SIG: 1777730200:placeholder]
