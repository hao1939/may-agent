# NVIDIA NOOA: Object-Oriented Agent Framework

Date: 2026-07-26
Source: https://arxiv.org/abs/2607.20709v1
Tags: #agent-framework #python #architecture #nvidia

## Summary

NVIDIA presents Object-Oriented Agents (NOOA), a model-agnostic Python framework where an agent is simply a Python object: methods are actions, fields are state, docstrings are prompts, and type annotations are contracts. Methods with `...` as body are completed at runtime by an LLM agent loop; methods with normal bodies remain deterministic Python.

## Key Contributions

1. **Agent-as-Python-object programming model** — developers and agents share the same interface, enabling standard testing/tracing/refactoring.
2. **Six model-facing primitives** combined on one surface (first to do so): typed I/O, pass-by-reference over live objects, code as action, programmable loop engineering, explicit object state, model-callable harness APIs.
3. **Benchmark results** — effective on SWE-bench Verified, Terminal-Bench 2.0, and ARC-AGI-3.

## Relevance

Signals a convergence toward treating agent definitions as native code constructs rather than prompt-template graphs. The "method body as contract boundary" pattern (deterministic vs LLM-completed) is a clean separation that could influence how agent harnesses evolve. Validates that Python's existing type system is sufficient for agent contracts without custom DSLs.

## Status

Published 2026-07-22. No open-source release URL found in abstract; framework name is NOOA (NVIDIA-labs OO Agents).
