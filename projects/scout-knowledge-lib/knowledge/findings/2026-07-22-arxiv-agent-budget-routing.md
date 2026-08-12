# CodeRescue: Budget-Calibrated Recovery Routing for Coding Agents

Date: 2026-07-22
Source: https://arxiv.org/abs/2607.19338v1
Repo: https://github.com/Qijia-He/agent-budget-control
Tags: #agent-cost #coding-agent #routing #conformal-risk-control

## Summary

CodeRescue reframes the cheap-model-then-escalate cascade as a **recovery routing** problem: after a coding agent fails and receives execution feedback, should it retry cheaply or escalate to a stronger model? The authors train a supervised router from execution rollouts and add a Conformal Risk Control (CRC) calibration layer that adjusts cost penalties at deployment time without retraining.

## Key Results

- Cheap recovery and escalation show complementary success patterns across five coding benchmarks.
- One CRC-calibrated frontier point exceeds the always-escalate solve rate while using only **35% of its mean recovery cost** (GPT-5.4-nano / GPT-5.4 setting).
- The CRC layer provides marginal expected-cost control under exchangeability — no retraining needed when budgets change.

## Relevance to Agent Harness Design

- **Post-failure branching**: execution feedback creates a decision point that simple cascades ignore. Harnesses should expose structured failure signals (not just pass/fail) to enable recovery routing.
- **Conformal calibration**: CRC gives deployment-time budget knobs with statistical guarantees — applicable beyond coding to any agent with heterogeneous fallback actions.
- **Cost-aware orchestration**: complements fixed retry/escalation policies with learned routing; relevant for multi-model agent systems managing token budgets.
