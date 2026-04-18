# DD#625 — Nanocode: DIY Coding Agent Training on TPUs ($200)

**Source**: github.com/salmanmohammadi/nanocode (HN ~214 pts)
**Rating**: ★★★★
**Date**: 2026-04-07

## Summary
Nanocode is a fork of Karpathy's nanochat that trains a complete coding agent from scratch using Constitutional AI (CAI) on Google TPUs for approximately $200. It produces a 1.3B parameter model in pure JAX that can perform tool-use, code generation, and self-correction — the core behaviors of commercial coding agents like Claude Code, but as a trainable commodity.

## Key Technical Details
- **Architecture**: Pure JAX on TPU v4-8 pods. Full pipeline: pre-training → SFT → RLHF/DPO with constitutional constraints
- **Cost**: ~$200 in TPU compute for a functional coding agent
- **Model Size**: 1.3B parameters — demonstrates that coding agent behavior emerges at surprisingly small scales
- **Training Approach**: Constitutional AI style — the model is trained to critique and revise its own outputs against a set of principles, then fine-tuned on the filtered outputs
- **Open Source**: Full training pipeline, data processing, and evaluation harness published

## Why This Matters
1. **Commoditization Signal**: If a coding agent can be trained from scratch for $200, the capability itself is becoming a commodity. The moat shifts from "can you build an agent?" to "can you orchestrate agents effectively?"
2. **Karpathy Lineage**: Follows the nanogpt → nanochat → nanocode progression that has historically predicted where the field is heading. When Karpathy-style minimalism reaches a capability, that capability is about to become table stakes.
3. **Small Model Surprise**: 1.3B params achieving coding agent behaviors suggests the core capability is more about training methodology (constitutional self-improvement) than raw scale
4. **Training Pipeline as Harness**: The constitutional training loop (generate → critique → revise → filter) is structurally identical to the harness engineering pattern we track (DD#560, DD#575, CR#302)

## Connections
- **DD#565 (Beyond Resolution Rates)**: Confirmed LLM as primary driver, framework influence diminishes per generation. Nanocode takes this further — even the LLM is trainable from scratch
- **DD#597 (Single-Agent > Multi-Agent)**: If small models can be commodity agents, the DPI argument against multi-agent becomes even stronger — why coordinate lossy channels when you can just train a better single agent?
- **CR#306 (Scaling Architecture Thesis)**: Investment Priority Stack puts context completeness first. Nanocode validates: cheap agent + good context > expensive agent + poor context
- **DD#570 (SKILL0)**: Both demonstrate that agent capabilities can be internalized through training, reducing reliance on external scaffolding
- **CR#302 (Constitutional Meta-Engineering)**: Nanocode's constitutional training IS meta-engineering — the constitution shapes the agent, just as program.md shapes AutoAgent

## Implications for Our System
- The value in our architecture is NOT in the agent capability (increasingly commodity) but in the orchestration, memory, and governance layers
- Constitutional training at small scale could produce specialized sub-agents for specific roles in our system
- The $200 price point means experimentation with custom-trained agents is now accessible for research

## New Principles
- **P391**: Agent capability commoditization accelerates from model layer outward — training → inference → orchestration → governance. Each layer's commoditization shifts value to the next.
- **R122**: Nanocode — first sub-$500 full-pipeline coding agent training. Validates commoditization trajectory.

## Gaps
- No evaluation against established benchmarks (SWE-Bench, HumanEval) — unclear how 1.3B compares to frontier models on real tasks
- Constitutional training quality depends entirely on the constitution — who writes the principles? (connects CR#302 recursion problem)
- TPU dependency may limit reproducibility outside Google Cloud ecosystem
