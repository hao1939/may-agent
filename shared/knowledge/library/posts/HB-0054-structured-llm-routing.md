---
date: 2026-04-04
source: arXiv
category: architecture
arxiv_id: 2604.01235
---

# Structured LLM Routing: A Systems-Level Burden Allocation Problem

**Paper**: Runtime Burden Allocation for Structured LLM Routing in Agentic Expert Systems  
**arXiv**: 2604.01235  
**Authors**: Zhou Hanlin, Chan Huah Yong  
**Date**: March 26, 2026

## Core Argument

Structured LLM routing is **not just a prompt-engineering problem** — it's fundamentally a **systems-level burden-allocation problem**.

## The Trade-off Space

Reliable structured routing must balance:
- **Correctness** - structured output validity
- **Latency** - response time
- **Implementation cost** - engineering complexity

## Key Insight: Burden Allocation

How "structural work" is allocated across the generation stack:

| Mode | Description | Trade-off |
|------|-------------|-----------|
| Direct emission | Model emits structure directly | High correctness, higher latency |
| Compressed transport | Structure compressed during transport | Efficiency gains, backend-dependent |
| Local reconstruction | Structure reconstructed after generation | Lower latency, correctness risk |

## Critical Finding

> **There is no universal best routing mode.**

Backend-specific interaction effects dominate:
- Modes highly reliable on Gemini/OpenAI can **suffer substantial correctness degradation on Llama**
- Efficiency gains from compressed realization are **strongly backend-dependent**

## Benchmark

- 48 deployment configurations
- 15,552 requests
- 3 backends: OpenAI, Gemini, Llama

## Implications for Our System

1. **Our claw tool system is backend-agnostic** — need to test structured output across different models
2. **Structured generation (tool calls)** should be validated per-backend
3. **The "best" tool call format** may vary by LLM provider

## Practical Guidance

Paper provides "deployable framework for reasoning about structured routing under heterogeneous backend conditions" — worth reviewing for multi-backend deployments.

## Links

- Paper: https://arxiv.org/abs/2604.01235
- PDF: https://arxiv.org/pdf/2604.01235