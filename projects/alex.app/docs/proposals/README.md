# Proposals: pending decisions, adoption and history

**Supports:** [Design authoring and review](../2b-manual/design-authoring/SKILL.md). Keep the next useful decisions visible without reopening completed implementation plans.

Use [INDEX](../INDEX.md) for current behavior. This catalogue separates remaining
questions, implemented source awaiting specific adoption evidence, deferred
redesigns and historical records. A source merge does not prove deployment, and
an unanswered trial question is not automatically a new implementation task.
The [November 11 review](../archive/reviews/design-and-proposal-status-review-20261111.md)
records evidence, the full disposition and the reasons for these priorities.
Recovery plans were consolidated on November 12 into one
[connected acceptance proposal](unified-agent-recovery-20261017.md); its earlier
reasoning and trials remain in the archive.

The [Task authoring cleanup](../archive/reviews/task-api-cleanup-20261112.md)
is merged in Host #454 with companion App callers committed. It is completed
source work, not a pending proposal. The separate
[approval-verifier alignment](../archive/reviews/improvement-approval-contract-cleanup-20261112.md)
is now verified in App source; live adoption remains separate.
The [explicit Condition freshness cleanup](../archive/reviews/condition-freshness-20261112.md)
is merged in Host #456 (`da9b9fb85aee`), and the
[Learning dashboard retirement](../archive/reviews/learning-dashboard-retirement-20261112.md)
is merged in Host #457 (`a84c6918ed40`). Both source cuts are complete;
installed adoption remains unverified.
The [project Lineage retirement](../archive/reviews/project-lineage-retirement-20261112.md)
is merged in Host #458 (`2a762206dd52`). Its source cut is complete;
installed adoption remains unverified.

## Best next candidates

1. **Task entry clarity:** distinguish assigned input from pending unclaimed
   input using current reads and evidence links.
2. **Recovery adoption:** real-model diagnosis and the scripted human-reply path
   have evidence. The accepted-release probe identifies missing generic
   pre-attempt controller routes. The App correction now has a real-controller
   regression through repair and original return; independent recipient startup
   and activation in the selected installation remain.

These are recommendations for bounded work, not approvals or a mandatory sequence.
Prompt/checker cleanup is already assigned elsewhere.

## Focused pending questions

| Record | Current status and remaining scope |
| --- | --- |
| [Teaching agents](agent-behavior-and-capability-extension.md) | Use existing instructions/skills/workflows; the remaining question is one discover-author-activate-fresh-use path with useful outcomes, not a new trainer. |
| [App author usability](app-environment-review-20260928.md) | Choose one concrete author/worker discovery failure and compare the smallest correction. Avoid another capability inventory. |
| [Current gaps and historical leads](design-implementation-convergence.md) | Host #456 closed freshness-by-event-name. Other September rows are historical leads requiring reproduction, not confirmed current defects. |
| [DeepSeek adoption candidates](dsh-superagent-review-and-adoption-20261111.md) | Approved cuts landed in #449. Attention views, connector retry safety and App initiative are conditional trials; choose a recurring need before adding behavior. |
| [Orca review and adoption candidates](orca-review-and-adoption-20261114.md) | Compares `stablyai/orca` (`c445f7dbc1`) with `may-agent` (`f13f94d12d`). Proposes coalesced wake invalidations (solving R3 missed-wake recovery), SQLite `journal_size_limit` / `temp_store = MEMORY` pragmas, $O(N)$ NDJSON framing, and inode-verified socket cleanup. |
| [Host/App release compatibility](host-stability-and-app-extensibility-20261005.md) | Use the smallest real-App compatibility and boundary checks that catch a current gap; several named earlier defects are already repaired. |
| [Observation ownership and freshness](observer-feedback-and-resource-conventions.md) | Publication/observer-accounting foundations exist, including #371. Explicit Condition freshness merged in #456; installed adoption is unverified and provider convention trials stay conditional. |
| [Task entry and evidence readability](task-resource-layout-20260929.md) | Clarify assigned/considered inputs versus pending unclaimed input using current readers and artifacts. One missed-review/correction comparison can bound the change. |
| [Recovery to the original outcome](unified-agent-recovery-20261017.md) | Single active recovery proposal. Connected, restart, timer, real-model and human-reply trials have bounded evidence. The accepted-release probe confirms selected admission and missing controller routes; capable execution and original return through the actual App correction remain, alongside broader reliability. |

