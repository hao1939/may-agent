# Simplify the system: fewer paths, clear owners

**Status:** Selected cleanup in implementation review; larger feature reductions
remain conditional. Existing direct-work and attempt-context contracts remain
accepted. See [implementation evidence](#implementation-evidence).
**Reviewed:** September 11, 2026, against Host `main` `0bedd93a`, including the
merged Conversation/state separation [#129](https://github.com/hao1939/may-agent/pull/129).
Source review does not identify the deployed release.

Make ordinary conversation and authorized work easier to understand, change and
operate at acceptable total cost. Directory organization now has an explicit
user goal: make component ownership and execution paths easy to review. Proceed
with that work independently of conditional behavior reductions. Follow the
[value/cost rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff).
One existing proposal owns this review; subsystem contracts and implementation
plans remain with the owners linked below.

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

### Directory organization for code review

**Status September 11:** Core/composition moves merged in
[Host #141](https://github.com/hao1939/may-agent/pull/141) as `48254267`.
Concrete Codex/observer grouping in [#142](https://github.com/hao1939/may-agent/pull/142)
is rebased onto that merge as `b8297fad` and awaits human review.
The rebase preserves the previously tested tree exactly.
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

1. #138/#139/#140 are merged (`ca6c9d7f`, `b725f546`, `335bf178`). Build the
   move-only slices on those ownership boundaries.
2. Reorganize core Task, inbox, state and shared scheduling files in one cohesive
   move-only slice. Put the mixed inbox orchestration and worker entry points in
   composition. Move tests, update imports, lint boundaries, worker/build paths
   and documentation references together.
3. Group concrete executors and producers in a separate slice. Then extract
   existing HTTP route families where that makes the server readable. Preserve
   their behavior; evaluation feature deletion remains a separate decision.
4. Child-wait retirement landed separately in #140. Affordable workflow redo
   remains a separate review and does not block directory organization.

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

Child-wait removal is now accepted as a separate source change. The earlier
#138/#139 scope above did not include it. The remaining reductions are:

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

Evaluation and workflow redo remain explicit deferrals under the value/cost
rule. The core/composition directory candidate moves 42 files with their tests,
updates source and fixture imports, retains all runtime algorithms and storage
formats, and adds short component reading guides. The agent-facing Task tool
remains outside core. Concrete executor/producer grouping is implemented in the separate 13-file
slice #142. HTTP extraction remains a separate follow-up.
Task algorithm rewrites and the remaining feature reductions require separate decisions.

## Remaining work

| Work | Boundary and next proof |
| --- | --- |
| Retire conversational child waits | Merged in #140; unfinished legacy waits fail visibly while admitted work and accepted asks remain. Deployment is separate. |
| Reorganize directories for code review | Core/composition (#141) is merged; concrete capabilities (#142) await review. HTTP extraction remains a separate slice of the [layout map](#directory-organization-for-code-review). |
| Review workflow redo | Select one real workload and measure discarded effort and effect risk before removing reuse. |
| Measure the context cleanup's behavioral effect | Compare baseline and candidate on the same small conversation cases. Existing scripted regressions establish supplied context and mechanics, not improved model judgment. |
| Resolve HTTP/Evaluation ownership | Compare feature reduction with an App-owned implementation using the [external plan](external-components-simplification.md#conditional-follow-ups). Preserve history and honest receipt/saved semantics. The paired migration is conditional on retaining the feature's value. |
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

The workspace branch `docs/core-directory-layout` updates the canonical source
map, local source links and the design-example checker's two internal Host imports.
Validate it against #142, which includes merged #141. Integrate it after #142
lands and the source checkout advances; its new imports deliberately
do not add fallbacks or forwarding modules for older layouts. Historical source
links remain pinned evidence. Source organization does not change the deployed
installation.

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
