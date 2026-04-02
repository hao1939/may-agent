# Anthropic Harness Design: 3-Agent Architecture for Long-Running Code Generation

**Source**: 小红书 (Henryz)  
**Date**: 2026-04-02  
**Original**: Anthropic Engineering Blog

---

## Overview

Anthropic published an engineering blog post explaining their internal approach to enabling Claude to autonomously write code for extended periods — not just 10-minute tasks, but **continuous hours-long sessions** building complete applications from scratch.

## Problems with Previous Approaches

The earlier approach used one Agent for task decomposition and another for code writing, but two persistent problems emerged during long-running sessions:

1. **Context Anxiety** - The model starts feeling it's approaching context limits and begins rushing to finish prematurely
2. **Self-Evaluation Failure** - When asked to evaluate its own work, the model consistently thinks it did a good job (optimism bias)

## Solution: GAN-Inspired 3-Agent Architecture

Their solution borrows from GAN (Generative Adversarial Network) principles: **separate generation from evaluation**.

| Agent | Role |
|-------|------|
| **Planner** | Expands a single sentence prompt into a complete product specification |
| **Generator** | Writes the actual code |
| **Evaluator** | Uses Playwright to operate the application like a real user and find bugs |

Key insight: It's easier to train an independent Evaluator than to teach the Generator self-criticism.

## Results

**Test Case**: Generate a retro game maker from the same prompt

| Version | Result |
|---------|--------|
| Single Agent | Core functionality broken — characters placed but didn't respond to input |
| 3-Agent | Had minor flaws but ran correctly |

## Simplification with Opus 4.6

With the release of Opus 4.6, they simplified the architecture:
- Removed Sprint segmentation
- Generator can now write continuously for 2 hours without breaking
- Evaluator still catches bugs and missing features that Generator overlooked

## Key Insight

> "As models improve, interesting Harness combinations aren't decreasing — they're shifting. The AI engineer's job is to continuously find the next effective combination."

## Implications for Our System

1. **Evaluation is harder than generation** - A dedicated evaluator agent with actual testing capabilities (like Playwright) is more effective than self-evaluation
2. **Context anxiety is real** - Long-running agents need strategies to manage perceived context pressure
3. **Model capability changes architecture** - What requires complex orchestration today may become simpler as models improve
4. **The GAN pattern** - Generator + Discriminator (Evaluator) is a proven pattern worth exploring for our multi-agent tasks

---

**Tags**: #agent-architecture #anthropic #claude #multi-agent #code-generation #evaluation
