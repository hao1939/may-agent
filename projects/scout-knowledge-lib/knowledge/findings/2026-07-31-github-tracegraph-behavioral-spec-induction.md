---
title: "tracegraph — Induce Behavioral Specs from Agent Traces, Then Check/Diff/Gate"
source: github
date: 2026-07-31
last_updated: 2026-07-31
type: finding
tags: [github, agent-observability, behavioral-spec, trace-analysis, mcp, ci-gating, tool-use-safety]
Repo: https://github.com/wayfarer-ai/tracegraph
---

## What it is

**tracegraph** is a TypeScript CLI that induces a reviewable behavioral specification from a pile of agent execution traces, then lets you check, diff, and live-gate against that spec. No LLM or API key required for any of its four verbs.

## Core verbs

| Verb | Purpose |
|---|---|
| `synthesize` | Traces → spec: discovers the actual tool-call graph, conditions, and decision gates |
| `check` | CI-ready: validates new traces against the spec, non-zero exit on deviation |
| `diff` | Compares two specs (e.g. before/after a model swap) on structure, thresholds, decision agreement |
| `gate` | MCP proxy that blocks tool calls that violate the spec in real time |

## Why it matters for agent engineering

The key insight is that hand-written trajectory assertions ("was policy checked before refund?") can pass while the agent is actually broken — e.g., calling a policy check with a wrong ID, getting an error, and proceeding anyway. An induced spec captures *what state a decision requires*, not just call ordering. The gate verb acts as a live MCP proxy that can shadow or block calls that don't satisfy the spec's guards.

This addresses a gap between post-hoc observability (traces/logs) and pre-hoc constraints (hardcoded rules): the spec is *induced* from real behavior, lives in git as a diffable YAML artifact, and enforces at runtime.

## Relation to other findings

- Complements **Agent Detective** (OTEL blame analysis) — Detective finds *which agent* broke; tracegraph captures *what the correct behavior pattern is* and enforces it.
- Relates to the **CoT Monitoring Fragility** thesis — tracegraph offers a non-CoT behavioral constraint mechanism.
- Connects to **trace-file-lineage** provenance work — different layer (tool-call behavior vs. file provenance).

## Signal strength

Early (3★, created 2026-07-29), but the README demonstrates a concrete real-world failure caught by the approach. TypeScript, works with Claude Code stream-json traces out of the box. Worth watching for adoption.
