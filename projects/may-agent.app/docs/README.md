# May System Documentation

This is the single design and operating-documentation home for May, including
its Host in `projects/may-agent`. Start with [May's goal](1-principles/design-philosophy.md#mays-goal)
for the intended outcome and [System Model](2a-design/system-model.md) for how
the system works. Use [INDEX.md](INDEX.md) to find the document that owns a
specific contract.

**Source baseline:** The consolidated Host checkout is `main` at `5857529e`
(September 11, 2026), including directory organization, core policy cleanup and
workflow failure evidence, Task definition preparation (#146) and runtime adapter
publication cleanup (#145). Dated reviews
retain the revision they examined;
this baseline does not imply a fresh review of every subsystem or identify the
deployed release. Candidate behavior and validation stay in linked proposals
until merged.

Conversation is the default for discussion and joint work. A **Request** is an
accepted ask May must close the loop on. An independent **Task** can run in the
background; an **Attempt** is one bounded execution of that Task.

Read the [System Model](2a-design/system-model.md) for a complete example, then
[Architecture](2a-design/architecture.md) for the four core responsibilities and
code layout. [Message Lifecycle](2a-design/message-lifecycle.md) owns Request
recognition, acknowledgment, tracking and closure.
It also distinguishes an interactive Turn from an internal model step and an
inbox item from an accepted Request. [Architecture](2a-design/architecture.md#conversation-core-and-capability-boundary)
places durable guarantees in core and conversational behavior in replaceable
capabilities; [Storage](2a-design/storage.md#conversation-state-api) defines their
small shared state boundary.

## Current focus

The [Task context discovery proposal](proposals/task-context-discovery-20260917.md)
adds a shared `TASK.md` entry with full context and discovery references. Its
local trials assess omitted-information discovery, self-diagnosis and unprompted
method selection. Its [handoff refinement](2a-design/workflows.md#one-handoff-contract)
separates the shared Task from each contribution and applies one execution/result
contract across agent and workflow calls. Candidate status and limits are recorded
in the proposal.

The [workflow enforcement table](2a-design/workflows.md#enforcement-infrastructure-and-guidance)
distinguishes shared guarantees, available infrastructure and current gaps.
[Authoring best practices](2b-manual/workflow-authoring.md#best-practices-and-learning)
keep uncertain procedure choices advisory until ordinary usage justifies code.

The [execution consolidation proposal](proposals/execution-entrypoint-consolidation.md)
addresses inconsistent helper scope, watchdog rules, one-shot completion and
standalone session recovery after the execution-feedback PoC. Keep bounded agent
calls and direct CLI use; share execution rules without giving every invocation a
Task. It records source findings, consumer migration, deletion gates and checks.
The [implemented candidate and PoC evidence](archive/reviews/execution-consolidation-poc-20260914.md)
record the passing source checks and remaining live-trial limits; deployment is separate.

The [scripts review proposal](proposals/poc-retirement-and-knowledge-20260912.md)
accounts for the refreshed 54-file Host inventory, including all 27 files in
`scripts/poc/`. Its isolated implementation removes that folder, retains useful
checks in maintained suites, and preserves findings with exact historical source
references. Command-safety fixes are reviewed separately; Gym compatibility stays
until its consumers/storage migrate together. This is not a merged/deployed claim.

The [caller-feedback proposal](proposals/caller-feedback-and-waiting.md) explores
returning problems to the exact caller without another escalation lifecycle.
Its isolated PoC exercises Task and Conversation returns, reporting while
waiting, and execution-failure feedback. Bounded live-agent trials now include
human-help judgment and same-Task continuation after repair. The follow-up
aligns Condition-owner schema guidance and the merged Task lifecycle docs.
The candidate now integrates main's shared failure path (#167), with focused
checks and a live below-minimum comparison. Source promotion and deployment
remain separate.

The [unified-Task improvement trial](proposals/task-improvement-poc-20260912.md)
extends agent-operated guidance work through a durable wait and Task-runtime/storage
reopen. One Task resumed across two managed attempts, activated its candidate and
passed four withheld checks. A separate withdrawal trial prevented later activation.
The retained unsuccessful trials exposed fixture tool rebinding and a no-op-event
counting error, not a need for another learning lifecycle. No production changes.

The [agent-operated improvement PoC](proposals/agent-operated-improvement-poc-20260912.md)
now tests the extension mechanisms without a human operating the intermediate
steps. Four temporary trials completed 42 model executions and 16 correct
withheld answers. Review tightened recovery evidence: the two new trials prove
failure delivery preceded the retry request. One also exposed an inaccessible
guidance reference despite correct answers. Clarifying target access and exposing
tool-error counts produced a later candidate with zero probe/holdout tool errors.
The earlier defect remains recorded; this is not a general reliability claim.
Compact answers with on-demand evidence kept the interface usable. This supports agent-directed use of existing capabilities,
not a new learning controller or a requirement to complete a Gym campaign.
Production authority and installed-path adoption remain separate.

The [agent extension proposal](proposals/agent-behavior-and-capability-extension.md)
follows a human correction through scoped guidance, verified activation and
use in later ordinary work. Instructions, skills, tools and workflows use
existing conventions. The [focused local PoC](proposals/agent-adoption-poc-20260912.md)
supports guidance adoption. The [workflow follow-up](proposals/workflow-stability-poc-20260912.md)
evaluates process stability rather than smarter or faster judgment. The
[real-daemon teaching trial](proposals/conversation-adoption-poc-20260912.md)
now verifies scoped agent-authored guidance and later Conversation adoption in
isolation. Installed authority/catalog and background Task adoption remain
separate checks; focused Host PRs #159/#160 are under review.
The [extension-method matrix](proposals/extension-methods-poc-20260912.md)
compares suitable cases, activation, lifetime and agent use, including crowded
discovery and isolated cross-agent teaching. It identifies feedback delivery
and post-promotion activation as the next integration gaps.
The [first integration candidate](proposals/feedback-adoption-integration-20260912.md)
restores reachable feedback and keeps unverified source adoption pending; four
model checks confirm the feedback read/update/clear path. Its ordinary-Task
follow-up verifies adoption in fresh dispatches while retaining an unsuccessful
immediate-wake timing case. A further no-model trial connects exact approved
source to a linked Task result and fixes a source-event publication defect.
Deployment and production owner acceptance of adoption remain separate.

The [Telegram experience proposal](proposals/telegram-conversation-experience.md)
tracks candidate fixes for five reproduced reliability defects alongside
conversation-first presentation and guidance. It reuses existing context and
Task controls, keeps commands optional, and separates source verification from
the pending live experience trial.

The [One Task lifecycle proposal](proposals/conversation-input-unification.md)
accepts one Task model and controller: handle durable input, record an explicit
outcome, rest, and run again when needed. The App, parent agent or human decides
when to close the Task. Human interaction, delegation and scheduled observation
are capabilities a Task can combine. Messages, Topics and accepted Requests
preserve human context within that loop. This replaces the earlier scheduler-only
candidate; merged Host #158 (`f5d5a535`) implements shared execution and
input/result routes. This is source status, not deployment evidence. Full CI, live nested delegation and an isolated daemon
cutover pass. Compatibility retirement and the expected reduction in maintenance
cost remain under review. The proposal links the evidence and remaining gates.

The [system simplification review](proposals/authority-boundary-simplification.md#design-choices-before-code-moves)
tracks the merged removal of conversational child waits in Host #140, with
visible retirement of old waits and preservation of accepted Requests and Task
work. Import/navigation and foreground-App selection landed in #138/#139.
Core/composition directory organization landed in Host #141 (`48254267`).
Codex executor/observer grouping landed in #142 (`427d4ea1`). The
[core policy cleanup](proposals/authority-boundary-simplification.md#core-policy-cleanup)
merged in #144 (`8e242c11`): it removes obsolete recovery escalation and keeps
conversational selection in composition.
The [Task lifecycle review](proposals/task-runtime-organization.md#task-lifecycle-review)
traces admission through restart; the focused reload fix merged in #145 (`5857529e`).
Definition preparation merged in #146 (`e1a0005e`). The
[Request follow-through review](proposals/task-runtime-organization.md#request-follow-through-review)
checks correction, non-success and closure across storage reopen. HTTP handler extraction remains separate.
Evaluation feature reduction and workflow redo remain conditional. Candidate
validation and merge status live in the proposal; deployment remains separate.

The [external component plan](proposals/external-components-simplification.md#candidate-evidence)
records the completed source fixes for guard guidance, the blocking credential
probe, and Telegram I/O. Scout's fix is on workspace `main`; Host #132 and #133
merged as `23968acd` and `39a23f22`. Deployment remains separate. Evaluation
feature reduction and metric improvements remain conditional; directory
organization is accepted and tracked by the simplification review.

The [observer feedback proposal](proposals/observer-feedback-and-resource-conventions.md)
applies the accepted contract-and-convention principle to two concrete gaps:
publication-safe observation memory for Scout and one resource-linked GitHub
PR observer. A fixture reproduced lost feedback; the proposed SDK/adapter
changes and live integration proof are not yet implemented.

The [workflow practices review](proposals/workflow-practices-review.md) applies
multi-worker lessons to installed Apps: isolated changes, exact-candidate
verification, reviewed integration, and useful progress during external waits.
It tracks each workflow separately; revised guidance is not deployment proof.

Keep the core simple and robust. The [core review plan](proposals/task-runtime-organization.md)
tracks completed input-handling fixes and remaining state/interaction work;
the [gap index](proposals/design-implementation-convergence.md)
links its owners. Request storage, bounded failed turns and durable Stop are
implemented. Host #121 added input-runtime containment and Esc/Stop-button
bindings; #127 added dispatch-failure pacing and cancellation of capacity waits
on close (merged as `743aa5de`). #129 consolidated naming and the state API.
Remaining work includes current-turn steering and usage validation. App judgment and
deployment need their own evidence.
The [sequential implementation plan](proposals/storage-state-service.md#implementation-order-and-acceptance)
tracks seven acceptance steps, now grouped into three ordered source PRs from
Host `0d8c7658`. The [candidate review](proposals/storage-state-service.md#candidate-review-and-landing-order)
records the code map and checks. #130 and #131 were incorporated into #129,
which merged to Host `main` as `0bedd93a`. Deployment has not been verified.
Completed separation and recovery reviews live in the [archive](archive/README.md).
The [workflow tracing and health metrics proposal](proposals/workflow-tracing-and-health-metrics.md)
reopens the discussion with a narrower direction: keep evidence with each run
and derive balanced health summaries through replaceable components, with a
stronger path for investigating failures. The bounded first source slice merged
in #143 (`939698ad`). The [page refinement candidate](proposals/workflow-tracing-and-health-metrics.md#page-refinement-candidate)
is Host #147 (`374a99db`): it keeps SQLite history and adds shared workflow
summaries, truthful observations and run-evidence inspection to the existing
pages. Standard metric semantics apply; a Prometheus client remains an optional
recording/export helper, not a history store or new core dependency. The
proposal records validation and remaining gaps. Neither source work nor these
documents verify or activate deployment.
The earlier error-routing alternatives and App consolidation remain
[archived](archive/reviews/error-handling-and-conversation-discussion-20260910.md).

## Choose a reading path

| I want to… | Start here | Then read as needed |
| --- | --- | --- |
| Understand what May is for and what counts as progress | [Goal definition](1-principles/design-philosophy.md#define-the-goal-first) | [Fundamental tradeoff rules](1-principles/design-philosophy.md#how-to-decide-a-tradeoff) |
| Choose work or review a design or PR | [Decision and review guide](1-principles/core-principles.md#review-rule) | [Fundamental tradeoff rules](1-principles/design-philosophy.md#how-to-decide-a-tradeoff), then the owning contract in [INDEX](INDEX.md) |
| Build an App or improve its behavior | [SDK Quickstart](2b-manual/sdk-quickstart.md) | [App Contract](2a-design/agent-app.md), [Task authoring](2b-manual/handler-authoring.md), [Workflow authoring](2b-manual/workflow-authoring.md), [Adoption checklist](2b-manual/agent-app-adoption-playbook.md) |
| Use or operate May | [User Guide](2b-manual/user-guide.md) | [Operations and Recovery](2b-manual/app-operations-recovery.md), [Metric Alerts](2b-manual/metric-alerts.md), [Event Audit](2b-manual/event-runtime-audit.md) |
| Change the Host | [Architecture](2a-design/architecture.md) | [Host/App Boundary](2a-design/system-boundary.md), then the owning subsystem in [INDEX](INDEX.md) |

## Where information belongs

| Folder | Purpose |
| --- | --- |
| `1-principles/` | Stable requirements and decision rules |
| `2a-design/` | Current contracts, with explicit implementation gaps |
| `2b-manual/` | Practical guidance derived from those contracts |
| `examples/` | Checked App, result and control-client examples used by the manuals |
| `proposals/` | Pending decisions and verified open implementation work |
| `archive/` | Superseded decisions, versioned migrations and dated evidence |

The project goal anchors the principles; principles guide design, and design
governs manuals. When implementation conflicts
with an accepted requirement, record the gap explicitly. Do not silently change
the requirement or describe the implementation as compliant. Design acceptance,
source implementation, and deployment verification are separate facts.

Contracts can be simplified when their guarantees cost more than their real
value. Revise the owning contract and affected implementation together, making
the accepted limitations clear. Use the
[tradeoff rules](1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
when a fix becomes complex; an existing contract is not a reason to keep adding
machinery without reconsidering the need.

Keep `Design status` and `Implementation status` concise. Each rule has one
owning document, listed in INDEX; other pages link to it. Put completed migration
and PR history in the [archive](archive/README.md). Update the owning contract
with a source change and keep copyable examples checked against that SDK.

From the workspace root, `bun run check:may-design` checks document integrity,
the linked examples, and the canonical App boundary. It is a source check,
not deployment proof.
