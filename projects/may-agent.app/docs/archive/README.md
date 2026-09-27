# Documentation Archive

Archived documents preserve rationale and evidence. They are not current
contracts; Tier-2 design governs when wording conflicts.

## Decisions

| Document                                                                                                             | Current authority                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [agent-app-boundary-refinement.md](decisions/agent-app-boundary-refinement.md)                                       | [Agent App Contract](../2a-design/agent-app.md)                                                         |
| [agent-app-runtime-model.md](decisions/agent-app-runtime-model.md)                                                   | [Agent App Contract](../2a-design/agent-app.md)                                                         |
| [agent-app-external-interaction-contract.md](decisions/agent-app-external-interaction-contract.md)                   | [System Model](../2a-design/system-model.md) and [Agent App Contract](../2a-design/agent-app.md)        |
| [app-owned-runtime-simplification.md](decisions/app-owned-runtime-simplification.md)                                 | [App Contract](../2a-design/agent-app.md)                        |
| [app-task-reconciliation-model.md](decisions/app-task-reconciliation-model.md)                                       | [Task Resource Engine](../2a-design/task-resource-engine.md)                                            |
| [event-ingress-and-socket-reliability.md](decisions/event-ingress-and-socket-reliability.md)                         | [Events](../2a-design/events.md) and [HTTP Boundary](../2a-design/http-boundary.md)                     |
| [task-reconciliation-integrity-refinement.md](decisions/task-reconciliation-integrity-refinement.md)                 | [Task Resource Engine](../2a-design/task-resource-engine.md)                                            |
| [implementation-simplification.md](decisions/implementation-simplification.md)                                       | [Agent App Contract](../2a-design/agent-app.md) and [Runtime](../2a-design/runtime.md)                  |
| [stigmergic-coordination.md](decisions/stigmergic-coordination.md)                                                   | [Projects](../2a-design/projects.md) and [Events](../2a-design/events.md)                               |
| [retired-design-alternatives.md](decisions/retired-design-alternatives.md)                                           | Current Tier-2 subsystem designs.                                                                       |
| [inbox-scope-reduction.md](decisions/inbox-scope-reduction.md)                                                       | [Agent App Contract](../2a-design/agent-app.md) and [Work Model](../1-principles/work-model.md)         |
| [work-admission-and-mechanism-selection.md](decisions/work-admission-and-mechanism-selection.md)                     | [Work Model](../1-principles/work-model.md) and [Workflows](../2a-design/workflows.md)                  |
| [convention-based-service-composition.md](decisions/convention-based-service-composition.md)                         | [System Boundary](../2a-design/system-boundary.md) and [Agent App Contract](../2a-design/agent-app.md)  |
| [task-authorship-and-workflow-governance.md](decisions/task-authorship-and-workflow-governance.md)                   | [Task Resource Engine](../2a-design/task-resource-engine.md)                                            |
| [task-handler-resolution-refinement.md](decisions/task-handler-resolution-refinement.md)                             | [Task Resource Engine](../2a-design/task-resource-engine.md) and [Workflows](../2a-design/workflows.md) |
| [task-reconciliation-simplification-and-integrity.md](decisions/task-reconciliation-simplification-and-integrity.md) | [Task Resource Engine](../2a-design/task-resource-engine.md)                                            |
| [task-workspace-convention.md](decisions/task-workspace-convention.md)                                               | [Task Resource Engine](../2a-design/task-resource-engine.md) and [Projects](../2a-design/projects.md)   |
| [simple-event-interface.md](decisions/simple-event-interface.md)                                                     | [Events](../2a-design/events.md), [Runtime](../2a-design/runtime.md), and [HTTP Boundary](../2a-design/http-boundary.md) |
| [herdr-backed-web-terminal.md](decisions/herdr-backed-web-terminal.md)                                               | [Web Terminal](../2a-design/web-terminal.md)                                                                          |
| [task-focused-shared-human-interface.md](decisions/task-focused-shared-human-interface.md)                         | [Human Control Surfaces](../2a-design/human-control-surfaces.md), [May Console](../2a-design/may-console.md), and [Telegram](../2a-design/telegram-notifications.md) |
| [human-action-task-view.md](decisions/human-action-task-view.md)                                                   | [Human Control Surfaces](../2a-design/human-control-surfaces.md) and [Task Resource Engine](../2a-design/task-resource-engine.md) |
| [lightweight-event-driven-reconciliation.md](decisions/lightweight-event-driven-reconciliation.md)               | [System Model](../2a-design/system-model.md), [Events](../2a-design/events.md), and [Task Resource Engine](../2a-design/task-resource-engine.md) |

## Reviews

- [Design documentation hygiene — 2026-09-27](reviews/design-doc-hygiene-20260927.md)
  — source-backed corrections to lifecycle, admission, recovery, user controls
  and improvement ownership; retained implementation gaps and validation limits.

- [Bounded May project-review pilot — 2026-09-12](reviews/may-project-review-pilot-20260912.md)
  — isolated comparison and visible container trials; a stopped scope-extension
  retry, three ordinary periodic reviews on `3644b5a1`, and clock-echo overhead.
