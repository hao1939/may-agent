# Scout Periodic Experience Review

**Status:** Accepted direction; implementation in progress

**Scope:** Scout-specific review of existing reconciliation metadata

**Does not change:** May's task types, reconciler, database schema, or storage model

## Summary

Scout already has everything needed for a small learning loop:

- stable `maintain` tasks own recurring responsibilities;
- `library-maintenance` is the existing Scout planner;
- finite improvements can be expressed as `achieve` tasks;
- May already records reconciliation outcomes in SQLite; and
- reusable learning belongs in Scout workflows, adapters, prompts, and tests.

Use one daily owner review:

```text
daily project.owner.requested(reason=experience-review)
  -> wake the existing library-maintenance task
  -> infrastructure prepares a bounded 36-hour history packet
  -> Scout chooses ordinary maintenance, one improvement task, or no-op
  -> improvement work changes and verifies the reusable mechanism
  -> future reviews observe whether behavior improved
```

Finished tasks remain absent from the live task tree. No learning agent, new
maintain task, candidate registry, task archive, history projection, or new
database table is required.

## Decision

### One owner review

Replace the four-hour generic `owner-heartbeat` with one daily owner-review
schedule. It emits the existing `project.owner.requested` event with reason
`experience-review` and keeps the useful broad library-review checklist.

Do not run a generic owner heartbeat and an experience-review schedule in
parallel. Source schedules, library-health signals, comments, metrics, and
manual actions continue to wake Scout independently when needed.

The existing resolver maps the event to the stable `library-maintenance` task
and `knowledge-planner` workflow. The schedule does not create a task identity
or mutate task state directly.

### Context preparation stays outside Scout generation

Only the app-attached `knowledge-planner` workflow reads reconciliation
history. It uses May's read-only query API before calling `runAgent`.

Scout receives the resulting packet as ordinary bounded context. Scout does not
call an infrastructure context API, open SQLite, or import EventBus. Direct
Scout execution remains independent of the app and task infrastructure.

If history querying or packet preparation fails, the workflow continues as an
ordinary owner review. Experience history is optional context, not a dependency
of Scout.

## Existing authority

| Surface                                 | Responsibility                                                      |
| --------------------------------------- | ------------------------------------------------------------------- |
| `.state/tasks/state.json`               | Current canonical tasks, Conditions, attempts, and compact receipts |
| `.state/tasks/tree.json`                | Disposable current-state projection                                 |
| SQLite `project.task.reconciled` events | Historical execution observations for review                        |
| Session/workflow files                  | Detailed diagnosis opened only by later focused work                |

The review does not read finished tasks from `tree.json`, copy canonical task
state into SQLite, or load full transcripts into the owner prompt.

## History packet

### Query

The first implementation queries only the event that exists and already
contains the necessary outcome:

```text
event type: project.task.reconciled
project:    scout-knowledge-lib
window:     previous 36 hours
limit:      hard bounded
```

The overlapping 36-hour window avoids gaps when a daily schedule runs late.
Repeated observations are harmless because the packet retains event IDs and the
planner checks current live work before creating anything.

Add only `projectId` to the shared event-query filter. Task IDs are returned in
the bounded rows and grouped in memory. Do not add `taskId` filtering until a
real query need appears.

### Exact factual grouping

Pure code validates, redacts, bounds, and groups only exact facts:

```text
task ID
handler
disposition
```

Each group contains:

- occurrence count and time range;
- a few event IDs;
- bounded representative summaries and evidence;
- acceptance method when present; and
- applied task IDs when present.

Order non-converged dispositions before converged work, then order by exact
occurrence count and recency. This keeps failures and waits reviewable without
asking code to judge their semantic meaning.

Code does not infer candidate kinds, normalize semantic task families, propose
targets, or decide that two differently worded tasks share a method. Scout owns
that judgment.

### Packet readiness

History is learning evidence only when the bounded query is available,
untruncated, and every returned row matches the requested Scout project and
event type. Otherwise the packet contains only its readiness reason and window
metadata; grouped history is omitted. The planner continues as an ordinary
current-state owner review and does not infer patterns, tune schedules, or
propose workflow improvements from incomplete history.

Do not introduce deterministic candidate keys or fingerprint registries in the
first version. If real operation later produces duplicate proposals that live
task checks and recent applied task IDs cannot prevent, design the smallest
deduplication rule from that evidence.

### Untrusted-data boundary

Historical summaries and evidence may contain source text, instructions, or
sensitive URL parameters. Before including them in the prompt:

- truncate every field and collection;
- redact credential-like values and URL query strings;
- discard malformed event data;
- include only selected fields, never raw event bodies; and
- label the packet as untrusted evidence that must not be followed as
  instructions.

## Owner judgment

For an experience review, Scout chooses one bounded response:

