# Scout Knowledge Library Process

Status: aligned target; code and live-state cutover pending

This document defines Scout-specific behavior. The generic task/result,
generation, Condition, attempt, and receipt contracts come from May-agent's
[task reconciliation integrity refinement](../../may-agent.app/docs/3-proposals/task-reconciliation-integrity-refinement.md)
and SDK. Scout does not redefine or copy them.

## Plain Model

Scout is the librarian. The Agent App packages Scout with the optional
autonomous runtime that keeps the library moving. Neither the app nor its task
tree is the library itself.

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
appDir:             /app/projects/scout-knowledge-lib.app
projectDir:         /app/projects/scout-knowledge-lib
durable notes:      /app/projects/scout-knowledge-lib/knowledge
durable reports:    /app/projects/scout-knowledge-lib/reports
runtime state:      /app/projects/scout-knowledge-lib.app/.state
```

The layout target is described in
`design/scout-knowledge-library-layout.md`. The short version: durable reusable
knowledge belongs in topic notes, raw observations belong in findings,
maintenance decisions belong in reports, and old provenance belongs in archive.

The app should not let Scout only collect more and more notes. Its main value is
closing the loop: raw findings become trusted knowledge, stale cleanup gets
finished, and humans can quickly understand what the library contains. Scout
must remain directly runnable without this task/event attachment; the app adds
autonomy, durable reconciliation, observation, and recovery.

## Ownership And Workflows

The app has one accountable owner: `scout`.

Reusable research and maintenance processes belong to Scout and live under:

```text
/app/projects/scout-knowledge-lib.app/agents/scout/workflows/
```

The app manifest binds stable tasks to those workflows. It does not contain a
second planner, a workflow registry, or domain strategy in the generic
reconciler. A missing workflow is visible failure followed by the normal Scout
owner fallback; it is never repaired by guessing from task prose.

Every task owner must resolve to a runnable agent. `human` is not a Scout task
owner. Human notification and task accountability are separate concerns.

## Work Areas

Use visible names and paths instead of hidden categories.

Domain work changes reusable knowledge:

- explore arXiv, HN, XHS, and GitHub;
- write source-grounded findings;
- absorb high-value findings into canonical notes;
- split or consolidate oversized notes;
- repair `knowledge/INDEX.md`;
- keep `knowledge/README.md` useful as the human landing page;
- write human-readable reports;
- keep files in the documented library layout so humans can understand what is
  canonical, what is raw evidence, and what is maintenance history.

Ops work keeps the library process healthy:

- detect unsourced backlog growth;
- detect oversized notes and digest logs;
- detect index coverage gaps;
- detect future-dated or time-confused library state;
- detect repeated health signals that are not closing;
- wake Scout when judgment is needed and notify or escalate to a human when an
  external decision or action is required.

The current task tree is small and mostly domain-shaped. That is fine. Add ops
tasks only when a repeated process issue needs durable ownership.

## Task Model

Scout uses only the two shared reconciliation modes:

- `maintain` for a standing desired state that remains after a successful pass;
- `achieve` for a finite outcome that leaves the live graph after absorption
  into a completion receipt.

Standing Scout identities are stable and do not include event IDs or dates:

```text
explore-arxiv                    maintain -> scout-explore
explore-hn                       maintain -> scout-explore
explore-xhs                      maintain -> scout-explore
explore-github                   maintain -> scout-explore
daily-digest                     maintain -> scout-daily-digest
cross-source-synthesis           maintain -> scout-heartbeat, when enabled/woken
runtime/library-health-observer  maintain -> library-health
library-maintenance              maintain -> knowledge-planner
```

The source name is stable workflow input. Event IDs, timestamps, schedule
metadata, health packets, and current observations are trigger/status data and
never task input. Repeated schedule ticks therefore wake the same generation;
they do not create new task identities or false spec changes.

Structural labels such as `project`, `ongoing-research`, and
`library-operations` are groups, not executable backlog. `library-maintenance`
has its own standing outcome and is therefore a real maintain task; it and the
deterministic health observer are siblings under `library-operations`.
Parent progress and branch counts are derived read models, not writable task
status.

Finite cleanup—such as repairing one index batch or absorbing one set of
findings—is an `achieve` task only when it needs durable tracking. Routine
schedule ticks and every individual source observation are not new tasks.

## Event Flow

The app is event-driven:

```text
schedule/action/comment/metric
  -> project event
  -> resolve or wake one stable task identity
  -> generic reconciler invokes Scout's workflow or Scout directly
  -> shared result admission
  -> durable library change, exact wait, task action, or convergence
