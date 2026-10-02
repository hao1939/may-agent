# Reviewing the capability contract against 90 recent PRs

**Supports:** [Agent capability guidance and infra contract](task-execution-capabilities-20261002.md). Uses recent fixes and successful work to assess the value and gaps of the capability contract.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Design review, 2026-10-03. No runtime change or deployment.
**Design reviewed:** [From intention to outcome](task-execution-capabilities-20261002.md),
with [supporting capability contracts](task-execution-capability-contracts-20261003.md).

## Conclusion

The purpose is useful work accomplished with less human coordination. The design
now starts from that purpose and explains the value of each part. This review
supports it with evidence about useful judgment, dependable execution, continued
responsibility and reusable, affordable operation. Historical defects identify
missing promises; completed work and recovered failures identify abilities to
preserve. PR coverage alone does not establish value to users.

The direction fits the problems: **agent decides; infra executes**. The agent
judges meaning and outcomes; infra supplies usable context, executes permitted actions, retains obligations
and brings back evidence. The recent fixes mostly reinforce existing ownership
and execution boundaries. They do not justify a new dispatcher, work lifecycle,
universal request schema or monitoring service.

The draft needs more precise operational requirements. "Expose context, execute
and recover" is too broad to catch the actual defects. Several fixes repaired
one entry point while another still violated the same promise. Pair the small
agent guide with observable infra requirements and checks through the real
agent, workflow, native and Conversation boundaries that support each feature.

Guidance can improve judgment once facts and actions are usable. It cannot
repair an executor that never starts, a result path that loses obligations, or
a runner that keeps spending after accepting completion.

Each reviewed problem is assessed through the same three questions: what the
agent needs to know and decide, which capability/behavior infra promises, and
how acceptance, results or failure reach the agent for its next decision. The
deliverable is useful agent guidance paired with necessary, testable infra
requirements. The PR history is evidence for that contract.

The App packages domain guidance, capabilities and workflows. A workflow
executes a defined procedure and calls an agent when judgment is needed.
Configured observers, timers and retry rules can execute standing decisions;
they do not independently select a repair strategy or judge domain success.

## Review scope and evidence

The inventory covers the latest **90 merged PRs by merge time**, from
2026-09-18 through 2026-10-02 UTC. It includes 75 non-maintenance PRs and 15
release/dependency PRs. The latest 30 contain 29 non-maintenance changes.
All non-maintenance problem/change descriptions were reviewed; selected
production changes and regression-test excerpts were inspected in 26 PRs:
225, 226, 227, 237, 251, 256, 257, 258, 262, 269, 270, 272, 274, 275, 276,
277, 278, 280, 281, 283, 284, 286, 287, 288, 289 and 218.
This is a design review with focused source checks, not a fresh line-by-line
audit of every PR or a rerun of their test suites.