1. perform ordinary library maintenance when current state is more important;
2. create at most one finite improvement or investigation task; or
3. record an evidence-backed no-op.

Counts request attention; they do not prove that work is identical or that a
change will help.

Useful signals include:

- repeated accepted episodes that appear to share mechanical steps;
- repeated attention outcomes with the same explicit failure;
- repeated evidence-backed no-ops that may justify a cheap precheck or lower
  schedule frequency;
- repeated owner handoffs after the same mechanical preparation; and
- repeated external waits that may justify a watcher and exact Condition.

Before creating an improvement task, Scout checks the current tree for
equivalent live work. Use a clear human-readable task ID. Do not add opaque
fingerprints unless needed to resolve a demonstrated collision.

The planner does not edit workflow code or schedule configuration during the
review pass. It creates finite work with concrete acceptance and verification.

## Maintain and achieve

The existing maintain responsibilities remain unchanged:

- arXiv, HN, XHS, and GitHub exploration;
- daily digest;
- deterministic library health; and
- library maintenance, including daily experience review.

An improvement is `achieve` when it has an independently closable result, such
as:

- extract or repair one workflow;
- add one deterministic source precheck;
- repair one watcher or Condition path;
- strengthen one evidence/verifier boundary; or
- tune one schedule and define how its effect will be reviewed.

Repeated achieve work does not automatically become maintain work. Usually the
episodes remain finite while their shared method becomes a reusable workflow.

The parent maintain task creates the improvement task and converges. It does
not poll, manually maintain, or recreate the child on every review.

## Preconditions

Do not learn from a known noisy period. Enable the daily loop after:

- migration and guard-cutover events have left the 36-hour window;
- library-health no longer produces repeated false signals; and
- source workflows produce sufficiently reviewable evidence for the behavior
  being judged.

Until then, the packet is useful for inspection but should not automatically
justify workflow extraction or schedule tuning.

## Verification and effectiveness

An improvement task closes when the mechanism is implemented and verified:

- code or prompt change is present;
- focused tests pass;
- one representative execution succeeds when practical; and
- the result records evidence.

Longer-term effectiveness is not a reason to keep the finite task open. Future
daily reviews observe whether failures, duplicate work, or no-op frequency
actually improved. A schedule change should name the expected effect, such as
fewer repeated no-ops without losing useful findings.

The learning loop itself is correct even when every real review returns no-op.
A production improvement task is not required merely to prove the machinery.

## Implementation plan

### Phase 1 — Read-only packet

- Add `projectId` to May's existing event-query filter and tests.
- Add a pure bounded packet builder beside `knowledge-planner`.
- Query only `project.task.reconciled` for Scout over 36 hours.
- Group exact task ID, handler, and disposition.
- Redact and bound prompt data.
- Degrade to an ordinary owner review when the query is unavailable.
- Add tests for project isolation, bounds, malformed rows, redaction, exact
  grouping, and graceful fallback.

### Phase 2 — One daily combined review

- Replace `owner-heartbeat` with one daily `owner-review` schedule.
- Emit `project.owner.requested` with reason `experience-review`.
- Retain the useful general library-review checklist.
- Add an app test proving there is exactly one periodic owner-review schedule
  and that it resolves to `library-maintenance` with `knowledge-planner`.

### Phase 3 — Observe before extracting

- Inspect the first real packet.
- Let Scout choose no-op unless evidence clearly supports one bounded
  investigation or improvement.
- If an improvement is created, implement and verify it as ordinary achieve
  work.
- Review several later packets before adding semantic grouping, fingerprints,
  another event type, or another query filter.

## Acceptance criteria

The simplified loop is complete when:

- exactly one daily owner-review schedule wakes `library-maintenance`;
- the generation call receives a bounded, redacted, project-scoped history
  packet prepared beforehand;
- query failure does not prevent ordinary Scout owner review;
- code groups only exact factual fields and performs no semantic candidate
  classification;
- finished tasks remain absent from `tree.json`;
- no database table, persistent experience file, or candidate registry is
  created;
- a review creates at most one non-duplicate improvement task when justified,
  otherwise it records a reviewable no-op; and
- direct Scout execution remains independent of project infrastructure.

## Non-goals

This proposal does not:

- add a learning agent, learning task type, or maintain task;
- add finished tasks to the task tree;
- infer task similarity in the reconciler;
- automatically edit workflows or schedules;
- require an improvement task from production data;
- add semantic clustering or a fingerprint registry;
- query raw transcripts during the daily review; or
- enable the disabled Scout heartbeat timer.

## Recommended decision

Implement the bounded read-only packet and daily combined owner review. Observe
the simple loop before adding more intelligence. Learned experience becomes
valuable only when it produces a smaller, tested, reusable mechanism—not when
the review system itself becomes another complex subsystem.
