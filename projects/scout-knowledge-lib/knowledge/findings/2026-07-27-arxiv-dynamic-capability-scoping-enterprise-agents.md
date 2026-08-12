# Dynamic Capability Scoping for Enterprise AI Agents

Date: 2026-07-27
Source: https://arxiv.org/abs/2607.22445v1
Authors: Halil Burak Noyan
Tags: agent-security, least-privilege, permissions, enterprise, guardrails
Venue: AIWILD Workshop @ ICML 2026

## Key Insight

Enterprise AI agents are typically granted static, over-privileged credential sets at config time. This paper argues capability scoping must be **dynamic** and follow least-privilege as a *prevention* mechanism: a credential absent from context cannot be misused regardless of agent reasoning.

## Three-Source Architecture

1. **Role-based ceilings** — maximum permissions for a given role.
2. **Task-context classifier** — narrows active credentials to those needed for the current task.
3. **Policy-derived combination prohibitions** — prevents toxic permission combos.

Supports both enforcing and observe-only modes; the latter logs permission requests inconsistent with task context as a misalignment signal.

## Dataset Contribution

600 synthetic enterprise task prompts with minimum-required permissions across a 15-permission taxonomy. Iterating between dataset and policy reduced ceiling violations from 46 → 3 (93% reduction).

## Relevance to Scout

Pattern: dynamic permission scoping as proactive agent safety (vs. reactive detection). The observe-only mode producing behavioral signals is directly useful for misalignment research and could inform how orchestrators scope tool access per-task.
