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

## Requested source assessments

A bounded assessment of an exact source page or paper uses `assess-source` with `sourceUrl`, outcome, acceptance,
explicit `archive`, and optional constraints or governing references. Its pure
Task mapper selects `scout-assess-source`. General research questions and library
work retain `goal`; supported standing feed scans retain `explore`. The App
catalog advertises these contracts. No URL keyword routing is added to the Host.

The bounded workflow fetches the exact source (arXiv abstract/HTML links resolve
to the same paper's PDF), extracts text, and supplies up to 60,000 characters:
all text when it fits, otherwise the first 45,000 and last 15,000 characters.
It records retrieval URL/time, byte hash, total text/page counts and supplied
page/character spans with excerpt hashes. HTML extraction retains HTTP(S) link
targets, resolving relative references against the retrieved URL; those links are
not followed. Plain text and Markdown retain literal code instead of passing
through an HTML parser. This supports text assessments of
PDFs and readable HTML/text posts; it does not cover images, OCR, paywalls or
JavaScript-rendered article bodies. An access/extraction failure is recorded and
returned incomplete. HTTP retrieval is bounded to 45 seconds/25 MiB; extraction
to 30 seconds. PDF extraction requires Python 3 and the pinned `pypdf` dependency
in `agents/scout/tools/requirements-source.txt`, installed during provisioning.

One read-only Scout call returns title, summary, assessment and whether the
assigned question is complete. The code owns saving, source identity and coverage;
the model owns interpretation and must distinguish author claims from checked
conclusions. Material supplied is not proof of full reading or proof verification.
Missing evidence for a deeper requested review is an incomplete result, while a
useful overview can complete with disclosed limits. A valid structured draft from
a partial agent finish is saved and returned incomplete even if the draft's own
completion flag disagrees. The saved note and caller response retain the reported
evidence gap. A call without a valid draft cannot create an assessment. A landing
page does not establish the contents of linked papers, documentation or code;
uninspected material is unknown rather than evidence of a defect. The default workflow does
not automatically edit curated topics or append a digest.

The workflow finds an existing source record in `knowledge/findings`, or creates
one flat dated source-assessment record. It presents the latest dated assessment
first, with code-generated source evidence, and retains earlier entries under
expandable history. It compares with the pre-analysis content before saving and
verifies the exact saved bytes.
A save failure cannot return convergence. The workflow observes the existing
attempt cancellation signal before accepting a late model result or saving;
fetch and extraction share that signal. The synchronous compare-and-replace
rejects changes observed during research, but does not claim a filesystem
transaction with independent external writers. Multiple matching source records
need owner resolution rather than an arbitrary overwrite. `archive: false` performs
analysis without creating an archive. Broad semantic quality remains the worker
and caller's judgment; no additional evaluator or semantic admission service is
introduced. The same existing Task update path carries corrections.

## Ownership And Workflows

The app has one accountable owner: `scout`.

`agents/scout/` is the App's only active agent directory. The former `amy` and
`amy-kimi` agents duplicated Scout's XHS responsibility, were not bound to any
App task or workflow, and carried instructions for retired knowledge paths.
Their files are preserved under `archive/agents/` as historical evidence and
are not loaded by the Host. Restoring either agent requires a new explicit role
that does not duplicate Scout and a reviewed plan for its output authority.

Reusable research and maintenance processes belong to Scout and live under:

```text
/app/projects/scout-knowledge-lib.app/agents/scout/workflows/
```

The app manifest binds deterministic responsibilities such as digest and
library health directly to their workflows. Standing source responsibilities
run through the native Scout owner, which reviews current Task state and selects
the existing `scout-explore` workflow only when a fresh scan is useful. The
workflow creates an isolated candidate and gives its bounded researcher/writer a
source operation first, with the standing Task packet retained only as
background. That writer performs the selected research and returns reviewed
source/output evidence; the workflow validates and publishes the candidate, and
the native owner then reconciles the standing Task and its independent waits.
The writer does not restart the same selected scan as a substitute for doing it.
This is the standard agent-owned method-selection boundary, not a second planner,
workflow registry, wake classifier, or domain strategy in the generic
reconciler. A selected but missing workflow remains an execution failure; the
runtime does not guess from task prose or silently substitute another method.

The boundary is validated with isolated managed-agent trials using the production
agent loader, workflow tool, Task reads, reconciler, and settlement path. Trials
cover review-only reconciliation, fresh input beside existing waits, and a real
source scan with hosted publication; they must compare retained Conditions and
workflow facts after settlement. A correction delivered through ordinary input
to an existing source Task is considered against its named evidence even when it
does not justify a fresh scan or code candidate. Retain the accepted owner
consideration and correlation: a delivery receipt is not proof that future
reasoning changed or that the reported issue is resolved. These fixtures do not
prove live scheduler or external recovery behavior, so activation still requires
a current installed App read-back and an observed source-Task reconciliation.

Every task owner must resolve to a runnable agent. `human` is not a Scout task
owner. Human notification and task accountability are separate concerns.

## Work Areas

Use visible names and paths instead of hidden categories.

Domain work changes reusable knowledge:

- explore arXiv, HN, XHS, GitHub, and Reddit;
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
explore-arxiv                    maintain -> Scout owner -> scout-explore when useful
explore-hn                       maintain -> Scout owner -> scout-explore when useful
explore-xhs                      maintain -> Scout owner -> scout-explore when useful
explore-github                   maintain -> Scout owner -> scout-explore when useful
explore-reddit                   maintain -> Scout owner -> scout-explore when useful
daily-digest                     maintain -> scout-daily-digest
runtime/library-health-observer  maintain -> library-health
library-maintenance              maintain -> knowledge-planner
```

The source name is stable Task input and becomes workflow input when Scout
selects `scout-explore`. Event IDs, timestamps, schedule metadata, health
packets, and current observations are trigger/status data and never task input. Repeated schedule ticks therefore wake the same generation;
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

- `scout.explore` -> standing source Task; Scout selects the source discovery workflow when useful;
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
- `needs-agent` — the workflow explicitly hands novel judgment to Scout.

`failed` is an attempt/runtime outcome, not a public workflow decision. Common
finite task-action fields use May conventions: root parent, `achieve`, `P2`,
and empty outputs. Standing work must explicitly use `maintain`.

Convergence records how acceptance was established:

- deterministic verifier evidence when the workflow provides a verifier;
- the admitted workflow contract for normal reusable Scout workflows; or
- Scout owner judgment after direct handling or `needs-agent`.

The runtime validates mechanics. Scout owns semantic knowledge decisions. A
generic reconciler never decides whether a research claim is good.

### Source results

Every source lane returns the same bounded result: a summary, current source
observation, and absolute output paths. The observation names the source,
query or feed, check time, optional fingerprint, and bounded item IDs or URLs.
Credential-bearing query strings are removed before it becomes task evidence.

XHS acquisition is currently workflow-observed. The other source lanes return
structured agent-reported query/feed and item observations until a small
deterministic acquisition is justified for that source. The workflow supplies
their `checkedAt` value from its own clock and labels the mixed provenance
explicitly. A session ID alone never satisfies source acceptance.

A changed result must name files that exist and whose resolved real paths stay
inside the allowed Scout roots. A no-op has zero outputs and explains why the
current source evidence did not justify a useful change.

Drafts and digest highlights alone do not satisfy library integration. A
nonempty exploration result must include a real file under the knowledge root;
otherwise preserve its outputs and source evidence and return an incomplete
result on the same Task. This path check does not prove content quality or Git
integration. An exact read-only file error is not evidence that all knowledge
paths are read-only: preserve that file, use another appropriate writable
destination when safe, or retain the draft with its exact blocker.

For accepted-publication recovery, the workflow gives Scout the exact current
Task's retained failure, archive descriptor, and previous-attempt link, plus any
caller procedure input in a separate advisory section subordinate to Task
acceptance. Canonical paths are read-only observation targets and final link
destinations for the bounded writer, never write targets. Candidate editability
is not evidence of canonical replaceability. Scout uses non-mutating checks,
does not replay a confirmed protected destination unchanged, and either explains
how a suitable writable adaptation preserves the accepted candidate and
provenance or returns a supported human-owned Condition. The shared publisher
remains the only publication path.

If that publisher fails after the bounded writer returns on an existing
accepted-publication recovery, the workflow preserves an already-valid waiting
result as a whole. Otherwise it returns `needs-agent` on the same Task rather
than turning the failure into an automatic workflow replay. The handoff carries
the thrown publication error, writer execution, immutable accepted archive,
unpublished candidate identity and paths, and the exact unaccepted bounded
result. It carries no proposed actions, Conditions, or dependencies because the
shared handoff contract does not admit them; independently persisted waits
remain on the Task and are not reconstructed from the handoff.

The native Scout owner then judges adaptation, a justified invocation of the
same `knowledge-planner` workflow, or an exact supported wait. It does not edit
canonical knowledge directly or claim a draft is delivery. Converged owner
results remain subject to the planner's read-only verifier: exact recovery must
match the immutable archive at canonical HEAD, while a Scout-judged adaptation
must name the archive and actual publisher commit and outputs. The verifier
checks canonical ancestry and bytes but does not replace Scout's semantic
judgment. Non-converged waits remain admissible without pretending publication
was verified.

An explicitly partial agent finish is not a no-op, even when its execution
status is `done` and its output list is empty. Preserve its finish evidence
and continuation details on the same source Task, and return a blocked
workflow result rather than claiming convergence. The maintenance workflow
uses the same rule before publishing a maintenance fact or accepting actions.
Source exploration uses the
existing 48-operation allowance within the ordinary execution time limit:
select one useful candidate early and leave room for integration and read-back.
Do not add a workflow-owned retry loop or manufacture a finding to avoid a
no-op. The [local trial](../../may-agent.app/docs/proposals/workflow-practices-review.md)
records why this boundary was changed and what was actually verified.

Before dispatch, the workflow records which knowledge files already exist. A
new Markdown finding is not admitted when one of its credential-free source
URLs already occurs in another knowledge file. Updating that existing file is
allowed. This is a narrow exact-source guard, not semantic similarity or a new
deduplication registry; Scout still decides whether related content should be
updated, consolidated, or left unchanged.

## External Waits

Apply the common [recovery behavior](../../may-agent.app/docs/2a-design/system-boundary.md#recovery-uses-evidence-before-repetition).
Scout owns diagnosis and authorized setup for its source access. Tool results
retain observations; the owner judges whether those observations require human
help. The intended XHS flow distinguishes these cases:

```text
access check finds setup missing or an unknown failure
  -> current Scout owner inspects and performs useful authorized recovery
  -> verify access and resume the original scan

access check establishes a human login or authority requirement
  -> return waiting
  -> Condition: credential.state / credential:xhs / state=ready
  -> report the exact request through existing May/Conversation delivery
  -> credential watcher or human action emits the semantic observation
  -> the Condition becomes true
  -> explore-xhs wakes and reconciles again
```

Scout remains the owner throughout. Keep credential observations read-only;
opening an allowed browser tab belongs to execution setup. Retain independent
waits and partial work while diagnosing access. Verify source readability after
setup before claiming a scan or satisfying an access Condition.

The exploration workflow calls `xhs-browse.mjs prepare`: reuse a current XHS
page, or open the explore page once when none exists, then inspect readability.
The observer uses `status`, which never opens a tab. Both probes retain a
successful page inspection's `loginWall` fact separately from access readiness.
Only a non-ready page with an observed login wall produces the human-login
Condition. Connection errors, malformed output, timeouts and unrecognized page
states return the exact failed operation to the current Scout owner through the
existing workflow failure result. No new recovery Task or error registry is
needed. Human request delivery still belongs to the native owner.

Search parsing retains usable rows plus discarded-row evidence. A nonempty
response with no usable records is a failed observation, while a successful
empty array remains a supported empty result. Partial source evidence reaches
both the bounded researcher and the owner; valid independent work is preserved.
The [September behavior review](../../may-agent.app/docs/proposals/app-behavior-convergence-20260925.md)
records the tested contrasts and remaining live-verification limits.

Human-required XHS credential waits name `human:operator`, show the concrete action,
and set an hourly `reviewAfterMs`. The existing five-minute credential observer
can satisfy the wait sooner. Source retrieval starts after readiness is verified;
the owner can diagnose setup before that point. The review deadline schedules
reconsideration. Tests admit this wait through the current Host result contract.

Credential observations are level-triggered. A transition to `ready` wakes the
waiting source task once; repeated `ready` observations and stale observations
from an older credential revision do not start work. A transition back to
`unavailable` updates the level and future exact wait without creating a retry
storm. Regression tests cover repeated same-level observations, stale
revisions, restart, and ready/unavailable transitions.

The credential preflight runs asynchronously with a 30-second subprocess
deadline, so a pending browser check does not block the Host event loop. Both
the observer and exploration workflow await its result. A timeout kills the
probe. Its failure remains diagnostic evidence for the owner and does not, by
itself, establish a human prerequisite.

The observer reads Host-retained `previousObservation` and returns events plus
`nextObservation`. The Host advances that memory after publishing the facts and
discards results from a replaced observer generation. A closed observer's
process may continue until its subprocess deadline. Ready facts replay on later
scans; unavailable facts are emitted on a state transition. These observations
describe access. Human delivery uses the existing caller/Conversation path and
requires its own receipt.

## Library Health

Library reads preserve availability as well as content. The packet retains
`observations.complete`, exact `read_errors`, and an `observation-unavailable`
fact through the existing owner-wake mechanism. Readable findings survive when
another path fails. Unavailable index/digest measurements are null, and a failed
index read cannot invent a set of structural orphans. File counts describe the
observed subset when the packet is partial. Only absent optional paths (reports,
digests, prior packet history) count as empty; permission and I/O errors remain
visible. Preamble coverage records no numeric sample for an unavailable scan or
zero readable files, instead of reporting perfect coverage. These are App-local
observation rules, not a new common health or recovery controller.

`agents/scout/workflows/library-health.ts` is code-only observation. It
collects bounded domain facts and emits signals. It does not decide content
quality or task progress.

The Host publishes this Task workflow's facts with source
`app-task:scout-knowledge-lib`; `agent:scout` is the owner, not the producer.
The owner-review subscription matches that producer and the Scout project,
then checks the bounded payload before waking `library-maintenance`.

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

Each packet includes at most 16 owner signals. `wake_decisions` records
eligibility before that limit. History is appended only after the Host accepts
the event; only `wake_signals` in that history start a fact's reminder interval.
Failed publication and omitted eligible facts leave signals due on later scans.
The event contains the owner facts; `packetPath` points to the observer's mutable
history, which may not yet contain this observation when the event is received.
A crash between publication and history append can repeat a signal rather than
lose it. The packet is not proof that Scout reviewed or repaired the finding.
No second queue or owner-state ledger is needed.

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

## Agent execution and acceptance

Source exploration and maintenance may interpret structured agent output only
after the call returns `done`. A blocked, interrupted or failed call can retain
partial data, but that data cannot become an accepted finding, a maintenance
fact or a proposed Task action. Preserve the execution identity and failure
status for normal recovery. A successful call returning a valid domain wait
is different: the workflow may admit that explicit wait under its normal
result contract. Terminal execution is necessary, not sufficient, evidence.

## Daily digest handoff

The daily workflow owns compiling and preserving findings, not Telegram
delivery. It writes an immutable, content-addressed digest snapshot and emits
one retry-stable `message.created` addressed to **May**, using the existing
App message route. May produces the useful human-facing reply in its default
shared Conversation. Host admission and recovery own that bounded request;
the workflow must not add a delivery queue, poll Telegram, or create a proxy
Task. Publication is reported as a handoff, never as provider delivery.
The `digest-now` App action uses the same `daily-digest` Task intent as the
daily schedule, so an operator can request a digest without a duplicate Task
or an internal-event injection.

The snapshot survives failed publication and process restart. Its existence
alone is not proof of handoff: a retry publishes the same content key and
payload, allowing the Host to return its original receipt. Content identity
does not depend on the wake, attempt or current date. Older dated archives
remain evidence; they cannot establish that the current Conversation received
anything.

Scout's Task runtime serializes its normal workflows. After successful
publication, clear `today.md` only if its exact bytes still match the captured
input. Otherwise retain it for a later cycle, accepting some repeated findings
over deleting concurrent work. This is not a filesystem transaction against
arbitrary external editors; they must not concurrently rewrite the shared
accumulator. Worktree isolation for repository content is separate from this
runtime artifact. May can deduplicate repeated highlights from its Conversation
context. No exactly-once human display or offline Telegram replay is promised.

**Rollout:** local candidate `58972f68e7` passed preservation/replay tests and
a temporary real-Host integration check with fake model/provider endpoints.
The local two-App trial then exercised the actual model and Conversation
route: one preserved snapshot, one May digest reply, one recorded Telegram
mirror receipt, and no duplicate request when the operator action was replayed.
This verifies the observed handoff, not that the human read it or that offline
delivery and long-running reliability are guaranteed.

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
the allowed roots, including a symlink that escapes them. Allowed roots are
independent: a knowledge output does not require the optional scratch directory
to exist. Missing output files still fail admission.

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

The Host's SQLite resource store owns task resources, Conditions, attempts,
triggers, and receipts. Workflows receive bounded reconciliation context;
agents and operators use supported task reads for current state. Neither an
App nor an agent reads or writes SQL to manage tasks.

The App's `.state/` retains domain runtime artifacts:

- library health packets;
- project readout;
- generated runtime journals.

Old `tasks/state.json`, `tasks/tree.json`, and `tasks/condition-routes.json`
files are historical evidence only. Their timestamps or paused flags do not
describe the running App. There is no current requirement to refresh them.
Do not restore retired Host machinery to satisfy an obsolete projection-repair
task; record the mismatch and request a truthful stop or scope correction.
`tasks/seed.json` initializes a new app once and contains only standing desired
state. It does not preserve completed migration work, incidents, attempts, or
current observations.

Do not commit runtime packets or current task snapshots as source truth.

The accepted-output source-command metric is retired because its JSON source
is no longer live. Existing samples remain historical, not current research
health. Its script accepts an explicit snapshot path for historical analysis
only. Use supported source-Task reads for current output evidence; do not
regenerate the retired file or add a replacement collector without a useful
measurement requirement.

## Metrics And Experience Review

Scout metrics are advisory infrastructure observations, never task acceptance
or content-edit instructions. Deployment-practice loading is runtime health.
Preamble coverage watches only canonical Scout knowledge. Current Task evidence
records accepted source outputs; evidence-backed no-ops are not failures.
The JSON-based output count and textual downstream reference count are retired.

## Qualified research-adoption handoff

The daily digest remains a presentation handoff and never creates work. A
separate qualified handoff is optional after Scout publishes and verifies one
source record that is plausibly relevant to the local May installation. The
planner or routine explore pass accepts at most one optional
`result.researchRecommendation`, after the required finding publication has
succeeded. The workflow verifies its HTTPS source identity, reviewed revision,
canonical published output and current bytes; computes and retains the bytes'
SHA-256 with the claim, evidence/reading limits, possible application, and
related work; then emits `scout.research.qualified` with content-addressed
transport identity. A missing recommendation is an ordinary publication-only
success, while malformed advisory data is retained as an explicit invalid
handoff outcome without rejecting the publication.

If event emission fails after publication, the accepted incomplete Task result
retains the exact publication identity and qualified handoff. Same-Task recovery
revalidates its structure and pinned artifact hash, retries only the idempotent
emission, and never reruns source research or publication. A changed artifact or
malformed retained recommendation is diagnosed rather than replayed. Thus
publication success and an unfinished optional handoff can coexist without a
new queue or facts-string protocol.

The event asks May's standing Bob-owned research Task to judge applicability. It
is not an Evaluation report, candidate, approval, or instruction to implement.
Unchanged source revision and bytes deduplicate; Bob judges semantic overlap and
whether changed evidence warrants reconsideration. A weekly latest-slot May
input reviews at most three older archive records with a retained rotating
cursor, so a missed handoff and old material remain recoverable without a new
Scout queue or changes to digest presentation.

The app does not subscribe directly to Scout
metric breaches during the observation window.

One daily owner review may receive a bounded, redacted 36-hour reconciliation
packet prepared before `runAgent`. Only complete, correctly scoped history is
learning evidence. Unavailable, truncated, or scope-mismatched history is
withheld and the planner continues as an ordinary current-state owner review.
An experience review may submit at most one bounded Scout `goal` in `requests`.
The planner validates the SDK-normalized request list and includes it as
`proposedRequests` in its maintenance fact. Whether to await its result is an
independent decision expressed by a `conditions` entry with that `requestId`.
Publication recovery likewise retains all existing requests and Conditions,
adding its exact recovery request and wait without replacing independent work.
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
