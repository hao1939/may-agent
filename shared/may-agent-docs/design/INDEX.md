# Design Documents — Index

## Core System Design

These define how the system works. Read these first.

| Document | What | Status |
|----------|------|--------|
| [context-injection-design.md](context-injection-design.md) | System prompt assembly, what agents see, what's on-demand | ✅ Active |
| [persistent-task-files.md](persistent-task-files.md) | Project system: project.md + journal.md, comment iterations, evaluator gate, health field | ✅ Active (v3) |
| [metrics-system.md](metrics-system.md) | Unified metric system: per-agent metrics, snapshots, alerts, dashboard | ✅ Implemented |
| [architecture-redesign.md](architecture-redesign.md) | EventBus, components, event types | ✅ Implemented |

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

## Research & Knowledge

| Document | What | Status |
|----------|------|--------|
| [research-system.md](research-system.md) | Knowledge base, adversarial peers, lab | Building |
| [skills-injection-overhead.md](skills-injection-overhead.md) | Problem analysis: skills add 8-46KB to prompts | Reference |

## Follow-ups

| Document | What |
|----------|------|
| [common-sense-followups.md](common-sense-followups.md) | Items from 2026-04-19 review that need addressing |

## Archive

Superseded, completed, or historical docs in [archive/](archive/). These are kept for reference but no longer active design guidance.
