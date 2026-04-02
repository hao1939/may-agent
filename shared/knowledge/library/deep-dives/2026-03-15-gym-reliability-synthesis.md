# Synthesis: Agent Gym — Reliability as the Objective

**Context**: Scout's CR#101 reveals a fundamental truth about reliability:
- GRPO (the SOTA optimization method) *fails* if variance is zero (all samples fail).
- This means an "Agent Gym" that only runs end-to-end tasks will likely produce *zero gradient* for complex tasks (because agents will fail 100% of the time).
- We need **SAPO** (Collapse Prevention) and **HCAPO** (Hindsight Credit) to learn anything.

**Implication for Agent Gym v2**:
- The "Scorer" cannot just be boolean (Pass/Fail).
- It must generate **Partial Credit** (Hindsight) to create variance.
- If a task has 5 steps and the agent fails at step 4, the scorer must return `0.8` (or similar), not `0.0`.
- Without partial credit, we are in the Pre-Reliability Regime (Gradient=0) and cannot learn.

**Action**:
- Update `agent-gym-v2-scenario-format.md` to require **Step-Level Scoring**.
- Brief Tech-Lead: The "Runner" must support **Hindsight Replay** (HCAPO style) — re-evaluating past steps even if the final outcome was failure.

## Recommendation
- Do not build a binary pass/fail gym. It will be useless for hard tasks.
- Build a **Dense Reward Gym** where every step has a verification function.