- [How we review, design, and implement May — 2026-09-12](reviews/may-project-development-method-20260912.md)
  — three Codex sessions, 23 PRs and current design/source evidence; scoped
  preferences, review case studies and gaps for a recurring owner-review task.
- [Core implementation after #111 and #112 — 2026-09-10](reviews/core-implementation-post112-20260910.md)
  — 229 passing focused tests and three reproduced input dispatch/recovery/reporting
  failures; portable probe and source limits retained with the review.
- [Refined core design against implementation — 2026-09-10](reviews/core-implementation-alignment-20260910.md)
  — Host #110 and committed May App comparison; 111 passing focused tests,
  reproduced input renewal/retry failures, and prioritized implementation slices.
- [Core simplicity and robustness — 2026-09-10](reviews/core-simplicity-review-20260910.md)
  — earlier source review, reproduced controller failure gaps, measured recovery
  query cost, and 172 passing focused tests; completion fix #104 is merged.
- [Error handling, metrics and responsive conversation — 2026-09-10](reviews/error-handling-and-conversation-discussion-20260910.md)
  — paused discussion: simple error hook, App placement, consolidation and user
  responsiveness; current work returns to core simplicity and robustness.
- [Default error handling and metrics — archived draft](reviews/default-error-handling-and-metrics-draft-20260909.md)
  — historical expanded-core proposal; placement was reopened and work paused.
- [Default error handling and metrics PoC — 2026-09-09](reviews/default-error-metrics-poc-20260909.md)
  — real isolated Host runs, actual model judgment, failure containment and restart,
  with a portable unpublished prototype and explicit coverage limits.
- [Core design review — 2026-09-09](reviews/core-design-review-20260909.md)
  — source-backed recovery findings, minimal core boundaries, and simplification
  tradeoffs, with reproducible probes and an unpublished experimental patch.
- [Design philosophy history — 2026-09-09](reviews/design-philosophy-history-20260909.md)
  — recovered human guidance, technical decision history, and corrections to
  earlier preference summaries; current guidance lives in Tier 1.
- [Authority-boundary review history — 2026-09-09](reviews/authority-boundary-history-20260909.md)
  — earlier proposal, incident analysis and source-review scope; current open work
  remains in the [active proposal](../proposals/authority-boundary-simplification.md).
- [Authority-boundary pilot — 2026-09-06](reviews/authority-boundary-pilot-20260906.md)
  — dated lifecycle, wait and restart verification, not current deployment status.
- [Documentation clarity review and cleanup — 2026-09-09](reviews/documentation-clarity-20260909.md)
- [Runtime compatibility audit — 2026-08-18](reviews/runtime-compatibility-audit-2026-08-18.md)

- [Agent App scenario audit — 2026-07-16](reviews/agent-app-scenario-audit-2026-07-16.md)
- [Project creative audit — 2026-06-14](reviews/project-creative-audit-2026-06-14.md)
- [Retry/recovery decomposition cleanup — 2026-08-11](reviews/retry-decomposition-rule-2026-08-11.md)
- [Console and Telegram information-experience evidence](reviews/console-telegram-information-experience.md)

## Completed implementation records

- [Atomic request attachment review — 2026-09-10](implementation/storage-attachment-review-20260910.md)
  — merged storage/readiness slices, transaction/restart proof and measured scope limits.
- [Core separation and recovery review — 2026-09-10](implementation/core-separation-review-20260910.md)
  — complete prior proposal, separation steps and PR-specific proof; active work has moved to the core review plan.
- [Controller implementation review — 2026-09-10](implementation/controller-review-20260910.md)
  — historical settlement/retry candidates and bounded owner-route evidence.
- [App contract migration notes](implementation/app-contract-migration-20260910.md)
  — completed migration wording, superseded by separate conversational and Task paths.
- [Convergence review through 2026-09-08](implementation/convergence-review-through-20260908.md)
  — previous main's migration evidence and scoped follow-up decisions.

- [Retired Task resource cutover](implementation/retired-task-resource-cutover.md)
  — historical commands removed in Host commit `54689855`; current source requires resource authority.

- [Dissolve shared workflows](implementation/2026-05-15-dissolve-shared-workflows.md)
- [Bug E/F fixes](implementation/2026-05-18-bug-e-f-fixes.md)
- [E2E harness findings](implementation/2026-05-19-e2e-harness-findings.md)
- [Legacy cleanup and resume path](implementation/2026-05-20-legacy-cleanup-resume-path.md)
- [System-boundary tracker](implementation/system-boundary-tracker.md)
- [Handler boundary audit](implementation/handler-boundary-audit.md)
- [App root cleanup — 2026-06-13](implementation/2026-06-13-app-root-cleanup.md)
- [Task reconciliation WebUI cutover](implementation/task-reconciliation-webui-reviewability.md)
- [Canonical Agent App migration](implementation/canonical-agent-app-migration.md)
- [Task reconciliation closeout](implementation/task-reconciliation-closeout-and-reviewability.md)
- [System operations convergence](implementation/system-operations-model.md)
- [Codex goal executor evaluation](implementation/codex-goal-executor.md)

## V2

See [V2 archive](v2/README.md) for the retired V2 specification, migration
plan, implementation notes, and review.
