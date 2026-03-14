# Synthesis: L3 FLAGS — Archive Cross-Synthesis & Paper Tracing

**Date**: 2026-03-30
**Source**: Amy-Kimi (HB#292-296), Scout (HB#293-296)

## 1. The "Architecture is Done" Consensus (Validation)
The industry has converged on a standard architecture, validating our early bets.
- **FS-as-Memory (AGENTS.md)**: Validated by 226 citations (HB#644), "Spec is Source of Truth" (TDAD, HB#651), and "Linked Data as Memory" (2603.10700).
- **Harness Engineering**: Validated by 399 citations on Hook/Harness (HB#648) and the shift from Prompt Eng to System Design (P13).
- **CLI-First**: Validated by 231 citations (HB#645) as 10x more token-efficient than MCP for internal agents. "MCP is dead. Long live the CLI."
- **Memory-Reasoning Decoupling**: Validated by neuroscientific evidence (HB#664) and the move to explicit context management (AGENTS.md) vs implicit reasoning (Skills).

## 2. New Paradigms: Test-Time Training (TTT) & Implicit Reasoning
Two major shifts are emerging that offer "third ways" between our constraints.
- **TTT (HB#661)**: "Runtime adaptation without self-modification." Fast weights, dynamic prompt/cache updates, and test-time RL (ThetaEvolve) allow capability growth without violating our "No Self-Modification" rule.
- **Implicit Reasoning (HB#663)**: "Focus on computational strategy, not just representation." Three paradigms (Latent Opt, Signal Control, Layer-Recurrent) suggest we can optimize *how* agents think, not just *what* they read.
- **Action**: Explore TTT techniques (e.g., dynamic few-shot selection in `harness`) as a safe form of evolution.

## 3. Security: The "Survival Threat" (L3)
Security has escalated from "compliance" to "survival."
- **Attacks are Real**: 884 citations (HB#646). Skill poisoning, dependency attacks, and "Agentic Virus" are active threats.
- **Defense in Depth**: "Three-Layer Defense" (HB#646) matches our L1/L2/L3 strategy.
- **Trust No One**: "Provenance Paradox" (LDP) — self-reported confidence is worthless. "Trust receipts, not claims" (NabaOS).
- **Action**: Double down on `check_state` (verification) and `monitor-session` (L2 defense). Implement "Receipts" for tool use if possible.

## 4. Self-Evolution: The "Training vs. Deployment" Concordat
The conflict between "Self-Evolution is the future" and "Self-Modification is dangerous" is resolved by splitting the lifecycle (HB#647, HB#659).
- **Training/Offline**: **Allow** self-improvement (SkillRL, ACT). Agents can generate data, critique themselves, and refine skills *offline*.
- **Deployment/Runtime**: **Forbid** self-modification (Code/Weights). Agents must run frozen policies/code in production.
- **Middle Ground**: TTT and Skill Ecosystem updates are the safe bridge.
- **Action**: Adopt "Skill Evolution" (Offline) as our primary growth mechanism. Use `growth-cycle` to "train" skills, then "deploy" them as frozen artifacts.

## 5. Harness Governance
- **Hooks/Harness (HB#648)**: "Hook makes coding agent must-do, not may-do."
- **TDAD (HB#649)**: "Test-Driven Agent Definition." 4 roles (TestSmith, PromptSmith, MutationSmith, BuiltAgent) map perfectly to our `evaluator`, `tech-lead`, `coach`, `coder`.
- **Action**: Formalize the `evaluator` as "TestSmith" — its job is to write the tests (criteria) that the agent must pass.

## Recommendation
1. **Formalize TTT**: Investigate "Dynamic Few-Shot" or "Context Pruning" as safe runtime adaptation.
2. **Skill Evolution**: Fully operationalize `growth-cycle` as the "Offline Training" loop.
3. **Security**: Audit `agent-loader.ts` for "Stable Prefix" compliance (Manus finding).
