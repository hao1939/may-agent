# Design Documents — Index

## Core Principles

Start here. This governs every design decision.

| Document | What | Status |
|----------|------|--------|
| [core-principles.md](core-principles.md) | 10 architecture principles that hold the system together. Read this first. | ✅ Active |

## Core System Design

These define how the system works.

| Document | What | Status |
|----------|------|--------|
| [context-injection-design.md](context-injection-design.md) | System prompt assembly, what agents see, what's on-demand | ✅ Active |
| [project-system.md](project-system.md) | Project system: project.md + journal.md, worker/reviewer/evaluator, metric projects, events | ✅ Implemented (core) |
| [metrics-system.md](metrics-system.md) | Unified metric system: per-agent metrics, snapshots, alerts, dashboard | ✅ Implemented |
| [runtime-ctx.md](runtime-ctx.md) | Shared infra interface for handlers, workflows, and agent tools | ✅ Implemented |
| [convention-defaults.md](convention-defaults.md) | Convention over config: event inbox, auto-heartbeat, default health metrics | ✅ Implemented (Phase 1-4) |
| [request-event-architecture.md](request-event-architecture.md) | Event architecture: events table as agent inbox + audit trail | ✅ Implemented |
| [agent-level-code-boundary.md](agent-level-code-boundary.md) | Move evaluator, context-learn, project-scanner from src/lib to agents/ | ✅ Implemented |
| [agent-neutral-projects.md](agent-neutral-projects.md) | Shared project location at agents/shared/projects/ | ✅ Implemented |
| [health-metrics.md](health-metrics.md) | Health metrics: handler + project metrics, alert_op, pipeline | ✅ Implemented |
| [heartbeat-system.md](heartbeat-system.md) | Heartbeat redesign: per-agent workflows, pre-loaded context, 1 session | ✅ Implemented |
| [escalation-system.md](escalation-system.md) | Escalation and recovery system design | Partial |
| [project-lifecycle-simplified.md](project-lifecycle-simplified.md) | Simplified lifecycle: agents push or stop, never "done" | ✅ Implemented |
| [workflow-lifecycle-events.md](workflow-lifecycle-events.md) | Workflow lifecycle events: step_start, step_done, etc. | Reference |
| [master-worker-workflow.md](master-worker-workflow.md) | Persistent worker/reviewer sessions with followUp() | Proposal |

## Agent Behavior

How agents cooperate, make decisions, and improve.

| Document | What | Status |
|----------|------|--------|
| [agent-calling-guide.md](agent-calling-guide.md) | call/fork/message patterns, when to use each | ✅ Active |
| [may-gatekeeper.md](may-gatekeeper.md) | May's supervisor role: decoupled async review | ✅ Implemented |
| [evidence-first-process.md](evidence-first-process.md) | How to validate ideas: hypothesis → evidence → build | ✅ Active methodology |
| [code-vs-data-decisions.md](code-vs-data-decisions.md) | When to use guards vs context.md vs workflows | ✅ Active guideline |
| [context-learning.md](context-learning.md) | A/B test results: context.md changes behavior for environmental knowledge | ✅ Validated finding |

## Quality & Safety

Guards, review, escalation.

| Document | What | Status |
|----------|------|--------|
| [guard-escalation.md](guard-escalation.md) | When guards block: ask owner, don't self-bypass | ✅ Approved |
| [review-gate.md](review-gate.md) | Code merge requires QA review | Draft |
| [workflow-guards.md](workflow-guards.md) | Reactive demand system for workflow quality | Reference |

## Metrics & Observability

| Document | What | Status |
|----------|------|--------|
| [health-metrics.md](health-metrics.md) | All 12 health metrics: definitions, thresholds, alert_op | ✅ Implemented |
| [output-channels.md](output-channels.md) | Telegram & web console notification design | ✅ Implemented |
| [webui-improvements.md](webui-improvements.md) | Web UI: projects tab (done), events view, dashboard cleanup | Partially implemented |

## Gap Tracking

| Document | What | Status |
|----------|------|--------|
| [closing-the-loop.md](closing-the-loop.md) | Gap fixes: events persistence, metric decoupling, guard escalation, projectId tracking | Active |
| [common-sense-followups.md](common-sense-followups.md) | Items from 2026-04-19 review that need addressing | Active |

## Research & Knowledge

| Document | What | Status |
|----------|------|--------|
| [research-system.md](research-system.md) | Knowledge base, adversarial peers, lab | Building |
| [skills-injection-overhead.md](skills-injection-overhead.md) | Problem analysis: skills add 8-46KB to prompts | Reference |

## Reference

| Document | What |
|----------|------|
| [logging.md](logging.md) | Logging system reference |
| [cli-execution.md](cli-execution.md) | CLI execution reference |

## Archive

Superseded, completed, or historical docs in [archive/](archive/). These are kept for reference but no longer active design guidance.

| Document | Superseded by |
|----------|--------------|
| [persistent-task-files.md](archive/persistent-task-files.md) | [project-system.md](project-system.md) |
| [project-lifecycle.md](archive/project-lifecycle.md) | [project-system.md](project-system.md) |
| [implementation-audit.md](archive/implementation-audit.md) | [closing-the-loop.md](closing-the-loop.md) |
| [event-driven-handlers.md](archive/event-driven-handlers.md) | [convention-defaults.md](convention-defaults.md) |
| [unified-event-system.md](archive/unified-event-system.md) | [convention-defaults.md](convention-defaults.md) |
| [unified-handler-events.md](archive/unified-handler-events.md) | [convention-defaults.md](convention-defaults.md) |
| [project-handler-events.md](archive/project-handler-events.md) | [convention-defaults.md](convention-defaults.md) |
| [idle-heartbeat-playbook.md](archive/idle-heartbeat-playbook.md) | [heartbeat-system.md](heartbeat-system.md) |
| [handler-health-metrics.md](archive/handler-health-metrics.md) | [health-metrics.md](health-metrics.md) |
| [project-metrics.md](archive/project-metrics.md) | [health-metrics.md](health-metrics.md) |
| [infra-metrics.md](archive/infra-metrics.md) | [health-metrics.md](health-metrics.md) |
| [metrics-evolution-roadmap.md](archive/metrics-evolution-roadmap.md) | Vision doc — not actionable |
| [metrics-heartbeat-reactor-proposal.md](archive/metrics-heartbeat-reactor-proposal.md) | [heartbeat-system.md](heartbeat-system.md) |
| [metric-types-sdk.md](archive/metric-types-sdk.md) | [health-metrics.md](health-metrics.md) |
| [project-lifecycle-continuous.md](archive/project-lifecycle-continuous.md) | On hold |
| [unified-session-design.md](archive/unified-session-design.md) | Draft — on hold |
| [re-design-draft.md](archive/re-design-draft.md) | Needs rewrite — architecture overview outdated |
