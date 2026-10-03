# May design and operating guide

**Supports:** [May's purpose](1-principles/purpose.md). Makes the system understandable and usable, and keeps design choices traceable to their value.

May helps Hao turn intent into useful, verified results with decreasing
supervision and acceptable total cost. Work should remain understandable and
steerable. **Agents own Tasks and decide; infra executes and keeps the records.**
An App extends its owner agent with a scoped address, shared context and knowledge,
policy, capabilities and collaborating agents. The [ownership contract](2a-design/agents.md#task-ownership-and-app-scope)
distinguishes this model from the current App requirement for durable admission.

Discuss and work in Conversation. A **Request** is an accepted ask to fulfill.
A **Task** retains work across executions. An **attempt** is one bounded
execution; it can take many actions. A pending **Condition** records a needed
fact while other useful work can continue.

## Start here

1. [Purpose and value](1-principles/purpose.md): what May is for and what counts as progress.
2. [System Model](2a-design/system-model.md): one complete example, vocabulary and required abilities.
3. [Design Philosophy](1-principles/design-philosophy.md) and [Core Principles](1-principles/core-principles.md): how we choose a sufficient design.
4. [Working on a Task](2b-manual/task-execution-guide/SKILL.md): how an agent uses current capabilities and decides its next step.

Then use [INDEX](INDEX.md) to find the one document that owns your question.
You do not need to read proposals or historical trials to understand the current
contract. Specific implementation gaps remain marked beside affected behavior.

## Choose a reading path

| I want to… | Read |
| --- | --- |
| Understand the system | [System Model](2a-design/system-model.md), then [Architecture](2a-design/architecture.md) |
| Work as an agent | [Task execution guide](2b-manual/task-execution-guide/SKILL.md); load exact capability references as needed |
| Build an App or workflow | [SDK Quickstart](2b-manual/sdk-quickstart.md), [Task authoring](2b-manual/handler-authoring.md), [Workflow authoring](2b-manual/workflow-authoring.md) |
| Change infra | [Host/App boundary](2a-design/system-boundary.md), then the owning contract in [INDEX](INDEX.md) |
| Read implementation | [Source reading guide](2b-manual/source-reading-guide.md) |
| Operate or recover May | [User guide](2b-manual/user-guide.md), [Operations and Recovery](2b-manual/app-operations-recovery.md) |
| Write or review a design | [Design authoring and review](2b-manual/design-authoring/SKILL.md), usable directly as agent skill instructions |
| Review future changes | [Active proposals and follow-up](proposals/README.md) |
| Inspect earlier decisions or trials | [Archive](archive/README.md) |

## Design hierarchy

Purpose and value → needed abilities → responsibilities → contracts → usage and evidence.
Philosophy, conventions and verified practice explain the choices along that path.
Each design links its contribution to a parent need and states why its mechanism
is appropriate. The [authoring guide](2b-manual/design-authoring/SKILL.md#design-hierarchy)
owns this convention and how to compare, split or retire documents.

## Where information belongs

| Location | Responsibility |
| --- | --- |
| `1-principles/` | Purpose, values and decision rules |
| `2a-design/` | Owning contracts, with explicit implementation limits |
| `2b-manual/` | Practical guidance for agents, authors and operators, including skill packages |
| `examples/` | Checked examples used by the guides |
| `proposals/` | Remaining design choices and implementation follow-up |
| `archive/` | Dated decisions, migrations and trial evidence |

The design authoring and Task execution manuals are canonical
`2b-manual/<name>/SKILL.md` packages. This index links to the same files people
and agents read; there is no separate skill copy. Other manuals and contracts
remain references loaded only when needed. Update affected skills alongside
design changes. `shared/skills/paths.json` points May's catalog at this manual
directory; see [discovery and availability](2a-design/skills.md#optional-discovery-paths).

## Reading source and installation status

Design acceptance, source implementation and deployment are separate facts.
A merged proposal can remain unimplemented. The running Host's artifact receipt
and installed immutable App definition release identify live behavior; checkout
`HEAD` alone does not. Use [deployment verification](2b-manual/app-operations-recovery.md#read-only-deployment-verification)
for that question.

## Keeping the contract readable

Update the owning rule and directly affected guides/examples together. Integrate
implemented proposals, separate unresolved choices, and archive dated evidence.
The [authoring guide](2b-manual/design-authoring/SKILL.md) explains the procedure and
agent-usability criteria. `bun run check:may-design` checks document integrity,
examples and App boundaries; it does not certify agent judgment or deployment.
