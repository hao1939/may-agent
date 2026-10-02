# May System Documentation

**Supports:** [May's goal](1-principles/design-philosophy.md#mays-goal). Keeps feature needs and design choices traceable so the system remains understandable and affordable to change.

This is the single design and operating-documentation home for May, including
its Host in `projects/may-agent`. Start with [May's goal](1-principles/design-philosophy.md#mays-goal)
for the intended outcome and [System Model](2a-design/system-model.md) for how
the system works. Use [INDEX.md](INDEX.md) to find the document that owns a
specific contract.

## Design hierarchy

The design has a hierarchy of reasons. From a specific rule, a reader should
be able to follow why it exists back to the project's purpose. From the purpose,
a reader should be able to find the designs responsible for delivering its value.

```text
Project purpose and value                     Design Philosophy
  -> needed features and behavior              System Model
    -> responsibilities and shared boundaries  Architecture / Host-App Boundary
      -> specific behavior and contracts       owning subsystem design
        -> use, implementation and evidence    manuals, code, trials and reviews

Philosophy + conventions + verified practice
  -> why we choose this design over alternatives, at each relevant level
```

Each step explains how it contributes to the step above. The
[project goal](1-principles/design-philosophy.md#mays-goal) owns purpose and value;
the [system responsibilities](2a-design/system-model.md#from-purpose-to-system-responsibilities)
translate them into abilities and link the owning designs. The tiers below
remain storage categories. No directory move or new document is required for
each level; a section can own a small responsibility.

For each design, keep the following explanation beside its contract:

- **Supports:** link to the specific parent responsibility or requirement.
- **Contribution:** explain what becomes possible or less costly, and what
  would be lost without this behavior. A generic link to the project goal is
  insufficient on its own.
- **Choice and limits:** explain why this mechanism is sufficient, its material
  cost, and why a simpler existing path does not meet the need. Link the relevant
  philosophy and convention, explaining how they informed the choice. State a
  justified exception explicitly. Avoid restating the parent contract.
- **Evidence:** link observations or checks that support the choice, identify
  uncertainty, and say what would justify revisiting it.

A short paragraph can cover these points. Existing documents can retain their
own headings; this is a review convention, not a required schema or approval
process. Drafts identify their proposed parent and remain drafts until accepted.
A proposal can be merged while still draft or unimplemented. Record design
acceptance, source implementation and deployment separately; merging the document
does not by itself establish any of them.

Keep scope/ownership, evidence/uncertainty and status/revisit conditions explicit
where they affect the decision. They are supporting dimensions, not more levels
in the hierarchy. Cost belongs in the comparison of choices, including human
attention, runtime work and maintenance. A source fix and a verified improvement
in use are different evidence.

Use one primary parent for navigation and additional links where a shared design
supports several responsibilities. Storage, events and execution need not be
copied into separate value branches. Dependency links explain what a design uses;
the parent link explains why it exists. Evidence can challenge a mechanism or a
parent requirement, so review can move upward as well as downward.

For example: less human supervision -> carry work through interruption ->
durable Task ownership -> retain unanswered inputs and accepted results ->
verify that resumed work incorporates a correction without losing prior work.
This justifies preserving responsibility; it does not, by itself, require
preserving every execution step. Cheap work can still restart.

Purpose and value explain **why** a design is needed. Philosophy and conventions
guide **how** to choose it. The
[conflict review rule](1-principles/core-principles.md#resolve-conflicting-designs)
owns comparison of competing proposals. Existing conventions provide a useful
default; an evidence-backed exception can improve the outcome. A new proposal
does not silently replace the accepted contract, and an accepted contract can
be revised when its value no longer justifies its cost.

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
| Explain why a feature exists or choose between conflicting proposals | [Design hierarchy](#design-hierarchy) | [Feature responsibilities](2a-design/system-model.md#from-purpose-to-system-responsibilities), then [conflict review](1-principles/core-principles.md#resolve-conflicting-designs) |
| Choose work or review a design or PR | [Decision and review guide](1-principles/core-principles.md#review-rule) | [Fundamental tradeoff rules](1-principles/design-philosophy.md#how-to-decide-a-tradeoff), then the owning contract in [INDEX](INDEX.md) |
| Read and review the implementation | [Source reading guide](2b-manual/source-reading-guide.md) | Follow a Task and agent execution; inspect model context, evidence and extension boundaries |
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
