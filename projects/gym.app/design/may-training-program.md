# Autonomous Agent Improvement

**Status:** Accepted design (2026-08-04)

This records the earlier implementation. The September 18
[report-driven improvement proposal](report-driven-improvement.md) identifies
what to retain and replace for the current Task contract. It does not activate
the old schedules or authorize production promotion.

## Goal

Gym App keeps May on the best behavior supported by approved evidence. It
collects useful evidence, evaluates May, tries isolated changes, verifies them,
and brings Hao one exact proposal when a better artifact is ready.

Benchmarks, candidates, metrics, and reviews support that goal. They are not
separate job systems.

## Mental model

```text
timer or domain event
  -> wake the affected task
  -> read its desired state, status, and evidence
  -> take the next bounded action
  -> save proof
  -> converge, wait on an exact condition, or emit another wake
```

Each task is a durable resource:

- its specification says what outcome must remain true;
- its status says what is currently known;
- events and timers wake it when relevant facts change;
- its owner chooses what the new evidence means;
- its workflow applies reusable operational experience; and
- the Host persists the result and reconciles again when needed.

Task resources hold the desired and observed state. Their generated tree shows
scope, ownership, and decomposition; it does not schedule work. There is no
central Gym pipeline or scheduler task.

## Responsibilities

| Part                                     | Responsibility                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Gym runner (`projects/gym`)              | Benchmark definitions, execution, comparisons, and immutable run evidence                                        |
| Gym App (`projects/gym.app`)             | Resources, event routing, workflows, checkpoints, and autonomous progress                                        |
| Gym owner agent (`gym`)                  | Goal and priority judgment, classification, evidence review, and authority boundaries                            |
| Implementation agent (`gym-implementer`) | One isolated candidate artifact within the writable scope it receives                                            |
| May-agent Host                           | Event delivery, timers, task persistence, Conditions, attempt fencing, recovery, metrics, and delivery mechanics |

The Gym owner is read-only. It judges evidence but does not edit the artifact it
judges. The implementation agent may edit only the isolated candidate or
benchmark snapshot supplied by the workflow. May never builds or approves its
own candidate.

## Resource organization

Gym uses two kinds of resources.

### Standing resources

Standing resources keep an ongoing condition true. Repeated wakes resolve to
the same task identity.

| Resource                          | Typical wake                                                    | Desired outcome                                                          |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `improve/may`                     | daily refill, human request, May metric, approval, May revision | May remains on the best approved behavior                                |
| `runtime/evaluation-intake`       | `evaluation.recorded`                                           | Durable May evaluations are classified and filed                         |
| `learning/codex-sessions`         | hourly timer                                                    | Strong reusable Hao intent is collected as candidate learning evidence   |
| `learning/telegram-field-review`  | daily timer                                                     | Real deputy conversations produce only strong reusable learning signals  |
| `runtime/design-alignment-review` | daily timer or explicit request                                 | Accepted Gym and May promises remain aligned with code and live evidence |
| `runtime/owner-review`            | free-form project intent                                        | The accountable owner answers or organizes the smallest useful next step |

### Bounded resources

An incident, regression request, or review proposal represents one concrete
piece of work. Its stable identity comes from the underlying evidence or durable
event. It converges independently and does not become a phase of a master task.

Routine facts are not tasks. The evaluation intake frontier processes the
oldest unprocessed evaluation, files deterministic evidence directly, and wakes
itself while more remain. It creates bounded work only when independent agent
judgment, human review, or a durable external dependency is required.

## Reconciliation contract

Every Gym workflow follows the same rules:

1. Read the task specification, current status, trigger evidence, and durable
   checkpoints.
2. Reuse already completed work when its fingerprints still match.
3. Advance one bounded, idempotent stage.
4. Save evidence before starting the next expensive or irreversible stage.
5. Return a result consistent with the latest checkpoint.
6. Converge, wait on an exact Condition, ask the owner for judgment, or emit a
   continuation wake.

App task-owner prompts have a strict finalization contract. Once the
current evidence supports `converged` or `waiting`, the owner must call
`finish()` exactly once as the final action. It must not end with prose, empty
text, or any non-tool final answer. The `finish()` payload includes
`result.state` exactly as `converged` or `waiting`, cites evidence, and includes
`actions: []` when no task-resource change is needed. It includes `conditions`
only for exact observable waits. When the Reconciliation Task payload embeds
live direct children, the owner cites that embedded child state instead of
probing or guessing task-resource storage paths.