## Implemented foundation; specific adoption remains

| Record | Current status and remaining scope |
| --- | --- |
| [Unified Agent and Workflow invocation](unified-agent-instance-runtime.md) | Shipped in Host PRs #512–#558 (`ctx.call`, `resolveCallable`, `TaskRunner`, `agents` tool code procedures, `may run` / `may list`, `@may-agent/sdk/standalone` two-layer runtime, unified `taskReconcileResultSchema` and 4-field `finishSchema`, and retirement of `WorkflowGuard` and `createWorkflowTool`). All App workflows + May intake skill migrated. |
| [`@may-agent/sdk` boundary hardening and kernel polish](sdk-boundary-and-kernel-hardening.md) | Shipped in Host PRs #542, #546, #555, and #558 (`G1`–`G6`): fenced `@may-agent/sdk/runtime` to Host-only via boundary checks, eliminated `packages/sdk/src/` deep imports, hardened `ctx.call` async preview + single-pass resolution, retired legacy `testing.ts` shims (`callAgent`, `runWorkflow`, `agents`, `workflows`), and added `.d.ts` snapshots for `/testing` and `/standalone`. |
| [Gym evaluation modernization on `@may-agent/sdk/standalone`](gym-sdk-standalone-modernization.md) | Aligns `@may-agent/gym` with `@may-agent/sdk/standalone` (pure SDK imports without Host internals, unified production `TaskReconcileResult` `task-result.json` benchmark contract with zero `system-state.md` or answer leaks, 5 single-file role-specific judgment benchmarks, `.lab/<candidate>` overlays for App-owned agents/skills/workflows, `WorkflowRunReport` scoring helpers, and `alex/learn-from-daily-work` + `alex/diagnose-improvement`). |
| [Event and control socket simplification](control-socket-simplification.md) | Shipped in Host PRs #523 and #524 (non-journaled `conversation.updated` wakes, removal of dead `getSessionId` / `chatMode` / slash-command rewriting, table-driven `server.ts`, and consolidation of `app.input.admit` and Task controls onto `publish(EventInput)`). |
| [Workflow as an executable skill](workflow-business-host-boundary.md) | Shared invocation kernel on `@may-agent/sdk` for Unit, Host-free Standalone/Gym (`src/app/standalone.ts`) and Host, merged in Host #455 (`52ff184177`) and extended into the unified invocation runtime above. |
| [Workload implementation](agent-task-workload-implementation.md) | Host #443 merged the consolidated stack; retain its candidate history. Complete selected installation/result-disposition acceptance before broader activation. |
| [Workload model](agent-task-workload-model.md) | Shared budgets, limits and feedback exist. Remaining work concerns funded scope, caller disposition and observed choices; standalone admission remains separate. |
| [Alex organization and migration](alex-improvement-app.md) | The source migration is complete; dated handover records report activation. Residual retained-state withdrawal and end-to-end improvement acceptance are separate work. |
| [Earlier simplification review](authority-boundary-simplification.md) | Many cuts landed, and #449 retired crash replay/configurable upkeep. Recheck only provider delivery or a concrete remaining consumer; no generic cleanup backlog. |
| [External-component cleanup](external-components-simplification.md) | The three first-milestone fixes and Learning dashboard retirement (#457) landed. Broader feedback/reporting changes remain conditional on a demonstrated consumer and provider evidence. |
| [Host adoption and performance follow-up](host-contract-improvements-20261016.md) | Preserves independent query/control performance and App result-adoption questions. Old fixes and trials are archived; connected recovery acceptance belongs to the single recovery proposal. |
| [Progress under arriving input](progress-under-burst-input.md) | Scoped acceptance exists in current source. Useful progress, correction latency and cost under representative bursts remain behavioral questions. |
| [Task communication and operational routing](tasks-and-communication-resources.md) | Common admission/results/communication landed in #449. Keep only the App operational-route and quiet-follow-through questions active; original design is archived. |
| [Telegram interaction](telegram-conversation-experience.md) | Host #157 is merged; later common Conversation and delivery fixes are current. Representative installed interaction remains separate from that old candidate. |
| [Workflow evidence and health](workflow-tracing-and-health-metrics.md) | Both #143 and #147 merged. Extra artifact/health presentation and provider adoption need actual reader value; avoid adding metrics solely to finish the old plan. |

## Work already assigned

| Record | Current status and remaining scope |
| --- | --- |
| [Prompt and schema size](model-surface-and-prompt-hygiene-20261111.md) | Host #452 is merged and Apps prompt/skill changes are committed. Accurate prepared-payload measurement and remaining prompt work are already assigned; do not duplicate them. |

## Deferred redesigns

| Record | Current status and remaining scope |
| --- | --- |
| [Context preparation experiment](focused-session-continuation.md) | Supporting hooks/measurements merged in #192/#193; default adoption remains unproven. Reconsider after current prompt work with a concrete context-use failure. |
| [Standing project-review loop](may-project-review-loop-20260912.md) | A bounded pilot exists. A standing review loop needs evidence that its decisions and resulting outcomes justify continuing attention/model cost. |
| [Durable work without an App](standalone-agent-tasks.md) | Accepted direction; direct durable admission and identity compatibility remain unimplemented. Existing Apps do not demonstrate urgency for this storage/addressing change. |
| [Broader storage extraction](storage-state-service.md) | Atomic attachment and shared state operations exist. A new service/API deployment or wider extraction needs a concrete coupling or operating problem. |
| [Alternative result spelling](task-attempt-decision-schema-20261002.md) | Keep state/continue and current schema identities. A spelling migration alone has no demonstrated outcome or maintenance benefit. |
| [Broad capability discovery](task-execution-capabilities-20261002.md) | Current SDK/tools already expose callable work, requests and Conditions. Start with one demonstrated missing capability rather than a universal facade. |
| [Capability-discovery reference](task-execution-capability-contracts-20261003.md) | Supporting reference for the preceding deferred design, not another implementation track. Existing calling/return contracts remain current. |

## Historical records and forwarding entries

| Record | Current status and remaining scope |
| --- | --- |
| [September App behavior review](app-behavior-convergence-20260925.md) | Archived evidence and contrasting failure cases; do not treat its old App/file inventory as a current implementation queue. |
| [Installation-policy migration](app-policy-and-host-boundary-cleanup.md) | Host #326 source slice is complete. Dated rollout and remaining retained-state limits are archived; current installation declarations own behavior. |
| [PoC source retirement](poc-retirement-and-knowledge-20260912.md) | Host #174 merged; current source has no tracked scripts/poc tree. Preserve the supported-tool/evidence convention without rerunning the old deletion inventory. |
| [Earlier recovery/oversight record](reliable-recovery-and-independent-oversight-20261002.md) | Archived implementation and trial evidence. Unified recovery owns the remaining availability/diagnosis question; the old ordering is superseded. |
| [Execution-evidence recovery](recovery-from-execution-evidence-20260922.md) | Forwarding entry to archived reasoning, retained-effect examples and automatic-versus-manual trial limits. Remaining recovery acceptance is consolidated. |
| [Responsive recovery](responsive-host-recovery-20261002.md) | Forwarding entry to archived measurements and rollout evidence. Current performance questions stay in the Host follow-up; the old isolation plan is not a pending implementation queue. |
| [Task-owned Host cuts](task-owned-host-simplification-20261111.md) | Forwarding page to #449 implementation evidence. Accepted cuts are complete in source; stopped upgrade and deployment remain separate. |
| [Earlier core/runtime roadmap](task-runtime-organization.md) | Archived dated source review. Architecture and current Task contracts own the system; old candidate steps require revalidation before new work. |
| [September workflow rollout](workflow-practices-review.md) | Archived dated source/behavior observations. Current workflow authoring rules apply; the old per-workflow rollout inventory is not a current backlog. |

## Related App design

[Token efficiency](../../../may.app/design/token-efficiency-proposal-20261002.md)
retains App-specific findings. Measure useful outcomes and correction cost as
well as size. When a pending choice lands, update its contract and guide, retain
its evidence in [the archive](../archive/README.md), and remove the completed
implementation step from the active reading path.
