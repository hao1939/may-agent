# Automatic assessment with May-owned follow-up

User-approved direction; refined implementation proposal, September 19, 2026.
Isolated preparation, tests and bounded local trials are authorized. Source
integration and live activation remain separate approval-controlled steps.
This proposal does not claim that ongoing-work assessment is deployed.

## Outcome and ownership

Reduce repeated human inspection by producing timely, evidence-backed assessments
of supported work, with visible coverage and a dependable return to its decision
owner. Begin with May and Scout; the mechanism uses canonical external App/Task
identity and should be reusable for other Apps without Host-specific cases.

**Evaluation assesses; May decides and follows through.** Assessment includes
judgment: the evaluator can find a broken obligation, a legitimate wait, useful
recovery or insufficient evidence. May judges urgency, necessity, value versus
cost, simpler alternatives and the responsible action. She coordinates the
appropriate owner, rather than acquiring authority to mutate every App.

| Responsibility                                                                                            | Owner and authority                                                         |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Execute, retain evidence, return feedback, recover attempts and enforce exact approval boundaries         | Host and supported adapters                                                 |
| Collect bounded assessment evidence, select due subjects and publish independent assessment with coverage | Evaluation App and evaluator                                                |
| Decide no change, investigate, reuse a repair, delegate or request approval; follow accepted work         | May under the installation's preparation authority                          |
| Prepare and verify a repair                                                                               | Responsible App/Host team                                                   |
| Compare behavioral candidates when useful                                                                 | Gym                                                                         |
| Approve the exact source/application and displayed activation scope                                       | Human                                                                       |
| Check Host/Evaluation mechanical availability                                                             | Host Operations; full Host outage requires observation outside that process |

Evaluation does not assess itself or its delegated review execution. A suspected
defect in its judgment receives an independent review arranged by May. Mechanical
availability observations are not semantic self-evaluation. This does not install
a new outside monitor or supervisor fallback hierarchy.

Ordinary tool failures still return directly to their worker, and unfinished
assignments keep existing owner feedback and review deadlines. An independent
assessment is not a prerequisite for routine recovery or an already-known repair.

## Alignment with existing contracts

