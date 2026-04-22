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
| [agent-level-code-boundary.md](agent-level-code-boundary.md) | Move evaluator, context-learn, project-scanner from src/lib to agents/ | Proposal |
| [event-driven-handlers.md](event-driven-handlers.md) | Cron entries gain event triggers, replacing poll-based model | Partial (project handler uses `on` field) |
| [unified-event-system.md](unified-event-system.md) | Migrate all agent-level reactions to handler dispatch; bus stays infra-only | Phase 1 implemented |
| [event-inbox.md](event-inbox.md) | Event inbox: persistent event lifecycle, heartbeat injection, dead-letter handling | Proposal |

## Agent Behavior

How agents cooperate, make decisions, and improve.

| Document | What | Status |
|----------|------|--------|
| [agent-calling-guide.md](agent-calling-guide.md) | call/fork/message patterns, when to use each | ✅ Active |
| [may-gatekeeper.md](may-gatekeeper.md) | May's supervisor role: decoupled async review | ✅ Implemented |
| [evidence-first-process.md](evidence-first-process.md) | How to validate ideas: hypothesis → evidence → build | ✅ Active methodology |
| [code-vs-data-decisions.md](code-vs-data-decisions.md) | When to use guards vs context.md vs workflows | ✅ Active guideline |
| [context-learning.md](context-learning.md) | A/B test results: context.md changes behavior for environmental knowledge | ✅ Validated finding |
| [idle-heartbeat-playbook.md](idle-heartbeat-playbook.md) | What to do when heartbeat has no priority work | ✅ Active |

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
| [infra-metrics.md](infra-metrics.md) | Infrastructure metrics: handler-health, stuck-requests, throughput | ✅ Active |
| [metrics-evolution-roadmap.md](metrics-evolution-roadmap.md) | Hao's vision: where metrics system should go | Vision |
| [output-channels.md](output-channels.md) | Telegram & web console notification design | ✅ Implemented |
| [webui-improvements.md](webui-improvements.md) | Web UI: projects tab (done), events view, dashboard cleanup | Partially implemented |

## Research & Knowledge

| Document | What | Status |
|----------|------|--------|
| [research-system.md](research-system.md) | Knowledge base, adversarial peers, lab | Building |
| [skills-injection-overhead.md](skills-injection-overhead.md) | Problem analysis: skills add 8-46KB to prompts | Reference |

## Follow-ups & Open Problems

| Document | What |
|----------|------|
| [closing-the-loop.md](closing-the-loop.md) | Gap fixes: events persistence, metric decoupling, guard escalation, projectId tracking |
| [common-sense-followups.md](common-sense-followups.md) | Items from 2026-04-19 review that need addressing |

## Reference

| Document | What |
|----------|------|
| [logging.md](logging.md) | Logging system reference |

## Archive

Superseded, completed, or historical docs in [archive/](archive/). These are kept for reference but no longer active design guidance.

| Document | Superseded by |
|----------|--------------|
| [persistent-task-files.md](archive/persistent-task-files.md) | [project-system.md](project-system.md) |
| [project-lifecycle.md](archive/project-lifecycle.md) | [project-system.md](project-system.md) |
| [implementation-audit.md](archive/implementation-audit.md) | [closing-the-loop.md](closing-the-loop.md) |
