---
title: "AxisAgentic + AxisRL — End-to-End Agent Trajectory Collection and RL Post-Training"
source: github
date: 2026-07-25
last_updated: 2026-07-25
type: finding
tags: [github, agent-training, trajectory-collection, reinforcement-learning, post-training, long-horizon-agents, sft, grpo, sglang, megatron]
---

# AxisAgentic + AxisRL — End-to-End Agent Trajectory Collection and RL Post-Training

Repo: https://github.com/XYZ-AI-Lab/AxisAgentic
Repo: https://github.com/XYZ-AI-Lab/axrl

## Summary

XYZ AI Lab released two companion frameworks (both Apache-2.0, Python 3.12+, created 2026-07-23) that together close the loop between agent execution and agent training:

1. **AxisAgentic** (29★) — an extensible runtime for long-horizon agents that produces append-only traces capturing the exact context visible to the model at each step. These traces serve triple duty: recovery/replay, benchmark evaluation, and state-faithful SFT export.

2. **AxisRL** (27★) — an agentic RL post-training framework built on SGLang (rollout) and Megatron (training) that consumes trajectories from agent workflows and trains models with PPO, GRPO/GRPO2, GSPO, TOPR, TIS, and related objectives.

## Key Design Patterns

### Trajectory as shared contract
The append-only trace is the single source of truth across execution, evaluation, and training. Runtime markers (rollback, context compaction, discard) are replayed faithfully during SFT export so supervised examples never include history the model couldn't see.

### Black-box harness capture (AxisRL)
AxisRL supports both white-box agent environments and black-box capture via an OpenAI-compatible proxy — meaning existing agent deployments can produce training data without code changes.

### Partial rollout for efficiency
Long-horizon agent tasks (300+ turns reported) create idle-time problems. AxisRL uses partial rollout, prefix-tree merge, handle-based data movement, and off-policy stabilization (TIS, Icepop) to keep GPU utilization high.

### Rollout-trainer consistency observability
A dedicated mismatch analysis system detects divergences in tokenization, masks, logprobs, routing, packing, or weight versions between rollout and training — a common silent failure mode in agentic RL.

## Why This Matters

This pair represents a maturing pattern: **the agent-training flywheel as infrastructure**. Rather than treating agent execution and model improvement as separate concerns, these frameworks make the loop a first-class system. Key signals:

- **State-faithful replay** — most trajectory datasets lose information about what the model actually saw (due to context window management, rollbacks, tool failures). AxisAgentic's visibility markers solve this.
- **Scale indicators** — AxisRL reports "hundreds-of-billions-parameter scale" training and 300+ turn trajectories. This is industrial-grade, not research-prototype.
- **XYZ-Aquila reference** — the flagship recipe is a search agent that benchmarks across BrowseComp, LiveBrowseComp, DeepSearchQA, and other agentic search benchmarks, suggesting the web-agent domain as primary validation ground.

## Architectural Pattern

**Execution-to-training loop** — agent runtime produces traces → traces are filtered/evaluated → selected trajectories exported in training format → RL or SFT updates the model → updated model deployed back to runtime. The key insight is that the trace format must preserve model-visible state faithfully for training signal to be valid.

## Connections

- Relates to agent evaluation research (traces enable both offline eval and training)
- Extends the trajectory/experience replay concepts from classic RL into multi-turn tool-using agents
- Complements agent governance patterns — traces also serve as audit logs
- The "black-box harness capture" pattern connects to agent observability tools (tooltrace, agent-report-card)
