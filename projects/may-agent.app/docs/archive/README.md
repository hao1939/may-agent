# Documentation Archive

Archived documents preserve rationale and evidence. They are not current
contracts; Tier-2 design governs when wording conflicts.

## Decisions

| Document                                                                                             | Current authority                                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [agent-app-boundary-refinement.md](decisions/agent-app-boundary-refinement.md)                       | [Agent App Contract](../2a-design/agent-app.md)                                                  |
| [agent-app-runtime-model.md](decisions/agent-app-runtime-model.md)                                   | [Agent App Contract](../2a-design/agent-app.md)                                                  |
| [agent-app-external-interaction-contract.md](decisions/agent-app-external-interaction-contract.md)   | [System Model](../2a-design/system-model.md) and [Agent App Contract](../2a-design/agent-app.md) |
| [app-owned-runtime-simplification.md](decisions/app-owned-runtime-simplification.md)                 | [Canonical Agent App Migration](implementation/canonical-agent-app-migration.md)                 |
| [app-task-reconciliation-model.md](decisions/app-task-reconciliation-model.md)                       | [Task Resource Engine](../2a-design/task-resource-engine.md)                                     |
| [event-ingress-and-socket-reliability.md](decisions/event-ingress-and-socket-reliability.md)         | [Events](../2a-design/events.md) and [HTTP Boundary](../2a-design/http-boundary.md)              |
| [task-reconciliation-integrity-refinement.md](decisions/task-reconciliation-integrity-refinement.md) | [Task Resource Engine](../2a-design/task-resource-engine.md)                                     |
| [implementation-simplification.md](decisions/implementation-simplification.md)                       | [Agent App Contract](../2a-design/agent-app.md) and [Runtime](../2a-design/runtime.md)           |
| [stigmergic-coordination.md](decisions/stigmergic-coordination.md)                                   | [Projects](../2a-design/projects.md) and [Events](../2a-design/events.md)                        |
| [retired-design-alternatives.md](decisions/retired-design-alternatives.md)                           | Current Tier-2 subsystem designs.                                                                |

## Reviews

- [Agent App scenario audit — 2026-07-16](reviews/agent-app-scenario-audit-2026-07-16.md)
- [Retry/recovery decomposition cleanup — 2026-08-11](reviews/retry-decomposition-rule-2026-08-11.md)

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

## V2

See [V2 archive](v2/README.md) for the retired V2 specification, migration
plan, implementation notes, and review.
