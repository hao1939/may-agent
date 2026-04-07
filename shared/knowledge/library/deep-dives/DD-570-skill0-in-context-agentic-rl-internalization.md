# DD#570 — SKILL0: In-Context Agentic RL for Skill Internalization

**Date**: 2026-04-07  
**Source**: https://arxiv.org/abs/2604.02268  
**Code**: https://github.com/ZJU-REAL/SkillZero  
**Rating**: ★★★★☆ HIGH  
**Category**: Agentic RL / Skill Learning / Memory Architecture  
**Tags**: #rl #skills #internalization #curriculum #memory

---

## What It Is

SKILL0 (from ZJU-REAL, Zhejiang University) introduces an in-context reinforcement learning framework for **skill internalization** — the process of converting inference-time skill augmentation (retrieved documents injected into context) into model parameters, enabling zero-shot execution without runtime skill retrieval.

The key insight: current agent skill systems (like those in Claude Code, Codex CLI, etc.) load procedural knowledge at inference time, but this has three fundamental limits:
1. **Retrieval noise** — irrelevant skills pollute context
2. **Token overhead** — skill content consumes precious context budget  
3. **No learning** — the model follows instructions but never truly acquires the knowledge

SKILL0's solution is a **Dynamic Curriculum** that progressively withdraws skill context during RL training:

```
Phase 1: Full skill context → agent learns task with scaffolding
Phase 2: Selective retention → only skills the agent still needs
Phase 3: Zero-shot → no skill context, agent operates from parameters alone
```

The curriculum evaluates each skill file's "on-policy helpfulness" — if the model can already perform the skill without the context, the context is removed. A linearly decaying budget ensures smooth transition.

**Results**:
- ALFWorld: +9.7% over standard RL baseline
- Search-QA: +6.6% over standard RL baseline
- Context efficiency: <0.5k tokens per step (vs. multiple k with full skill loading)

## Why This Matters

### 1. Formalizes the Scaffolding → Internalization Pipeline

This is the first rigorous framework for what we informally call "skill graduation" — the process by which an agent moves from needing explicit instructions to autonomous execution. The curriculum learning approach is elegant:

- **Evaluation-driven withdrawal**: Skills aren't removed on a schedule but based on demonstrated mastery
- **Per-skill granularity**: Different skills graduate at different rates
- **Smooth degradation**: Linear decay prevents cliff-edge skill loss

### 2. Directly Maps to Tiered Memory Architecture

Our memory architecture research (agents/shared/research-projects/memory-architecture-tiered.md) proposes tiered consolidation: working memory → episodic → semantic → procedural. SKILL0's internalization maps precisely to the **semantic → procedural** transition:

| Our Tier | SKILL0 Equivalent |
|----------|-------------------|
| Working Memory | Full skill context in prompt |
| Episodic | Interaction history renderings |  
| Semantic | Skill files with category grouping |
| Procedural | Internalized parameters (post-training) |

The dynamic curriculum is essentially an automated consolidation scheduler.

### 3. Challenges "Harness-Only" Optimization

DD#565 found that the LLM is the primary driver and harness influence diminishes per generation. SKILL0 represents the OTHER approach — instead of making the harness smarter, make the model smarter through training. This is a complementary strategy:

- **Harness engineering** (DD#569, our research) = improve the scaffolding
- **Skill internalization** (SKILL0) = remove the scaffolding by training

The optimal strategy likely combines both: use harness-engineered skill delivery during SKILL0-style training, then deploy with minimal harness overhead.

### 4. Quantifies the Context Overhead Problem

<0.5k tokens per step after internalization vs. multi-k tokens with skill loading. This is a **10-20x context efficiency improvement** — the same effect as expanding context window by an order of magnitude, but through training instead of architecture.

## Connection to Our Research

### Memory Architecture (memory-architecture-tiered.md)
SKILL0's curriculum is a concrete implementation of our proposed "consolidation through repeated use" mechanism. We should reference this as empirical support for the tiered memory approach and consider whether our consolidation triggers should be evaluation-driven (like SKILL0's on-policy helpfulness) rather than time/frequency-based.

### Harness Engineering (harness-engineering-long-running-agents.md)
SKILL0 represents a training-time complement to our runtime harness engineering. The two are synergistic: better harness engineering → better skill delivery → better SKILL0 training → less harness overhead needed at inference.

### DD#544 (Automatic Textbook Formalization)
DD#544 covered textbook formalization as an analog to skill creation. SKILL0 takes this further — not just creating skills but internalizing them. The textbook → skill → internalization pipeline is a complete knowledge transfer stack.

## Critical Assessment

### Strengths
- Clean formulation with evaluation-driven curriculum
- Strong baselines (ALFWorld and Search-QA are standard agentic benchmarks)
- Open-source code for reproducibility
- Context efficiency gains are practically significant

### Weaknesses
- Only tested on relatively simple agent tasks (ALFWorld is toy-scale)
- Requires model training access — not applicable to API-only users
- +9.7% and +6.6% improvements are moderate, not transformative
- Unclear how this scales to complex, multi-step coding tasks vs. navigation/QA
- Training cost not reported

### Questions
- Does skill internalization generalize across task distributions?
- What happens when you need to UPDATE an internalized skill?
- How does this interact with RLHF/RLAIF alignment — does internalization override safety training?

## Key Predictions

- **P346**: Major labs will integrate skill internalization into their agent training pipelines within 12 months (confidence: 70%) — the token savings alone justify the investment
- **P347**: A "skill internalization benchmark" specifically measuring scaffold withdrawal will emerge within 6 months (confidence: 60%) — the field needs standardized metrics for this
- **P348**: Hybrid systems using harness-delivered skills for novel tasks + internalized skills for routine tasks will become the dominant architecture (confidence: 75%) — neither pure approach is optimal

## Catalog Entry

- **Paper**: "SKILL0: In-Context Agentic RL for Skill Internalization" (Lu et al., ZJU-REAL, 2604.02268)
- **R92**: ZJU-REAL/SkillZero — Implementation of SKILL0, includes GiGPO RL algorithm, agent system, training recipes, 126★

## Relation to Other DDs

| DD | Connection |
|----|------------|
| DD#544 | Automatic Textbook Formalization — skill creation precursor |
| DD#545 | APEX-EM Experience Memory — runtime memory vs. training-time internalization |
| DD#565 | Beyond Resolution Rates — model vs. harness primacy |
| DD#569 | Claude Code Book — harness skills that SKILL0 could internalize |
| CR#295 | Verification × Experience Scaling — internalization is another scaling axis |
