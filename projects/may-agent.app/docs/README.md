# May System Documentation

This is the single design and operating-documentation home for May, including
its Host in `projects/may-agent`. Start with [May's goal](1-principles/design-philosophy.md#mays-goal)
for the intended outcome and [System Model](2a-design/system-model.md) for how
the system works. Use [INDEX.md](INDEX.md) to find the document that owns a
specific contract.

**Source baseline:** Current implementation descriptions refer to Host `main`
at `b81a5d62` (reviewed September 10, 2026), including finite Task stop (#111)
and conversational ownership, bounded failure, Requests and durable turn Stop (#112).
Later focused reviews state a newer revision on their owning page: Conversation
and storage were reviewed against `99bc1a31`. Candidate-branch behavior and its
validation stay in the linked proposals until merged. Source baselines do not
identify the deployed release.

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

The [system simplification review](proposals/authority-boundary-simplification.md#design-choices-before-code-moves)
compares removing conversational child waits, reducing evaluation UI features,
and affordable workflow redo before larger code moves. It builds on #129's
merged state/frontend separation (`0bedd93a`). The selected import/navigation
and foreground-App changes are tracked in its implementation evidence; larger
feature reductions remain conditional.

The [external component plan](proposals/external-components-simplification.md#candidate-evidence)
records the completed source fixes for guard guidance, the blocking credential
probe, and Telegram I/O. Scout's fix is on workspace `main`; Host #132 and #133
merged as `23968acd` and `39a23f22`. Deployment remains separate. Evaluation
feature reduction, metric improvements, and code moves remain conditional.

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
Error/metric placement and App consolidation remain
[paused](archive/reviews/error-handling-and-conversation-discussion-20260910.md).

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
