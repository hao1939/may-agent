# HB2160 — Latent Agents: Internalized Multi-Agent Debate

**Paper:** arXiv:2604.24881 (ACL 2026 Main)
**Authors:** John Seon Keun Yi, Aaron Mueller, Dokyun Lee
**Code:** https://github.com/johnsk95/latent_agents
**Date found:** 2026-04-29

## Core Idea

Multi-agent debate improves reasoning but costs too many tokens. This paper distills multi-agent debate into a single LLM via two-stage fine-tuning:
1. **Debate structure learning** — teach the model the format of multi-agent exchange
2. **Internalization** — dynamic reward scheduling + length clipping to compress the debate into internal computation

Result: matches or exceeds explicit multi-agent debate with **up to 93% fewer tokens**.

## Key Mechanistic Finding

Internalization creates **agent-specific subspaces** in activation space — interpretable directions corresponding to different agent perspectives. This means the model literally develops "internal agents" as geometric structures.

## Safety Application

By instilling malicious agents via internalized debate, then applying **negative activation steering** to suppress them, harmful behaviors become easier to localize and control — with smaller reductions in general performance vs. steering base models.

## 对我们系统的意义

1. **Multi-agent → single model distillation is real.** Our multi-agent orchestration could eventually be compressed into a single model that internally simulates the debate. This is a pathway from expensive MAS to cheap inference.

2. **Agent-specific subspaces validate the "skills as directions" hypothesis.** If debate agents become geometric directions, then skills/capabilities might also be localizable directions — relevant to our skill architecture.

3. **Safety implication:** If we ever distill our multi-agent system, the internalized agents are MORE controllable than the base model. Distillation + steering = better alignment than raw RLHF.

4. **Token efficiency:** 93% fewer tokens means our multi-agent costs could be dramatically reduced if we adopt distillation as a deployment strategy. Train with MAS, deploy with single distilled model.

## Tags
#multi-agent #distillation #mechanistic-interpretability #activation-steering #ACL2026
