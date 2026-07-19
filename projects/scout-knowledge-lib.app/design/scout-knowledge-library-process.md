# Scout Knowledge Library Process

Status: initial operating model

## Plain Model

`scout-knowledge-lib.app` is the librarian. It is not the library.

The real library lives in `/app/projects/scout-knowledge-lib`. The app keeps
that library useful.

```text
sources find raw material
Scout writes findings
useful findings become durable notes
health checks find mess or stuck work
the task tree keeps unfinished cleanup visible
the planner pushes one small useful step at a time
```

The app is not the knowledge library. The app keeps the process moving. The
domain workspace holds the knowledge:

```text
app/control plane: /app/projects/scout-knowledge-lib.app
domain library:    /app/projects/scout-knowledge-lib
durable notes:     /app/projects/scout-knowledge-lib/knowledge
runtime state:     /app/projects/scout-knowledge-lib.app/.state
```

The layout target is described in
`design/scout-knowledge-library-layout.md`. The short version: durable reusable
knowledge belongs in topic notes, raw observations belong in findings,
maintenance decisions belong in reports, and old provenance belongs in archive.

The app should not let Scout only collect more and more notes. Its main value is
closing the loop: raw findings become trusted knowledge, stale cleanup gets
finished, and humans can quickly understand what the library contains.

## Work Areas

Use visible names and paths instead of hidden categories.

Domain work changes reusable knowledge:

- explore arXiv, HN, XHS, and GitHub;
- write source-grounded findings;
- absorb high-value findings into canonical notes;
- split or consolidate oversized notes;
- repair `knowledge/INDEX.md`;
- keep `knowledge/README.md` useful as the human landing page;
- write human-readable reports.
- keep files in the documented library layout so humans can understand what is
  canonical, what is raw evidence, and what is maintenance history.

Ops work keeps the library process healthy:

- detect unsourced backlog growth;
- detect oversized notes and digest logs;
- detect index coverage gaps;
- detect future-dated or time-confused library state;
- detect repeated health signals that are not closing;
- wake Scout or a human when normal maintenance is not enough.

The current task tree is small and mostly domain-shaped. That is fine. Add ops
tasks only when a repeated process issue needs durable ownership.

## Event Flow

The app is event-driven:

```text
schedule/action/comment/metric
  -> project event
  -> workflow route
  -> workflow result
  -> durable library change, task-tree update, exact no-op, or owner wake
```

The main routes are:

- `scout.explore` -> source discovery workflow;
- `scout.digest` -> daily digest workflow;
- `project.library_health.tick` -> deterministic health observer;
- `project.owner.requested` -> Scout owner/planner review;

Observation is not completion. A health packet closes only when the signal is
resolved, accepted with a durable reason, or represented by clear follow-up
work that shows progress. A bare active task with only a next action is not
enough; it must either do a small library step, record evidence, or explain why
it cannot move yet.

## Library Health

`agents/scout/workflows/library-health.ts` is code-only observation. It should collect facts
and emit signals. It should not decide content quality by itself.

Good signals name raw facts:

- whether the human landing page exists;
- which notes are oversized;
- how many index entries are still `Not yet sourced`;
- which files are missing index coverage;
- which reports are still in the root `reports/` folder instead of
  `reports/health`, `reports/merge`, `reports/triage`, `reports/migration`, or
  `reports/operations`;
- whether the digest log needs reset;
- whether future dates appear in project truth;
- whether the same signal has repeated across health packets without closing.

Scout decides what to do with those facts. The useful outcomes are:

- update an existing note;
- create or update `knowledge/README.md`;
- split a note into canonical plus companion notes;
- source a small high-value batch;
- update `INDEX.md`;
- write a compact report;
- move a small report batch into the right report folder;
- update the task tree;
- record an exact no-op reason.

## Closure Rule

Every repeated abnormal signal needs a visible ending:

```text
resolved
accepted with reason
tracked by a durable task with progress evidence
or escalated to human
```

If a signal repeats for several health packets and there is no clear task,
report, or no-op reason, the app should treat that as a process concern. This
does not mean the observer should fix the content. It means the observer should
wake Scout with enough raw facts to decide.

## Recurring Responsibilities

Recurring responsibility is durable structure, not a permanent worker
attempt. Container nodes such as `project`, `ongoing-research`, and
`library-maintenance` may remain open while bounded child work comes and goes.
Leaves with `kind: work` or `kind: standing_task` remain visible but are not
dispatched as ordinary worker backlog. Schedules and events start bounded
explore/digest workflows; an executable leaf is `active` only while a concrete
attempt is actually running.

Finishable tasks are different. A task such as sourcing unsourced findings,
repairing future dates, or merging a shared-knowledge batch should not sit in
`active` with only a `next_action`. It must show one of these:

- a small completed library change;
- evidence or a report path;
- a current progress note;
- a result that closes the task;
- or a concrete blocker that needs a human.

If library health sees that a current signal is represented by an active task
but that task has no progress evidence, it emits `active-task-not-moving`. The
planner must then do one small real step, close the task, or escalate with the
exact reason. This keeps "assigned" from becoming a dead end.

## Date Trust

This project is a research library. Dates are part of the product.

Future dates can be valid when they describe predictions or planned windows,
but future-dated `last_updated`, task completion text, report names, or
finding dates can make the library look like it came from the future. Health
checks should flag future-dated project/library content for Scout review.

Scout should either correct the date or record why it is intentionally future
dated.

## Runtime State

Git tracks source:

- `app.ts`;
- `project.json`;
- `tasks/seed.json`;
- `tasks/README.md`;
- `agents/scout/workflows/*.ts`;
- `design/*.md`.

`.state/` tracks runtime:

- live task tree;
- library health packets;
- project readout;
- generated runtime journals.

Do not commit runtime packets or current task snapshots as source truth.

## What To Improve First

Keep the next steps small:

1. Keep this design doc current.
2. Keep `knowledge/README.md` useful as the human landing page.
3. Move reports into `reports/health`, `reports/merge`, `reports/triage`,
   `reports/migration`, or `reports/operations` in small batches.
4. Make `library-health` detect repeated unresolved signals.
5. Make `library-health` detect future-dated project/library content.
6. Let Scout use those signals to update notes, reports, or tasks.
7. Only add more workflows after the same manual process repeats.
