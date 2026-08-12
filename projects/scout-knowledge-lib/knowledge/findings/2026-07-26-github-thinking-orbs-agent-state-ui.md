---
title: "Thinking Orbs — Tuned Loading Indicators for Agent State Visibility"
source: github
date: 2026-07-26
last_updated: 2026-07-26
type: finding
tags: [github, agent-ui, state-visibility, loading-indicators, ux, typescript]
---

# Thinking Orbs — Tuned Loading Indicators for Agent State Visibility

Repo: https://github.com/Jakubantalik/thinking-orbs

## Summary

A TypeScript component library (1,072★ in 5 days) providing dotted thought-orb loading indicators specifically designed for AI and agent UIs. Ships six tuned animation states that map to distinct agent phases, two sizes, and automatic dark/light mode adaptation.

## Why It Matters

Most agent UIs still use generic spinners or streaming text to convey "thinking." This project maps agent processing phases (e.g., planning, tool-calling, synthesizing) to visually distinct animated states, giving users richer feedback about what the agent is doing without exposing raw chain-of-thought.

The rapid star growth (1,072★ in 5 days) signals pent-up demand for purpose-built agent UX primitives — components designed for the specific affordances of agentic systems rather than adapted from traditional web loading patterns.

## Key Design Choices

- **Six discrete states** — goes beyond binary "loading/done" to represent multiple agent phases
- **Two sizes** — compact (inline) and prominent (full-screen wait)
- **Auto dark/light** — adaptive theming without configuration
- **Framework-agnostic TypeScript** — can be integrated into React, Vue, Svelte, or vanilla

## Connections

- Complements the Slab design language (agent-authored UI) — Slab is about agents generating UI; thinking-orbs is about UI reflecting agent state back to humans
- Related to the broader "agent observability" theme: human-facing state visibility is the UX counterpart to structured logging and tracing
