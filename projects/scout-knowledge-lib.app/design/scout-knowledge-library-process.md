# Scout Knowledge Library Process

Design status: accepted

Source status: implemented and tested

This document defines Scout-specific behavior. The generic contracts come from
May-agent's current [Agent App](../../may-agent.app/docs/2a-design/agent-app.md),
[Task Resource Engine](../../may-agent.app/docs/2a-design/task-resource-engine.md),
[workflow](../../may-agent.app/docs/2a-design/workflows.md), and SDK designs.
Scout does not redefine or copy them.

## Plain Model

Scout is the librarian. The Agent App packages Scout with the optional
autonomous runtime that keeps the library moving. Neither the app nor its task
tree is the library itself.

The real library lives in `/app/projects/scout-knowledge-lib`. The app keeps
that library useful.

```text
source workflows record what was checked
Scout writes source-grounded findings when useful
useful findings become durable notes
health checks report unusual library facts
the planner chooses one small useful step or a reviewable no-op
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

The current layout is described in `design/scout-knowledge-library-layout.md`.
The short version: durable reusable knowledge stays in readable top-level topic
notes, raw observations use flat dated files under `findings/`, and maintenance
decisions belong in categorized reports.

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
reconciler. A missing named workflow remains visible in `attention` until the
binding is repaired. The runtime does not guess from task prose or silently
substitute the owner.

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
schedule/action/comment
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
- an allowlisted `project.owner.requested` reason -> Scout owner/planner review.

The allowlist is `experience-review`, `library-health-signal`,
`project-comment`, `manual-library-review`, and `repair-index`. Human entry
points translate to a named reason. Infrastructure recovery events such as
`workflow-blocked` remain on their source task and do not become library work.

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

### Source results

Every source lane returns the same bounded result: a summary, current source
observation, and absolute output paths. The observation names the source,
query or feed, check time, optional fingerprint, and bounded item IDs or URLs.
Credential-bearing query strings are removed before it becomes task evidence.

XHS acquisition is currently workflow-observed. The other source lanes return
structured agent-reported observations until a small deterministic acquisition
is justified for that source; task evidence labels that provenance explicitly.
A session ID alone never satisfies source acceptance.

A changed result must name files that exist and whose resolved real paths stay
inside the allowed Scout roots. A no-op has zero outputs and explains why the
current source evidence did not justify a useful change.

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

## Library Health

`agents/scout/workflows/library-health.ts` is code-only observation. It
collects bounded domain facts and emits signals. It does not decide content
quality or task progress.

Good signals name raw facts:

- whether the human landing page exists;
- which notes are oversized;
- how many index entries are still `Not yet sourced`;
- which files are missing index coverage;
- which reports are still in the root `reports/` folder instead of
  `reports/health`, `reports/merge`, `reports/triage`, `reports/migration`, or
  `reports/operations`;
- whether the digest log needs reset;
- whether explicit truth fields or canonical filenames are future-dated.

The observer does not inspect task progress, task summaries, or the task tree.
It does not map facts to finite task IDs and does not store owner decisions.
Each fact has a stable `kind + subject` key and a fingerprint of its bounded
canonical value.

The existing bounded packet history controls wakes. Scout is woken only for a
new fact, a deterministically worse value, or a fact still present when its
review interval expires. An unchanged fact remains visible without paging the
owner every six hours. A fact disappears when current domain truth no longer
produces it.

Scout decides what to do with those facts. The useful outcomes are:

- update an existing note;
- create or update `knowledge/README.md`;
- split a note into canonical plus companion notes;
- source a small high-value batch;
- update `INDEX.md`;
- write a compact report;
- move a small report batch into the right report folder;
- propose a typed task action for the generic reconciler;
- record an exact no-op reason.

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

## Date Trust

This project is a research library. Dates are part of the product.

Future dates can be valid when they describe predictions or planned windows.
The observer therefore checks canonical knowledge/report filenames and explicit
truth fields such as `date`, `last_updated`, and `generated_at`. It does not
scan free-form task history or treat quoted forecasts as domain truth.

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
because it changes meaning with the current working directory. Source-output
admission requires an absolute existing file and rejects a real path outside
the allowed roots, including a symlink that escapes them.

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

## Metrics And Experience Review

Scout metrics are advisory infrastructure observations, never task acceptance
or content-edit instructions. Deployment-practice loading is runtime health.
Preamble coverage watches only canonical Scout knowledge. Accepted source
outputs count admitted `output:` evidence from converged source
reconciliations; evidence-backed no-ops are not failures. Textual downstream
reference counting is retired. The app does not subscribe directly to Scout
metric breaches during the observation window.

One daily owner review may receive a bounded, redacted 36-hour reconciliation
packet prepared before `runAgent`. Only complete, correctly scoped history is
learning evidence. Unavailable, truncated, or scope-mismatched history is
withheld and the planner continues as an ordinary current-state owner review.
An experience review may create at most one finite `achieve` task; omitted mode
uses May's normal `achieve` default. It cannot create standing maintain work.
The optional synthesis checklist helps Scout connect recent findings when that
is useful; it does not require a synthesis on every review. No task archive,
learning agent, or experience database is needed.

## Current Observation Priorities

Keep the next steps empirical and small:

1. observe source results, no-ops, failures, health facts, owner wakes, and
   session use;
2. add deterministic source acquisition only where a source exposes a small,
   reliable interface and the stronger provenance is useful;
3. tune one source schedule only when accepted results and no-op cost justify
   it; and
4. add another workflow only after the same useful manual process repeats.
