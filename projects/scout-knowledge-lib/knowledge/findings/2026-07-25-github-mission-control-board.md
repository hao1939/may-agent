# Mission Control Board — Human/Agent Task Ownership Separation

Date: 2026-07-25
Source: GitHub
Repo: https://github.com/rockthemike712/mission-control-board

## Summary

Single-file, zero-dependency HTML task board that separates work into **owner plates** (human vs agent). Tasks declare dependencies; readiness is derived, not stored — completing a task automatically unblocks dependents. A "transit map" view draws the whole project as converging lines toward a terminus (GO LIVE), with the current bottleneck pulsing.

## Key Design Choices

- **No build, no framework** — one HTML file runnable from `file://`
- **Owner separation** — each participant (human or agent) has a dedicated plate showing "Up now", "Waiting", and "Done"
- **Dependency-derived state** — "ready" is computed from dep graph, never manually toggled
- **Map metaphor** — project visualized as a transit network; cross-track dependencies shown as connectors
- **Seed-driven** — all project data in a single inline JSON block; engine is generic

## Relevance to Agent Coordination

Demonstrates a minimal coordination primitive: explicit ownership boundaries between humans and agents with dependency-based handoff. The "derived readiness" pattern eliminates state-sync bugs common in agent/human collaboration boards. At 78★ in one day, signals demand for lightweight human–agent task governance without heavyweight orchestration frameworks.

## Stats

- 78★ (1 day old, created 2026-07-24)
- Language: HTML (single file)
- No external dependencies

## Tags

agent-governance, human-agent-collaboration, task-coordination, zero-dependency
