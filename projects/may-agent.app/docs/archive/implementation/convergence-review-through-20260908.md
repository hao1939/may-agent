# Convergence review history through September 8, 2026

**Historical context:** [System Model](../../2a-design/system-model.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical snapshot of the previous main tracker. Earlier open,
candidate and rollout statements refer to their named revisions. Use the
[current gap index](../../proposals/design-implementation-convergence.md)
and its owning contracts for remaining work.

# May Design And Implementation Convergence

**Status:** Active convergence tracker

**Last reviewed:** 2026-09-08 (source review; not a deployment audit)

**Scope:** Keep the complete May Host, Apps, executors, Conversation adapters,
and documentation aligned with the accepted event-driven Task model.

The latest [whole-system source review](system-review-20260907.md)
records exact revisions, evidence, verification, and the next paired change.
It is review evidence, not another active tracker. Its metrics fix is a source
candidate; no rollout or live-state repair is claimed.

## Purpose

This is not another architecture proposal. It records only known differences
between the accepted design and the implementation that runs today. Resolved
design decisions move into Tier-2 documents; completed migration evidence moves
to the archive.

The target remains small:

```text
human turn or event
  -> persist and return
  -> May answers, clarifies, or admits typed input to the responsible Task
  -> one Task owned by the accountable App represents each durable outcome
  -> one fenced attempt keeps working until done, exactly waiting, or unsafe
  -> Task events carry progress, facts, feedback, and steering
  -> one bounded reconciliation of May's supervision Task protects the human purpose
  -> Conversation and Task reads feed independent presentation adapters
```

The governing rules are:

- one kind of Task and one Task reconciliation path;
- code collects bounded facts and applies validated effects; the LLM decides
  semantic meaning;
- message and Task identity, never text matching, prevents duplicates;
- previous-attempt observations remain history and never become current state;
- adapters are best-effort event listeners and resource readers, not work
  owners or guaranteed-delivery services; and
- extensions attach to events and release resources after bounded work.

## Recently resolved convergence gaps

### Conversation can do work without becoming another Task engine

The September 8 source change separates conversation from ongoing commitments,
not the deputy from its tools. New direct-admission turns use the existing
bounded full App execution profile. Retained child-wait requests keep their
original schema and deputy profile. May's identity and relevant skills no
longer require prompt delegation, suppress the immediate response, or route
unclassified work to Host Operations.

May can own an ordinary Task when continuation is needed. Conversation and
Topic retain discussion and exact references, not copied execution state.
No new service, tool profile, router, scheduler, or Task lifecycle was added.
See [message-lifecycle.md](../../2a-design/message-lifecycle.md).

The paired source branches are `codex/may-direct-conversation-work-20260908`.
The Host is based on main `0c7c2564`; the App changes build on the published
focused-conversation branch `ed9cdab44e`. This is source validation, not rollout:

- Host CI: 2,522 passed, 3 installation-only skips, no failures.
- Paired installation checks: 34 passed, 7 retired-Cron skips, no failures.
- May App contract checks: 8 passed; design integrity: no errors, 3 scratch warnings.
- Both edited skills pass their metadata/structure validator.
- Scripted-model regressions exercise real read/edit/write/shell tools without
  a Task, reject an interrupted attempt's claimed success, preserve accepted
  results across duplicate input and Host reconstruction, and steer the same
  May-owned Task after reopening the runtime. Inference and Task execution are
  stubbed; these tests prove the boundary, not better model judgment.

No deployment, live Task repair, or model-backed comparison was performed.
Arbitrary tool effects are not transactional with request completion; do not
claim exactly-once execution across a crash. Keep retained child waits until
their existing obligations and callers have been accounted for.

### May supervision proxy semantics

The frontend previously emitted `app.follow-up.requested` to the standing
`may/conversation/follow-up` Task, which then requested or followed the real
owner Task. That duplicated ownership and changed Console focus.

The implemented direct path now:

1. the bounded frontend returns a typed App request or exact-Task feedback;
2. Runtime admits it to the responsible Task and records the Topic link in the
   same durable operation;
3. meaningful events on that linked Task wake one bounded reconciliation of
   May's supervision Task; and
4. every 15 minutes, one bounded read wakes at most 100 unfinished Topic-linked
   Tasks that have stayed quiet for the interval.

The existing Task owns only the recurring supervision outcome. It must not
parent, wait on, or copy destination Tasks; healthy supervision converges until
another event or recovery interval wakes it. Do not add another supervisor
resource, watcher per Task, model polling loop, or replacement sibling. Revise
the existing Task in place after accounting for its current links.

The human Task projection now renders a live converged maintain Task as `up to
date`; it remains discoverable and wakes again, while only a receipt is
terminal `done`.

Completion proof for this gap is one focused end-to-end sequence:

1. a human durable request admits and watches only the responsible Task;
2. its Topic link causes meaningful progress to wake the same May supervision
   Task once, without adding a child or dependency;
3. May either no-ops, steers the exact Task, or appends one useful message, then
   the supervision Task returns to `up to date`;
4. a burst coalesces while a new human turn is answered first; and
5. the bounded recovery event rechecks an intentionally quiet linked Task
   without producing duplicate work or Conversation output.

### Lost wait recovery and human visibility

Runtime previously removed `reviewAfterMs` after repeated unchanged reviews
and cleared the indexed `next_check_at` when acknowledging a wait. Human views
inspected only direct Conditions and missed legacy display owner `Hao`.

The repair now preserves the next review, follows exact dependency leaves for
human action, points `/todo` at the Task that owns the action, and keeps legacy
`Hao` approvals visible. New handler-returned Conditions require a canonical
owner and review interval; retained legacy Conditions remain readable. Runtime
validation and wait-deadline regression tests cover these boundaries.

## Open simplification gaps

### 1. Host metrics still have a central catalog

Cron is now the single Host-maintenance schedule for `metrics-snapshot`, but
the handler still retains the large central `ALL_METRICS` catalog while current
design assigns domain measurements to their Apps.

The first bounded slice is complete: Host Operations no longer defines or
measures Scout's retired rolling accepted-output metric, it retires the invalid
instruction-text “loaded” proxy, and Scout's existing library-health workflow
owns the advisory preamble measurement and the evidence-backed accepted-output
replacement. No new scheduler or metric lifecycle was introduced.

The Evaluation aftermath-coverage slice is now converged. Evaluation declares
the exact eligibility query and metric metadata on its App definition; Runtime
measures it on Cron's existing snapshot event and preserves count/window
evidence. The former sibling snapshot Tasks, evaluator-agent aggregate call,
Host catalog entry, and duplicate Host source executor are removed. Runtime is
the only executor for persisted `sourceQuery` and `sourceCommand` definitions;
Host Operations measures and evaluates only its built-ins.

Evaluation now also owns the LLM-evaluation lag and trailing 24-hour activity
definitions with their exact read-only queries. Runtime samples both through
that same source consumer and existing snapshot event; their central Host
definitions and measurement blocks are removed. Continue moving the remaining
Evaluation metrics one exact meaning at a time rather than introducing a second
catalog or a bulk compatibility layer.

The broad 24-hour Evaluation quality-rate dashboard metric follows the same
path and retains its denominator as sample evidence. Host Operations no longer
defines or calculates that Evaluation-owned ratio.

The substantive 24-hour quality-failure ratio is also App-owned now. Its query
retains the established issue families and denominator while removing the old
second scan and unused session join from Host Operations.

The meaningful-review ratio now lives with Evaluation's event semantics. One
App query counts the two review-worthy lanes and completed reviews, preserves
the routed denominator, and replaces two Host scans.

The triage-closure ratio follows the same ownership path but keeps its narrower
meaning: only `needs_triage` routes form the denominator. Its App query replaces
the two corresponding Host scans.

The false-good overturn ratio is now App-owned as well. It preserves reviewed
`good` outcomes as its sample denominator and the original uncapped ratio while
replacing two Host event scans.

The project-finding delivery rate and pending-age metrics now live together in
Evaluation because they share the same owner-request event contract. Their two
App queries preserve the original ratio, oldest pending age, and sample counts
while replacing three Host queries.

The failed-session triage rate is now Evaluation-owned as well. Its source
query retains the three-hour window, seven-minute grace period, recovery and
cleanup exclusions, any-verdict coverage rule, neutral small-sample behavior,
and bounded session-ID evidence. Host Operations no longer defines or computes
that coverage meaning.

Runtime also honors each source definition's `measureInterval` as a minimum
normal cadence. This removes the prior behavior where a six-hour Scout command
was executed and sampled on every five-minute wake; forced operational samples
remain available without another scheduler.

Retain only small Host-owned runtime measurements centrally, and move domain
measurements to their Apps in bounded steps.

### 2. Generic Task code retains offline JSON compatibility

Production authority is now proved and enforced: every live App has resource
authority, installed descriptors require `resourceStore`, startup refuses an
uncut legacy App, and event routing, Condition replay, recovery, scheduling,
executor emission, App observers, and Task-owned workflows receive the loaded
resource reader rather than a JSON fallback.

The Runtime App read capability now follows the same boundary. It reads Tasks
only through the loaded App reader or `AppTaskResourceStore`; ordinary workflow
execution paths no longer imply a JSON Task reader, and the focused read
fixtures now bootstrap resource authority directly.

The loaded Runtime completion probe is resource-only as well. Its callers pass
the installed resource config, and its bounded Task/receipt read no longer
accepts offline JSON state. An unused whole-App intent scan was removed instead
of preserving another compatibility surface. The bounded App-wide live Task
snapshot now likewise queries the resource index and reads only the selected
Task contexts; its focused fixture exercises that authority directly. Executor
child context now reads the same bounded resource graph, including current
children and their completion receipts, without an offline JSON alternative.
The installed Task Runtime now has no generic `readTaskState` call: accepted
waits, active attempts, prior workspaces, executor event fences, and persisted
terminal-result recovery all read their exact resource rows or bounded resource
contexts. Focused Runtime fixtures activate resource authority before invoking
those paths. The verifier's pending-wake read and the reconciler's exact trigger
inspection and recording are resource-only too. Desired-state observation now
requires resource authority, reads only the exact Task, parent, dependency,
admission, and Condition routes involved, and commits through their resource
fences. Its Runtime and Codex fixtures now begin under resource authority
instead of mutating a whole JSON Task tree.
Claiming an attempt and accepting its completed or waiting result now use the
same exact resource context and require resource authority. The reconciler no
longer enters those lifecycle transitions through the generic JSON-capable
reader or runs JSON-only attempt pruning after them. The remaining whole-tree
attempt-pruning helper and optional-store recovery branches are removed;
resource-backed attempt history remains the durable evidence.
Condition preflight now reads the normalized resource route index, and selected
Condition observations mutate only their exact resource contexts. Live routing
no longer repairs or falls back to the JSON Condition index, and its unused
legacy index reader is removed. The offline writer remains only with JSON
import/test compatibility. The unused whole-App Condition tracking API is also
removed; tests now exercise the same indexed preflight and exact selected-Task
mutation used by Runtime.
Rejected stale reconciliation results are released from the exact resource
context through their claim fences; that production path no longer reads or
prunes JSON attempt state.
Moving a failed attempt to attention now uses the same exact resource context,
live-Event check, attempt fence, and optional parent wake, with no JSON attempt
pruning branch.
The externally visible effect fence also reads the exact resource context, so a
generation change or newer unaccepted Event is checked without a JSON path.
Startup recovery discovers unreported attention Tasks from the bounded resource
context and acknowledges the exact reported attempt through a fenced resource
mutation. A persisted terminal Agent result also reconstructs its exact current
claim from resource context before applying the ordinary fenced result path.
Expired Agent-session recovery now judges and releases the exact resource
attempt and its lease against observed session activity. Failed-execution
discovery and evidence-backed release likewise read only the bounded resource
candidates selected by the recovery index.
Unavailable-workflow discovery uses the same indexed, bounded resource path,
and release after a proved App reload reads and mutates that exact resource
context. An operator retry of one reviewed failed Task generation now validates
and requeues that exact bounded resource context as well.
Queue metadata for already-selected Task IDs also reads their exact resource
contexts. Attempt workspace lineage and lease renewal now read the exact
resource context and commit only their fenced attempt updates. A late terminal
workflow result after Runtime restart now requeues its exact fenced attempt from
the same bounded resource context. Previous-runtime attempt discovery now reads
the indexed running Task IDs from resource authority, preserves current Runtime
and fresh-lease fences, and retires a stale duplicate only through its matching
completion receipt. Releasing one discovered interrupted attempt now requires
that exact resource observation and its generation, version, attempt, and lease
fences; the Task is requeued through the same bounded resource transaction.
Startup repair of retained previous-runtime attention state also reads the
indexed candidate resources and commits only their fenced requeue mutations.
Orphaned cross-App dependency waits are checked against admitted requests from
their indexed waiting resource contexts and requeue the same Task without a
JSON repair path. Running Tasks whose current attempt is missing or no longer
running are likewise repaired from the indexed resource candidates and requeue
the same Task through one fenced mutation. Exact Task-intent lookup now reads
only the requested resource context as well; installed routing and focused
resource fixtures no longer pass that ordinary read through JSON state. A
launched Agent session and a nested workflow session are likewise attached only
to their exact current attempt through the resource fence, without a JSON
session path. The affected recovery fixtures now start under resource authority
and perturb only the exact fenced attempt. Passive runnable discovery now
starts from the resource recovery index and reads only its bounded candidate
Task contexts. Canonical dependency, attempt, wait, lane, priority, and trigger
state decides whether and when each candidate runs; there is no whole-App JSON
scan. A generation change also prunes a detached Condition only after its final
Task reference is gone. Previous-runtime, missing-attempt, orphaned-dependency,
attention-notification, unavailable-handler, and failed-execution recovery now
require the exact candidate IDs selected by the resource index; none can fall
back to a whole-App snapshot.

The reconciler config and fixtures are resource-only: constructing the config
requires an `AppTaskResourceStore`, with no JSON fallback. Host commits
`33905c4a` and `07ad8764` removed the legacy JSON store, its
`legacyTaskStateConfig`, and the completed offline cutover path. This cleanup
is complete; do not plan another fixture migration or reintroduce an importer.
Retained old state files are read-only historical evidence, not Runtime inputs.

### 3. Host Operations exposes historical incidents as public inputs

Six completed input variants that embedded exact old dependency IDs, Event
IDs, generations, sessions, commits, hashes, and paths have been removed from
the public schema and routing switch. Their focused fixtures remain explicitly
archived in the App test while retained receipts preserve the real evidence.

One exact containment input remains temporarily because the live database has
an unfinished request using it. It is compatibility for that existing request,
not a reusable App capability and must not receive new producers.

Check unfinished dependencies, archive completed proof, and retain a small
stable contract such as owner review, platform obligation, deployment request,
and runtime capability request.

### 4. Evaluation reports failed or invalid owner reviews as converged

The full Evaluation App check against the reviewed Host fails three heartbeat
tests: their Conditions omit required owner/review fields or use a noncanonical
owner. More importantly, the production fallback records a converged no-op and
returns `ctx.done` for invalid structured output or executor failure. It preserves
child state and records failure evidence, but successful review acceptance is
not justified. Correct that outcome boundary and the valid fixtures together;
do not weaken validation or add another retry coordinator. A legitimately
verified no-op must remain distinct from a failed review.

### 5. HTTP retains evaluation policy and feedback persistence

The current source review also found HTTP-owned evaluator instructions and
direct session-feedback file writes. Move those meanings through the existing
Evaluation App/event path in a paired change, preserving UI compatibility and
testing retries and exact evidence identity.

The September 8 direct source check reproduced a more specific break: passing
`evaluation.session.requested` with `focusLine: 12`, `focusRaw`, and
`instructions` through `taskInputForEvent` retains the fields, but
`taskIntentForInput` drops all of them. The resulting aftermath Task receives
only `sessionId`. Its evaluator prompt forbids file writes and can return an
existing summary; this is not the requested fresh, line-focused trail review.
Moving the HTTP prompt alone would not repair that behavior.

The same Host revision accepts that event as record-only, not as proof that
Evaluation owns an admitted request. The comment endpoint directly appends a
JSONL row without a submission identity, and the UI treats a successful response
as saved rows. Existing history must remain readable. The next paired slice
must preserve the selected raw line through admission and execution, use the
existing request/event identities for retries, and display pending or failed
delivery honestly. Evaluation owns review policy and feedback meaning; Host
mechanics own durable recording. Do not give App workflows arbitrary Host
storage paths or copy the HTTP file writer into an App to claim convergence.

Prove the same submission once across retry/restart, a distinct later review
of the same line, retained feedback visibility, and persistence failure without
a false saved response. These are source findings and next-slice requirements,
not a completed migration or live reproduction.

The same review removed the metric collector's independent session-end
backfill on its source branch so observation no longer conceals missing
evidence; deployment remains separate.

## Documentation gaps

The active reading path had three structural problems at this review:

1. completed/historical proposals were still listed as active;
2. several Tier-2 documents said “implemented” while known gaps were recorded
   only in a proposal; and
3. stable design documents repeated migration narratives and delivery
   vocabulary that no longer matches the simple event-listener model.

The first cleanup moves completed proposals to the archive, makes implementation
status honest, fixes stale workflow-context wording, and keeps this file as the
only active convergence tracker. `system-model.md` now stops at the public
mental model and links to subsystem authorities. `agent-app.md` now keeps only
the generic App/request/dependency contract and links May behavior to
`message-lifecycle.md`. `event-graph.md` now keeps the trace and read-model
contract; historical inspection and additive backfill procedure live in
`event-runtime-audit.md`.

The target authority split is:

| Document          | Keep here                                                           | Move or replace with a link                                        |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `system-model.md` | the small public mental model and responsibility boundaries         | subsystem protocols and migration detail                           |
| `agent-app.md`    | the generic App declaration, admission, and reconciliation contract | detailed May conversation behavior owned by `message-lifecycle.md` |
| `event-graph.md`  | trace identity, causality, closure, and read-model invariants       | backfill/runbook detail owned by `event-runtime-audit.md`          |

Do this consolidation only while editing the owning contract; a broad prose
rewrite is not an implementation prerequisite. This tracker remains active
until its correctness and boundary gaps close, then moves to the implementation
archive. It is not a second design authority.

## Resolved and absorbed

| Earlier finding                                                                                                         | Disposition                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-cutover `may/conversation/app_*` wrapper Tasks                                                                      | Cancelled through normal Task control; retained only as history                                                                                                                                                                                   |
| Exact old-Topic lookup                                                                                                  | Implemented with pagination and exact reads; candidate retrieval does not choose semantic intent                                                                                                                                                  |
| Referenced-Task context and narrow human Task control                                                                   | Implemented through bounded canonical reads and validated exact control                                                                                                                                                                           |
| Explicit response plus fallback inbox result                                                                            | Both projections now use the request- or follow-up-derived `result:<requestId>` message identity; bounded-window regression coverage proves the identity remains stable while explicit data wins when both are present                            |
| Current Task observation scope                                                                                          | Progress reads now require the exact active `attemptId`; accepted Task status records its producing attempt, timestamp inference is removed, terminal results win, and multi-attempt coverage keeps prior progress historical                     |
| Host Operations source check                                                                                            | The App now installs its declared Node/Bun types, consumes the bounded reconciliation Event batch, uses the current `needs-agent` handoff state, and passes its complete syntax, type, format, and manifest-test check                            |
| Telegram best-effort watch presentation                                                                                 | Telegram starts at the current Conversation head without promising offline replay and now suppresses unchanged watched-Task revisions while still rendering real progress and terminal changes                                                    |
| Equivalent Console result and terminal card                                                                             | Console correlates canonical `result:*` Conversation messages with exact Task references and suppresses only the matching supporting terminal card; the watch-ended state remains visible and no prose comparison is used                         |
| Task cancellation and active executor resources                                                                         | `TaskAttempt.signal` now carries the exact attempt stop signal; durable cancellation names that attempt and stops managed sessions, workflows, Codex turns, and Codex/Claude subprocess trees while the terminal Task fence remains authoritative |
| Executor input parity                                                                                                    | Runtime now resolves one `TaskAttempt` with role, current children and waits, ordered Events, workspace, output paths, and result schema. Built-in and registered executor paths consume that boundary; Codex's JSON projection is transport only                                                              |
| Host Operations recurring execution                                                                                      | Cron is the sole five-minute `metrics-snapshot` scheduler. `app:may-agent` owns Host Operations Tasks, `agent:tech-lead` is the App and project default attempt profile, and May remains the human-facing deputy. Retained `may` records are compatibility evidence, not another execution model                  |
| First Scout metric-ownership slice                                                                                        | Host Operations no longer reactivates `scout.accepted-source-outputs-24h`, retires the invalid `scout.knowledge-practice-loaded` proxy, and leaves `scout.knowledge-preamble-coverage` plus the accepted-output replacement to Scout's existing six-hour library-health workflow                          |
| Evaluation aftermath-coverage metric                                                                                     | Evaluation declares one evidence-bearing source query; Runtime measures it on the shared Cron event. Per-snapshot Tasks, agent aggregation, the Host catalog entry, and Host's duplicate generic source executor are removed                                                                                 |
| Evaluation LLM-coverage-lag metric                                                                                        | Evaluation declares the exact non-heuristic-evaluation lag query; Runtime measures it on the shared Cron event, and the Host catalog plus handwritten measurement block no longer own that domain meaning                                                                                                  |
| Evaluation 24-hour LLM activity metric                                                                                     | Evaluation declares the exact recent non-heuristic evaluation-count query; Runtime measures it on the shared Cron event, and the Host catalog plus handwritten measurement block no longer own that domain meaning                                                                                         |
| Evaluation broad quality-rate metric                                                                                        | Evaluation declares the exact recent non-skipped quality-rate query and preserves its denominator; Runtime measures it on the shared Cron event, with no Host definition or handwritten calculation                                                                                                      |
| Evaluation substantive quality metric                                                                                       | Evaluation declares the established substantive issue-family ratio and denominator in one source query; Runtime measures it on the shared Cron event, replacing two Host scans and an unused session join                                                                                               |
| Evaluation meaningful-review metric                                                                                          | Evaluation declares the review-worthy route and completed-review ratio with its routed denominator; Runtime measures it on the shared Cron event, replacing two Host event scans                                                                                                                         |
| Evaluation triage-closure metric                                                                                              | Evaluation declares the needs-triage route and closure ratio with its routed denominator; Runtime measures it on the shared Cron event, replacing two Host event scans                                                                                                                                  |
| Evaluation false-good metric                                                                                                  | Evaluation declares the reviewed-good and false-good event ratio with its reviewed-good denominator; Runtime measures the original uncapped ratio on the shared Cron event, replacing two Host event scans                                                                                              |
| Evaluation project-finding delivery metrics                                                                                    | Evaluation declares delivery-rate and oldest-pending-age queries over its project-owner request contract; Runtime preserves their values and sample counts on the shared Cron event, replacing three Host queries                                                                                        |
| Evaluation failed-session triage metric                                                                                     | Evaluation declares the failed-session eligibility, triage coverage, grace period, neutral small-sample rule, and bounded evidence query; Runtime measures it on the shared Cron event with no Host definition or handwritten calculation                                                               |
| Scout App test boundary                                                                                                   | The App check runs Scout-owned tests only. Cached third-party source repositories under the agent workspace remain inspectable evidence but are not treated as part of Scout App verification                                                                                                             |
| Whole-system document scope                                                                                                | `system-model.md` retains the public nouns, May/App/agent boundary, one flow, record map, and governing rules; detailed persistence, dependency, recovery, presentation, and code contracts link to their owning subsystem documents instead of being restated                                            |
| Generic App document scope                                                                                                 | `agent-app.md` owns package declaration, admission, typed dependencies, event attachments, reconciliation, and Host boundaries. May-specific understanding, clarification, Topic linkage, supervision Task, follow-through, and plain-language behavior live in `message-lifecycle.md`                          |
| Event graph document scope                                                                                                  | `event-graph.md` owns trace identity, causality, closure, provenance, storage, and graph-read invariants. Historical audit and additive backfill commands live in `event-runtime-audit.md`; neither trace nor backfill becomes work authority                                                                    |
| Event trace audit semantics and runtime cost                                                                                 | The checker audits the current `conversation.message.created` to May-request boundary and correlated Conversation result instead of adapter delivery. An indexed close-event lookup removes the retained-history quadratic scan; the 249k-event live audit now completes in under one second with structural and semantic integrity passing                  |
| Native coding worker document scope                                                                                           | The accepted adapter contract now records current failure, validation, worktree, and inspection boundaries instead of maintaining a speculative UI/metric/parser wishlist. New worker features require concrete evidence and extend the existing adapter/read models rather than creating another execution path                                      |
| Task engine interface documentation                                                                                            | The engine contract now names the shared `TaskAttempt` instead of a stale narrower pseudo-type, distinguishes small list views from exact `TaskDetail`, records the opt-in lossless outcome projection, and makes correlated request completion independent of adapter delivery                                                                   |
| Installed Task persistence authority                                                                                           | All live Apps have resource authority; installed descriptors require it, startup refuses uncut JSON state, and production routing, Condition replay, recovery, scheduling, execution, App observers, and Task-owned workflow reads use the loaded resource authority                                                                                 |
| Runtime App Task reads                                                                                                         | The App read capability accepts a loaded reader or canonical resource authority; generic workflow execution paths no longer reconstruct Task views from JSON, and focused read fixtures exercise the resource store directly                                                                                                                           |
| Inbox delivery/lifecycle compatibility surface                                                                                 | Removed unused delivery projection types and reads, per-item/list N+1 delivery joins, the health delivery subquery, and uncalled continuation/claim/wait helpers. Historical delivery rows and schema remain untouched evidence and do not affect request or Task state                                                                             |
| Task queue ordering                                                                                                             | Removed front/ordinary lanes, burst counters, and both skip-aging maps. Scheduling is trusted human lane, canonical effective priority, exact-wake promotion among equal-priority peers, FIFO, and Task-ID coalescing; passive recovery rereads canonical priority                                                                                |
| Shared request/Task capacity                                                                                                    | Request decisions now acquire the same Host capacity as Task attempts. Normal request decisions use background slots, at most one May decision uses the reserved foreground slot, App keys coalesce, and the request coordinator does not exceed its stated admission bound                                                                      |
| Completed Host Operations incident inputs                                                                                       | Removed dependency-authority, installed-resolver, App-deployment, runtime-source-deployment, protected-config, and status-activation incident shapes after live resource and inbox reads found no unfinished consumers. Historical receipts remain evidence; one unfinished containment input remains temporary compatibility                  |
| Loaded specialist instructions with Task trees, mandatory artifacts, proactive backlogs, and fire-and-forget delegation | Replaced with the shared Task/attempt boundary and current environment facts                                                                                                                                                                      |

Resolved rows do not remain implementation steps in this tracker.

## Repair order

1. Review the observational-metrics fix and integrate pending companion source
   and design changes explicitly; do not equate Host main with an App release.
2. Fix Evaluation's failed/invalid review result and its stale Condition fixtures
   using the existing Host non-success result path.
3. Move session evaluation policy and feedback writes out of HTTP through a
   paired Host/Evaluation change using the existing event/App path.
4. Classify remaining central metrics and move demonstrated domain meaning to
   its App; preserve useful Host-owned measurements.
5. Retire the isolated JSON import/test constructor when supported consumers
   permit it, and incident-specific public contracts after checking live waits.
6. Run the final document-by-document status, link, and code-reference audit.

Each step is independently reviewable and reversible. Do not combine them into
a broad rewrite.

## Non-goals

- no new broker, queue service, delivery service, or Conversation database;
- no Task subtype, hidden Task, per-turn wrapper Task, or adapter-owned work;
- no text-based duplicate detection or keyword intent router;
- no broad production database cleanup;
- no session, Topic, workflow, Codex thread, or trace as work authority; and
- no guarantee that every adapter displays every message exactly once.

## Completion

Convergence is complete when:

- the full Host and every installed App pass their paired checks;
- one message keeps one identity across all bounded projections;
- current Task presentation is explicitly tied to the current attempt or
  accepted revision;
- cancellation releases active executor resources;
- each recurring responsibility has one scheduler and one owner;
- current Apps have one resource-backed Runtime path;
- active Tier-2 documents state remaining gaps honestly; and
- a fresh code-and-document audit finds no second work, delivery, routing, or
  persistence authority.

## September 8 focused May simplification

The human approved the focused May scope preserved in
[implementation evidence](focused-may-scope-20260908.md). Earlier
pilot and deployment choices are not authority for this source task.
The human stopped its Herdr goal and worker and asked the original assistant
to implement directly. The paused worker's isolated source checkouts were
preserved and reviewed before continuation; there is no active delegation.
The human then clarified that this pass must focus on May, not Evaluation:
A's compatibility audit and B's attempt-context cleanup are in scope; C is not.

A: deletion of frontend child-request waiting is explicitly deferred. The SDK
contract and compatibility fixtures remain. A subsequent read-only local audit
found one unanswered May parent still waiting on two completed child requests;
there is no complete installed-caller census or live recovery proof. See the
[consumer audit and drain decision](request-wait-audit-20260908.md).
Ordinary request/result correlation and Task dependencies remain required.

B: the source candidate narrows May's shared identity from 146 to 47 lines,
keeps supervision instructions with its App-supplied Task input, and puts Host
Operations review procedure in the existing tech-lead profile. The common
identity preserves authority rules and an explicit fallback for retained
supervision Tasks whose old input lacks instructions. Ordinary May goals reuse
the Host Task protocol without copying it into each input. Context documentation
no longer says destination results wake the completed frontend request.

The Host continuation now gives a new direct-handoff turn a model-facing
schema without frontend child dependencies. Requests with retained child work
keep both their compatibility prompt and schema after an App definition change.
Another Topic's work does not change this request's protocol. The frontend
catalog now includes May's own durable goal input contract, excluding its
conversational kinds; the former catalog excluded May even though its prompt
allowed May-owned work. No new role router, SDK field, scheduler, or persistence
path is introduced. The shared public schema and generic request runtime remain.

C: HTTP/Evaluation policy and feedback ownership remains a separate known gap,
excluded from this May-focused pass by the human's clarification. No Evaluation
implementation, partial migration, live state change, or rollout is included.

### Published source and verification

[Host PR #77](https://github.com/hao1939/may-agent/pull/77) contains candidate
`4ff36da53b53599c501b4a3d4b104821fc6bac67`, based on main `78fe7123253c64a161a963d87bf3d40eaa593898`.
The paired App source includes instruction commit `be40354546` and the current
documentation on `codex/may-focused-conversation-20260908`, based on App main
`d8baf6e0c7`. It is published to the existing bare Git repository
`azureuser@74.176.66.242:/opt/may-agents.git`, which has no PR interface.
The Host PR records the exact paired App revision. Earlier local commit IDs
remain audit history, not the current review heads.

Verification on the current Host candidate, with Node 24.20.0 and Bun 1.3.14:

- Full Host CI: 2,509 passed, 3 installation-only skips, no failures. Typechecks,
  SDK/boundary checks, lint, and real daemon/socket/browser tests passed.
- Paired installation checks: 34 passed, 7 retired-cron skips, no failures.
  These include actual prompt assembly for May and Host Operations and Gym's
  resource-backed admission/emission fixtures, not a live installation trial.
- Focused App and owner-workflow checks: 27 passed, no failures.
- Design integrity: no errors; three local scratch-directory warnings.

Six request-contract tests cover new and retained protocols. One creates a
legacy child wait, recreates the inbox Host with the current May definition,
and completes the same request without attaching replacement work. The existing
May-owned-goal runtime test now uses the real request resolver: it checks the
model's own-App catalog and schema, then one decision, one Task attachment, and
the exact Topic link. Inference and Task execution are fixture capabilities;
this proves the handoff contract, not model judgment or full task completion.

The production Host change adds 27 lines and removes 7, narrowing an unnecessary
model choice without deleting the public runtime. No SDK or storage migration,
role router, queue, or extra work lifecycle is introduced.

### Completion boundary

| Item | Status and remaining work |
| --- | --- |
| A: caller audit | Source audit complete; read-only local evidence confirms one unfinished parent with a child wait. The public waiting path stays supported. |
| A: delete the waiting path | Deferred. Preserve and recover the observed obligation, complete the affected SDK/installation inventory, and verify drain or migration before removal. |
| B: focused instructions and direct-handoff context | Implemented and verified as a source candidate; review both repositories together. |
| Better model behavior | Not established. Run the approved conversation cases against baseline and candidate only with separate model/credential authority. |
| Merge and rollout | Not performed. CI and publication do not authorize either. |
| C and the earlier delivery pilot | Outside this May-only pass, not prerequisites or implied new work. |

The scoped source cleanup is implemented; the full historical proposal and
live rollout are not complete. GitHub's current-candidate checks and review
discussions remain the readiness authority, not this dated evidence record.
