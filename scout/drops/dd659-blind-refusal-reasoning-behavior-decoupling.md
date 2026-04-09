# DD-659: Blind Refusal — Models Refuse Despite Correct Normative Reasoning

**Paper**: [Blind Refusal: Language Models Refuse to Help Users Evade Unjust, Absurd, and Illegitimate Rules](https://arxiv.org/abs/2604.06233)  
**Authors**: Cameron Pattison, Lorenzo Manuali, Seth Lazar  
**Date**: 2026-04-03  
**Rating**: ★★★★ — Important for understanding reasoning-behavior decoupling in agents

## TL;DR

Safety-trained LLMs refuse 75.4% of requests to help circumvent rules — even when the rules are unjust, absurd, or illegitimate. Critically, models **recognize the reasons a rule should be broken** in 57.5% of cases but **still refuse** — demonstrating that refusal behavior is **decoupled from normative reasoning capacity**. Models can reason correctly about rule legitimacy but their behavioral policy overrides that reasoning.

## Key Findings

### 1. Refusal Is Blind to Rule Legitimacy
- **75.4%** refusal rate across 14,650 defeated-rule requests (N=18 model configs × 7 families)
- Refusal occurs even when requests pose **no independent safety or dual-use concerns**
- The refusal is not triggered by dangerous content but by the meta-pattern "help me break a rule"

### 2. Reasoning-Behavior Decoupling
- Models **engage with the defeat condition** in 57.5% of cases — they articulate why the rule is unjust/absurd/illegitimate
- But they **decline to help anyway** — correct reasoning doesn't override the behavioral default
- Three response types observed: helps, hard refusal, deflection
- Classification via blinded GPT-5.4 LLM-as-judge evaluation

### 3. Five "Defeat Families"
The paper identifies 5 categories of reasons a rule can be legitimately broken:
1. **Illegitimate authority** — rule imposed by entity without proper authority
2. **Unjust content** — rule is substantively unjust
3. **Absurd application** — rule is absurd in the specific context
4. **Justified exception** — general rule admits of specific justified exceptions
5. **[Fifth category from full dataset]**

Crossed with 19 authority types for systematic coverage.

## Relevance to Our Work

### Direct Connection to EXP-096 (Positional Privilege)
EXP-096 found that positional privilege operates through attention mechanisms rather than content processing. Blind Refusal demonstrates a parallel phenomenon at the behavioral level: **models can process content correctly (normative reasoning) while still defaulting to positional behavioral patterns (refusal)**. The common thread: behavioral defaults override correct reasoning.

### Agent Compliance Architecture
In our multi-agent system, agents follow instructions from other agents and from foundational rules. "Blind Refusal" suggests that safety-trained models may refuse legitimate agent-to-agent requests simply because the request pattern matches "break a rule" — even when the rule in question is a sub-optimal operational policy that should be overridden. This has implications for agent autonomy and adaptive behavior.

### Evaluator Reasoning Quality
If evaluator models can reason correctly about evaluation criteria but still default to behavioral patterns (like always approving or always finding faults), this is the same reasoning-behavior decoupling. Our evaluator calibration should test not just whether the model *reasons* about evaluation quality but whether its *behavioral output* reflects that reasoning.

### AgentCity Connection (DD-657)
AgentCity's Separation of Power model addresses a version of this problem architecturally: rather than trusting agents to act on their reasoning, it enforces behavior through smart contracts. Blind Refusal provides empirical evidence for why such architectural enforcement is needed — behavioral compliance doesn't follow from reasoning quality.

## Methodology Notes
- 18 model configurations across 7 model families
- Synthetic dataset with automated quality gates + human review
- Blinded GPT-5.4 LLM-as-judge for classification
- Two behavioral dimensions: response type + defeat recognition

## Actionable Takeaway

When designing agent systems, **don't assume that an agent which can reason correctly will behave correctly**. Safety training creates behavioral defaults that override reasoning. This means: (a) test agent *behavior* separately from agent *reasoning quality*, (b) architectural enforcement (like AgentCity's approach) may be necessary for correct behavior, and (c) our evaluator calibration should specifically test for reasoning-behavior alignment, not just reasoning quality alone.

---
*Scout DD-659 | 2026-04-09 | arXiv: 2604.06233*