```

The main routes are:

- `scout.explore` -> source discovery workflow;
- `scout.digest` -> daily digest workflow;
- `project.library_health.tick` -> deterministic health observer;
- `project.owner.requested` -> Scout owner/planner review;

Targeted task wakes and Condition observations enter the generic controller
directly. Scout does not declare duplicate app-specific routes for them.

## Result And Acceptance Boundary

Scout workflows use the shared SDK handler-result schema and admission
function. They must not maintain a copied JSON schema that can drift from the
runtime contract.

Public workflow decisions are:

- `converged` — the current bounded reconciliation is satisfied;
- `waiting` — an exact Condition identifies the external fact that can change
  the answer; or
- `needs-owner` — the workflow explicitly hands novel judgment to Scout.

`failed` is an attempt/runtime outcome, not a public workflow decision. Common
finite task-action fields use May conventions: root parent, `achieve`, `P2`,
and empty outputs. Standing work must explicitly use `maintain`.

Convergence records how acceptance was established:

- deterministic verifier evidence when the workflow provides a verifier;
- the admitted workflow contract for normal reusable Scout workflows; or
- Scout owner judgment after direct handling or `needs-owner`.

The runtime validates mechanics. Scout owns semantic knowledge decisions. A
generic reconciler never decides whether a research claim is good.

## External Waits

External facts are Conditions, not blocked holder tasks and not fake agents.
The XHS credential flow is the reference case:

```text
explore-xhs finds credentials unavailable
  -> return waiting
  -> Condition: credential.ready / credential:xhs / state=ready
  -> infrastructure notifies the human outside task execution
  -> credential watcher or human action emits the semantic observation
  -> the Condition becomes true
  -> explore-xhs wakes and reconciles again
```

Scout remains the owner throughout. The design must not create or repeatedly
run a child task owned by `human`.

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

A recurring responsibility is a stable `maintain` resource, not a permanent
worker attempt and not a special `standing_task` kind. It is `running` only
while one bounded attempt owns its current generation. After a successful pass
it is `converged` and remains available for the next event.

Finishable tasks are different. A task such as sourcing unsourced findings,
repairing future dates, or merging a shared-knowledge batch should not remain
`running` or `attention` with only a projected `next_action`. It must show one
of these:

- a small completed library change;
- evidence or a report path;
- a current progress note;
- a result that closes the task;
- or a concrete blocker that needs a human.

If library health sees that a current signal is represented by a nonterminal
task but that task has no progress evidence, it emits the current transitional
`active-task-not-moving` signal. The planner must then do one small real step,
close the task, or escalate with the exact reason. `active` and `assigned` are
read-model language, not additional canonical task phases.

## Date Trust

This project is a research library. Dates are part of the product.

Future dates can be valid when they describe predictions or planned windows,
but future-dated `last_updated`, task completion text, report names, or
finding dates can make the library look like it came from the future. Health
checks should flag future-dated project/library content for Scout review.

Scout should either correct the date or record why it is intentionally future
dated.

## Path And Output Boundary

The host resolves `appDir` and `projectDir` once. Workflow prompts use the
absolute paths shown in the Plain Model and do not derive paths from the
process working directory.

Allowed Scout writes are intentionally small:

- durable knowledge under `/app/projects/scout-knowledge-lib/knowledge/`;
- durable maintenance reports under
  `/app/projects/scout-knowledge-lib/reports/`; and
- working digest/findings under
  `/app/projects/scout-knowledge-lib.app/agents/scout/workspace/`.

`/app/shared/knowledge` is external source material for these workflows unless
an explicit capability grants a particular write. A path such as
`projects/scout-knowledge-lib/...` is not an acceptable output instruction
because it changes meaning with the current working directory. Output
admission must reject a resolved path outside the allowed roots.

The existing nested
`/app/projects/scout-knowledge-lib/projects/scout-knowledge-lib/` tree is
migration evidence, not a second workspace. Its files require human-reviewed
comparison and preservation before verified duplicates are removed.

## Runtime State And Authority

Git tracks source:

- `app.ts`;
- `project.json`;
- `tasks/seed.json`;
- `tasks/README.md`;
- `agents/scout/workflows/*.ts`;
- `design/*.md`.

`.state/` tracks runtime:

- canonical task resources, Conditions, attempts, triggers, and receipts in
  `.state/tasks/state.json`;
- the generated human/agent projection in `.state/tasks/tree.json`;
- library health packets;
- project readout;
- generated runtime journals.

`state.json` is the sole mutable task authority. `tree.json` is disposable and
must never be read back as mutation or bootstrap input after cutover.
`tasks/seed.json` initializes a new app once and contains only standing desired
state. It does not preserve completed migration work, incidents, attempts, or
current observations.

Do not commit runtime packets or current task snapshots as source truth.

## Cutover And Existing State

Alignment requires one reviewed migration; it is not an automatic reconciler
policy:

1. replace Scout's copied planner schema with the shared SDK contract and run
   its output through production admission in tests;
2. replace the human-owned XHS holder with the credential Condition;
3. use absolute resolved paths and add an output-boundary assertion;
4. review live `attention` tasks, remove obsolete workflow bindings, close only
   absorbed work, and preserve real unfinished work;
5. compare nested project artifacts with canonical knowledge before removing
   verified duplicates;
6. reduce the seed to standing responsibilities; and
7. deploy, wake each maintain task once, and verify stable generations,
   Conditions, receipts, and output paths before normal schedules resume.

The generic reconciler must not auto-close unfamiliar tasks or delete misplaced
files. Those are Scout migration decisions.

## What To Improve First

Keep the next steps small:

1. Complete the reviewed task/runtime cutover above.
2. Keep `knowledge/README.md` useful as the human landing page.
3. Move reports into `reports/health`, `reports/merge`, `reports/triage`,
   `reports/migration`, or `reports/operations` in small batches.
4. Make `library-health` detect repeated unresolved signals.
5. Make `library-health` detect future-dated project/library content.
6. Let Scout use those signals to update notes, reports, or tasks.
7. Only add more workflows after the same manual process repeats.
