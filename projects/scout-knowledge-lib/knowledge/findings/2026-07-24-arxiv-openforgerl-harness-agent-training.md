# OpenForgeRL: End-to-End RL Training for Harness-Based Agents

Date: 2026-07-24
Source: https://arxiv.org/abs/2607.21557
Tags: #ai-agents #reinforcement-learning #training #tool-use #open-source

## Summary

OpenForgeRL is an open-source framework for training AI agents end-to-end within their actual inference harnesses (Claude Code, Codex, OpenClaw, etc.) using RL. The key insight: modern agents depend on complex multi-turn harnesses for tool use and reasoning, but existing RL training stacks can't natively express stateful, multi-process harness inference.

## Architecture

- **Lightweight proxy** serves harness model calls while recording them as training data for standard RL codebases (e.g., veRL)
- **Kubernetes orchestrator** runs each rollout in its own remote container
- Decouples training infrastructure from inference harness, enabling training on any harness in any environment

## Key Results

- OpenForgeClaw: 31.7 pass^3 / 55.9 pass@3 on ClawEval, 33.7 on QwenClawBench
- OpenForgeGUI: 37.7 on OSWorld-Verified, 63.0 on Online-Mind2Web, 72.3 on WebVoyager
- Matches or surpasses models several times larger in GUI setting
- Only hundreds to a few thousand tasks needed

## Insights for Agent Builders

- Harness choice matters significantly for learnability — some are substantially harder to learn than others
- RL improves agentic reliability (self-verification, tool coverage, multi-step plan completion)
- Error recovery remains a weak point even after RL training
- The proxy-based approach means any existing harness can be made trainable without modification

## Relevance

Directly relevant to anyone building production agents with tool-use harnesses who wants to fine-tune models specifically for their agent architecture rather than relying on general-purpose models.
