# Simplify the system: fewer paths, clear owners

**Status:** Selected cleanup in implementation review; larger feature reductions
remain conditional. Existing direct-work and attempt-context contracts remain
accepted. See [implementation evidence](#implementation-evidence).
**Reviewed:** September 11, 2026, against Host `main` `0bedd93a`, including the
merged Conversation/state separation [#129](https://github.com/hao1939/may-agent/pull/129).
Source review does not identify the deployed release.

Make ordinary conversation and authorized work easier to understand, change and
operate at acceptable total cost. First remove unnecessary behavior and competing
continuation paths; then organize the implementation that remains. Follow the
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

## Design choices before code moves

The most promising savings come from removing ways to execute, wait, recover or
write the same outcome. A directory move alone removes none of those cases.
These are structural opportunities, not measured bug reductions or line savings.

| Choice | Complexity potentially removed | Accepted cost and next decision |
| --- | --- | --- |
| One durable delegation path: Task handoff | Conversational child-request creation, waiting, result aggregation, reconsideration and their recovery combinations | Long work is linked to a Task and reported in a later turn; retire the old path only after caller and retained-obligation checks |
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

The alternative path creates child inbox requests, waits for their results, then
reconsiders the parent input. #129 separates this code and rejects that protocol
for new direct Task handoffs, but retains compatibility handling. Its
`conversations/turn-handler.ts` still creates children and joins their waits.
The source declaration search found May as the current App declaring agent
request handling; that does not prove no retained caller or obligation needs it.

**Recommendation:** With #129 merged, audit the remaining callers and
make Task handoff the sole supported new conversational delegation path. Then
drain or explicitly migrate retained child waits before deleting their execution
path. Keep input receipts, accepted Requests, Topic links, Task-to-Task waits and
historical reads. A temporary drain path needs an explicit removal condition;
do not replace it with another general compatibility framework.

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
| Group retained HTTP/backend implementations | After the feature decisions above, put touched route families under existing `http/` homes and backend files beside their executor family. Use ordinary imports, not a new router/plugin/service framework. |
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

Foundational database primitives stay in `src/lib/db/`. Still-flat Task/inbox
modules can keep their current paths while their responsibility is clear.
Folder symmetry is not an acceptance criterion. Use existing ESLint import
rules to protect boundaries as they are extracted; a dependency-analysis service
or a repository-wide move is unnecessary.

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

1. Build on #129, now merged as `0bedd93a`. Keep the feature reductions separate
   from that completed state/frontend extraction.
2. Take a small behavior-preserving cleanup: direct internal imports and a shorter
   source map. Address the shared inbox's App-name assumptions as a separate,
   focused capability-boundary change.
3. Review removal of the conversational child-wait path first, and evaluation UI
   feature reduction separately. Each needs its caller/retained-data decision,
   owning-contract update and a concrete retained user path before source deletion.
4. Consider the workflow redo experiment only when an actual workload makes its
   savings plausible. Defer large Task/HTTP extractions until the remaining paths
   and a useful change justify them.

Steps 3 and 4 are conditional choices, not an automatic implementation queue.
No live-state inventory, provider trial, deployment or Host merge is performed by this
document review. The preceding source review ran 36 focused registry/controller,
reporting and import-boundary tests on `743aa5de`; those tested modules are
unchanged at the reviewed `main`. It did not measure field failure frequency,
redo cost, or certify deployment.

For each selected reduction, record the behavior retained, the behavior given up,
the actual path deleted and the relevant regression evidence. Stop if migration
or permanent exceptions cost more than the removed feature. Success means less
coordination and fewer failure cases for useful work, not merely fewer files.

## Implementation evidence

The approved bounded milestone is delivered as two independent Host PRs based
on `0bedd93a` (candidates `71ea02a6` and `ccc33d3d`). Both remain subject to human review; no merge or deployment is
part of this implementation.

| Slice | Result and evidence |
| --- | --- |
| [#138](https://github.com/hao1939/may-agent/pull/138) — import ownership and source map | Loader imports owning modules directly; ESLint prevents reintroducing the barrel cycle. Public exports remain. The map is 102 lines; review corrections make module paths explicit. Frozen install and full local CI for the runtime change (`8a95827c`): 2,677 pass, three installation-only checks skipped; browser checks ran. |
| [#139](https://github.com/hao1939/may-agent/pull/139) — foreground selection and conversation presentation | Composition selects `conversationAppId`, with May as the shipped default. Shared scheduling uses that selection. `conversations/task-status.ts` owns waiting text, message identity and follow-up self-wake suppression. The safeguard follows the owning Conversation even when selection changes or is omitted; other Apps still receive Task facts. 52 focused checks and full local CI passed: 2,681 pass, three installation-only checks skipped; browser checks ran. |

Omitting selection uses background capacity with the existing reserve, an
accepted utilization cost that avoids another capacity mode. This does not rename
an installed App or change turn-handler declarations. Existing cancellation,
Task attachment, accepted Requests and retained child waits remain in place.

The three larger reductions were audited but not selected for deletion:

- **Child waits:** Current declarations favor direct Task handoff, but the
  handler still supports retained child creation/join/reconsideration and a
  dated audit found open obligations. Source searches cannot establish that
  those obligations have drained. Remove only after an authorized retained-state
  decision; no new compatibility framework is needed.
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

These are explicit deferrals under the proposal's value/cost rule, not evidence
that every optional reduction has been implemented. Broad Task/HTTP moves remain
outside the selected milestone.

## Remaining work

| Work | Boundary and next proof |
| --- | --- |
| Retire conversational child-request waiting where redundant | Follow [one durable delegation path](#1-one-durable-delegation-path); a dated audit found retained open obligations, so a source search alone cannot justify their deletion. |
| Review workflow redo and code organization | Use the [design choices](#design-choices-before-code-moves) and [bounded milestone](#recommended-next-milestone); the existing core/storage plans keep ownership of their accepted work. |
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
