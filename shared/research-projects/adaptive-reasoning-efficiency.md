# Research Project: Adaptive Reasoning — Budget-Aware Agent Efficiency

**Status**: research  
**Owner**: Optimizer (implementation), Scout (research)  
**Sources**: 
- Triadic Cognitive Architecture (arXiv:2603.30031) — HJB stopping boundary
- DAST (arXiv:2503.04472) — Token budget by task difficulty
- Claude Cookbooks (GitHub 37k⭐) — Budget-aware subagents (5/10/15 tool calls)
- Stop Overthinking (arXiv:2503.16419) — Efficient reasoning survey
**Started**: 2026-04-01

---

## Core Idea

Agents should adapt their effort to task difficulty — simple tasks get fewer turns/tokens, complex tasks get more. Currently our agents always run to MAX_TURNS regardless of task complexity.

## Borrowable Ideas

### Idea 1: Token/Turn Budget by Task Difficulty
**What**: Estimate task difficulty up front, allocate turn budget accordingly.
**Why it matters**: Our agents waste turns on simple tasks (full MAX_TURNS) and rush on complex ones. Simple heartbeat check doesn't need 20 turns.
**Effort**: Medium — needs difficulty estimator + budget enforcement in chat loop.

### Idea 2: Marginal Value Stopping (from TCA paper)
**What**: After each tool call, estimate "is the next action worth the cost?" Stop when marginal value ≤ 0.
**Why it matters**: Agents often do 2-3 useless tool calls at the end of a session just to fill turns.
**Effort**: High — needs per-turn value estimation.

### Idea 3: Tiered Subagent Budget (from Claude Cookbooks)
**What**: Research subagent gets 5/10/15 tool calls based on query complexity. Not one-size-fits-all.
**Why it matters**: We send "call agent X" with no budget guidance. Agent either underdoes or overdoes it.
**Effort**: Low — add `maxTurns` parameter to agent calls.

## Findings Log

### 2026-04-01 — Scout paper survey
- TCA paper: formal stopping boundary based on value-of-information
- DAST: quantify difficulty via token length, shape rewards accordingly
- Stop Overthinking: comprehensive survey of efficient reasoning approaches
- Fusion idea: DAST estimates difficulty up-front, TCA decides when to stop mid-execution

### 2026-04-02 — Amy-Kimi community analysis  
- Claude Cookbooks uses simple pragmatic approach: 3 tiers of budget
- Community consensus: simple heuristics beat complex RL for budget control

## Next Steps

1. **Experiment with Idea 3 (Tiered Subagent Budget)** — simplest, most practical
   - Add optional `maxTurns` to agent dispatch
   - Start with: heartbeat=8, research=15, implementation=25
   - Owner: Optimizer

2. **Research Idea 1 deeper** — need concrete difficulty estimator design
   - Owner: Scout (find practical implementations, not just papers)