Events contribute facts; they do not replace the task specification or
interrupt an active attempt. A wake received during execution is queued for the
next reconcile. Duplicate wakes, daemon restart, and a lost session recover by
reading the same task and checkpoints again.

A benchmark process may finish after its parent workflow times out. On the next
reconcile, Gym reuses that run only when it is complete and its baseline id,
benchmark, agent, candidate id and fingerprint, scenario set, trial set, and
comparison all match the pending stage exactly. Otherwise Gym starts a new run.

Each attempt is fenced by task generation and attempt identity. After an
expensive call and before shared writes or continuation events, the workflow
must confirm that it still owns the attempt. A superseded call may finish, but
it cannot change current state or start more work.

## The `improve/may` resource

```text
id: improve/may
mode: maintain
owner: gym
workflow: improve-agent
outcome:
  Keep May on the best behavior supported by approved Gym evidence and bring
  Hao one verified improvement proposal when a better candidate is ready.
```

`improve/may` has one lifecycle: the task lifecycle. Campaign files preserve
assessments, candidates, decisions, and the next resumable stage. They do not
own another waiting, attention, or convergence lifecycle. Before a workflow
returns, its checkpoint and task result must describe the same disposition.

Every workflow exit first writes the current campaign checkpoint. `done` is
valid only with a named terminal disposition and positive evidence. A missing or
unknown checkpoint, an unapplied artifact, a safety limit, or exhausted safe
revision choices requires attention. The verifier rejects these states instead
of inferring completion from the absence of a known wait.

Verification reads the checkpoints cited by the current result. During a
curriculum drain, it may also read tracks carrying the current curriculum and
agent fingerprint. Older campaign directories remain evidence, but cannot block
or prove the current campaign.

The task is reconciled for current evidence when one of these is true:

- May has no actionable failure;
- a verified proposal is waiting for Hao's exact decision;
- a benchmark, scorer, runtime, or noise finding has a truthful disposition;
- a required external fact is represented by an exact Condition; or
- progress reached a genuine owner or authority boundary.

A later timer, request, metric, approval, benchmark change, or May revision
wakes the same resource. It does not create another campaign task.

### Improvement cycle

One bounded cycle:

1. Load the approved autonomous-training tracks.
2. Run or reuse development assessment evidence.
3. Retry invalid evaluation once without erasing valid failures.
4. Classify every non-pass as May, benchmark truth, scorer, runtime, or noise.
5. Select at most one integration path.
6. Run guided practice when the learning unit defines it.
7. Build one isolated candidate with `gym-implementer`.
8. Verify the candidate against its frozen development baseline.
9. Review a failed candidate before revising the responsible mechanism.
10. Run the withheld release comparison only after development improves.
11. Request approval for one exact fingerprinted artifact, or expose a truthful
    safety or authority boundary as attention.
12. Emit a continuation wake when approved material remains.

Candidate revisions for one hypothesis are sequential and cumulative. Each
revision starts from the exact previous candidate, preserves unrelated earlier
changes, and changes only the mechanism named by the failed review. It never
rebuilds from production May. A repeated artifact or the bounded iteration
limit ends the burst as visible attention instead of spinning or claiming
convergence. A durable continuation keeps the task pending; it is never
surfaced as convergence.

### Bounded work

One reconcile advances one learning track. When approved material remains, Gym
saves the current checkpoint and emits one continuation event for the next
track. This keeps peak work small and prevents one failed assessment from
leaving an unowned sibling run behind.

Fresh assessment and candidate integration are separate reconciliation stages.
After an expensive assessment produces an actionable finding, Gym saves the
assessment, emits one continuation wake, and returns. The next reconcile reuses
that evidence before selecting and integrating a candidate. This keeps a slow
assessment from consuming the time needed for verification and review, while a
restart or timeout resumes from the same files instead of repeating model work.

Candidate creation, revision, release verification, approval, application, and
confirmation remain ordered. Gym never parallelizes two revisions of the same
hypothesis and never sends more than one integrated candidate for approval.

An evaluator or runtime issue in one track does not prevent a later wake from
assessing the next track. It does prevent that track from authorizing an agent
change.

## Evidence and workspace

The Gym runner owns immutable benchmark evidence:

```text
projects/gym/.state/benchmarks/<run-id>/
```

Gym App owns generated assessments, candidates, learning checkpoints, reviews,
and metrics:

```text
projects/gym.app/.state/
├── assessments/
├── candidates/
├── incidents/
├── learning/
├── metrics/
├── reviews/
└── scratch/
```

Scratch space is disposable. A candidate that matters is copied into a durable,
fingerprinted artifact before scratch is removed. Git worktrees are reserved
for changes intended to become branches; experimental candidates are artifacts,
not branches.

