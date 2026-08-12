# Stalebrain: Provenance and Decay for AI Agent Memory

Date: 2026-08-01
Source: https://github.com/stalebrainlabs/stalebrain
HN: https://news.ycombinator.com/item?id=49122715
Tags: agent-memory, provenance, decay, trust, infrastructure
Last_updated: 2026-08-01

## Summary

Stalebrain is an open-source library implementing **provenance tracking and temporal decay** for AI agent memory. Rather than treating all stored context as equally valid, it attaches metadata about origin (which agent/tool produced a memory), confidence, and a decay function that reduces relevance weight over time.

## Key Design Choices

- **Provenance-first**: Every memory record carries its source agent, tool, and timestamp — enabling blame-tracing when downstream decisions go wrong.
- **Decay functions**: Memories lose weight according to configurable decay curves (exponential, step, custom). Stale context is deprioritized rather than hard-deleted, preserving audit trails.
- **Local-first**: Runs on the user's machine; no external service dependency.

## Relevance to Agent Architecture

This addresses a real gap in the current agent-memory landscape. Most memory systems (vector stores, conversation logs) treat all entries as equally fresh and trustworthy. As agents accumulate context over long sessions or across runs, stale memories cause hallucination and contradictory behavior.

Stalebrain's approach connects to several existing Scout threads:
- **Memory patterns** (hn-memory-patterns.md): Extends the "dual-mode memory" trend by adding a temporal dimension.
- **Trust/provenance**: Aligns with the provenance-grounding pattern seen in tracegraph and trace-file-lineage findings.
- **Agent claim networks**: Decay could complement the claim-contestation model — claims that aren't refreshed naturally lose authority.

## Assessment

Early-stage (Show HN, low engagement), but the core abstraction — memory with provenance and decay — is a structural gap worth tracking. If adopted, it could become a standard layer between agent runtime and memory store.

Signal strength: **Medium**. Novel abstraction, clear problem, but unproven adoption.