Merged Host baseline: `e2e5c848122a6b1ce1a916764b20b27e9d24abcc` (#289).
The capability draft was reviewed in the companion App checkout based on
`d8767d3264`, including its uncommitted proposal. Historical PR descriptions
record validation at their own revisions; those reports are not fresh runtime
measurements or proof of deployment.

[PR #285](https://github.com/hao1939/may-agent/pull/285) is **open**, outside the
90 merged changes. At review its head was `c8a8513da83a396d2dce43037dd844821defab28`.
Its narrowed scope retains routing and shared admission, with requests and
caller Conditions separate. The `decision` schema migration is deferred;
existing `state`/`continue` results remain. The proposed `reply` choice is
also follow-up design, not part of that implemented contract.

Positive evidence was also checked: retained live rollout receipts from
2026-09-28, isolated real-model recovery/comparison records, and four accepted
decisions read from the local runtime on 2026-10-03. The latter were produced
on 2026-10-02 UTC; two linked Evaluation report files were read and their hashes
matched the accepted publication records. No model trial, live mutation or
deployment was performed for this review. The sample is illustrative and does
not estimate the success rate of the installation.

## What the history says

| Recurring problem | Representative fixes | Assessment of the draft |
| --- | --- | --- |
| Required facts were stored but missing, stale or obscured in the worker's actual context. | [#230](https://github.com/hao1939/may-agent/pull/230), [#251](https://github.com/hao1939/may-agent/pull/251), [#256](https://github.com/hao1939/may-agent/pull/256), [#266](https://github.com/hao1939/may-agent/pull/266), [#268](https://github.com/hao1939/may-agent/pull/268), [#284](https://github.com/hao1939/may-agent/pull/284) | Correct direction: supplied facts and schemas must reach the actual worker, including after compaction/resume. A path in configuration is insufficient. |
| Seeing an input or finishing a batch was confused with answering every requirement. | [#264](https://github.com/hao1939/may-agent/pull/264), [#269](https://github.com/hao1939/may-agent/pull/269), [#272](https://github.com/hao1939/may-agent/pull/272), [#284](https://github.com/hao1939/may-agent/pull/284) | Strengthen the distinction between notifications considered and requirements fulfilled. Preserve one intention across refinements and let later corrections reach the worker. |
| Validation differed between discovery, tools, public input and final settlement. | [#210](https://github.com/hao1939/may-agent/pull/210), [#225](https://github.com/hao1939/may-agent/pull/225), [#226](https://github.com/hao1939/may-agent/pull/226), [#258](https://github.com/hao1939/may-agent/pull/258) | Shared admission fits. Also require useful correction feedback before ending execution when the invalidity is already knowable. |
| Accepted finish did not stop work, or setup and execution used different time budgets. | [#265](https://github.com/hao1939/may-agent/pull/265), [#281](https://github.com/hao1939/may-agent/pull/281), [#289](https://github.com/hao1939/may-agent/pull/289) | Missing explicit terminal and deadline guarantees. These belong to the runner/adapter, including ordinary helpers and workflows. |
| Independent waits disappeared, checkpoints spun, or observations did not arrive at the declared cadence. | [#209](https://github.com/hao1939/may-agent/pull/209), [#217](https://github.com/hao1939/may-agent/pull/217), [#218](https://github.com/hao1939/may-agent/pull/218), [#259](https://github.com/hao1939/may-agent/pull/259), [#270](https://github.com/hao1939/may-agent/pull/270), [#276](https://github.com/hao1939/may-agent/pull/276) | Existing Conditions are the right mechanism. Require preserved independent interests, operational cadence and automatic return; avoid a second watch registration. |
| Recovery saved a problem but did not reliably return it or establish accountable follow-through. | [#228](https://github.com/hao1939/may-agent/pull/228), [#254](https://github.com/hao1939/may-agent/pull/254), [#257](https://github.com/hao1939/may-agent/pull/257), [#271](https://github.com/hao1939/may-agent/pull/271), [#274](https://github.com/hao1939/may-agent/pull/274), [#282](https://github.com/hao1939/may-agent/pull/282) | Evidence exposure is necessary. The responsible App must also define review and response ownership, including failures before a worker runs. |
| Small responses still required expensive historical scans or oversized transport reads. | [#216](https://github.com/hao1939/may-agent/pull/216), [#277](https://github.com/hao1939/may-agent/pull/277), [#278](https://github.com/hao1939/may-agent/pull/278), [#280](https://github.com/hao1939/may-agent/pull/280), [#283](https://github.com/hao1939/may-agent/pull/283), [#288](https://github.com/hao1939/may-agent/pull/288) | Bounded prompt size is insufficient. Bound retrieval work and preserve responsiveness as retained history grows. |
| Advertised capabilities, permissions or runtime state did not match execution. | [#223](https://github.com/hao1939/may-agent/pull/223), [#237](https://github.com/hao1939/may-agent/pull/237), [#273](https://github.com/hao1939/may-agent/pull/273), [#284](https://github.com/hao1939/may-agent/pull/284), [#286](https://github.com/hao1939/may-agent/pull/286) | Discovery and operation-level enforcement belong together. Installation permissions and Task authority are separate facts. |
| Context, references, approval, completion and closure were treated as interchangeable authority or state. | [#197](https://github.com/hao1939/may-agent/pull/197), [#227](https://github.com/hao1939/may-agent/pull/227), [#235](https://github.com/hao1939/may-agent/pull/235), [#260](https://github.com/hao1939/may-agent/pull/260), [#262](https://github.com/hao1939/may-agent/pull/262), [#267](https://github.com/hao1939/may-agent/pull/267), [#275](https://github.com/hao1939/may-agent/pull/275) | Trust worker judgment by default while retaining exact authority and lifecycle checks. A reference grants no control; a completed contribution does not withdraw remaining work. |
| Tests or source/configuration presence were mistaken for an installed, effective behavior. | [#238](https://github.com/hao1939/may-agent/pull/238), [#247](https://github.com/hao1939/may-agent/pull/247), [#249](https://github.com/hao1939/may-agent/pull/249), [#250](https://github.com/hao1939/may-agent/pull/250), [#276](https://github.com/hao1939/may-agent/pull/276), [#284](https://github.com/hao1939/may-agent/pull/284), [#287](https://github.com/hao1939/may-agent/pull/287) | Keep source correctness, installation conformance and model behavior as separate evidence. Activation and later behavior must be observable. |

## Successful behavior to preserve

Successful completed work and recovered failures answer a different question
from bug fixes: which decisions already work when infra provides usable facts
and actions? Preserve those paths and use them as agent guidance examples.

| Observed success | Evidence and limits | Guidance to retain | Infra promise that supports it |
| --- | --- | --- | --- |
| May completed a live rollout assessment, incorporated a Tuesday-to-Thursday correction and finished both input obligations on the same Task. | Retained #265 rollout trial: canonical final Task and verification receipt agree on the corrected answer, done status and no pending input. It was a bounded live trial, not general deployment certification. | Incorporate new requirements into the existing assignment; state exactly what the evidence establishes. | Deliver new input and preserve it for reconciliation; link the accepted answer to the addressed requirements. |
| A worker recovered from an unavailable refresh and an unsuitable file read, then reported the correct evidence and correction while preserving approval. | [#266](https://github.com/hao1939/may-agent/pull/266) retained real-model trial used the ordinary Task reader and finished in three model requests. Its larger reads were still expensive. | Try another supported read, use current evidence, and continue the work within scope. | Explicit read errors, useful alternate reads, current requirements and retained independent Conditions. |
| May recovered from an incomplete interpretation of a correction, eventually resolving the full related request chain while preserving independent work. | [#269 trial record](explicit-task-input-consideration-20260930.md) and final receipt: all related requests answered, independent requests unanswered, approval retained and originals read. Three passes were required; the harness continued the same temporary Task. | Reconsider unresolved requirements on the next pass; distinguish related refinements from independent work. | Keep unanswered work reachable and preserve exact result scope across interruption/reconciliation. |
| The agent completed useful work while maintaining a valid wait. | [Matched context comparison](task-decision-context-behavior-comparison-20260926.md): independent progress/failure/waits and genuine approval-wait cases each passed five of five runs in both versions. These were isolated real-model fixtures. | Progress and waiting facts can coexist; choose the next action from the actual assignment. | Conditions remain independent from contribution completion and preserve their identity. |
| The evaluator interpreted missing measurements correctly; May retained the existing investigation and left the human Request open without another reply. | Four recent runtime decisions inspected. One published report's pinned evidence had zero samples, missing freshness, collection failures and existing dispositions; its interpretation matched those facts. The selected owner results omitted a new follow-up/reply, and one explicitly retained an open Request. This establishes those decisions, not global absence of duplicates or repair of the producer. | Distinguish unknown from zero; reuse relevant owned work; keep communication proportional to what changed. | Expose measurement failures, accepted decisions, exact work references and explicit Request dispositions. |
| A compact current brief reduced discovery effort without preventing ordinary successful decisions. | [Thirty matched pairs](task-decision-context-behavior-comparison-20260926.md): model calls fell from 227 to 152; all 60 final reports had correct required content and retained required obligations. Full behavioral acceptance was 29/30 baseline and 27/30 candidate, including repeated-write failures. | Read selectively and reuse accepted evidence when it still covers the assignment. | Supply a compact current view with usable detail access and exact accepted results. Token reduction alone does not establish better behavior or lower billing. |

The positive lesson is that agents can interpret corrections, choose useful
reads, preserve independent obligations and make sensible no-change decisions
through the existing execution model. Teach those action patterns and keep
ordinary successful work simple. A normal response should not require the
agent to reconstruct delivery, repeat unchanged Conditions, copy every default
input identity or obtain a mandatory second judgment.

Recovery quality includes what survived: accepted work, unanswered requirements,
independent waits and authority. A successful later attempt is evidence of
recovery only for the requirements it actually addresses. A completed review
or investigation report does not by itself mean the underlying defect is fixed.

The comparison also supplies a preservation warning. More visible evidence
reduced discovery work but did not reliably prevent duplicate writes: accepted
review reuse passed five of five baseline cases and three of five candidate
cases. Keep this counterexample alongside the successes. Compare both outcomes
and actions when changing guidance; do not add an infra veto on repeating work
that an agent can legitimately choose to redo under changed requirements.

Local positive-evidence index:
`/app/.state/task-capability-pr-review-20261003/positive-evidence-checks.json`.
It records receipt/report paths and hashes, selected exact attempt identities
and the limited checks performed. The #266 experiment/source record is retained
at companion revision `6548f2c4feb0` under
`projects/may-agent.app/docs/proposals/task-executor-surface-20260928.md`.

## Required refinements

### 1. Make execution promises precise

The current draft says an attempt ends with its final decision. #281 showed
that an accepted ordinary helper finish could still allow further model calls;
#289 showed a workflow could spend its budget in setup and subsequently emit
an effect and report success. Add explicit requirements: accepted finish stops
that invocation, later tool calls do not execute, cancellation/deadlines cover
the owned execution scope, and cleanup preserves prior accepted work.

The common deadline does not promise forcible interruption of arbitrary
synchronous JavaScript or rollback of an already completed external effect.
Supported effect and return boundaries must enforce the actual deadline.

Likewise, one schema must be usable at discovery, invocation and settlement.
#225 improved validation but #226 was still needed because the public entry
point returned a generic rejection first. #258 allowed a missing reply to be
corrected in the same invocation. Keep final freshness/authority checks while
returning already knowable errors early. This is structural correction, not a
second judge of whether the work is good enough.

### 2. Separate input progress from requirement completion

#269 corrected an actual mixed-batch trial: the worker said independent work
remained, but the Host marked it answered. #272 preserved one accepted human
intention across several inputs. #284 then repaired a different accounting
failure: considered notifications were restored repeatedly, keeping a later
correction behind the same bounded batch.

The contract must retain all three distinctions: input arrived, input was
considered, and the worker judged its requirement fulfilled. Infra advances
consumed notifications while preserving unanswered requirements. The agent
decides which inputs refine one intention and exactly which work a result
answers. These do not require separate agent-managed ledgers or a universal
Request resource for every input.

Conversation also carries a human communication obligation. #277 removed
unnecessary promises/replies from routine automated reviews. An accepted human
Request has explicit scope and disposition; an ordinary observation need not
create one. The agent decides the promise; the existing contract enforces
its bookkeeping and required reply.

### 3. Deliver failure evidence to a responsible judging agent

An agent cannot diagnose a correction it never receives or an executor that
fails before invoking it. Infra must deliver those facts through the declared
route to the designated evaluator or owner agent. That agent judges the trend
and decides whether to observe, repair or escalate. The App packages the domain
guidance, capabilities and standing observation rules that support those
decisions. Existing metric evidence, Conditions, accepted decisions and Tasks
provide the mechanism.

Test the chain: a retained failure/trend reaches the selected reviewer; the
reviewer uses an existing investigation where appropriate or accepts new work;
that work receives a later observation/result; its owner decides the next step.
Keep absence of evidence and failed monitoring explicit. Recording an alert,
delivering feedback, accepting an investigation and restoring the original
request are different observable facts.

No universal retry-count cap or automatic failure classifier follows from this
review. #271 explicitly retained unlimited retry count with capped backoff.
The requirement is inspectable behavior and an owned response path. Monitoring
inside a dead Host cannot observe that Host; installation health coverage
remains a separate operational responsibility.

### 4. Require usable, affordable capabilities

The worker should select an action and use its result without reconstructing
transport or enumerating history. #278, #280 and #283 needed better access paths;
a small `LIMIT` or compact output did not establish cheap retrieval. #288 needed
bounded exact-turn reads, even though Task context already had a bounded view.

Add representative large-history checks, query/transport diagnostics, explicit
coverage limits and installed execution checks where the environment matters.
Use the existing installation checks after setup or relevant upgrades; avoid a
new preflight on every attempt. #286 also demonstrates why a documented
read-only contract needs enforcement at its actual operation boundary.

### 5. Keep the model small and the existing contracts authoritative

The organizing phrase "Task supplies purpose and authority" was too loose.
The assignment supplies purpose; trusted caller/App policy supplies authority.
A Task retains durable responsibility. Seeing its context neither grants
authority nor makes every helper its owner (#262, #267). A direct helper or
standalone deployment need not create a Task merely to use a capability (#220).

Retain the four capability purposes as navigation, not four new services. Keep
the existing result schema while teaching its meaning; do not couple this work
to the deferred #285 schema migration. Treat `reply` as a proposed convenience
over current request/Condition ownership and validate that independently.

Keep the core guide short and supply domain/capability details on demand.
Loading this entire design into every invocation would work against the context
reductions in #277 and #288. A reported lesson or edited guidance file is not
an activated behavior change (#238, #251, #287).

## Purpose and philosophy review

This pass reviews the merged documentation at App commit `650d79627c` against
[May's purpose](../1-principles/design-philosophy.md#mays-goal), the
[tradeoff rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff),
[agent-first mechanism selection](../1-principles/code-vs-data.md#before-adding-runtime-behavior),
and the owning Task, SDK, cooperation, escalation and metric contracts.
It uses the retained evidence above; it adds no model trial, current PR-status
audit or deployment evidence. Refinements remain draft and unimplemented where
they propose new interfaces.

### Assessment

The direction supports the project purpose: useful outcomes with less human
coordination require usable agent judgment and dependable execution. The paired
guide/infra contract is valuable because a prompt rule cannot repair a missing
action or lost reply, and delivery machinery cannot decide what satisfies a
requirement. Existing successful work shows that much of this model already
works. Preserve it and repair demonstrated gaps before adding conveniences.

The proposal was stronger at explaining why each part was useful than at
explaining why its particular mechanism was the simplest sufficient choice.
The refinements below narrow those choices and distinguish what acceptance
means. They do not turn every historical fix into another universal feature.

### Findings and refinements

| Finding in the reviewed draft | Consequence for the project goal | Refinement |
| --- | --- | --- |
| No-reply was described as transferring fulfillment to the receiver. | An agent could confuse asking for a contribution with handing over its original promise, losing responsibility while claiming less bookkeeping. | The receiver owns its contribution; the caller retains its assignment. Reply choice controls feedback only. An actual handoff requires its own authorized ownership decision. |
| Human communication inherited the work-request acceptance wording. | A saved message could be treated as a human commitment, overstating progress and hiding an unanswered requirement. | Define acceptance per action. A communication capability accepts delivery and reply correlation; it cannot accept work on the human's behalf. Keep transport delivery, human response and source outcome distinct. |
| Discovery said a rejection must report that no acceptance occurred, without distinguishing lost acknowledgments. | Retrying after uncertain acceptance could duplicate already accepted work. | A known pre-admission rejection is definite. After dispatch, return available receipt evidence or uncertainty. Retained call identity supports replay; similar text does not prove a duplicate. |
| Failure guidance named a reviewer but left the operational prerequisite too implicit. | Recording a trend can appear to close the feedback loop even when no usable reviewer route exists, especially when the worker cannot start. | App/installation selects a reviewer and usable route; infra executes it and exposes failed delivery. Check coverage outside the failed startup path. Reuse configured fallback only; no invented supervisor or retry-count cap. |
| A small catalog was prescribed even where the existing callable descriptions may suffice. | Another maintained description layer adds prompt and maintenance cost without demonstrated value. | Reuse tool descriptions and owned schemas. Add compact discovery only when capability volume or lookup cost justifies it. Require matching behavior on supported surfaces, not universal adapter coverage. |
| The proposal listed broad verification goals without one sufficient first outcome. | Work could expand into capability standardization without establishing better results or lower supervision. | Start with one review-and-test assignment using current schemas. Repair its actual path; trial reply convenience separately and stop when the demonstrated need is met. |

These are design ambiguities and scope improvements. They are not evidence that
the implementation currently exhibits every described failure.

### Choices justified by value and philosophy

| Needed value | Chosen approach and basis | Alternative, accepted cost and revisit condition |
| --- | --- | --- |
| Better decisions with less repeated explanation | Keep a short common guide; supply App policy, current facts and exact schemas through their existing owners. Agent-first and one-authority rules keep meaning with the agent. | A comprehensive handbook in every prompt costs context and drifts from schemas. On-demand reads may cost an extra call; preload a specific fact only when observed failures or cost justify it. |
| Actions the agent can actually use | Describe and enforce the operations installed for the invocation. Reuse existing tool descriptions and SDK contracts. | A universal catalog/dispatcher adds another layer. Accept different tool/function syntax; add a narrow adapter when a real worker needs the operation. |
| Less caller bookkeeping across interruption | Trial an explicit answer choice that fills existing request/Condition records. Agent chooses the need; infra executes the predictable wiring. | Keep current explicit declarations as the baseline. The convenience earns its cost only if paired SDK/Host changes remove repeated work without new authority or replay ambiguity. It is not a prerequisite for repairing lost feedback. |
| Continued responsibility without freezing useful work | Retain independent Conditions and let the agent decide execution and completion. Keep durable Task ownership; use direct helpers for bounded contributions. | Automatically waiting on every Condition restricts valid progress. A new execution-state model adds migration cost; neither is justified by the current need. Preserve ordinary accepted judgment even when independent facts remain pending. |
| Honest, useful completion | Trust accepted judgments by default, preserving scope, evidence and outstanding facts. Existing admission enforces structure and authority. | Mandatory secondary verification for every result consumes attention and delays work. Accept that a judgment can be mistaken; apply explicit App checks where required and allow later correction. |
| Recoverable work at acceptable cost | Reuse accepted records and replay contracts; redo cheap computation when safe. Distinguish delivery acceptance from fulfillment. | Exact continuation of every tool call/Promise creates permanent recovery machinery. Accept bounded redo or delayed feedback when sufficient; stronger recovery needs evidence of consequential loss. |
| Repeated failures lead to a decision | Use existing metrics, declared routes and accountable App review. Diagnose with an agent; infra persists and executes its response. | Fixed retry limits do not establish repair; an all-purpose supervisor is another work system. Keep continuing retries/backoff and configured controls. Escalation/repair quality still needs behavior evidence; review missing coverage rather than assume it. |

The first outcome should be demonstrable without inventing any new work owner.
A request for review and a request for repair use the same existing admission
foundation; their domain meaning and acceptance evidence belong to the receiving
App. A human message shares the calling convention while retaining its different
delivery promise. Common rules unify responsibility and feedback, without making
all operations identical.

### Evidence needed before expanding

Use the [smallest implementation milestone](task-execution-capabilities-20261002.md#smallest-next-implementation)
for the next change. Establish the installed path first, then compare the reply
convenience on the same kind of assignment. Exercise actual entry, acceptance
and return boundaries, including fast feedback, restart and failure. Retain
known good cases: changed requirements on one assignment, useful progress with
independent waits, recovery through supported reads, and reuse of accepted work.

Compare fulfilled requirements and appropriate actions alongside human rescue,
duplicate work, model calls/tokens and retrieval cost. The retained 30-pair
comparison is a warning: fewer calls coincided with lower full behavioral
acceptance. It does not prove that this proposal improves or worsens those
results. Mechanical checks can establish delivery and replay semantics; model
trials establish whether the guide helps the agent use them.

Keep the common guide when it clarifies existing behavior at low cost. Repair
violated current promises at their owner. Implement a new convenience only for
an observed remaining burden; defer broader exposure when no assignment needs
it. Stop or reconsider a mechanism whose maintenance, prompt or failure cost
outweighs its benefit. This is the existing philosophy applied to this proposal,
not a new approval process or measurement service.

## Suggested implementation order

1. Consolidate the existing guide and contract descriptions, preserving current
   schema spelling and permission semantics. Check actual prepared worker input.
2. Close demonstrated exposure/wiring gaps through the existing owners. Include
   operation-level restrictions, native live capability access and supported
   human delivery; use current installed contracts until new ones are released.
3. Verify representative request paths: correction during an attempt, review
   while testing, interruption after acceptance, later input during retry,
   late results after closure, and owned investigation of repeated failures.
4. Trial the proposed reply convenience separately. It must reduce caller
   bookkeeping while reusing the existing request and Condition identities.

For each changed boundary, test the real entry and return path and the relevant
failure/restart case. A smoke that manually wakes the owner proves less than
one that resumes it automatically (#229, #276). Do not multiply identical tests
across every capability; cover the distinct adapters and lifetime behaviors.

The history supports this direction, but does not establish current live token
savings, recovery of a particular production Task, or better model judgment.
Those need comparable behavioral trials and post-activation observations.

## Inventory

The following inventory is ordered by merge time. Release/dependency entries
are retained for scope transparency and were screened as maintenance rather
than individually audited for the capability design.

| Merge order | PR | Design relevance | Source/test excerpts |
| --- | --- | --- | --- |
| 1 | [#289](https://github.com/hao1939/may-agent/pull/289) fix(workflows): enforce one deadline for setup and execution | Execution boundaries | Inspected |
| 2 | [#288](https://github.com/hao1939/may-agent/pull/288) fix(codex): resume long conversations without loading their full history | Affordable retrieval | Inspected |
| 3 | [#287](https://github.com/hao1939/may-agent/pull/287) fix(apps): reload pinned source without requiring a clean worktree | Installation and verification | Inspected |
| 4 | [#286](https://github.com/hao1939/may-agent/pull/286) fix(metrics): run metric SQL on a read-only database connection | Enforced operation contract | Inspected |
| 5 | [#284](https://github.com/hao1939/may-agent/pull/284) fix(tasks): restore Codex execution and keep correction requests reachable | Usable context and capabilities | Inspected |
| 6 | [#283](https://github.com/hao1939/may-agent/pull/283) fix(tasks): speed up requester lookup with a reverse route index | Affordable retrieval | Inspected |
| 7 | [#282](https://github.com/hao1939/may-agent/pull/282) feat(diagnostics): expose SQLite cost and recent slow queries | Evidence for evaluator judgment | — |
| 8 | [#281](https://github.com/hao1939/may-agent/pull/281) fix(execution): stop ordinary helpers after accepted finish | Execution boundaries | Inspected |
| 9 | [#280](https://github.com/hao1939/may-agent/pull/280) fix(conversation): avoid broad admission scans during recovery | Affordable retrieval | Inspected |
| 10 | [#277](https://github.com/hao1939/may-agent/pull/277) fix(conversation): keep automated reviews quiet and context focused | Usable context and capabilities | Inspected |
| 11 | [#278](https://github.com/hao1939/may-agent/pull/278) fix(metrics): avoid scanning all attempts for evidence reads | Affordable retrieval | Inspected |
| 12 | [#261](https://github.com/hao1939/may-agent/pull/261) chore(main): release 5.3.0 | Release/dependency maintenance | — |
| 13 | [#276](https://github.com/hao1939/may-agent/pull/276) Fix observer polling delays and incorrect Task links in event receipts | Observation and recovery | Inspected |
| 14 | [#275](https://github.com/hao1939/may-agent/pull/275) fix(inputs): share approval handling across Telegram and Console | Shared delivery and presentation | Inspected |
| 15 | [#274](https://github.com/hao1939/may-agent/pull/274) feat(metrics): expose trend evidence and retained breach decisions | Evidence for evaluator judgment | Inspected |
| 16 | [#271](https://github.com/hao1939/may-agent/pull/271) fix(tasks): reopen with new input and retain late observations | Observation and recovery | — |
| 17 | [#272](https://github.com/hao1939/may-agent/pull/272) fix(conversations): preserve accepted Requests across input batches | Requirements, outcomes and authority | Inspected |
| 18 | [#273](https://github.com/hao1939/may-agent/pull/273) fix(web): reuse the runtime App catalog | Shared delivery and presentation | — |
| 19 | [#270](https://github.com/hao1939/may-agent/pull/270) feat(observers): connect Task waits to App resource detectors | Observation and recovery | Inspected |
| 20 | [#269](https://github.com/hao1939/may-agent/pull/269) fix(tasks): settle only the requests a worker answers | Requirements, outcomes and authority | Inspected |
| 21 | [#268](https://github.com/hao1939/may-agent/pull/268) fix(tasks): keep assigned input visible in context previews | Usable context and capabilities | — |
| 22 | [#267](https://github.com/hao1939/may-agent/pull/267) fix(conversation): allow Task references without prior attachment | Requirements, outcomes and authority | — |
| 23 | [#266](https://github.com/hao1939/may-agent/pull/266) fix(tasks): share execution context and Task reads | Usable context and capabilities | — |
| 24 | [#265](https://github.com/hao1939/may-agent/pull/265) fix(tasks): centralize attempt setup and cleanup | Execution boundaries | — |
| 25 | [#264](https://github.com/hao1939/may-agent/pull/264) fix(conversation): present the whole input batch before reply routing | Usable context and capabilities | — |
| 26 | [#263](https://github.com/hao1939/may-agent/pull/263) fix(events): preserve event metadata across storage and retries | Shared delivery and presentation | — |
| 27 | [#262](https://github.com/hao1939/may-agent/pull/262) refactor(conversation): separate context from task authority | Requirements, outcomes and authority | Inspected |
| 28 | [#260](https://github.com/hao1939/may-agent/pull/260) fix(health): label session completion separately from task success | Requirements, outcomes and authority | — |
| 29 | [#259](https://github.com/hao1939/may-agent/pull/259) fix(tasks): expose the scheduler condition review deadline | Requirements, outcomes and authority | — |
| 30 | [#258](https://github.com/hao1939/may-agent/pull/258) fix(conversation): share reply validation between execution and settlement | Requirements, outcomes and authority | Inspected |
| 31 | [#246](https://github.com/hao1939/may-agent/pull/246) chore(main): release 5.2.0 | Release/dependency maintenance | — |
| 32 | [#257](https://github.com/hao1939/may-agent/pull/257) feat(reporting): expose task attempt history for systemic evaluation | Evidence for evaluator judgment | Inspected |
| 33 | [#256](https://github.com/hao1939/may-agent/pull/256) refactor(agents): separate execution instructions from App requests | Usable context and capabilities | Inspected |
| 34 | [#255](https://github.com/hao1939/may-agent/pull/255) refactor(tasks): simplify attempt execution and failure settlement | Execution boundaries | — |
| 35 | [#254](https://github.com/hao1939/may-agent/pull/254) fix(events): recover App routing after translation failures | Observation and recovery | — |
| 36 | [#253](https://github.com/hao1939/may-agent/pull/253) refactor(tasks): make waiting-result settlement explicit | Execution boundaries | — |
| 37 | [#252](https://github.com/hao1939/may-agent/pull/252) refactor: remove evaluation policy from session health | Evidence for evaluator judgment | — |
| 38 | [#251](https://github.com/hao1939/may-agent/pull/251) refactor: remove ignored agent context configuration | Usable context and capabilities | Inspected |
| 39 | [#245](https://github.com/hao1939/may-agent/pull/245) chore(deps): bump @earendil-works/pi-coding-agent from 0.85.1 to 0.87.1 in /container | Release/dependency maintenance | — |
| 40 | [#250](https://github.com/hao1939/may-agent/pull/250) test: verify session lifecycle and remove unused helpers | Execution boundaries | — |
| 41 | [#249](https://github.com/hao1939/may-agent/pull/249) fix(release): test the built image before publishing | Installation and verification | — |
| 42 | [#248](https://github.com/hao1939/may-agent/pull/248) refactor: remove unused helpers and misleading test scaffolding | Simplification and existing boundaries | — |
| 43 | [#247](https://github.com/hao1939/may-agent/pull/247) test(codex): verify CLI behavior instead of schema fingerprints | Installation and verification | — |
| 44 | [#244](https://github.com/hao1939/may-agent/pull/244) chore(deps): bump @anthropic-ai/claude-code from 2.1.274 to 2.1.281 in /container | Release/dependency maintenance | — |
| 45 | [#243](https://github.com/hao1939/may-agent/pull/243) chore(deps): bump @openai/codex from 0.154.0 to 0.156.1 in /container | Release/dependency maintenance | — |
| 46 | [#242](https://github.com/hao1939/may-agent/pull/242) chore(deps-dev): bump the maintenance group with 6 updates | Release/dependency maintenance | — |
| 47 | [#233](https://github.com/hao1939/may-agent/pull/233) refactor(http): extract existing read routes from the server | Simplification and existing boundaries | — |
| 48 | [#238](https://github.com/hao1939/may-agent/pull/238) refactor(sessions): remove disconnected completion side effects | Simplification and existing boundaries | — |
| 49 | [#236](https://github.com/hao1939/may-agent/pull/236) refactor(maintenance): remove the unused workflow launch adapter | Simplification and existing boundaries | — |
| 50 | [#240](https://github.com/hao1939/may-agent/pull/240) fix(maintenance): preserve declared event metadata | Shared delivery and presentation | — |
| 51 | [#237](https://github.com/hao1939/may-agent/pull/237) fix(tools): expose supported options and return usable session IDs | Usable context and capabilities | Inspected |
| 52 | [#235](https://github.com/hao1939/may-agent/pull/235) fix(conversation): derive active turns from current Task attempts | Requirements, outcomes and authority | — |
| 53 | [#239](https://github.com/hao1939/may-agent/pull/239) test(telegram): wait for task notifications in both chats | Shared delivery and presentation | — |
| 54 | [#234](https://github.com/hao1939/may-agent/pull/234) test(tasks): observe recovery deadlines without fixed sleeps | Observation and recovery | — |
| 55 | [#231](https://github.com/hao1939/may-agent/pull/231) docs: clarify Host source navigation and deployment instructions | Simplification and existing boundaries | — |
| 56 | [#232](https://github.com/hao1939/may-agent/pull/232) refactor: clarify Host internal APIs and imports | Simplification and existing boundaries | — |
| 57 | [#230](https://github.com/hao1939/may-agent/pull/230) Keep current Task context available across agent execution | Usable context and capabilities | — |
| 58 | [#229](https://github.com/hao1939/may-agent/pull/229) test(tasks): verify automatic saved-answer recovery | Observation and recovery | — |
| 59 | [#228](https://github.com/hao1939/may-agent/pull/228) Preserve Task ownership and return recovery failures | Observation and recovery | — |
| 60 | [#222](https://github.com/hao1939/may-agent/pull/222) chore(main): release 5.1.0 | Release/dependency maintenance | — |
| 61 | [#227](https://github.com/hao1939/may-agent/pull/227) fix(tasks): separate completion cleanup from cancellation | Requirements, outcomes and authority | Inspected |
| 62 | [#226](https://github.com/hao1939/may-agent/pull/226) fix(apps): show why public input requests are rejected | Usable context and capabilities | Inspected |
| 63 | [#225](https://github.com/hao1939/may-agent/pull/225) fix(apps): expose input contracts and explain rejected requests | Usable context and capabilities | Inspected |
| 64 | [#224](https://github.com/hao1939/may-agent/pull/224) feat(models): add an experimental DeepSeek option | Installation and verification | — |
| 65 | [#223](https://github.com/hao1939/may-agent/pull/223) fix(execution): report the tools available to direct runs | Usable context and capabilities | — |
| 66 | [#221](https://github.com/hao1939/may-agent/pull/221) fix(telegram): reduce duplicate alerts and distinguish human actions | Shared delivery and presentation | — |
| 67 | [#212](https://github.com/hao1939/may-agent/pull/212) chore(main): release 5.0.1 | Release/dependency maintenance | — |
| 68 | [#211](https://github.com/hao1939/may-agent/pull/211) chore(deps): update Claude Code to 2.1.274 and fix CI races | Release/dependency maintenance | — |
| 69 | [#220](https://github.com/hao1939/may-agent/pull/220) fix(deploy): allow deployment without an App task | Simplification and existing boundaries | — |
| 70 | [#218](https://github.com/hao1939/may-agent/pull/218) fix(tasks): prevent repeated runs after a completed review | Observation and recovery | Inspected |
| 71 | [#217](https://github.com/hao1939/may-agent/pull/217) fix(tasks): honor explicit dependency review schedule updates | Observation and recovery | — |
| 72 | [#216](https://github.com/hao1939/may-agent/pull/216) fix(tasks): find human actions through indexed links | Affordable retrieval | — |
| 73 | [#215](https://github.com/hao1939/may-agent/pull/215) fix(telegram): clarify task states in /tasks and /todo | Shared delivery and presentation | — |
| 74 | [#214](https://github.com/hao1939/may-agent/pull/214) fix(tasks): expose older accepted evidence through Task reads | Usable context and capabilities | — |
| 75 | [#213](https://github.com/hao1939/may-agent/pull/213) fix(telegram): make task lists readable and show scheduled recurrence | Shared delivery and presentation | — |
| 76 | [#210](https://github.com/hao1939/may-agent/pull/210) fix(tasks): keep unfinished work recoverable across handoffs | Observation and recovery | — |
| 77 | [#190](https://github.com/hao1939/may-agent/pull/190) chore(main): release 5.0.0 | Release/dependency maintenance | — |
| 78 | [#209](https://github.com/hao1939/may-agent/pull/209) fix(tasks): preserve independent waits and deferred reviews | Observation and recovery | — |
| 79 | [#207](https://github.com/hao1939/may-agent/pull/207) chore(deps-dev): bump the maintenance group with 3 updates | Release/dependency maintenance | — |
| 80 | [#208](https://github.com/hao1939/may-agent/pull/208) chore(deps): bump the actions group with 2 updates | Release/dependency maintenance | — |
| 81 | [#205](https://github.com/hao1939/may-agent/pull/205) chore(deps): bump typebox from 1.3.30 to 1.3.32 in the pi-runtime group | Release/dependency maintenance | — |
| 82 | [#206](https://github.com/hao1939/may-agent/pull/206) chore(deps): bump @anthropic-ai/claude-code from 2.1.267 to 2.1.273 in /container | Release/dependency maintenance | — |
| 83 | [#204](https://github.com/hao1939/may-agent/pull/204) Lock container CLI tools and expose ordinary commands | Installation and verification | — |
| 84 | [#185](https://github.com/hao1939/may-agent/pull/185) chore(deps): bump typebox from 1.3.28 to 1.3.30 in the pi-runtime group | Release/dependency maintenance | — |
| 85 | [#203](https://github.com/hao1939/may-agent/pull/203) fix(state): recover a stuck Conversation input offline | Observation and recovery | — |
| 86 | [#200](https://github.com/hao1939/may-agent/pull/200) fix(tasks): mark recurring tasks without hiding human decisions | Shared delivery and presentation | — |
| 87 | [#202](https://github.com/hao1939/may-agent/pull/202) fix(inbox): reject misrouted input before it blocks a conversation | Observation and recovery | — |
| 88 | [#199](https://github.com/hao1939/may-agent/pull/199) fix(runtime): keep task worker role process-local | Execution boundaries | — |
| 89 | [#197](https://github.com/hao1939/may-agent/pull/197) feat(runtime): bind approvals and activation to exact Task evidence | Requirements, outcomes and authority | — |
| 90 | [#198](https://github.com/hao1939/may-agent/pull/198) fix(checkpoint): preserve numbering across process restarts | Execution boundaries | — |
