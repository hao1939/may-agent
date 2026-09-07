# Documentation Archive

Archived documents preserve rationale and evidence. They are not current
contracts; Tier-2 design governs when wording conflicts.

## Decisions

| Document                                                                                                             | Current authority                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [agent-app-boundary-refinement.md](decisions/agent-app-boundary-refinement.md)                                       | [Agent App Contract](../2a-design/agent-app.md)                                                         |
| [agent-app-runtime-model.md](decisions/agent-app-runtime-model.md)                                                   | [Agent App Contract](../2a-design/agent-app.md)                                                         |
| [agent-app-external-interaction-contract.md](decisions/agent-app-external-interaction-contract.md)                   | [System Model](../2a-design/system-model.md) and [Agent App Contract](../2a-design/agent-app.md)        |
| [app-owned-runtime-simplification.md](decisions/app-owned-runtime-simplification.md)                                 | [Canonical Agent App Migration](implementation/canonical-agent-app-migration.md)                        |
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

- [Agent App scenario audit — 2026-07-16](reviews/agent-app-scenario-audit-2026-07-16.md)
- [Project creative audit — 2026-06-14](reviews/project-creative-audit-2026-06-14.md)
- [Retry/recovery decomposition cleanup — 2026-08-11](reviews/retry-decomposition-rule-2026-08-11.md)
- [Console and Telegram information-experience evidence](reviews/console-telegram-information-experience.md)

## Completed implementation records

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
