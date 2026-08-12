# TRACE-ROUTER: Task-Level Routing for Agentic AI

Date: 2026-07-27
Source: https://arxiv.org/abs/2607.22465

## Summary

TRACE-ROUTER reframes LLM routing for agents as a task-level decision rather than per-call. A contextual bandit assigns each incoming task to a single model, pins all subsequent LLM calls to that backend, then updates its policy using the task's terminal reward (jointly accounting for accuracy and latency). This avoids the credit-assignment problem of per-call routers that never observe the delayed outcome.

## Key Results

- On tau2-Bench: +7–8 accuracy points over latency-matched interpolation between individual models.
- On Terminal-Bench: +7.1 accuracy points vs. strongest single-model baseline with 36% lower latency.
- Achieves non-dominated Pareto frontier points across three agentic benchmarks.

## Agent Engineering Relevance

- **Pattern: pin-at-admission routing** — decide once per task, attribute reward once. Eliminates per-step credit assignment noise.
- Contextual bandit (not RL) keeps the decision lightweight and online-updatable.
- Directly applicable to multi-model agent deployments that want cost-quality optimization without per-step overhead.
- Contrasts with infrastructure-level routers (e.g., OmniRoute) that handle failover but not quality-aware selection.

## Tags

- routing
- model-selection
- cost-optimization
- contextual-bandit
- agent-deployment
