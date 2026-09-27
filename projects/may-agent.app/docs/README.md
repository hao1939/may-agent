# May System Documentation

This is the single design and operating-documentation home for May, including
its Host in `projects/may-agent`. Start with [May's goal](1-principles/design-philosophy.md#mays-goal)
for the intended outcome and [System Model](2a-design/system-model.md) for how
the system works. Use [INDEX.md](INDEX.md) to find the document that owns a
specific contract.

## Reading source and installation status

Keep four facts separate: this documentation states the intended contract; a
source review names the exact Host revision it inspected; the running binary is
identified by its embedded revision and artifact receipt; and the active App and
agent definitions come from an installed immutable definition release. Source
checkout `HEAD` is not deployed identity, and a passing source check does not
prove rollout. Preserve revisions in dated reviews rather than maintaining a
volatile baseline here. Operators recover the exact receipt and compare binary,
SDK, UI, and definition provenance through [Operations and
Recovery](2b-manual/app-operations-recovery.md#read-only-deployment-verification).

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

## Choose a reading path

| I want to… | Start here | Then read as needed |
| --- | --- | --- |
| Understand what May is for and what counts as progress | [Goal definition](1-principles/design-philosophy.md#define-the-goal-first) | [Fundamental tradeoff rules](1-principles/design-philosophy.md#how-to-decide-a-tradeoff) |
| Choose work or review a design or PR | [Decision and review guide](1-principles/core-principles.md#review-rule) | [Fundamental tradeoff rules](1-principles/design-philosophy.md#how-to-decide-a-tradeoff), then the owning contract in [INDEX](INDEX.md) |
| Read and review the implementation | [Source reading guide](2b-manual/source-reading-guide.md) | Follow one Task, then choose context, Conversation, workflow, recovery or App routes |
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
| `proposals/` | Design discussions and implementation records; check each record's status |
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
owning document, listed in INDEX; other pages link to it. Keep dated migration
and PR evidence out of the current contract. Retain existing record paths so
links remain useful; a proposal's location does not mean its work is pending.
Update the owning contract
with a source change and keep copyable examples checked against that SDK.

From the workspace root, `bun run check:may-design` checks document integrity,
the linked examples, and the canonical App boundary. It is a source check,
not deployment proof.

The [September 27 documentation review](archive/reviews/design-doc-hygiene-20260927.md)
records the source checks, corrections and remaining implementation limits.

## Keeping the contract readable

When a behavior changes, follow its input, owning state, execution and result
back to the caller. Update the one owning contract and its directly affected
manuals/examples together. Check for a stale document, a conflicting design
rule, an implementation defect, or an intentional limitation; those need
different remedies. Preserve an accepted requirement when code falls short,
and record the gap with a source entrypoint and the evidence needed to close it.

Use short implementation-status summaries. Keep PR chronology and experiments
in linked records, and describe a historical finding as historical. Existing
integrity/example checks catch broken structure and API examples; they cannot
establish semantic agreement with source or certify agent behavior.
