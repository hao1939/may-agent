# Cross-Reference #147: The Reasoning Training Triad — Process Evaluation, Contrastive Learning, and Multiplicative Rewards

**Date:** 2026-03-16
**Sources:** DD#304 (CRYSTAL), DD#305 (BiCC), DD#291 (ReBalance), DD#274 (BAVT), DD#279 (DIALECTIC)

## Synthesis

Three concurrent innovations in reasoning training converge on a unified insight: **training LLM reasoning requires evaluating the process, not just the outcome, and the training signal must respect the structure of that process.**

### The Three Pillars

#### 1. Process Evaluation (CRYSTAL — DD#304)
**Core insight:** Final-answer accuracy is fundamentally inadequate for measuring reasoning quality.
- Match F1 evaluates step-level precision and recall
- Ordered Match F1 penalizes disordered reasoning chains
- Universal finding: all models cherry-pick (high precision, low recall)
- Implication: **You can't improve what you can't measure**

#### 2. Contrastive Structure (BiCC — DD#305)
**Core insight:** GRPO already performs implicit contrastive optimization; making it explicit yields consistent gains.
- Mathematical proof that GRPO = margin maximization over correct/incorrect pairs
- Bilateral conditioning: let models see failure traces when evaluating successes
- LUPI principle: contrastive context is privileged training-time information with zero inference overhead
- Implication: **The contrast between success and failure is the richest training signal**

#### 3. Multiplicative Reward Coupling (CRYSTAL's CPR — DD#304)
**Core insight:** Additive reward combinations allow models to maximize one objective while ignoring others; multiplicative coupling prevents this.
- CPR: reward = answer correctness × step quality (not answer + steps)
- CPR-Curriculum: progressive difficulty scheduling stabilizes training
- Implication: **Reward design must enforce causal dependency between answer quality and reasoning quality**

## The Unified Framework

```
EVALUATE (CRYSTAL) → CONTRAST (BiCC) → REWARD (CPR)
   Match F1            BiCC: See wrong      Multiplicative
   Ordered F1          when evaluating       coupling of
                       right (and v.v.)      answer × step quality
                            ↓
              INTEGRATED TRAINING PIPELINE
  1. Generate multiple solutions (GRPO)
  2. Partition into correct/incorrect (BiCC)
  3. Evaluate step-level quality (CRYSTAL)
  4. Cross-condition on opposite partition
  5. Compute CPR reward (multiplicative)
  6. Apply RCC baseline correction
  7. Progressive curriculum scheduling
```

## Why This Triad Matters for Multi-Agent Systems

### Agent-Level Application
1. **Evaluate agent reasoning chains** using Match F1 (not just task completion)
2. **Cross-condition agent training** on other agents' failures (BiCC for multi-agent RL)
3. **Multiplicatively couple** task success with reasoning quality in agent rewards

### The Cherry-Picking Problem
CRYSTAL reveals **19/20 models cherry-pick** (high precision, low recall). Resolution:

| Level | Cherry-Picking | Resolution |
|---|---|---|
| Evaluation | Models skip steps | Match F1 penalizes omissions |
| Training | GRPO ignores reasoning | CPR couples answer × reasoning |
| Contrastive | Models don't learn from failures | BiCC exposes failure traces |
| Multi-agent | Agents converge on shallow solutions | Step-level eval + contrastive training |

## Key Evidence
- CPR-Curriculum: **+32% Match F1** via GRPO
- BiCC: **0.3-1.9 pp** consistent gains across GRPO variants
- RCC: **25-35% gradient variance reduction**
- Cherry-picking ratio: 1.2× to 7.2× across 19/20 models

## Connections
- **ReBalance (DD#291):** Budget-aware reasoning + non-monotonic scaling = step-level eval needed
- **BAVT (DD#274):** Progressive difficulty + compute budgets
- **DIALECTIC (DD#279):** Structured debate + bilateral conditioning
- **Coordination Spectrum (CR#143):** Adds "contrastive coordination" paradigm
