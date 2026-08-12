---
title: "Super Simple Software Factory — Deterministic Code Owns the Agent Graph"
source: github
date: 2026-08-03
last_updated: 2026-08-03
type: finding
tags: [github, agent-architecture, orchestration, deterministic-control, coding-agents, workflow]
relevance: medium-high
---

# Super Simple Software Factory

## Overview

- **Repo:** [disler/super-simple-software-factory](https://github.com/disler/super-simple-software-factory) (117★, created 2026-08-02)
- **Author:** disler
- **Language:** Python
- **What:** A skill/template that packages agent-plus-code workflows into repeatable, deterministic pipelines. The core principle: Python code owns sequencing, retries, and acceptance gates — coding agents operate only as bounded nodes within named phases.

## Key Design Principles

| Principle | Detail |
|---|---|
| **Code owns the graph** | Deterministic Python controls phase sequencing, not prompts |
| **Agents as bounded nodes** | Each agent operates in a single named phase with typed JSON envelope I/O |
| **Phase = trace unit** | Every phase boundary is a checkpoint; failures are attributable to a specific step |
| **Acceptance gates** | Each phase has a code-defined acceptance criterion — "done" is not "agent stopped talking" |
| **SQLite event stream** | Every event streams to SQLite during execution, enabling real-time UI and post-hoc analysis |
| **Correction > restart** | Session stays alive across phases; fixing one phase is cheaper than cold restart |
| **Envelope-mediated context** | Typed JSON envelopes are the only mechanism for context to cross phase boundaries |

## Why This Matters

1. **Anti-pattern articulation:** The repo explicitly names the failure mode of "one big agent owning its own loop" — no phase boundaries, no acceptance criteria, no reproducibility. This matches emerging consensus in production agent deployments.

2. **Deterministic orchestration pattern:** Positions agents as execution engines within a code-controlled DAG rather than autonomous planners. This is the same architectural insight behind systems like deer-flow, Temporal-based agent harnesses, and production coding agent deployments.

3. **Reproducibility-first:** The explicit goal of "get the same result twice" addresses the most common complaint in coding agent adoption — non-deterministic outputs from identical inputs.

4. **Skill-as-template model:** Designed to be "stamped into any repo" — a portable pattern rather than a hosted platform. Aligns with the trend of agent capabilities as installable project-level configuration.

## Connections to Library Themes

- **Agent harness architecture** — complements findings on better-harness (QoderAI) and Harness-R1; all converge on "code controls, agent executes"
- **Deterministic agent workflows** — the "agent proposes, code disposes" mantra echoes the control-plane patterns seen in deer-flow and AxisAgentic
- **Observability** — SQLite trace stream is a lightweight version of the agent telemetry patterns (OpenTelemetry for agents)
- **Bounded agent autonomy** — the explicit phase-gating mirrors the compliance/safety patterns in ratchet-agent and council-lab deliberation
