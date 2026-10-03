# Proposals and implementation follow-up

**Supports:** [Design authoring and review](../2b-manual/design-authoring/SKILL.md). Keeps unresolved choices visible without making readers reconstruct current behavior from old PR discussions.

For supported behavior, use [the current contract index](../INDEX.md). These
documents hold remaining choices, adoption questions or implementation follow-up.
Their source findings are dated; inclusion is not a claim that every old defect
still exists or that a candidate is currently deployed. A merged proposal can
remain unimplemented.

Implemented rules belong in their owning chapter. Dated trials and completed
reviews are in [the archive](../archive/README.md#implementation-and-trial-records).
For mixed documents, use the remaining scope below and the record's explicit
implementation limits. Resolve a fresh implementation question against source
before acting on an old checklist.

## Agent access and execution

| Proposal | Owning need or contract | Remaining review scope |
| --- | --- | --- |
| [Agent capability guidance and infra contract](task-execution-capabilities-20261002.md) | [Host And App Boundary](../2a-design/system-boundary.md) | Proposed common discovery using existing requests and separate Conditions; current use has a separate guide. |
| [Task execution capability contracts](task-execution-capability-contracts-20261003.md) | [Agent capability guidance and infra contract](task-execution-capabilities-20261002.md) | Existing calling and return contracts, proposed discovery improvements and verification cases. |
| [Explicit attempt decision (deferred)](task-attempt-decision-schema-20261002.md) | [Task attempts](../2a-design/task-attempts.md) | Deferred output spelling only; current state/continue behavior stays in the attempt contract. |
| [Make progress while input keeps arriving](progress-under-burst-input.md) | [Task attempts](../2a-design/task-attempts.md) | Bounded decisions, continuing input and steering; isolated progress proof plus an unread-correction counterexample. |
| [Continue unfinished work with correct context](unfinished-input-context.md) | [Task attempts](../2a-design/task-attempts.md) | Repair existing scope/context delivery first; deterministic PoC, with model behavior still unverified. |
| [Reduce context cost through App knowledge and agent methods](focused-session-continuation.md) | [Agent Cooperation](../2a-design/agents.md) | Experimental context reduction; weigh behavior regressions alongside token savings. |
| [Task resource entry and evidence access](task-resource-layout-20260929.md) | [Task Reads](../2a-design/task-resource-read-interface.md) | Remaining entry/read usability changes need evidence beyond existing Task facilities. |
| [App environment and improvement review](app-environment-review-20260928.md) | [App Contract](../2a-design/agent-app.md) | Remaining App environment and improvement responsibilities; reuse the established runtime. |

## Recovery and observation

| Proposal | Owning need or contract | Remaining review scope |
| --- | --- | --- |
| [Reliable recovery and independent oversight](reliable-recovery-and-independent-oversight-20261002.md) | [Host/App Boundary](../2a-design/system-boundary.md) | Independent oversight and connected recovery of the original requirement remain to be demonstrated. |
| [Keep recovery from blocking ordinary Host requests](responsive-host-recovery-20261002.md) | [Host Runtime](../2a-design/runtime.md) | Remaining recovery isolation and responsiveness proof; merged query fixes are dated evidence. |
| [Recover current work from execution evidence](recovery-from-execution-evidence-20260922.md) | [Host And App Boundary](../2a-design/system-boundary.md) | Adoption and behavioral verification of recovery using retained evidence. |
| [Reliable observer feedback without a subscription system](observer-feedback-and-resource-conventions.md) | [Events And Task Admission](../2a-design/events.md) | Observation feedback and convention refinements; distinguish implemented routes from remaining coverage. |
| [Workflow tracing by default and useful health metrics](workflow-tracing-and-health-metrics.md) | [Metrics And Alerts](../2a-design/metrics.md) | Remaining tracing/metric coverage after the recorded initial source slice. |

## Ownership and implementation follow-up

| Proposal | Owning need or contract | Remaining review scope |
| --- | --- | --- |
| [Keep domain policy in Apps, keep the Host generic](app-policy-and-host-boundary-cleanup.md) | [Host And App Boundary](../2a-design/system-boundary.md) | Broader App-policy cleanup beyond the recorded implemented slices. |
| [Simplify the system: fewer paths, clear owners](authority-boundary-simplification.md) | [Host And App Boundary](../2a-design/system-boundary.md) | Remaining simplification decisions; completed slices are context, not a second current contract. |
| [External components: simple, solid, and clearly organized](external-components-simplification.md) | [Host And App Boundary](../2a-design/system-boundary.md) | Follow-up component boundaries beyond the accepted first milestone. |
| [Storage: a state service backed by SQLite](storage-state-service.md) | [Runtime Storage](../2a-design/storage.md) | Further state-operation boundaries beyond integrated request-to-Task work. |
| [Core review: simple, robust, replaceable](task-runtime-organization.md) | [Architecture](../2a-design/architecture.md) | Retained source/interaction follow-up; recheck dated findings before treating them as current defects. |
| [Design and implementation gaps](design-implementation-convergence.md) | [Host And App Boundary](../2a-design/system-boundary.md) | Dated gap tracker; current contracts own requirements, and source evidence must be refreshed for a new fix. |
| [App behavior convergence review](app-behavior-convergence-20260925.md) | [Host And App Boundary](../2a-design/system-boundary.md) | App adoption and behavioral gaps; source and actual agent behavior are separate evidence. |
| [Telegram: a natural conversation with reliable follow-through](telegram-conversation-experience.md) | [Human Control Surfaces](../2a-design/human-control-surfaces.md) | Interaction and follow-through adoption; the shared Conversation contract owns execution. |
| [Workflow practices review](workflow-practices-review.md) | [Workflow Discovery And Execution](../2a-design/workflows.md) | Workflow behavior and rollout follow-up; the common contract remains independent of a specific procedure. |

## Learning and useful recurring work

| Proposal | Owning need or contract | Remaining review scope |
| --- | --- | --- |
| [Review Host scripts, preserve reusable tools and retire completed PoCs](poc-retirement-and-knowledge-20260912.md) | [App Root Layout](../2a-design/app-root-layout.md) | Retire completed harnesses while preserving reusable tools and evidence; refresh the remaining inventory before deleting source. |
| [Teaching agents: from a correction to dependable behavior](agent-behavior-and-capability-extension.md) | [Agent improvement: an optional App integration](../2a-design/practice-learning-loop.md) | Proposed improvement approach; completed adoption trials are archived separately. |
| [A recurring task to review and improve May](may-project-review-loop-20260912.md) | [Agent improvement: an optional App integration](../2a-design/practice-learning-loop.md) | Pilot and recurring-review value; a standing loop needs evidence of useful outcomes. |

## Related App proposal

[Token efficiency](../../../may.app/design/token-efficiency-proposal-20261002.md)
retains its audit and remaining App-owned changes. Evaluate cost together with
fulfilled requirements and recovered failures; a smaller prompt alone is not
an improved outcome.

When a remaining choice lands, follow the [proposal lifecycle](../2b-manual/design-authoring/SKILL.md#keep-status-and-history-honest):
update its owning contract and guide, retain useful evidence, and remove it from
this active reading path. Archiving does not silently close unresolved work.
