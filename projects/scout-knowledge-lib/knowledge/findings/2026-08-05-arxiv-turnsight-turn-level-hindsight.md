# TurnSight: Tool-Agent Training Is Moving from Trajectory Rewards to Turn-Level Hindsight

Date: 2026-08-05
Last_updated: 2026-08-05
Source: https://arxiv.org/abs/2608.04007
Repo: https://github.com/quchangle1/TurnSight
Tags: agent-training, tool-use, reinforcement-learning, self-distillation, credit-assignment, long-horizon-agents

## Summary

The new arXiv paper **TurnSight** argues that current RL training for tool-using agents is bottlenecked by the **wrong credit-assignment granularity**. Standard outcome-based RL spreads one trajectory reward across many steps, while prior self-distillation methods often score individual tokens using privileged context that may no longer match the state the agent actually reached.

TurnSight's core move is to treat a full **reasoning → tool call → observation** block as the unit that should receive hindsight credit. It builds supervision from the agent's own execution outcomes, compares multiple hindsight views with different lookahead depths, and only keeps signals that agree directionally across those horizons. On the paper's main table, TurnSight is the top method across **three tool-agent benchmarks** for both reported Qwen3 backbones.

## Key Details

- **Problem framing**: long-horizon tool agents need finer credit than "the whole trajectory succeeded" but more coherent credit than per-token rewards inside a tool turn.
- **State-aligned hindsight**: instead of using a gold trajectory or retrieved skill as a teacher, TurnSight derives supervision from the **execution-conditioned states the agent actually visited**.
- **Turn-level aggregation**: the method explicitly aggregates token evidence into a single signal for each complete interaction turn, matching the structure of tool use better than token-wise scoring.
- **Reliability filter**: it constructs multiple hindsight teachers with different lookahead horizons and keeps supervision that shows **cross-horizon directional agreement**.
- **Main results**: on the paper's three benchmark families (**FTRL, BFCL, ToolHop**), TurnSight posts the best reported overall average for both backbones in Table 1:
  - **Qwen3-4B**: **37.51** average vs. **34.76** for the strongest listed baseline.
  - **Qwen3-8B**: **42.02** average vs. **39.03** for the strongest listed baseline.
- **Ablation signal**: in Table 2, removing **turn-level aggregation** drops the reported average from **46.92** to **43.23**, suggesting the gain is not just "more hindsight" but specifically **credit shaped at turn resolution**.

## Why It Matters

Scout's library already has repeated signals that agent systems fail when evaluation or training is too coarse: session-level outcomes hide where a workflow went wrong, and token-level metrics often miss the real control unit of a multi-step agent. TurnSight adds a training-side version of the same pattern.

The useful insight is that **tool agents may need an intermediate accounting layer**:
- not whole-run reward only,
- not raw token credit only,
- but **turn-shaped credit** aligned to the smallest semantically complete control action.

That matters for real agent stacks because many practical failures happen at exactly this level: the agent chose the wrong tool, used the right tool with the wrong arguments, or failed to reinterpret the observation before the next move. A trajectory score tells you too little; token credit tells you the wrong shape.

## Scout Take

The non-obvious contribution in TurnSight is not merely another RL improvement. It strengthens a broader thesis emerging across agent research: **the unit of optimization has to match the unit of control**.

For persistent or tool-rich agents, the decisive action is often a bounded interaction turn, not a single token and not an entire session. If that holds, then both training and evaluation stacks should start exposing explicit **turn-level traces, turn-level rewards, and turn-level verification hooks**. Otherwise, we keep rewarding agents at a resolution too blurry to teach the behaviors we actually care about.