The common [ownership boundary](../../may-agent.app/docs/2a-design/system-boundary.md#ownership-and-intervention),
[Task wait/recovery rules](../../may-agent.app/docs/2a-design/task-resource-engine.md),
[workflow rules](../../may-agent.app/docs/2a-design/workflows.md), and
[metrics contract](../../may-agent.app/docs/2a-design/metrics.md) remain authoritative.
No new controller, issue registry, public lifecycle or mandatory Task per event is
needed. Code executes predictable checks; agents choose the semantic response.

Evaluation's current [Task-outcome design](task-outcome-evaluation.md) owns bounded
public reads, immutable publication, integrity-checked readers, evidence identity
and self-exclusion. May's [improvement loop](../../may.app/design/evaluation-improvement-loop.md)
owns disposition, candidate, approval and follow-up. The linked
[failure-follow-up proposal](../../may.app/design/failure-follow-up-proposal-20260919.md)
owns immediate recovery and execution-origin repair intake. Keep these parts
separately reviewable and reuse their established return contracts.

Current source has an exact external Task reader, a serialized selector that
emits at most one review per wake, and May's explicit subscription to
`evaluation.task_report_published`. The selector includes running/pending/waiting work under a distinct ongoing
rubric and keeps open obligations eligible beyond the seven-day outcome window.
The strengthening candidate leaves that fair bounded sampling unchanged and
adds an opt-in exact review opportunity for production reconciliation outcomes
reported as `incomplete` or `retrying`. Evaluation rereads current evidence, so
a recovered transient is not frozen as a failure. Other stalls retain ordinary
sampling latency; lifetime attempt count, age, and error prose alone are not
failure verdicts.

The manifest currently uses an event schedule; the Host's existing App-input
schedule supports durable slot identity and latest-slot catch-up. Assess a small
switch using the existing `automatic-review` input before inventing another
scheduler. Enabling a schedule is not proof a due run was admitted and handled.
Do not revive retired project-health lanes, session scoring or legacy metrics.

## Three opportunities, one assessment path

1. **Relevant observation:** a supported, exact-subject result or material
   follow-up observation can request assessment through ordinary App input.
   Reuse an existing producer when it already supplies the required identity.
   Do not subscribe to every log line, tool error, heartbeat or report recursively.
2. **Periodic selection:** a bounded scheduled selector checks current external
   work for due assessment, missed observations and fair sampling of useful
   outcomes. Read code-owned facts first; unchanged evidence need not spend a
   model call. It does not decide that a selected Task is defective.
3. **Explicit follow-up:** May requests an exact review after verified adoption,
   or a user requests assessment. Reuse the same evidence/publication path and
   keep exact pinned post-adoption requests intact.

The Host owns time, scheduling, input retention and retries. Evaluation owns
selection policy, review budget and assessment. May's own Task/Condition reviews
still protect her unfinished obligations; they are not a second periodic system
evaluation program. Events and scheduled reads are opportunities to reconcile
current evidence, not competing owners or a new workflow for each trigger.

For the first candidate, demonstrate one supported event/request path plus the
periodic backstop. Inventory the actual available producers and readers before
choosing integration points. A missing useful producer warrants the smallest
reviewable adapter correction or an explicit coverage limitation, not invented
delivery or private App access to Host storage.

## Assess ongoing work without confusing it with an outcome

Keep the exact App/Task as the subject. An ongoing-work assessment asks whether
current obligations, returned evidence and next actions are coherent at the
observed revision. It does not require a running Task to have delivered its
eventual outcome. Check whether a wait has a real dependency/producer, an owner,
an established return path and a review deadline, using only exposed evidence.

Human approval pending, active useful execution, recovered transient failures
and an idle Gym with no worthwhile candidate are valid situations. Silence,
Task age or a nonzero command alone is not a failure verdict. An overdue review
is evidence to inspect, not authority to cancel or reassign the work.

Do not silently change the meaning of historical reports. Choose the smallest
explicit assessment-purpose/rubric distinction that the existing reader and May
consumer can preserve. Version semantic changes and maintain old report reads.
Do not require a new public App input kind merely to select a procedure.

Use coherent bounded snapshots and preserve the current pre-publication drift
check. A subject changing during assessment cannot be reported as a verified
current result. Retain the coverage limitation and retry on an appropriate later
opportunity, without an unbounded model loop.

Elapsed time can make a review due without another Task write. Test that a
deadline crossing is reconsidered while repeated reads before that deadline
reuse valid evidence. Bind time-sensitive assessments to a meaningful due-review
identity or bounded validity, rather than adding a raw clock timestamp to every
hash and reevaluating unchanged work each tick.

Current open obligations must not disappear solely because they fall outside the
recent-completion window. Use bounded navigation and fairness; expose any Apps,
pages, subjects or evidence excluded by the configured coverage. Do not promise
exhaustive monitoring from a small sample.

## Return, decisions and human visibility

Reuse Evaluation's integrity-checked publication and May's ordinary message
consumer. Reports carry facts and assessment, never commands or approval. May
rereads the current subject and accepted linked repair before deciding. Delivery,
accepted disposition, repair completion and independent recovery verification
remain distinct facts. A later report does not create another repair by default.

At first glance present current findings, covered scope, last successful check,
evidence age and material gaps. A selector wake that finds no eligible subject
is a successful scan with no assessment, not healthy population coverage. A read
failure, unavailable evaluator or stale sample is unknown/insufficient evidence.
Source revision must describe the actually used definitions and evidence, not
an unrelated process environment label.

May's ordinary Task result adds action disposition, accountable owner and next
action/wait with links. Healthy unchanged observations stay quiet. A new material
problem, useful recovery, blocker or exact approval request merits the existing
human return path. No new dashboard, Telegram protocol or repeated model call
is required to read retained status. Tests must not send real external messages.

## Simplicity and value check

| Choice                                                          | Value                                                       | Cost control / smaller alternative                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Existing outcome assessment plus scoped ongoing-work assessment | Finds missed handoffs before humans repeatedly inspect them | Reuse reader/store/consumer; avoid a second health-report framework                      |
| Event/request path plus one existing scheduled backstop         | Prompt response and recovery from missed signals            | No separate per-App timers or Task per tick; verify restart deduplication                |
| Deterministic reads before evaluator judgment                   | Avoids repeated model work and exposes missing facts        | Keep bounded selectors and current Task facts; no second cache/issue queue               |
| Real transition checks and a small agent trial                  | Establishes that components work together                   | Reuse maintained fixtures; no live deployment or model run for each mechanical edge case |

Start serialized and keep an explicit small semantic-review budget covering both
scheduled and event-triggered work. Retained requested reviews take capacity before
routine sampling. The selector checks the complete bounded Evaluation Task snapshot;
when a requested review is live it preserves its cursor and skips that sample, and
when the snapshot is absent or truncated it reports unknown backlog coverage instead
of asserting the backlog is empty. Work already emitted before a newer request may
still finish; this policy does not preempt running work or add a scheduler.

Exact duplicate suppression alone does not bound a burst of different subjects.
Exhaustion returns an accepted `waiting` result for the exact review with subject
generation, evidence hash, slot, limit, and actual next eligibility. The waiting
result uses the Host's absolute `reviewAt`; it introduces no Condition or producer.
Early wakes preserve the deadline and spend no model call. At the deadline the same
exact request becomes eligible for reconsideration; elapsed time never proves an
external fact. Semantic allowance uses the separate
`EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS`; changing selector cadence does not
silently change spend. The bounded pilot is an hourly selector with a daily allowance
of at most two semantic calls (`maxConcurrent: 1`): at most 14 calls/week. The prior
four-call trial estimated $0.479074 total, so $1.68/week is a planning estimate at
that observed mean, not a billing cap; the enforceable upper bound is 14 calls.
Live settings remain unchanged until an operator explicitly configures and activates
the reviewed release. The default daily sample and one-call daily allowance remain
limited coverage, not a prompt-response guarantee.

### September 21 capacity refinement

The original daily pilot budget proved too small for the retained requested work:
23 review contracts were waiting while routine sampling yielded. The existing
mechanism remains sufficient. The [active-installation capacity
profile](task-outcome-evaluation.md#capacity-for-an-active-installation) specifies
an hourly selector with one semantic assessment per hour, retaining serialized
execution and exact waits. This supersedes the earlier pilot frequency for this
installation, activated on September 21; it does not change the conservative code
defaults or claim that all work is monitored. Activation and observed results are
recorded in the [rollout record](rollout-and-migration-2026-09.md).

## Implementation slices and acceptance

May owns this as one ordinary implementation Task linked to the independent
failure-follow-up Task `may/goal/app_34b2f8b1-1860-419f-ab1e-1c48f6065487`.
Ask Bob for an independent design/value review and use tech-lead as useful.
Preserve that existing work; coordinate shared May policy/consumer files and
develop this candidate in a separate isolated worktree. Keep PR #199's worker
context correction separate too.

1. Map current code to this contract and reproduce the selection/coverage and
   wake gaps. Return a short justified implementation plan and proceed with
   authorized isolated work; no extra permission is needed for that preparation.
2. Implement the smallest Evaluation assessment/trigger refinement and only
   necessary May consumer changes. Preserve publication integrity, self-exclusion,
   exact source identity and agent decision authority.
3. Exercise event admission, a dropped signal recovered by the scheduled path,
   restart/catch-up without duplicate work, old unresolved work, time-based due
   review, a valid human wait, a recovered failure, duplicate/changed evidence,
   unavailable evidence and excluded self-review. Test absence of new effects
   when approval is missing or stale by reusing the existing approval checks.
4. Run a bounded isolated agent trial through the production modules: evaluator
   assesses a controlled unresolved external Task and a valid-wait/recovered
   control; the real report reaches May, who chooses and retains a justified
   disposition. Link existing repair work when appropriate. Keep synthetic
   providers/events distinct from model judgments and live deployment proof.
5. Retain exact commits, source revisions, checks, missed or failed trials,
   admitted owner results, invocation/cost observations and uncovered paths.
   Return independent review, value/cost and simpler-alternative conclusions.

Use existing focused tests before adding more, and widen trials only when
failures or material uncertainty justify it. Keep background Tasks bounded and
clean up disposable trial work. Application and real rollout need exact human
approval; post-adoption verification stays pending until that approved step.

Update current Evaluation design, criteria, agent guidance and README when the
candidate changes them. Put May disposition policy in May's existing design and
agent guidance. Common mechanics belong in the existing `may-agent.app` design
owners only if their contract changes. Record candidate versus installed status
explicitly. Generic supervisor fallback, outside uptime monitoring, a new metrics
catalog and release redesign are deferred, with concrete coverage limits shown.
