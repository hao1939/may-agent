---
title: "hermes-self-evolution — Constitutional Offline Self-Improvement for Agent Harnesses"
source: github
date: 2026-07-26
last_updated: 2026-07-26
type: finding
tags: [github, self-evolution, hermes-agent, constitutional-governance, cron-loops, agent-improvement, offline-learning]
---

# hermes-self-evolution — Constitutional Offline Self-Improvement for Agent Harnesses

Repo: https://github.com/erenciracioglu-dotcom/hermes-self-evolution

## Summary

An MIT-licensed Shell/prompt framework (54★ in 1 day, created 2026-07-25) that adds scheduled offline self-improvement to Hermes Agent instances via four cooperating cron roles: **Evolution** (proposes capability changes), **Critic** (challenges proposals with diverse models), **Verifier** (runs falsifiable predictions against witness logs), and **Gardener** (prunes stale or harmful patterns).

The framework is governed by a 6-article Constitution that explicitly forbids "bookkeeping theatre" — internal cleanups that don't produce observable user-facing improvement.

## Why It Matters

This is one of the first open-source implementations of **constitutional offline agent self-improvement** — combining several patterns the Scout library tracks:

1. **Multi-role adversarial loops** — Evolution and Critic deliberately use different models to avoid reinforcing blind spots (addresses the "collusion" failure mode in self-play).
2. **Constitutional governance** — A human-ratified constitution constrains what the agent may evolve, requiring amendments to go through proposal + approval.
3. **Ships empty** — No preset data; each operator populates from their own `witness-log.md`, ensuring ground-truth comes from real experience rather than synthetic data.
4. **Offline vs. online separation** — Complements Hermes' built-in in-session learning with scheduled background improvement, creating a dual-loop learning architecture.

## Key Design Choices

- **Witness log as append-only ground truth** — all improvement claims must trace back to real operator friction recorded in logs
- **Falsifiable predictions** — Verifier role requires testable claims, not just narrative explanations
- **Diverse-model mandate** — Evolution and Critic must run on different LLMs to break self-reinforcement
- **Gardener role** — dedicated pruning prevents skill/knowledge bloat over time

## Relevance to Agent Architecture

Signals that the "harness evolution" pattern is maturing from ad-hoc prompt iteration into structured, governed offline loops. The constitutional constraint + multi-role adversarial design addresses the key failure modes (theatre, collusion, unbounded growth) that plague naive self-improvement approaches.

## Limitations

- Very early (1 day old, 54★), shell-based — may not survive beyond Hermes ecosystem
- Effectiveness depends entirely on quality of witness log entries (garbage in, garbage out)
- No benchmark results or longitudinal evidence of improvement yet