Historical runs and decisions are append-only. A benchmark, label, scorer, or
evaluator change requires a fresh baseline. Evidence produced by a different
framework revision or artifact fingerprint may aid diagnosis but cannot
authorize promotion. When an otherwise valid comparison differs only by
framework revision, Gym keeps the candidate frozen and performs one fresh
same-revision baseline-and-candidate retry before classifying another failure;
it does not revise May or ask Hao for this recoverable runtime mismatch. When
every candidate trial passes but a transient invalid baseline trial alone
blocks that same-revision comparison, Gym performs one additional clean-baseline
retry. If a held-back candidate has no deterministic failure and only transient
invalid trials against a valid frozen baseline, Gym reruns that candidate once
against the same baseline. A second invalid comparison stops for runtime review
instead of looping.

Metrics measure operation—valid-run rate, model/runtime cost proxies,
classification time, accepted proposals, and prevented regressions. They wake
the accountable resource as evidence; they never choose a repair.

## Human decisions

Gym proceeds autonomously through collection, evaluation, classification,
isolated construction, revision, and verification. It asks Hao only when:

- an exact agent candidate is ready for production promotion;
- an exact benchmark or scorer artifact is ready to apply; or
- progress requires authority or information Gym does not own.

```text
verified artifact
  -> project.approval.requested
  -> human notification carrying the exact approval identity
  -> Hao replies
  -> project.approval.submitted
  -> the exact Condition wakes improve/may
```

The wait matches the approval id, task generation, and artifact fingerprint. An
old reply cannot approve a newer artifact. Approval applies only the named
artifact. Adjustment or rejection closes that proposal and becomes new evidence
for the same task. The workflow continues from that evidence when it can do so
safely; it asks the owner only when reusable process cannot determine the next
bounded move.

An adjustment can change the artifact or change only how Gym verifies it. Gym
edits a candidate, benchmark, or scorer only when the requested artifact
changes. A verification-only adjustment names the exact candidate fingerprint
and benchmark and selects the benchmark's full active suite. Gym then checks
that every selected label is approved, runs a fresh baseline and candidate
comparison with the same framework, and requires every candidate trial to pass
with no invalid runs or regressions. It keeps the rejected benchmark proposal
and its target unchanged. A passing comparison produces the normal exact
candidate promotion request; a mismatch or failed gate stops with its evidence.
That failed candidate is a completed track issue, not a human approval wait;
the curriculum may continue on a later reconcile.

The durable adjustment packet records this as `verify-candidate`, with the
candidate fingerprint, benchmark, `active-suite` scope, and fresh-baseline
requirement. Plain-language replies made before this packet existed are accepted
only when all of those requirements are explicit; the extracted values still
have to match the durable candidate, current suite, approved labels, task,
generation, and approval.

Gym never silently changes production May, approves subjective benchmark truth,
merges a candidate, or rewrites historical evidence.

## Interface

The default interface is free-form outcome intent. A project comment wakes the
Gym owner, who may answer, record an evidence-backed no-op, or organize durable
work. Callers do not choose Gym's internal task, workflow, or wake path.

Typed actions are optional automation shortcuts:

- `improve-may-now` advances the approved autonomous May curriculum
  immediately;
- `run-regression` runs a requested benchmark or scenario;
- `report-incident` submits concrete failure evidence;
- `collect-codex-learning` scans a bounded source batch; and
- `review-telegram-field` reviews a bounded set of completed conversations.

The daily improvement refill drains all approved autonomous-training tracks.
Once their curriculum and May learning-surface fingerprints are exhausted, an
unchanged wake is a cheap no-op. Continuation events keep a non-exhausted drain
moving without a scheduler task.

The standalone Gym CLI remains the developer and CI interface. Improvement
workflows call the same typed Gym loop implementation. The bounded regression
workflow may invoke the CLI and preserves its resulting run pointer.

## Design invariants

- Tasks hold desired and observed state; workflows hold reusable process.
- Events wake work and carry facts; they are not jobs.
- The generated task tree explains scope and ownership; it does not schedule.
- Event-resolved `runtime/*` resources are reconciler-owned. Handler actions do
  not create, update, close, or unblock them; a later event may reconcile that
  same resource through the app resolver.
- One durable target has one stable resource identity.
- Routine evidence is history, not one task per row.
- A durable wait names an exact observable condition.
- Agent judgment never overrides deterministic safety or approval gates.
- Infrastructure recovery does not create a second domain lifecycle.
- Completed migration history belongs in durable evidence and Git, not the live
  app contract.
