---
title: "OpenTax Engine — Deterministic, Proof-Bearing Tax Calculator Built for Agent Consumption"
source: github
date: 2026-07-24
last_updated: 2026-07-24
relevance: B
tags: [agent-tooling, verifiability, deterministic-tools, proof-systems]
---

Repo: https://github.com/Invaro/opentax-engine

## What It Is

OpenTax Engine is an open-source (AGPL-3.0) US tax calculator written in pure TypeScript that produces **verifiable proof trees** for every computation. Each result cites the specific statute (e.g., `26 U.S.C. § 63(c)`) and can be independently re-derived by anyone — alter one byte of the proof and the verifier pinpoints exactly what broke. The engine uses exact arithmetic (no floating point), Merkle-rooted rule corpora, and canonical JSON proof format.

Stars: 87 | Language: TypeScript | License: AGPL-3.0

## Why It Matters for Agents

This is a clean example of the **"verifiable tool output" pattern** — instead of agents trusting opaque API responses, the tool provides a cryptographically anchored proof that the agent (or a downstream verifier) can check independently. Key properties:

1. **Deterministic**: Same inputs always produce same outputs, with exact-cent arithmetic. Agents can rely on reproducibility.
2. **Self-documenting**: Every answer includes a full derivation tree citing the law. An agent doesn't need to "understand" tax law — it can relay the proof.
3. **Offline-verifiable**: The proof format is fully specified; independent verifiers can be written in any language. This breaks the "trust the tool" assumption.
4. **Refuses when uncertain**: If the engine can't derive an answer from its encoded rules, it refuses rather than guessing — a model for how agent tools should handle ambiguity.

Claims highest score ever recorded on TaxCalcBench (96% exact returns).

## Agent-Design Implications

- **Proof-bearing tools reduce hallucination risk**: When agent tools return verifiable derivations rather than bare answers, downstream agents or humans can audit the chain.
- **Merkle-rooted corpora enable version pinning**: Agents can verify they're working against a known rule set, not a silently updated one.
- **The "refuse rather than guess" pattern** aligns with the broader push for agents that know the boundaries of their competence.

This pattern could generalize beyond tax: regulatory compliance, financial calculations, legal reasoning — any domain where agents need auditable, deterministic tool outputs.
