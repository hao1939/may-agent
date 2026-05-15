# Literacy Skills Deployment Summary

**Date**: 2026-06-24
**Phase**: 2 — Deploy top 3 literacy skills

## Skills Selected

Based on baseline gaps (8% skill read rate, near-zero structured escalations):

1. **reading-metrics** — How to interpret heartbeat metric symbols (✅📉🔴), investigate bad metrics, and act
2. **closing-the-loop** — Decision framework for preventing recurrence: skill → guard → handler evolution ladder
3. **escalation** — When and how to escalate with full context (reason + what was tried + what's needed)

## Deployment Targets

| Agent | reading-metrics | closing-the-loop | escalation |
|-------|:-:|:-:|:-:|
| bob | ✅ | ✅ | ✅ |
| coder | ✅ | ✅ | ✅ |
| optimizer | ✅ | ✅ | ✅ |
| scout | ✅ | ✅ | ✅ |
| qa | ✅ | ✅ | ✅ |
| may | ✅ | ✅ | ✅ |

**Total**: 18 skill files deployed (3 skills × 6 agents)

## Why These Agents

- **bob, coder, optimizer, scout, qa** — Active worker agents that execute tasks. They benefit most from knowing how to read metrics, close loops, and escalate properly.
- **may** — Orchestrator agent. Needs escalation and metrics skills to model good behavior.

## Why NOT These Agents

- **coach** — Already has meta-level skills; literacy skills less relevant
- **evaluator** — Specialized scoring/monitoring role with custom skills
- **tech-lead** — Already has good skill coverage; lower priority
- **amy/amy-kimi** — Specialized agents with different workflows

## Expected Impact

- Skill read rate should increase from 8% → 25%+ as agents encounter these in their skills directory
- Escalation quality should improve as agents follow the structured escalation format
- Metric responsiveness should improve as agents learn to interpret ✅📉🔴 symbols
