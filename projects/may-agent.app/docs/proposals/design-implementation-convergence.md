# May Design And Implementation Convergence

**Status:** Active convergence tracker

**Last reviewed:** 2026-08-26

**Scope:** Keep the complete May Host, Apps, executors, Conversation adapters,
and documentation aligned with the accepted event-driven Task model.

## Purpose

This is not another architecture proposal. It records only known differences
between the accepted design and the implementation that runs today. Resolved
design decisions move into Tier-2 documents; completed migration evidence moves
to the archive.

The target remains small:

```text
human turn or event
  -> persist and return
  -> May answers, clarifies, or publishes typed durable intent
  -> one Task owned by the accountable App represents each durable outcome
  -> one fenced attempt keeps working until done, exactly waiting, or unsafe
  -> Task events carry progress, facts, feedback, and steering
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

`app-task-store.ts`, the reconciler config, and cutover helpers still compile a
JSON path used by the guarded offline importer and many focused fixtures. Keep
that compatibility explicit and outside installed Runtime construction, then
migrate fixtures in bounded slices before deleting it. Retain old files as
read-only evidence; do not add a legacy/modern abstraction.

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
| Per-request May follow-through loop                                                                                     | Replaced by one normal visible Conversation Task plus bounded frontend turns                                                                                                                                                                      |
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
| Scout App test boundary                                                                                                   | The App check runs Scout-owned tests only. Cached third-party source repositories under the agent workspace remain inspectable evidence but are not treated as part of Scout App verification                                                                                                             |
| Whole-system document scope                                                                                                | `system-model.md` retains the public nouns, May/App/agent boundary, one flow, record map, and governing rules; detailed persistence, dependency, recovery, presentation, and code contracts link to their owning subsystem documents instead of being restated                                            |
| Generic App document scope                                                                                                 | `agent-app.md` owns package declaration, admission, typed dependencies, event attachments, reconciliation, and Host boundaries. May-specific understanding, clarification, Topic, conversation-Task, follow-through, and plain-language behavior live in `message-lifecycle.md`                          |
| Event graph document scope                                                                                                  | `event-graph.md` owns trace identity, causality, closure, provenance, storage, and graph-read invariants. Historical audit and additive backfill commands live in `event-runtime-audit.md`; neither trace nor backfill becomes work authority                                                                    |
| Event trace audit semantics and runtime cost                                                                                 | The checker audits the current `conversation.message.created` to May-request boundary and correlated Conversation result instead of adapter delivery. An indexed close-event lookup removes the retained-history quadratic scan; the 249k-event live audit now completes in under one second with structural and semantic integrity passing                  |
| Native coding worker document scope                                                                                           | The accepted adapter contract now records current failure, validation, worktree, and inspection boundaries instead of maintaining a speculative UI/metric/parser wishlist. New worker features require concrete evidence and extend the existing adapter/read models rather than creating another execution path                                      |
| Task engine interface documentation                                                                                            | The engine contract now names the shared `TaskAttempt` instead of a stale narrower pseudo-type, distinguishes small list views from exact `TaskDetail`, records the opt-in lossless outcome projection, and makes correlated request completion independent of adapter delivery                                                                   |
| Installed Task persistence authority                                                                                           | All live Apps have resource authority; installed descriptors require it, startup refuses uncut JSON state, and production routing, Condition replay, recovery, scheduling, execution, App observers, and Task-owned workflow reads use the loaded resource authority                                                                                 |
| Inbox delivery/lifecycle compatibility surface                                                                                 | Removed unused delivery projection types and reads, per-item/list N+1 delivery joins, the health delivery subquery, and uncalled continuation/claim/wait helpers. Historical delivery rows and schema remain untouched evidence and do not affect request or Task state                                                                             |
| Task queue ordering                                                                                                             | Removed front/ordinary lanes, burst counters, and both skip-aging maps. Scheduling is trusted human lane, canonical effective priority, exact-wake promotion among equal-priority peers, FIFO, and Task-ID coalescing; passive recovery rereads canonical priority                                                                                |
| Shared request/Task capacity                                                                                                    | Request decisions now acquire the same Host capacity as Task attempts. Normal request decisions use background slots, at most one May decision uses the reserved foreground slot, App keys coalesce, and the request coordinator does not exceed its stated admission bound                                                                      |
| Completed Host Operations incident inputs                                                                                       | Removed dependency-authority, installed-resolver, App-deployment, runtime-source-deployment, protected-config, and status-activation incident shapes after live resource and inbox reads found no unfinished consumers. Historical receipts remain evidence; one unfinished containment input remains temporary compatibility                  |
| Loaded specialist instructions with Task trees, mandatory artifacts, proactive backlogs, and fire-and-forget delegation | Replaced with the shared Task/attempt boundary and current environment facts                                                                                                                                                                      |

Resolved rows do not remain implementation steps in this tracker.

## Repair order

1. Reduce the central metrics catalog in bounded App-owned steps.
2. Move retained JSON import/test compatibility out of normal Task code, then
   retire it as fixtures migrate.
3. Remove incident-specific public contracts.
4. Run a final document-by-document status, link, and code-reference audit.

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
