# AgentHPOBench: Benchmarking LLM Agents as Sequential Experimenters

Date: 2026-08-03
Source: https://arxiv.org/abs/2607.29626
Tags: agent-benchmarks, hyperparameter-optimization, iterative-reasoning, scientific-agents

## Summary

AgentHPOBench is a sequential benchmark evaluating whether LLM agents can interpret experimental evidence and iteratively refine hyperparameter configurations. It comprises 30 executable ML tasks across seven research categories. Each task starts with a validated baseline; the agent then performs sequential interventions, observing accumulated configs, metrics, and logs before proposing the next valid configuration.

## Key Results

- 12 widely used agents and conventional HPO baselines evaluated under a unified protocol.
- Current agents show measurable optimization ability but face clear limitations in sustained iterative refinement, complex log diagnosis, and consistent progress toward reference performance.
- Highlights the gap between single-step code generation and multi-step experimental reasoning.

## Relevance to Agent Design

Signals that "agent as experimenter" is crystallizing as a distinct capability axis. The benchmark tests exactly the feedback-loop reasoning (observe → hypothesize → act → observe) that differentiates agentic systems from one-shot LLM calls. The finding that agents struggle with sustained refinement and log diagnosis suggests memory, state tracking, and structured reflection remain open problems for scientific agent loops.
