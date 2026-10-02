# Simplify the system: fewer paths, clear owners

**Supports:** [Host And App Boundary](../2a-design/system-boundary.md). Removes competing execution and state paths to reduce operational and change cost.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Task/HTTP, caller-feedback, script-retirement, event-delivery and
checkpoint/tool-state cleanup are merged. The September 27 repository-wide
cleanup is merged through Host `b79a693f`; see its inventory below. Workflow redo
and provider-facing delivery still need their separate evidence.
**Reviewed:** September 27, 2026: source review at Host `0ddad3aa`, then merge
verification at `b79a693f`. Earlier dated findings
and candidate checks below remain historical evidence, not a fresh backlog or
proof of the deployed release.

Make ordinary conversation and authorized work easier to understand, change and
operate at acceptable total cost. Directory organization now has an explicit
user goal: make component ownership and execution paths easy to review. Proceed
with that work independently of conditional behavior reductions. Follow the
[value/cost rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff).
One existing proposal owns this review; subsystem contracts and implementation
plans remain with the owners linked below.

## Current implementation plan

Keep one owner for work and one authoritative home for evidence. Remove a
duplicate decision or state copy when doing so fixes a demonstrated problem;
do not build another coordination framework or delete useful recovery merely
to reduce the line count.

| Area | Current disposition |
| --- | --- |
| Shared execution and ownership | Conversation already executes through one stable Task in merged #158; child-wait retirement, component layout and core policy cleanup are also merged. Do not repeat those changes. |
| Task outcome names, vocabulary and execution path | [#168](https://github.com/hao1939/may-agent/pull/168) integrated [#170](https://github.com/hao1939/may-agent/pull/170) and [#171](https://github.com/hao1939/may-agent/pull/171), merged as `c0cbb59e`. Preserve its paired App contract and retained-state verification; do not reimplement the stack. |
| Session review UI ownership | [#173](https://github.com/hao1939/may-agent/pull/173) integrated in `c0cbb59e`: HTTP-owned generation and inline feedback writes were removed; historical notes and the existing Evaluation App action remain. This deliberately gives up inline corrections, without claiming an equivalent replacement. |
| Independent tool-state cleanup | Merged in #198 as `28670dd2`: retained checkpoint numbering, one test declaration and removal of obsolete CLI reuse discovery. The [candidate evidence](#independent-tool-cleanup) is historical; do not reimplement it. |
| Caller feedback and retired experiments | #169 merged as `b1c7cbef`; #174 merged as `649d801c`. Preserve caller reports and the supported checks without restoring `scripts/poc/`. |
| Duplicate event delivery | #175 merged as `e38d2861`. Retain exact per-Task delivery identities; [Events](../2a-design/execution-feedback.md#duplicate-delivery-and-safe-reconsideration) owns the common contract. |
| Workflow redo, model-quality comparison and App-owned delivery | Deferred experiments with the explicit evidence/authority requirements below. They do not block the independent cleanup or authorize deployment. |

Continue from the merged September 27 cleanup. Preserve the
already merged execution, Task and checkpoint contracts during integration.
The historical sections below explain prior decisions. The table above and
[remaining work](#remaining-work) are the current plan.

## Current contract

| Question | Owning document |
| --- | --- |
| When can May work directly, and when does it need a Task? | [System Model](../2a-design/system-model.md#a-turn-or-a-task) |
| How do conversation, exact Task links and follow-through work? | [Message Lifecycle](../2a-design/message-lifecycle.md) |
| Who owns domain policy and acceptance? | [Host/App Boundary](../2a-design/system-boundary.md) |
| How do attempts, waits, cancellation and recovery preserve work? | [Task Resource Engine](../2a-design/task-resource-engine.md) |
| Which capabilities can be replaced or removed? | [Stable core proposal](task-runtime-organization.md) |

May may investigate, edit, verify and answer in an authorized bounded turn.
Continuation uses an ordinary Task. The responsible App accepts its own
outcome; May's follow-through retains exact links without taking over that
acceptance. This proposal does not redefine those contracts.

The [review history](../archive/reviews/authority-boundary-history-20260909.md)
preserves the incident analysis, earlier alternatives, source revisions and
scoped authorization record. The [September 6 pilot](../archive/reviews/authority-boundary-pilot-20260906.md)
records the exercised lifecycle, wait and restart cases. Neither establishes
the current deployed release or completion of provider-facing delivery work.

<a id="design-choices-before-code-moves"></a>

## Independent feature reductions

Removing duplicate execution, waiting, recovery or write paths can reduce
behavioral complexity. Directory organization separately reduces the effort of
reading and reviewing the code. That value justifies the next layout milestone;
these conditional deletions are not prerequisites for moving existing modules.
Neither source moves nor these proposals establish measured bug reductions.

| Choice | Complexity potentially removed | Accepted cost and next decision |
| --- | --- | --- |
| One durable delegation path: Task handoff | Conversational child-request creation, waiting, result aggregation, reconsideration and their recovery combinations | Long work is linked to a Task and reported in a later turn; retire old frontend waits with a visible failure, preserving accepted asks and admitted work |
| Evaluation UI keeps supported reads; unsupported generation/editing is removed | HTTP-owned evaluation prompts and feedback writes, plus controls and tests for those operations | Lose inline/line-specific convenience; establish whether existing Conversation/App operations satisfy actual review needs |
| Cheap interrupted work starts a fresh attempt from current evidence | Eligible workflow step-reuse/session-resume paths and their matching/fallback cases | Extra compute and delay; examine one real workflow before choosing any deletion |

### 1. One durable delegation path

Keep the human interaction simple:

```text
human input -> bounded turn with as many useful model/tool steps as needed
  -> answer directly, or explain and admit linked Task work
  -> end the turn; later Task facts support a new reply or follow-up
```

Discussion remains interactive. A Request records the accepted ask; a Task owns
independent work; neither requires keeping the original turn alive. Task admission
must commit before claiming the handoff succeeded. Failure to admit leaves an
honest failure and the accepted ask open. Long work can still involve multiple
Apps through existing Task dependencies and ordinary bounded calls.

**Decision accepted September 11:** Remove the conversational child-wait
protocol. The user accepts losing automatic aggregation by the original turn
in exchange for one simpler conversational path. Keep direct Task handoff and
Task-to-Task/App dependencies.

The old protocol makes an inbox row another coordinator:

```text
old:    human input -> parent inbox P -> agent returns dependencies
          -> child inbox C1 -> Task T1
          -> child inbox C2 -> Task T2
        P waits on children:P, then invokes the agent again to review results

kept:   human input -> agent answers or admits one responsible Task -> finish P
        accepted Request stays open when an answer is still owed
        linked Task facts -> later conversation or ordinary follow-up Task
```

The old wait releases model execution and capacity, but still needs child IDs,
joined waits, result collection, re-entry, duplicate-work checks and restart
handling. Direct handoff puts ongoing execution on the Task that owns it.
Discussion stays interactive, and one Task can coordinate work across Apps.

**Retained state:** During database upgrade, mark unfinished conversational
child waits as failed input handling with a clear explanation. Cover dormant
aggregate waits, exact App waits, reclaimed parents with children, and saved
child-delegation decisions. Clear scheduling and lease ownership, fence stale
claims, and retain the original wait/session identity and saved decision as
evidence. Do not resume the parent agent or create replacement work.

Keep completed inputs, accepted Requests, child inputs, Tasks, accepted results,
Topic/Task links and history. Already admitted child work continues independently;
the migration does not cancel it or close the accepted ask. Expose the failure
alongside any earlier acknowledgment. A new human turn can inspect the preserved
work and decide whether to continue, revise scope, or close the ask. Automatic
aggregation by the old parent is intentionally given up. No drain service or
second compatibility executor remains.

**Source change:** Use `ConversationTurnResult` and one result schema for every
frontend declaration. Remove conversational `dependencies`, child-result context,
creation/join/wake code, the extra prompt/tool-profile branch, and their obsolete
tests. Deprecated result names remain aliases of the same restricted contract;
child-specific SDK types are removed. Existing Apps using those removed fields
must adopt `followUp` before upgrading. The current `may.app` declaration already
uses direct handoff, and the scoped App source search found no consumers of the
removed types or context fields. This is source evidence, not an installed-state
or third-party compatibility guarantee.

Keep the direct handoff's bounded recheck when a selected Task becomes terminal
while the agent is deciding. Accepted Request revision fences, exact Task
controls and Task-to-Task dependencies also remain.

**Proof:** A long handoff leaves chat responsive; failed admission cannot claim
delegation; duplicate/restarted handoff retains the same Task; an interrupted
answer does not lose an open ask; the final Task outcome remains available for
its owed explanation. The existing
[storage slice](storage-state-service.md#candidate-review-and-landing-order)
owns the transactional extraction and its tests.

### 2. Reduce evaluation UI obligations

`http/server.ts` constructs evaluation instructions and directly appends feedback
to a trail. The [current contract](../2a-design/session-eval-trail.md) records that
the Evaluation Task drops the selected line/instructions and does not generate
that requested trail. Moving these handlers would preserve a partially working
feature and its maintenance burden.

**Recommendation:** Prefer historical trail reads and supported App review
operations. Before removing generation/comment controls and their write routes,
inspect known callers and check whether a concrete whole-session or line-specific
review can be expressed adequately through existing Conversation/App input.
Do not claim the alternative preserves inline editing or exact line attribution
unless it does. If that convenience is valuable enough, retain it with one
App-owned writer instead. The
[external plan](external-components-simplification.md#conditional-follow-ups)
owns this decision and the paired HTTP/UI/contract change.

**Proof:** Retained trails remain readable; disabled operations return unavailable
and the UI offers no false saved/generated state. Removing the feature must not
remove unrelated summary evaluation, metrics or ordinary conversation.

### 3. Prefer affordable redo where it actually deletes a path

Task restart already uses persisted identity and current evidence rather than
resuming a JavaScript stack. That is an existing benefit, not a new saving.
However, `src/lib/workflow-tool.ts` still offers `resume` and can reuse completed
steps or resume child sessions. These paths warrant a separate cost review.
The separate workflow tool's reuse path must not be confused with ordinary Task
restart; removing it may save little on the common Task path.

**Recommendation:** Inspect one frequently used, bounded workflow. Compare fresh
execution from Task input/evidence with its present reuse behavior. Favor redo
when the discarded work is cheap and effects can be checked or safely repeated.
Preserve accepted Task progress, results, transcripts and artifact references.
For expensive work, one explicit coarse checkpoint may earn its cost; keep
useful existing reuse when that is cheaper than replacing it.

Rerunning a workflow can repeat code between agent steps even when step results
are reused. Neither resume nor Task idempotency proves external-effect safety.
Before a replacement attempt, establish that the old execution has stopped or
is adequately fenced. Read provider state or use its idempotency mechanism for
consequential operations. If an earlier effect remains uncertain, expose attention
for an App/human decision instead of blindly repeating it. A prior terminal
session is evidence, not automatically an accepted Task result.

Estimate interruption frequency times discarded effort over the feature's likely
lifetime, plus failure loss, against implementation and ongoing maintenance cost.
If new and old execution paths would both remain indefinitely, claim no deletion
savings. This is a conditional experiment, not a new recovery-mode setting or an
instruction to remove all resume APIs.

**Proof:** Interrupt the selected fixture around meaningful steps and an uncertain
effect; verify retained identity, stopped-work behavior, accepted evidence and
the absence of an unsafe duplicate action. Measure redo cost for that workload.
Update [workflows](../2a-design/workflows.md) and the
[Task engine](../2a-design/task-resource-engine.md) only with the selected change.

## September 12 codebase cleanup review

**Status:** Original findings at #164, now triaged by the
[current implementation plan](#current-implementation-plan). The original review
changed no Host source; the independent implementation is recorded below.
This extends the [48-file scripts review](poc-retirement-and-knowledge-20260912.md)
to `src/`, `packages/`, `test/` and `container/` at Host #164. These areas contain
614 tracked files, including 284 test files. Inventory, relative-import and
identifier searches covered those areas; manual review focused on runtime/state
boundaries, HTTP policy, compatibility APIs, tool state and type declarations.
This is a focused review, not a line-by-line audit of every file.

There is useful cleanup, but no demonstrated large pile of unreachable source.
The relative-import scan found references to every production `src/` module
except the known binary entrypoint. Re-exports and test/dynamic callers can hide
unused code, so that observation neither proves every export is useful nor
justifies deleting modules by filename. Much of the old inbox execution has
already been removed; current inbox code admits input and projects exact results.

### Concrete candidates

| Priority / candidate | Evidence at this revision | Proposed change and verification |
| --- | --- | --- |
| First: checkpoint counter ownership | [`checkpoint.ts`](../../../may-agent/src/lib/tools/checkpoint.ts) keeps a process-wide `stepCounters` map keyed only by session ID. Its exported cleanup hook has no caller in tracked Host code. An isolated invocation of the real tool in two fresh state roots with the same session ID wrote first steps **1 and 2**, demonstrating shared state. | Give counters an explicit session/state-root lifetime or derive numbering from retained checkpoints. Preserve numbering across any supported resume/recreated-tool path. Exercise separate installations, repeated sessions and teardown. Update the existing checkpoint tests to use temporary roots; their current fixed source-directory fixture should not become shared test state. Deleting the unused cleanup function alone would leave the problem. |
| First: duplicated Bun test declarations | At #164, `src/types/bun-test.d.ts` and [`packages/sdk/src/bun-test.d.ts`](../../../may-agent/packages/sdk/src/bun-test.d.ts) are byte-identical, 11-line declarations exposing all test APIs as `any`. There are also separate minimal Bun runtime/SQLite declarations. | Keep the SDK declaration: its standalone target includes it and the Host already includes `packages/`. Delete only the redundant Host copy; add no new dependency or ambient declarations. Run Host/SDK type checks and the SDK export-contract test. Existing `any` declarations remain a limitation, not improved Bun type coverage. |
| First: misleading private lifecycle name | [`stopAppTask()`](../../../may-agent/src/app/core/tasks/app-task-reconciler.ts) accepts an unsuccessful outcome and schedules retry. Its production caller is in the Task runtime. Actual attempt Stop and owner closure are separate operations; the Task README already has to explain the mismatch. | Rename the private operation to describe recording an unsuccessful outcome, and update its caller, tests and navigation. Preserve persisted `stopped` values and SDK compatibility in this slice. Existing stale-result, backoff, closure and public Stop tests must still exercise distinct behaviors. |
| Small API cleanup: obsolete advertised CLI option | [`run-cli-agent.ts`](../../../may-agent/src/lib/tools/run-cli-agent.ts) advertises `reuseSession`, while [`cli-agent.ts`](../../../may-agent/src/lib/cli-agent.ts) rejects implicit reuse without an exact native session ID. No use was found in the scoped current App/Gym/agent configuration and workflow search. | Stop advertising the obsolete option after a final caller check; retain the explicit `resumeSessionId` operation and a clear rejection at the compatibility boundary. Update schema/documentation tests and preserve native-session identity, cancellation and result-evidence tests. This removes an unnecessary model-facing choice, not native resume support. |
| Largest feature simplification: HTTP/Evaluation ownership | [`http/server.ts`](../../../may-agent/src/app/http/server.ts) constructs evaluation prompts and appends human feedback directly. [`sessions.js`](../../../may-agent/packages/webui/static/pages/sessions.js) calls these endpoints. The current [Evaluation App](../../../evaluation.app/app.ts) maps the request to a Task whose input retains session ID/correction fields, dropping the requested focus line and instructions. | Resolve the existing [evaluation feature decision](#2-reduce-evaluation-ui-obligations): retain historical reads and either remove the unsupported write controls/routes or supply one App-owned implementation. Compare a concrete line-review/human-correction journey before selecting removal. A route extraction alone preserves the incomplete behavior. Verify retained history, honest admission/completion reporting and the served UI together. |
| Coordinated cleanup: legacy imports, aliases and ignored configuration | [`requests.ts`](../../../may-agent/src/lib/requests.ts) is a DB re-export facade whose introductory comment still describes sessions/events as work tracking. A [tech-lead helper](../../agents/tech-lead/handlers/testing.ts) imports it. A [current workflow](../../agents/tech-lead/workflows/platform-owner-review.ts) imports deprecated `taskOwnerResultSchema`. Agent definitions still declare `context_files`; Host loading maps these into `contextFiles`, with no production reader of that property found. Tool-call arguments also named `context_files` have real consumers and are a different contract. | Prefer owning DB modules in changed internal code and correct the facade's misleading description. Migrate actual sibling imports before deleting the facade or SDK aliases. Resolve the ignored agent configuration through the existing [context/adoption review](agent-behavior-and-capability-extension.md), verifying what reaches execution before removing fields. Preserve the working tool-call context arguments. |

The first three candidates can be reviewed independently. The checkpoint change
is a correctness fix with a small simplification; the type and naming changes
reduce maintenance ambiguity. The CLI schema cleanup has a compatibility check.
Evaluation scope and sibling API migration need their existing owners and paired
changes, rather than being folded into a mechanical deletion PR.

### Independent tool cleanup

**Candidate:** `fix/authority-tool-state-20260912`, based on `f6a11d1c`.
The September 12 record reports local implementation and focused checks; full
CI and publication evidence were pending. September 18 source inspection at
`dd548cab` still finds the global checkpoint counter and advertised `reuseSession`
option. This candidate has not landed; refresh it and its checks before calling
it ready.

- The checkpoint log, scoped by state directory and session, owns its step
  numbers. Each save takes the highest retained valid step plus one. A fresh
  installation starts at one; a recreated tool or restarted process continues
  the same evidence. Previously reset numbers are retained, not rewritten.
  Remove the process-global map and its unused cleanup hook.
- Accept reading this small, coarse-progress log on each save instead of adding
  a cache and another lifecycle. Read and append are synchronous under the
  existing one-executing-writer-per-session assumption. This is not a new
  cross-process multi-writer lock, external-effect receipt or exactly-once write
  guarantee; it does not change Task acceptance or workflow resume.
- Checkpoint tests use fresh temporary roots and close their databases. Four
  regressions failed before the change: cross-installation leakage, process
  restart reset, numbering below retained history, and consuming a step after
  a failed write. The existing dynamic-session test also exercises switching
  away and back; recreated and still-live tool objects share persisted evidence.
- The SDK's existing test declaration serves both compilation targets. Broader
  Bun typing remains separate; no new `any` or dependency is introduced.
- The model-facing CLI schema offers explicit `resumeSessionId` only. Existing
  raw legacy calls still get the runner's clear rejection for implicit reuse.
  Native resume, cancellation, identity and evidence behavior remain unchanged.

Focused verification: 44 checkpoint/preparation/recovery tests and 32 native CLI/
SDK-export tests pass. The CLI schema assertion also failed before removal.
No model call, installed-state edit or deployment was needed.

### Large modules: organize by responsibility

The largest production files include HTTP server (3,886 lines), Task reconciler
(3,755), Task runtime (3,206), session manager (2,492), and workflow tool (2,046).
Size identifies review effort, not unused behavior.

The HTTP server is the clearest organizational slice: extract cohesive project,
session/evaluation and transport/static-serving handlers under its existing
`http/` home, with explicit dependencies and the current route contracts. Start
with one family after its feature decision. Do not introduce a new router or
service framework merely to distribute the lines.

For Task/runtime files, retain one owner for each claim, result acceptance,
transaction and publication/rollback boundary. Move cohesive private helpers
only where they reduce shared context or duplicate decisions. The current Task
and inbox READMEs already identify those owners; use their tests and source map.
Do not recreate the removed inbox executor, or unify dispatch backoff with
attempt backoff: one retries dispatch/storage, the other may execute model work.
The [existing runtime plan](task-runtime-organization.md) owns these extractions.

### Retain until the relevant evidence exists

- Keep old-state conversion and historical readers until the supported upgrade
  window is deliberately retired. Fresh-source success does not prove old
  retained Tasks, input links or receipts can be discarded.
- Keep the direct-agent adapter while Gym calls it; the scripts proposal records
  the paired migration. It is a bounded executor, not proof of a second durable
  Task owner.
- Keep workflow reuse pending the existing cost/effect comparison. Native CLI
  resume, workflow step reuse and Task recovery solve different problems.
- Preserve file-backed, concurrent-connection, worker-death and restart tests.
  Sharing assertions or similar fixture shapes does not make those guarantees
  interchangeable. Use the existing [test coverage map](../../../may-agent/test/README.md).
- Refresh stale implementation-status passages when landing the affected slice.
  The September 12 review found Architecture still describing separate
  Conversation execution; that passage now reflects the shared Task handlers.
  Do not use an older status paragraph to reimplement completed cleanup or infer
  deployed state.

**Validation:** The checkpoint reproduction called production code with synthetic
inputs and two temporary directories, then closed databases and deleted those
directories. No model calls, installed-state operations or deployments ran.
The counter result is evidence of shared in-process state, not a measured memory
growth rate. Declaration equality and named caller checks are source evidence.
Documentation links and design checks are validated separately; no full Host CI
or behavior-preserving extraction is claimed by this review.

## Smaller organization changes worth keeping

#129 already gives core state and the conversational frontend separate homes.
Build on its reviewed result. Paths below are relative to the Host checkout.

| Change | Smallest sufficient implementation and useful proof |
| --- | --- |
| Remove shared inbox assumptions about `may` | Composition selects the foreground App, with May as the shipped default. Shared capacity consumes that selection; conversation status wording and follow-up suppression belong with the frontend/App policy. Test a differently named frontend and an omitted frontend without losing background progress or the interactive reserve. No user-facing scheduler configuration or App-renaming migration is required. |
| Break the internal barrel-import cycle | `lib/index.ts -> agent-loader.ts -> loader/toolset-loader.ts -> lib/index.ts` becomes direct imports from owning modules. Keep public SDK/control exports. Prefer `lib/db/connection.ts` over the historical `lib/requests.ts` facade in touched code; remove the facade only after its callers are gone. |
| Make the attempt path readable | In `app-task-runtime.ts`, make claim, prepare/execute, verify, commit and publish easy to follow. Extract a cohesive helper when it reduces shared context; leave atomic mutation and stale-result checks with their owner in the reconciler/state code. Run the existing race/cancellation tests when these boundaries move. |
| Group retained HTTP/backend implementations | Group existing route families under `http/` and backend files beside their executor family, independently of feature removal. Use ordinary imports, not a new router/plugin/service framework. |
| Shorten navigation | Give each component its responsibility, contract, implementation/wiring and owning tests. The #138 source map is 102 lines; link detailed contracts rather than growing another design explanation. |

The resulting ownership is straightforward:

```text
core/          admission, state consistency, Task/event/timing mechanics
conversations/ selected conversational context and turn handling
adapters/      concrete executors, producers, discovery, reporting, workspaces
composition/   defaults, selection, activation and cleanup
transport/, http/, client packages  input and presentation
owning App     domain decisions, acceptance and situational repair
```

Foundational database primitives stay in `src/lib/db/`. Move the remaining flat
families into their existing component homes so reviewers can find the whole
responsibility together. Use existing ESLint import rules; no dependency-analysis
service, service framework or uniform folder template is needed.

### Core policy cleanup

**Status:** Merged in [Host #144](https://github.com/hao1939/may-agent/pull/144)
as `8e242c11` on September 11, from reviewed candidate `7d80cc45`.
Deployment remains separate.

The core/external review found two small policy leaks and unnecessary imports.
Use the existing boundaries instead of adding another extension mechanism:

- Composition supplies one conversational App identity to both event admission
  and inbox dispatch. Core enforces durable admission for that selection without
  naming May. The comparison includes the canonical `.app` alias; unrelated
  direct-agent input remains available.
- Remove the obsolete recovery owner-review fallback and notification helpers.
  Its selector followed a synchronous repair pass that already requeued every
  matching legacy attention record. Keep that repair, exact Task/generation,
  prior evidence and its existing observational event. Other blockers retain
  attention. No new App input, event type or recovery decision is introduced.
- Put the unchanged persisted recovery-owner constant beside the session-binding
  contract. Executor adapters import it without loading the reconciler. Core
  database callers use the connection module directly.
- Extend existing import restrictions to prevent core from regaining App-input
  helpers or the database compatibility facade, and prevent executor adapters
  from importing lifecycle/state mutation implementations. Type-only imports
  remain allowed; they confer no execution authority.

Regression coverage reopens legacy state with and without old notification
metadata, runs startup recovery twice, preserves an unrelated domain blocker,
and completes the same repaired Tasks without an owner-review input. Admission
coverage selects a differently named conversational App and omits it entirely.
This is a source cleanup; no App schema migration or new runtime service is needed.
Larger runtime/reconciler and HTTP file splits remain separate work.

Validation at `7d80cc45`: full local CI passed with 2,687 tests passed, three
installation-only skips and zero failures; browser coverage ran. Committed ESLint
tests verify forbidden value imports, allowed contract/type imports, focused
database imports and composition/test exemptions. The alias regression
reproduced a bypass before the fix; the focused admission/lint suite passes all 21 tests.
Canonical design integrity, examples and App checks passed against this source.
Hosted Quality and Container checks passed on `7d80cc45`. No installation or
model-backed test ran.

### Directory organization for code review

**Status September 11:** Core/composition moves merged in
[Host #141](https://github.com/hao1939/may-agent/pull/141) as `48254267`.
Concrete Codex/observer grouping in [#142](https://github.com/hao1939/may-agent/pull/142)
merged as `427d4ea1` from candidate `b8297fad`.
The rebase and merge preserve the previously tested tree exactly.
It does not depend on retiring child waits, evaluation controls or workflow resume.
The intended reading order is composition -> inbox -> Task runtime -> state,
then the concrete capability involved.

| Existing family | Destination and reason |
| --- | --- |
| `app-task-*` runtime/capability, reconciler, recovery, context, emitter, condition, state-type and snapshot helpers (resource store below) | `core/tasks/`: keep the attempt and reconciliation path beside its controller and queue |
| `app-inbox-host.ts` | `core/inbox/`: generic admission, claims, ordering, Stop and dispatch beside the input-handler contract |
| `app-inbox-store.ts`, `app-event-admission-store.ts`, `app-task-resource-store.ts`, `task-reference-index.ts` | `core/state/`: persistence implementations beside existing coordinated state operations; preserve one database and the same transactions |
| `host-capacity.ts` | `core/scheduling/`: one shared capacity mechanism for inbox decisions and Task attempts |
| `app-inbox-runtime.ts` | `composition/`: this module wires routing, producers and concrete conversation behavior; moving it wholesale into core would hide that dependency |
| `task-admission-process.ts`, `task-attempt-process.ts` | `composition/workers/`: process entry points construct concrete registries, executors and persistence |
| `codex-goal-*.ts` | `adapters/executors/codex/`: keep this backend's client, packet, progress, result and executor together |
| `app-observer-runtime.ts` | `adapters/producers/`: observers beside existing schedule production |
| Retained HTTP route handlers | Existing `http/`, grouped by route family when extracted from `server.ts`; server setup continues to wire ordinary handlers |

Keep `conversations/` for frontend context, turn handling and presentation;
`loader/`, transports and client packages already have useful homes. Preserve
existing exported names in the first moves. Move colocated tests with their
implementation, update all callers and entry-point paths, and leave no forwarding
files at the old internal paths. A mixed module gets an honest composition home;
its size alone is not a reason to invent another interface.

Each component gets a short reading map: responsibility, entry point, important
state changes and owning tests. Update the central source map and canonical
source links with each move. Directory cleanup must not silently alter storage
formats, input/result schemas, recovery behavior. Feature retirement has its own separate diff.

## Limits that keep the system simple

| Tempting change | Decision for this proposal |
| --- | --- |
| Combine Turn, Request and Task into one status | Keep the distinct facts: execution ended, the accepted ask was addressed, and background work finished. Combining them would reintroduce false fulfillment. |
| Drop leases, identity fences, atomic writes or worker isolation | Keep these safeguards. They address duplicate ownership, stale results, partial commits and unresponsive execution; replaying cheap work does not replace them. |
| Remove every workflow-to-agent handoff | Defer. Gym source contains `needs-agent` consumers, and workflow verifiers still apply after handoff. A blanket deletion is not justified by file size; audit actual callers before proposing an App-owned replacement. |
| Replace existing atomic App reload with a restart-only Host | Defer. The supported reload boundary already has consumer/rollback tests; operational savings have not been established. New optional capabilities can start with omission/draining/restart rather than seamless live replacement. |
| Guaranteed cross-channel display or seamless turn steering | Keep the accepted limits: canonical reads recover missing presentation, Telegram sends are best effort, and Stop followed by a correction is the initial redirection path. These are existing simplifications, not new work. |
| Turn every local operation into an event/API-server request | Keep SQLite transactions and typed local calls. Events remain the integration contract for meaningful inputs, changes and independent observers. |

## Recommended next milestone

1. Refresh the unmerged independent tool cleanup against current `main`, then
   repeat its regression/full-CI checks before review and integration.
2. Preserve the merged Task/HTTP stack, caller reports, script retirement and
   event-delivery fixes. Their source work is complete, not a new backlog.
3. Select any further HTTP extraction by responsibility after the feature
   decision, rather than splitting large files merely for their size.
4. Leave workflow redo and provider-facing delivery at their explicit evidence
   gates. Completing this source milestone does not authorize a live rollout.

For every source slice, run the existing affected tests and full Host CI,
including subprocess and browser coverage where paths change. Do not add a
parallel framework or rewrite algorithms during file moves. Reviewer acceptance
is concrete: one obvious home per responsibility, a traceable execution path,
updated references and no behavior change. A source map alone does not complete
the directory milestone.

## Implementation evidence

The import/navigation and foreground-selection milestone landed as two
independent Host PRs: #138 as `ca6c9d7f`, and #139 as `b725f546` on September 11.
The table records their earlier local implementation checks; later review
follow-ups are included in the merged revisions. Deployment remains separate.

| Slice | Result and evidence |
| --- | --- |
| [#138](https://github.com/hao1939/may-agent/pull/138) — import ownership and source map | Loader imports owning modules directly; ESLint prevents reintroducing the barrel cycle. Public exports remain. The map is 102 lines; review corrections make module paths explicit. Frozen install and full local CI for the runtime change (`8a95827c`): 2,677 pass, three installation-only checks skipped; browser checks ran. |
| [#139](https://github.com/hao1939/may-agent/pull/139) — foreground selection and conversation presentation | Composition selects `conversationAppId`, with May as the shipped default. Shared scheduling uses that selection. `conversations/task-status.ts` owns waiting text, message identity and follow-up self-wake suppression. The safeguard follows the owning Conversation even when selection changes or is omitted; other Apps still receive Task facts. 52 focused checks and full local CI passed: 2,681 pass, three installation-only checks skipped; browser checks ran. |

Omitting selection uses background capacity with the existing reserve, an
accepted utilization cost that avoids another capacity mode. This does not rename
an installed App or change turn-handler declarations. Existing cancellation,
Task attachment and accepted Requests remain in place. Those two PRs did not
retire child waits; that change is isolated in #140.

The accepted retirement is implemented in [Host #140](https://github.com/hao1939/may-agent/pull/140),
merged as `335bf178` from reviewed candidate `f050b1a3`. It removes the frontend child protocol
and upgrades retained parents to visible failed handling while preserving asks
and admitted work. Frozen install and full local CI passed: 2,682 tests passed,
three installation-only checks skipped, zero failures; browser coverage ran.
Two new storage regressions cover file-backed restart, exact/aggregate/reclaimed/
saved waits, stale claims, unchanged Task evidence and continued Task execution.
The canonical design check passed against that SDK. This is source/fixture
evidence; deployment remains separate. Directory moves are not part of #140.

Child-wait removal was accepted as a separate source change. The earlier
#138/#139 scope above did not include it. At that review, the reductions below
remained deferred. The later #173 change, merged through #168, superseded the
Evaluation recommendation by explicitly removing inline writes; workflow redo
still lacks its workload proof.

- **Evaluation UI:** The shipped session page is a caller of both generation and
  comment routes. Comments currently append usable line-attributed evidence;
  generation drops requested line/instructions downstream. A replacement for
  that feedback path has not been demonstrated, so deleting both would discard
  working capability without the promised user-path proof. Keep this as a paired
  HTTP/UI/App decision, preserving historical reads and summary metrics.
- **Workflow redo:** The separate workflow tool still offers step reuse and
  child-session resume. Ordinary Task restart already uses fresh attempts, and
  no concrete workload establishes a worthwhile saving from deleting reuse.
  Keep existing paths until redo cost and effect safety have been measured.

These were explicit deferrals under the value/cost rule at that revision.
The core/composition directory candidate moved 42 files with their tests,
updates source and fixture imports, retains all runtime algorithms and storage
formats, and adds short component reading guides. The agent-facing Task tool
remains outside core. Concrete executor/producer grouping is implemented in the separate 13-file
slice #142. HTTP extraction remains a separate follow-up.
Task algorithm rewrites and the remaining feature reductions require separate decisions.

## Remaining work

| Work | Boundary and next proof |
| --- | --- |
| Review retained compatibility | The September 27 cleanup is merged. Check actual consumers before retiring the remaining compatibility boundaries listed below. |
| Further HTTP organization | Directory moves #141/#142 are merged. Extract a retained route family only when its responsibility is clearer; #173's feature removal does not claim the server has been split. |
| Review workflow redo | Select one real workload and measure discarded effort and effect risk before removing reuse. |
| Measure the context cleanup's behavioral effect | Compare baseline and candidate on the same small conversation cases. Existing scripted regressions establish supplied context and mechanics, not improved model judgment. |
| Legacy imports and ignored agent context | #170's SDK vocabulary migration is merged. Keep the DB facade until sibling imports move; resolve unused agent-definition context through the existing extension/adoption review. Tool-call context arguments remain supported. |
| Prove one App-owned delivery workflow | Select one repository, responsible Task, executor and requested terminal outcome. The recorded read-only PR assessment did not exercise publication, review dispatch or validation effects. |
| Assess historical production state before rollout | Verify the actual artifact and retained state. Candidate fixes do not establish that a previously revived Task generation was authorized or repair historical rows automatically. |

These are separate slices, not prerequisites for every ordinary May Task. Keep
the [convergence tracker](design-implementation-convergence.md) for verified open
source gaps and the core proposal for implementation separation. Do not copy
their backlogs here.

## Proposed delivery workflow

Use the repository's existing responsible App. One ordinary workflow collects
current provider facts, chooses eligible work, invokes existing tools or a
bounded agent, and returns a Task result or exact wait. Keep pure eligibility
helpers beside the workflow and provider reads in its existing observer or
adapter. The Host continues to own admission, storage, scheduling and recovery.

```text
provider fact -> declared event route -> responsible Task
  -> App workflow reads current facts and repository policy
  -> eligible tool operation or bounded agent job
  -> verified result, exact wait, or visible blocker on the same Task
```

Use code for an agreed repeatable process, guidance for situational judgment,
and an agent for implementation or focused interpretation. A worker may handle
a useful batch of findings; one accepted supervisory decision is not a limit
of one tool call, file edit or suggestion.

| Current facts | Eligible work under the repository's policy |
| --- | --- |
| Implementation or agreed local checks incomplete | Implement and verify the candidate |
| Reviewable candidate and publication authorized | Find or publish the matching PR, then read back its identity, head and state |
| Required review absent | Request the configured review once and wait for its exact evidence |
| Applicable findings remain | Resolve a useful batch or record an evidence-backed disagreement |
| Required current-candidate validation absent | Dispatch the configured validation once for that candidate/configuration |
| Matching review or validation already running | Return an exact wait; continue independent authorized work if useful |
| Required evidence satisfies policy | Present the requested readiness result or obtain required approval |
| Provider confirms the requested terminal outcome | Let the owning App accept the Task with evidence |

Read current facts on each attempt. Do not persist a parallel sequence of stage
Tasks or copy PR/build status into another workflow store. Unknown or empty
policy is not automatic success. A changed candidate may require renewed proof;
the repository's policy decides which evidence remains applicable.

Before an external effect, recheck Task/attempt authority, provider identity,
candidate and policy. After an interruption, read the provider before repeating
the effect. Reuse provider idempotency and existing Task/operation correlation.
If the outcome remains unknown, expose that ambiguity. There is no transaction
covering SQLite and the provider.

Keep implementation and judgment in the worker job, and publication, dispatch,
approval and merge decisions at the App workflow boundary. This is only an
enforced capability boundary when the worker's actual tools and credentials
enforce it; prose alone does not restrict a full-access shell.

## Sequence and acceptance

1. Recheck current callers and retained obligations for the exact slice. Remove
   a path only after its required behavior has a supported home.
2. Use isolated fixtures to prove admission, duplicate input, exact waits,
   uncertain effects and restart. Reuse the production boundaries in tests.
3. For the delivery slice, exercise one explicitly scoped provider workflow
   through its requested outcome or a precise external blocker. Source review
   and dated pilot permissions do not establish live rollout authority.
4. Delete only duplication demonstrated by that proof. Executor, storage and
   SDK cleanup can follow through the core proposal; no broad rewrite is needed.

A slice is complete when:

- one responsible Task retains its identity and accepted state across attempts,
  duplicate events, interface closure and restart;
- late or replaced attempts cannot accept results, and the selected effect
  boundary checks uncertain outcomes before repeating consequential operations;
- stopped work stays stopped, while an authorized newer generation remains visible;
- an unchanged blocker stays quiet, retains its recovery review, and resumes on
  the relevant fact without repeated model polling or human notifications;
- source and destination Apps keep their own acceptance authority, and adapters
  report admission separately from completion;
- a removed capability leaves the remaining system correct, with missing
  capability visible on affected work; and
- the delivery trial, if included, proves matching candidate evidence and its
  explicit stopping outcome without another CLI, workflow or supervisor lifecycle.

Report what was exercised and which evidence is synthetic, source-based or
live. For model comparisons, also check answer usefulness, wrong-owner choices,
duplicate Tasks, missed follow-ups, model turns and latency. Shorter prompts or
fewer lines alone do not prove better behavior.

The review should settle which remaining slice comes next and its acceptance
contract. Completed slices move to their owning design and dated archive;
unfinished work must remain explicit. Herdr or a new workflow framework is not
required by this proposal.

### Directory companion and landing order

The workspace directory companion updates the canonical source
map, local source links and the design-example checker's two internal Host imports.
Host #141/#142 are merged. Integrate the companion after the source checkout
advances to that layout; its new imports deliberately
do not add fallbacks or forwarding modules for older layouts. Historical source
links remain pinned evidence. Source organization does not change the deployed
installation.

Workspace branch `docs/core-policy-boundaries` includes that companion and the
candidate cleanup notes above. Validate it against the matching Host candidate;
land the Host change before describing its implementation as current.

The core PR also includes a separate test-harness commit: compiled status checks
use bounded asynchronous subprocesses. During validation, the existing synchronous
compiler call left an exited child and a spinning test worker; the run was stopped,
not counted as a pass. The four status checks pass with the corrected harness.
The runtime move and harness change remain separate commits for review.

### Directory validation

| Candidate | Verified evidence |
| --- | --- |
| Core/composition #141, `18f9af01` | Node 24 / Bun 1.3.14 frozen install and full local CI: 2,682 pass, three installation-only skips, zero failures; browser and real worker coverage ran. Runtime changes are moves/path updates. The separate asynchronous status-test fix passes all four original behavior cases. Hosted Quality and Container passed on `18f9af01` (run `34516157559`). |
| Codex/observers #142, `7754e376` | Full local CI before inheriting the test-only parent fix (`4cde38ce`): 2,682 pass, three installation-only skips, zero failures; browser coverage ran. Refreshed candidate source checks and all four status cases pass. Hosted Quality and Container passed on `7754e376` (run `34516184910`). |

The canonical design check passes against the combined candidate; all 178 local
links in the changed documentation resolve. Earlier validation exposed and fixed
a moved test's temporary-database path, then the synchronous compiler stall noted
above. Failed/stalled runs are not reported as passes. Human review and deployment
remain separate from these source checks.

PR #142 was rebased onto the squash merge of #141 on September 11. Candidate
`b8297fad` has the same source tree as `7754e376`; only its ancestry changes.
The PR now targets `main` directly, without replaying the merged core commits.

## September 27 repository-wide hygiene review

The scope covers runtime, agent tools, adapters, storage, packages, scripts,
tests and documentation. A legacy-name search is an inventory, not evidence of
dead code. Trace production callers, sibling Apps, persisted data and current
design before deleting a path. This is a source review; no installed records
are moved, no deployment is inferred and no new recovery mechanism is added.

| Merged PR | Change and value | Compatibility / cost |
| --- | --- | --- |
| [#233](https://github.com/hao1939/may-agent/pull/233) | Extract existing HTTP read routes into a focused module. | Response contracts stay intact; Task and Conversation remain distinct read views of shared execution. |
| [#235](https://github.com/hao1939/may-agent/pull/235) | Derive active Turns from linked Tasks' current running attempts, including successors; remove historical inbox-lease authority and the unused production Stop helper. | Preserve historical rows and offline cutover fixtures; verify restart, successor and Telegram Stop behavior. |
| [#236](https://github.com/hao1939/may-agent/pull/236) | Remove the unused maintenance workflow-launch adapter, its App-path discovery, manager dependency and redundant capability wrapper. | Named handler capabilities remain; standalone workflow execution uses its existing entry point. Retire adapter-only tests. |
| [#237](https://github.com/hao1939/may-agent/pull/237) | Remove ignored tool controls and redundant parameter declarations; return full session IDs that can be used for evidence reads. | `task` is the call/fork argument; retired message actions still explain the supported tools. Message priority and tool-call context files keep their real behavior. |
| [#238](https://github.com/hao1939/may-agent/pull/238) | Remove unregistered context/file-read subscribers and tests that described them as production; keep result suggestions and real completion/recovery coverage. | Removes optional private helper imports. No current caller found; historical file-read rows and read views remain. Reporting does not become automatic adoption. |
| [#239](https://github.com/hao1939/may-agent/pull/239) | Wait for both Telegram destinations before asserting both received a notification. | Repairs a test race exposed by full CI; no production change, fixed sleep or retry. |
| [#240](https://github.com/hao1939/may-agent/pull/240) | Preserve the complete declared maintenance event envelope through the existing canonical builder; remove a narrower duplicate method signature. | Trace, visibility, action and routing coexist. The regression checks published metadata and persisted trace links; no new schema or mechanism. |

All seven PRs merged on September 27, with #239 first and the cleanup batch
complete at Host `b79a693f`. Its source tree matches the combined verification
checkout below. The source guides travel with their owning changes. Canonical
storage, scheduling and reporting/adoption notes live here. Merge status does
not establish deployed behavior or measured improvement in model judgment.

Retained boundaries and next review targets:

- SDK `owner`/result aliases and the `requests.ts` facade still have sibling
  source consumers. Migrate callers before removing exports.
- `context_files` in agent definitions is still declared by installed Apps,
  including a nonempty judge configuration; its mapped `contextFiles` has no
  execution reader. Resolve that knowledge/context contract with the owning
  App, then remove the ignored configuration. Tool-call `context_files` is a
  different, working feature and remains.
- Historical inbox leases, CLI upgrade fences, old Task receipt/hash formats
  and retained session restrictions protect upgrades or preserve evidence.
  Remove them only with an explicit supported-upgrade decision.
- Gym scripts and the direct-agent entry have actual external callers. Their
  removal needs a coordinated migration of the consumer and result store.
- HTTP project discovery, workflow history and the `file_reads` table serve
  historical views. UI hash aliases preserve links. Retire a view only after
  identifying its replacement or explicitly accepting the loss.
- The commit guard still understands installation and old agent-repository
  layouts. Its layout-specific path assumptions need a separate demonstrated
  repair; deleting the fallback alone would not make it generic.

Full suites retain failures and skips in their evidence. The first #236 run
exposed the #239 race: it waited for either chat and asserted both. That is a
validation defect, not proof that removing the maintenance adapter lost a
notification. Regression checks exercise production boundaries; tests that
only instantiate removed functionality are retired with that functionality.

Pre-merge combined Host source `557d348c` includes all seven cleanup PRs. Full
local CI passes with 3,260 tests, three installation-dependent skips and no
failures. All seven PRs passed their GitHub Quality/Container checks; #239 correctly
omits an unnecessary image build. The final branches merge cleanly. These are
portable source checks, not deployed-runtime or model-quality claims.
The companion design integrity check passes with zero errors/warnings, and all
113 local links in the six changed documents resolve. Repeated Task executor
and view explanations were condensed while preserving the contract anchors.


## September 27 follow-up: truthful tests and explicit context

Two source candidates address the remaining narrow cleanup findings:

- [Host #250](https://github.com/hao1939/may-agent/pull/250), `12c01ba4`, replaces
  permissive manager tests with successful controlled replies through the real
  agent loop and the existing runner factory. It checks old/new and captured
  definitions, premature results, concurrent waiters, completed cancellation,
  progress limits and frozen duration. Temporary sessions settle and their
  databases close in teardown. The duplicate registry/smoke examples are removed;
  related lifecycle assertions are grouped. Three unused production helpers are
  deleted; tests inspect the actual workspace cleanup, emitted Codex packet and
  saved checkpoint pointer. Checkpoint storage and recovery readers remain.
  Final source `36a208db` strengthens the packet assertion to require the complete
  packet at the end of the instruction text.
- [Host #251](https://github.com/hao1939/may-agent/pull/251), `65a75ba5`, removes
  ignored agent-definition context metadata. Old JSON remains loadable; the
  loader test includes a missing retired context file and verifies that the
  resulting definition has no retired metadata. Agent/message tool arguments
  with the same spelling still work.

The companion App changes remove 13 obsolete configuration fields across
Evaluation, Gym, its semantic-judge fixtures and Host Operations profiles.
Seven useful Host Operations context notes remain in place and are linked from
`AGENTS.md`. Evaluation's unused judge context note is removed: its substantive
role, evidence, transcript boundary and conservative verdict instructions already
live in `AGENTS.md`; its old model and discovery paths are not revived. Evaluation
already supplies its canonical scoring criteria in the assessment workflow brief.
Archived configurations and historical evidence are left intact.

This applies the existing context model, rather than introducing another loader:
identity is always visible; supporting references are read when relevant;
required content belongs in the supplied Task brief or existing preparation hook.
The updated [agent convention](../2b-manual/agent-convention.md#prompt-files)
and [skill invocation guidance](../2a-design/skills.md) own that rule.

A local source trial prepared all 13 revised configurations with old and candidate
Host code. Prompts were identical for the same revised App source, and the real
read tool resolved all seven context links. This verifies preparation and file
access, not whether a model chooses the right reference. Neither source half
requires the other to land first; source review and App activation remain separate.

The test-reduction trial compared base `671b6900` with #250: 3,248 passing tests
became 3,240, with the same three installation-only skips and no failures.
The affected manager suite has seven scenarios instead of fifteen named examples;
this includes grouping retained assertions, not deleting eight independent
behaviors. Two deliberate mutations substituted a registered model for a captured
definition and returned an error result for a still-running execution. The old
suite passed both broken variants; the revised suite rejected both.

Source line coverage (`src`, `packages`, `scripts`, excluding tests and generated
temporary modules) was 80.1799% before and 80.1964% after; function coverage was
91.1841% and 91.1772%. Removed helpers account for removed covered source.
Two unchanged IPC relay-drain lines were covered only in the first run: that
conditional depends on whether frames remain when a worker exits. The manager
examples do not invoke that worker path, whose existing dedicated process tests
remain. Coverage is an observation, not proof that all failure modes were checked.
The runs took 205.06s and 215.87s, with other verification overlapping the latter;
these measurements establish no speedup. The audit does not support a blanket
30% deletion. Distinct restart, cancellation, identity and historical-reader
contracts still need their tests even when they visit the same lines.

Both individual local CI runs passed. Combined source `78a2379b` passed full
local CI: 3,240 passed, three installation-only skips, no failures (230.95s).
The only later change strengthens two packet assertions. Final combined source
`6f1e9aa0` passed 35 owning tests with the same three installation-only skips.
Host #251 passed both GitHub checks on `65a75ba5`; #250 passed both checks on
its final revision `36a208db`. Both PRs are ready for human review. No deployment, App activation, record migration or model-backed
experiment was performed.
