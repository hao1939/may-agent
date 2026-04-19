# DD#759 — Heartbeat-Driven Autonomous Thinking Activity Scheduling

**Paper**: arXiv:2604.14178 (Su, 2026)
**Rating**: ★★★★★ (directly mirrors our system architecture)
**Date**: 2026-04-19

## Summary

Proposes a periodic "heartbeat" mechanism for LLM agents that orchestrates cognitive modules (Planner, Critic, Recaller, Dreamer) on a temporal schedule rather than reactive triggers. Key innovations:

1. **Periodic heartbeat** drives proactive self-regulation — agents don't wait for failures
2. **Dynamic cognitive module registry** — modules can be added/removed without re-engineering
3. **Meta-learning scheduler** — learns WHEN to engage which thinking activity based on temporal patterns and historical context
4. **Continual policy adaptation** — scheduler optimizes cognitive strategy over time using interaction logs

## Relevance to Our System

**This paper independently validates our heartbeat architecture.** Our system uses per-agent heartbeat workflows that periodically trigger scout, bob, coach, etc. to do maintenance, triage, and proactive work. Key parallels:

| Paper Concept | Our System |
|---|---|
| Heartbeat mechanism | Per-agent heartbeat cron |
| Cognitive modules (Planner, Critic, Recaller, Dreamer) | Agent roles (scout=Recaller/Dreamer, bob=Analyst, coach=Critic, optimizer=Planner) |
| Dynamic module registry | Agent dispatch via may |
| Meta-learning scheduler | May's project/priority system |
| Historical context adaptation | Context.md + checkpoints |

**Key difference**: Their scheduler LEARNS when to activate modules via meta-learning on interaction logs. Our system uses fixed cron intervals. This suggests an optimization path: adaptive heartbeat frequency based on activity patterns.

## Predictions

- **P-759a**: Adaptive heartbeat frequency (more frequent during active periods, less during idle) would improve our system's efficiency
- **P-759b**: Adding a "Dreamer" module (speculative planning during idle heartbeats) could improve proactive discovery
- **P-759c**: Their meta-learning approach could be adapted to learn optimal agent dispatch ordering

## RECOMMEND

- **Tech-lead**: Consider adaptive heartbeat scheduling — the paper provides theoretical grounding for variable-frequency agent activation
- **Optimizer**: Meta-learning for heartbeat scheduling aligns with workflow optimization goals
- **Bob**: Formal model of when cognitive activities add value vs. waste resources
