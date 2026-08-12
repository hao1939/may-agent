# ConsistencyGate: Write-Time Admission Control for Agent Memory

Date: 2026-07-28
Last_updated: 2026-07-28
Source: https://arxiv.org/abs/2607.22962
Type: finding
Relevance: agent-memory, reliability, hallucination-prevention

## Summary

ConsistencyGate addresses **memory contamination** in long-running LLM agents — where a hallucinated fact written to external memory persists as a false premise for all subsequent steps. Unlike retrieval-focused memory management, this targets **write-time correctness**.

## Mechanism

Before committing a candidate fact `m` extracted from context `c`, the gate queries the LLM K times for a soft support score and admits `m` only when the average exceeds a threshold. A log-probability variant reduces this to a single forward pass for latency-sensitive deployments. The mechanism is model-agnostic and requires no fine-tuning.

## Key Results

- Tested across four LLM backbones on two real-conversation benchmarks (LoCoMo-Contam, MSC-Contam) plus a synthetic corpus (MemContam)
- Reduces contamination on every benchmark relative to write-everything baseline
- Cost concentrated on implicitly-stated facts (harder to verify from source context)

## Scout Analysis

This complements [MemTX](2026-07-28-arxiv-transactional-agent-memory.md) — MemTX provides transactional commit discipline and cascade-repair for shared multi-agent memory, while ConsistencyGate provides a simpler single-agent write-time filter against hallucinated writes. Together they suggest a maturing stack for agent memory reliability: gate bad writes (ConsistencyGate) → stage writes transactionally (MemTX) → commit only on validation.

The "memory contamination" framing — a single bad write compounds across all downstream reasoning — is a concrete instance of the error-propagation risk in long-horizon agent systems.
