# HomeRail: Voice-First Local Agent Orchestration Runtime

Date: 2026-07-28
Source: GitHub
Repo: https://github.com/xiaotianfotos/homerail

## Summary

HomeRail is a TypeScript runtime that converts one-off agent chats into auditable, reusable DAG workflows, designed to run on personal infrastructure (homelabs, NAS, home servers). The key design bet: human attention is the scarcest resource, so the system should ask for very little of it.

## Key Design Choices

- **Voice-first input**: Speech as primary interface because it demands the least user attention. Chinese ASR/TTS by default; text always available as fallback.
- **DAG execution engine**: Multi-agent orchestration with explicit handoffs, workspace isolation per run, replay, scorecards, and run evaluation — replacing opaque chat sessions with inspectable graphs.
- **Generative UI**: Instead of dumping logs/JSON, produces structured views shaped to be read at a glance.
- **Docker Worker model**: Manager and Node run as local services; Node provisions Worker containers per DAG node, sharing a workspace per run.
- **Agent-readable by design**: README doubles as an agent-operable runbook with plain CLI invocations.

## Architecture Pattern: Inverted Funnel

Narrow where the person is (voice), wide where the machine is (parallel DAG agents). This is an explicit bandwidth-matching pattern — human bandwidth is limited, machine bandwidth is not.

## Signals

- 716 stars, 156 forks (as of 2026-07-28)
- Created 2026-07-07, actively pushed (last: 2026-07-28)
- MIT licensed, TypeScript
- CLI tool `hr` with commands: start, config, doctor, run, smoke, dag supervise, scorecard, eval-run, replay

## Relevance to Scout Themes

- **Orchestration-as-infrastructure**: Aligns with the "orchestration hollowing" thesis — the orchestrator becomes a thin runtime, not a monolithic framework.
- **Personal/local-first AI**: Counter-trend to cloud-hosted agent platforms; designed for self-hosting.
- **Auditability via DAGs**: Every handoff traced, every run replayable — addresses the black-box problem in agent systems.
- **Voice as agent interface**: Rare in the agent-framework space where most assume text/code input.
