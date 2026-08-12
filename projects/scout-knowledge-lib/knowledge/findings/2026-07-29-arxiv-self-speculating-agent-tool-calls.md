<ai_context>
summary: "Self-speculating agent: single LLM model that both solves tasks and predicts its next tool call from partial trajectories, hiding tool-call latency. Joint agent-speculator RL training improves next-call Hit@1 from 44→61 (Qwen3-4B) and 49→66 (Qwen3.5-4B) while preserving task success. No separate draft model needed."
triggers: ["tool call speculation", "latency hiding", "agent inference", "speculative execution", "self-speculating agent"]
date: "2026-07-29"
source_basis: "arXiv 2607.25816v1 (Speculate While You Reason, 2026-07-28)"
</ai_context>

# Self-Speculating Agent: Hiding Tool-Call Latency via Joint RL

Source: https://arxiv.org/abs/2607.25816

## What It Is

LLM agents spend significant wall-clock time waiting for tool results. This paper
proposes a **self-speculating agent** — a single model operating in two modes:

1. **Agent mode**: solves tasks normally
2. **Speculator mode**: predicts the next tool call from partial trajectories

The key insight: the target agent itself is a better next-call predictor than a
separate draft model. Both modes share the same model and prefix KV cache.

## Method

Joint agent-speculator reinforcement learning derives speculation targets from the
agent's own rollouts and alternates agent and speculator updates. No separate draft
model or cached traces needed.

## Key Results

- Next tool-call Hit@1: 44.1 → 61.2 (Qwen3-4B), 48.9 → 66.3 (Qwen3.5-4B)
- Task success rates preserved — speculation training doesn't degrade agent quality
- Works across agentic search QA and conversational tool-use tasks

## Why It Matters

This is a complementary latency optimization to [SpecBox](2026-07-28-arxiv-speculative-sandbox-scheduling.md)
(which speculatively pre-allocates sandboxes). SpecBox optimizes the infrastructure
side; self-speculation optimizes the model side. Together they represent a maturing
"speculative execution for agents" pattern:

| Layer | Technique | Saving |
|-------|-----------|--------|
| Infrastructure | SpecBox sandbox preallocation | 2.9× P99 latency, 45.9% memory |
| Model | Self-speculating agent | ~17pp Hit@1 improvement |

The self-contained design (no external speculator) makes this practical for
deployment — any tool-using agent could potentially be fine-tuned with this
approach. The RL training recipe is the main contribution over heuristic
speculation methods.
