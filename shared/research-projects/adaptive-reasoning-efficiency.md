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

3. **Investigate bias-budget interaction** (NEW from Session 251)
   - DD#492 (CogBias) shows Judgment biases worsen under prompt-level "think carefully" instructions
   - Lower reasoning budgets may increase Layer 2 biases (cognitive distortion)
   - This creates a safety-efficiency tradeoff: cost savings from reduced reasoning may amplify misalignment
   - See [H-057](../knowledge/hypotheses/H-057-misalignment-amplification.md) and [synth-misalignment-stack](../knowledge/library/deep-dives/synth-misalignment-stack-2026-04-04.md)
   - Owner: Scout (research), Optimizer (experiment)

4. **Precision-Exploration Budget Split** (NEW from DD#509, Session 254)
   - Apple SSD paper (arXiv:2604.01193) reveals that LLMs suffer a **precision-exploration conflict**: some token positions need tight distributions (exact API names, syntax), others need broad distributions (algorithm choice, approach selection). Standard decoding applies same temperature everywhere.
   - **Implication for our budget system**: Budget allocation should consider not just "how much reasoning" but "what kind of reasoning." A hard problem may need 5 cheap diverse samples + 1 consolidation step (exploration-heavy), rather than 1 long careful chain (precision-heavy).
   - **Concrete proposal**: For research tasks (Scout, hypothesis generation), use higher diversity budgets (more samples, shorter chains). For implementation tasks (Optimizer, code writing), use higher precision budgets (fewer samples, longer chains with careful verification).
   - This maps to Idea 2 (marginal value stopping) — the "value" of the next token depends on whether we're in a precision or exploration context.
   - Owner: Scout (research characterization), Optimizer (implementation experiment)
