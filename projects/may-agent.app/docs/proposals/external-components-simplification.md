# External components: simple, solid, and clearly organized

**Design status:** Draft for review.
**Implementation status:** Source review completed September 10, 2026. The changes
below are proposed; none has been implemented or deployed by this plan.

## Goal and sufficient outcome

Make May's replaceable capabilities easier to understand, change, and operate
without weakening accepted work. A capability should have an obvious owner,
small dependencies, bounded execution where applicable, and explicit cleanup.
Removing it should degrade capability while preserving the remaining system's
correctness and accepted obligations.

Use the [value/cost rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
and [core principles](../1-principles/core-principles.md). Invest first in failures
that can repeatedly stall ordinary use. Accept missed observations, affordable
redo, or visible unavailability when that avoids permanent recovery machinery.
A file move earns its cost when it clarifies ownership or prevents coupling;
file length alone is not a reason to refactor.

Enough means the concrete gaps below are closed, their affected contracts agree
with the implementation, and existing removal/failure guarantees still hold.
It does not mean every external file has moved or every capability has the same API.

## Scope and evidence

The review covered capability families, their composition, and representative
failure paths; it was not an exhaustive audit of every installed App or provider.
It examined Host `0d8c7658` and the Conversation candidate `0b420287`.
The cited external implementations were unchanged between those revisions.
At plan preparation, fetched `main` was `765ce79c` and those implementations
remained unchanged. #130 and #131 were squash-merged into #129's branch
(`5317d627`); #129 remained open. Recheck these facts before implementation.

Existing focused tests passed: **79 tests across 11 files**, covering observers,
schedules, discovery/registration, workflow inspection, Git workspaces, reporting,
maintenance, Telegram client behavior, and read-dedup guards. A small synthetic
probe exercised the actual observer runtime with an unresolved callback: later
slots did not rerun it, reload started another callback before the old one
settled, and close correctly discarded late facts. Separate probes confirmed
the guard wording and metric projection omissions described below. These are
source observations, not network, live-model, or deployment validation. Add
durable regression coverage with the fixes rather than relying on scratch probes.

| Finding | Source, relative to the Host root | Consequence |
| --- | --- | --- |
| Observer awaits have no runtime deadline or supplied cancellation signal; reload resets running ownership | `src/app/app-observer-runtime.ts`; SDK `ObserverContext` | A stuck observer stays busy; replacement can overlap unresolved old work |
| Telegram fetch has no explicit request deadline or cancellation tied to close | `src/app/transport/telegram-client.ts`, `telegram.ts` | Provider I/O can hold polling or a delivery sequence beyond its useful lifetime |
| HTTP builds evaluator instructions and appends feedback files | `src/app/http/server.ts`, `handleSessionEvalGenerate` and `handleSessionEvalComment` | Transport owns domain policy and a second domain write path |
| Metric collection is attached in general daemon setup; public metric reads omit sample time | `src/app/daemon-events.ts`, `metric-source-measurement.ts`, `adapters/reporting/metric-read.ts` | Collection has no matching optional lifecycle boundary; callers cannot assess value freshness |
| Central definitions still include domain measurements | Host Operations `agents/tech-lead/handlers/metrics-snapshot.ts` | Meaning and definition updates can have competing owners |
| Read-dedup warns that file content has not changed without checking it | `src/lib/tools/read-dedup-guard.ts` | A mechanical observation becomes an unsupported instruction |
| Executor implementation and registration are scattered | `src/app/codex-goal-*`, `daemon-agents.ts`, `src/lib/manager.ts`, `workflow-tool.ts` | Backend changes require navigating unrelated responsibilities |

The [architecture](../2a-design/architecture.md) owns the core/external boundary.
[Storage](../2a-design/storage.md) owns authoritative operations. This proposal
owns the implementation sequence; it does not replace those contracts.

## Responsibility and removal review

| Family | Keep or improve | Required behavior when absent |
| --- | --- | --- |
| Apps | Keep meaning, acceptance, prompts, and domain measurements with their App | Reject unavailable new work; preserve admitted obligations. Follow the existing drain/removal restriction |
| Conversation | Reuse the [state/handler extraction](storage-state-service.md#conversation-state-and-handler-extraction) | Chat may be unavailable; Requests, messages, links, and unrelated Tasks remain intact |
| Executors | Supply bounded execution and evidence through existing contracts | Required backend unavailable is visible; no silent substitute or false completion |
| Tools, skills, guards | Prefer useful guidance and precise action checks | Optional guidance/tools may disappear; a mandatory action check remains enforced or that action is unavailable |
| Schedules and observers | Keep timing, fact production, and work execution separate | No new timed input/facts; Task waits, cancellation, and required recovery remain operational |
| Interfaces | Admit through shared operations and present canonical reads | One unavailable channel cannot complete, reopen, or stop unrelated work |
| Metrics and reports | Own collection/projections outside core; retain evidence in existing storage | Missing/stale measurement is explicit; accepted results and canonical reads remain usable |
| Discovery and workspaces | Retain existing narrow contracts and tests | Failed reload retains the accepted generation; missing workspace support fails affected execution visibly |
| Maintenance | Retain bounded deterministic duties and single-flight behavior | Optional duties may stop. Task recovery and essential integrity work keep an explicit owner; disk growth is not acceptable indefinitely |

Deliberate absence at startup and supported reload are sufficient. Arbitrary live
unloading is not a goal. Events connect independent consumers; local reads,
execution calls, and atomic changes remain typed operations. Report-specific
SQL may stay with a bounded read model; authoritative writes use their owning
state operation. Sharing SQLite does not make every report part of core.

## Implementation sequence

| Slice | Value and cost | Review boundary |
| --- | --- | --- |
| 1. Observer lifetime | Prevent recurring stalls with a small runtime/SDK change | Deadline, cancellation, and ownership across reload |
| 2. Telegram lifetime | Keep a frequently used channel responsive; accept occasional display duplicates | Provider I/O, cleanup, and retry semantics |
| 3. Guard wording | Remove misleading guidance at minimal cost | Small independent correction; may land first |
| 4. Evaluation ownership | Remove duplicate policy/writes; requires a paired App change | Input/result contract and artifact compatibility |
| 5. Collection lifecycle | Make optional measurement removable and failure-contained | Composition, subscriptions, and cleanup |
| 6. Freshness and ownership | Make existing measurements useful and trustworthy | Additive reads, then one bounded App migration |
| 7. Executor layout | Reduce future navigation/change cost; defer broader extraction | Move concrete implementation without lifecycle changes |

Each slice has its own reviewable diff and sufficient proof. Independent small
fixes may proceed from current `main`; changes using the new Conversation state
API depend on #129 landing, or must show an explicit stacked base. The order
below is a priority order, not a requirement to prepare every slice at once.

### 1. Bound observer lifetime and preserve single-flight ownership

**Change:** Supply a cancellation signal through `ObserverContext` and add one
conventional observer deadline. Audit installed observers for compatible bounded
provider calls. Start with a proposed 60-second default, validated against those
uses; avoid per-App timeout configuration until an actual use needs it.

Keep in-flight ownership by stable App/observer identity across replacement.
On timeout, abort and report the original failure once; reject late facts.
On replacement or close, cancel retired work and prevent new work from overlapping
it. Release ownership only when the underlying callback settles. A callback that
ignores cancellation remains visibly unavailable until it settles or the process
is restarted; close must not wait forever or claim that the callback was killed.

This is cooperative cancellation for trusted App callbacks. It cannot preempt
synchronous CPU work. Keep expensive computation in the existing Task worker
path rather than adding an observer worker framework. Retry-safe observation is
recollected on an ordinary later scan; add no durable observer retry queue.

**Code and contract:** Keep the change together in `app-observer-runtime.ts`,
SDK `ObserverContext`, affected App adapters, and [Scheduling](../2a-design/cron.md).
Move the runtime and tests to `adapters/producers/app-observers.ts` after the
behavior is settled if the move keeps the review clear.

**Done when:** Controlled pending-callback tests prove deadline cancellation,
no overlap across scans/reload, rejection of late facts, recovery after actual
settlement, and close without new dispatch. A separate healthy observer and
admitted Task continue. Failure-publication failure remains contained.

### 2. Bound Telegram requests and own their cleanup

**Change:** Give the client an owned cancellation path and explicit request
deadlines. Proposed initial constants are 15 seconds for ordinary API requests
and 45 seconds for the existing 30-second long poll. Verify them with local
fixtures; keep them out of user configuration initially. Bot close cancels
requests, retry delays, and queued refreshes, and prevents new sends.

Preserve provider message IDs, chunk accounting, Conversation cursors, and exact
Stop controls. Cancellation or timeout does not prove that Telegram rejected a
send. Restrict plain-text formatting fallback to a confirmed formatting rejection;
do not immediately resend an ambiguously timed-out send as a formatting fallback.
The proposed display contract accepts occasional duplicate notifications: keep
the last confirmed Conversation cursor and let the existing refresh path retry
with bounded backoff. Reuse message identity/delivery evidence and report the
uncertain attempt honestly. Do not add a durable uncertain-delivery state machine
or stop all future messages to prevent an affordable display duplicate. Input
admission and Task actions still retain their exact deduplication guarantees.

Do not build a durable delivery queue or promise exactly-once display. Retry
polling through the existing bounded backoff. Process-wide networking settings
must have an explicit composition owner rather than running merely on import.

**Code and contract:** `transport/telegram-client.ts`, `telegram.ts`, and
[Telegram notifications](../2a-design/telegram-notifications.md). Split provider
I/O, runtime/input handling, and pure rendering only where these edits establish
the boundaries; preserve Console/control contracts.

**Done when:** Local HTTP fixtures cover stalled requests, long-poll allowance,
close during I/O/backoff, formatting rejection, ambiguous send outcome, and
no post-close sends. Existing chunk, refresh, authorization, ordering, and
turn-control tests pass; a failed channel does not affect Task settlement.

### 3. Correct the read-dedup signal

**Change:** Remove the unsupported claim that file content has not changed.
Keep the observed read count and advisory meaning. Do not add hashing, file
watching, or automatic blocks to preserve that sentence.

**Code and contract:** `src/lib/tools/read-dedup-guard.ts` and
[Guards](../2a-design/guards.md). This tiny independent fix can land at any time.

**Done when:** The warning states only observed facts, existing guard checks
pass, and rereading a changed file remains allowed. No new wording-only test
suite is needed.

### 4. Return evaluation ownership to the Evaluation App

**Change:** Inventory current browser callers and the Evaluation App's input
route. Reuse or extend that declared route for session evaluation and human
feedback. HTTP supplies validated session/line identities and user content;
the App owns evaluator instructions, append rules, artifact paths, and result
interpretation. Reuse existing Task/input identity for retry-safe generation.
For feedback, provide a stable submission identity and deduplicate appends at
the owning write boundary so a lost response cannot append twice.

Keep existing HTTP endpoints as thin adapters where useful. Specify admission
versus completion responses with the browser consumer: a receipt cannot claim
feedback was appended. Missing Evaluation must report unavailable without a
fallback file writer. Retain existing evaluation files and their read path.

**Integration:** This is a paired Host/Evaluation change. Prepare both revisions
and test them together. Introduce the compatible App route first, switch Host/UI
callers next, and remove any temporary compatibility only after callers migrate.
If the existing protocol cannot support that order, release the paired changes
together rather than land an incompatible half. Deployment remains separate.

**Code and contract:** HTTP handlers, `projects/evaluation.app`,
[HTTP boundary](../2a-design/http-boundary.md), and
[evaluation trail](../2a-design/session-eval-trail.md). This slice implements the
existing [authority follow-up](authority-boundary-simplification.md#remaining-work).
Extract touched routes from `server.ts` after ownership is clear; a wholesale
HTTP rewrite is outside this slice.

**Done when:** Fixtures prove exact admission/result semantics, duplicate-submit
behavior, retained artifact reads, invalid identity rejection, and unavailable
Evaluation behavior. HTTP contains neither evaluator instructions nor direct
evaluation writes. Chat, Task controls, and unrelated reads remain functional.

### 5. Give metric collection an explicit optional lifecycle

**Change:** Select and activate the current collector through reporting
composition, with owned unsubscribe/cancellation/close. Separate collector
installation from general daemon event setup. Keep default collection enabled
in shipped composition without requiring core runtime construction to install it.
Keep one snapshot cadence, existing due-sample checks, and keep-latest coalescing.

Definition/collector failure reports diagnostics but cannot reject an App
generation, stop unrelated work, or erase accepted results. No new work queue,
service registry, metric scheduler, or default investigation App is needed.
Existing core failure evidence remains available with collection omitted.

**Code and contract:** `daemon-events.ts`, `metric-source-measurement.ts`,
`composition/reporting.ts`, `adapters/reporting/`, and
[Metrics](../2a-design/metrics.md). Reuse the existing metric storage service.

**Done when:** A real runtime fixture omits collection and reporting while
executing Tasks and reading retained results. Failed initialization, one failed
source, and close during measurement are contained; no new collection starts
after close. Verify one trigger/cadence owner and no duplicate subscriptions.

### 6. Expose sample freshness and migrate one useful metric group

**Change:** Add a backwards-compatible last-successful-sample time to metric
reads, using retained snapshot evidence rather than definition-update time.
Derive freshness from the declared cadence; absent cadence means freshness is
unknown. Preserve the last successful value when a sample fails and expose
bounded collection-failure evidence through existing diagnostics. A missing
sample is distinct from a measured zero; definition status `active` is not health.

Inventory the remaining central catalog by owner. Retain Host measurements with
Host Operations; choose one demonstrably useful domain group to migrate to its
App. Remove its old registration/measurement in the same cutover. Preserve IDs,
history, sample meaning, cadence, and alerts when meaning is unchanged; changed
meaning needs a new ID or explicit migration. Do not expand the metric set.

**Code and contract:** SDK `MetricView`, the metric service/read projection,
affected consumers, Host Operations catalog, the selected App, and
[Metrics](../2a-design/metrics.md). Follow the existing
[ownership migration rule](design-implementation-convergence.md#remaining-metric-ownership-migration).
Separate freshness and the paired App migration into distinct PRs if neither
requires the other.

**Done when:** Controlled-clock and retained-data tests distinguish fresh,
stale, never-measured, failed, and measured-zero cases. Updating a definition
cannot refresh a sample. Old consumers tolerate added fields. The chosen metric
has one active definition/measurement owner after restart and App reload; its
history and meaning remain intact.

### 7. Organize executor implementation where it pays back

**Change:** Group `codex-goal-*` implementation and tests under
`adapters/executors/codex-goal/`. Move concrete executor registration and retained
binding migration selection from general agent preparation into execution
composition. Preserve executor names, binding files, legacy aliases needed by
unfinished work, and daemon/worker wiring.

Keep the existing shared model/tool execution path. Splitting `manager.ts` or
`workflow-tool.ts` is a later choice only when an actual change demonstrates a
useful responsibility boundary. Do not remove workflow resume or change stored
run semantics during this organization work. Affordable-redo changes require
their own workload/cost and external-effect review.

**Done when:** Core has no concrete backend import; daemon and isolated worker
select the same backend behavior. Existing cancellation, result fencing,
unavailable-backend, restoration, and retained-binding tests pass. Imports and
entrypoints resolve in the built image. No forwarding wrappers or second
executor registry remain solely to conceal the move.

## Proposed code layout

This extends existing homes. Create directories as their owning slice lands,
move tests with implementations, and update source navigation at that time.
Existing `src/lib` services stay where they are unless a separate useful
extraction is justified.

```text
src/app/
  core/                         stable admission, state, events, work runtime
  conversations/                context, agent selection, turn handling
  adapters/
    discovery/                  conventional App sources
    executors/
      managed-agent.ts
      workflow.ts
      session-recovery.ts
      codex-goal/                backend implementation and tests
    producers/
      app-schedules.ts
      app-observers.ts
    workspaces/git.ts
    maintenance/                existing deterministic duties
    reporting/                  collection and bounded report projections
  transport/
    console.ts
    socket.ts
    telegram/                   client, runtime, rendering as separated
  http/
    server.ts                   server setup and route wiring
    routes/                     extracted thin resource/feature endpoints
    read-model/                 existing bounded report queries
    live.ts                     websocket transport if extracted
  composition/                  concrete selection, activation, cleanup

packages/sdk/                   App and executor contracts
packages/control/               client protocol and transport helpers
packages/terminal/              Console client
packages/webui/                 browser client
projects/<id>.app/              domain declarations, policy, agents, workflows
```

Use ordinary imports and narrow functions. Core cannot import concrete adapters
or conversational policy; composition may import both sides. A provider module
must not change process settings, subscribe, or start a timer merely on import.
Reuse existing lint boundaries and add targeted checks only for an extracted
boundary. Different capability families retain their own contracts.

## Review, verification, and stopping

Review each slice against four questions: what useful failure does it prevent;
what simpler alternative was considered; what happens on failure/removal; and
what state or behavior must survive the change? The numbered slices state the
proposed decisions. Reviewers should settle the timeout defaults, Telegram
uncertain-delivery behavior, paired Evaluation contract, and chosen metric
group before implementing their dependent behavior. These are design choices,
not a new runtime approval framework.

Use a separate, independently reviewable PR for each cohesive fix. Pair Host/App
revisions where needed; group file moves only with their demonstrated boundary.
Keep the shared checkout on `main` and isolate implementation work. Before a
Host PR is ready, use the repository-pinned tools, frozen install, full
`bun run ci`, and current-revision Quality/Container checks. Run affected App
tests and `bun run check:may-design` for paired contract changes. Local fixtures
must not depend on a live installation, credentials, or model calls.

Final review uses existing boundary coverage plus the new regressions; do not
build an exhaustive matrix of every optional combination. Confirm Task-only
operation, another healthy channel/producer, retained accepted results, and
supported removal/reload. Recheck runtime readiness and control responsiveness
where the changed callback shares their process. No performance improvement is
claimed without measurement; a passing deadline test is not network reliability
proof.

Stop after a slice satisfies its acceptance criteria. Discovery, schedules,
Git workspaces, the Console/control protocol, skills, and maintenance need no
general rewrite based on this review. App merging, a new error-investigation
system, a generic plugin framework, exact delivery, precise workflow recovery,
and live deployment remain outside this plan. Further work needs an observed
remaining problem or a benefit worth its total cost.
