# Deep Dive: Agentic Critical Training (ACT) — arXiv:2603.08706

**Paper:** "Agentic Critical Training"
**Authors:** Weize Liu, Minghui Liu, Sy-Tuyen Ho, Souradip Chakraborty, Xiyao Wang‡, Furong Huang‡ (University of Maryland, College Park)
**Date:** March 9, 2026
**Project Page:** https://attention-is-all-i-need.github.io/ACT/

---

## One-Line Summary

Train agents to *judge which action is better* via RL (not imitate reflections via SFT), producing genuine self-reflection that transfers to both in-domain tasks and general reasoning.

---

## Core Problem

Standard LLM agent training follows imitation learning (IL): the model learns to replicate expert demonstrations via next-token prediction. This teaches **what to do** but not **why** — the agent never sees suboptimal alternatives, so it has no awareness of action quality. When it encounters novel states (e.g., a failed action returning "Nothing happens."), it has no mechanism to diagnose and recover.

The prior attempt to fix this — **Early Experience** (Zhang et al., 2025) — generates reflection text by executing both expert and alternative actions, observing resulting states, and prompting the model to explain why the expert action was better. But this is still IL: the model imitates pre-generated reflection strings rather than developing genuine reasoning.

**Key insight:** Imitating reflections ≠ learning to reflect. The training signal should be *whether the model's judgment is correct*, not *whether it can reproduce a target string*.

---

## ACT Architecture

### Three-Stage Pipeline

**Stage 1: Data Construction**
- Given expert demonstration trajectories D_expert = {(s₁,a₁), ..., (sT,aT)}
- For each expert state-action pair (sᵢ, aᵢ), sample K alternative actions from the initial policy π_θ₀(·|sᵢ)
- Filter duplicates (remove alternatives identical to expert action)
- Construct contrastive pairs: D_critic = {(sᵢ, aᵢ⁺, aᵢ⁻)} where aᵢ⁺ = expert, aᵢ⁻ = sampled alternative
- **Key assumption:** initial policy generates actions inferior on average to expert actions

**Stage 2: Agentic Critical Training (ACT)**
- Present the model with a prompt containing the current state and two candidate actions (randomly ordered to prevent position bias)
- Train via GRPO (Group Relative Policy Optimization) to identify the better action
- **No reasoning supervision** — only reward for correct selection
- Model must autonomously discover chain-of-thought reasoning to maximize reward
- This is where genuine self-reflection emerges

**Stage 3: RL Action Training**
- The ACT-enhanced model is further trained with GRPO for direct action generation
- Given context sᵢ, reward responses matching expert action aᵢ⁺
- Builds on the critical reasoning foundation from Stage 2

### Reward Design

Composite reward function shared across both RL stages:

```
R(s,y) = R_acc(a, a⁺) + R_adm(a, A_admissible) + R_fmt(y)
```

- **R_acc = 1.0** if action exactly matches expert action
- **R_adm = 0.1** if action is admissible (valid in environment) but doesn't match expert — partial credit
- **R_fmt = -0.5** if response lacks proper `<action>` tags — format penalty

The partial credit for admissible actions is important: it prevents the model from collapsing to random outputs while still differentiating between perfect and good-enough responses.

### GRPO Optimization

Both stages use GRPO (from DeepSeek-Math):
- For each prompt, sample G responses from current policy
- Compute verifiable reward for each
- Update policy using group-relative advantages (no critic network needed)
- This is computationally efficient compared to PPO — no separate value model

---

## Experimental Results

### Main Results (Qwen3-8B)

| Method | ALFWorld ID | ALFWorld OOD | WebShop | ScienceWorld |
|--------|-------------|-------------|---------|-------------|
| Prompt w/o CoT | 35.71 | 27.61 | 2.80 | 28.01 |
| Prompt w/ CoT | 56.43 | 50.00 | 3.00 | 25.21 |
| ACT alone | 72.86 | 72.39 | 7.40 | 26.71 |
| IL | 85.71 | 82.84 | 28.00 | 42.80 |
| Early Experience | 87.86 | 85.82 | 31.00 | 45.60 |
| **IL w/ ACT** | **91.43** | **87.31** | **31.60** | **48.69** |
| RL | 90.71 | 84.33 | 29.40 | 43.04 |
| **RL w/ ACT** | **92.86** | **88.06** | **33.80** | **50.34** |

Key findings:
1. **RL > IL** consistently across all benchmarks
2. **ACT alone ≠ good action generation** — it teaches judgment, not execution (expected)
3. **ACT + IL > IL** by avg +5.07pp — critical reasoning transfers to action generation
4. **ACT + RL > RL** by avg +4.62pp — same pattern
5. **ACT + IL > Early Experience** by avg +2.42pp — genuine reflection > imitated reflection
6. **RL w/ ACT = best overall** on every benchmark

### OOD Generalization

ACT's gain over RL is larger on OOD tasks (3.73pp) than ID tasks (2.15pp). This is the key result: the critical reasoning learned through ACT generalizes to novel configurations rather than overfitting. The model isn't memorizing expert trajectories — it's learning to reason about action quality.

### Cross-Size Data Transferability

ACT data collected from Qwen3-8B transfers effectively to Qwen3-4B:
- All ACT-augmented methods improve over non-ACT counterparts
- Qwen3-4B RL w/ ACT: 92.14% ID, 91.79% OOD (vs 91.43%/88.81% for RL alone)
- **Practical implication:** ACT data collection cost can be amortized across model sizes

### General Reasoning Transfer (Most Surprising Result)

Models trained *only on ALFWorld agentic data* evaluated on MATH-500 and GPQA-Diamond:

| Method | MATH-500 | GPQA-Diamond |
|--------|----------|-------------|
| Prompt w/ CoT | 77.73 | 51.52 |
| ACT alone | **78.93** | **53.37** |
| IL | 74.53 | 44.61 |
| Early Experience | 76.60 | 50.34 |
| IL w/ ACT | 77.93 | 52.53 |
| RL | 77.47 | 50.67 |
| RL w/ ACT | 78.20 | 52.19 |

Critical observations:
- **IL causes "reasoning collapse"**: GPQA-Diamond drops from 51.52% → 44.61% (−6.91pp). SFT on agentic data destroys general reasoning.
- **ACT alone improves general reasoning**: +1.2pp on MATH-500, +1.85pp on GPQA-Diamond, despite zero math/science training data
- **ACT recovers IL's damage**: IL w/ ACT (52.53%) recovers above baseline (51.52%)

**Why?** The paper hypothesizes (and case studies support) that ACT develops a **self-verification** capability: after performing an initial derivation, the ACT model checks its answer by substituting back into original equations. IL models show "reasoning collapse" — unfocused meandering and algebraic death loops.

---

## Failure Mode Analysis

### IL Failure: Infinite Loops
IL models, having never seen failure states during training, repeat failed actions indefinitely. In ALFWorld, when the environment returns "Nothing happens," the IL model repeats the same action for 30+ steps until max step termination.

### ACT Recovery: Root Cause Diagnosis
The ACT-trained model encounters the same failure but uses internal reasoning to:
1. Diagnose the root cause ("I'm in the wrong location")
2. Break the loop
3. Issue the correct navigation command

**This self-critique behavior originates from the ACT phase** — RL alone does not produce reflective reasoning patterns.

### IL on General Reasoning: Two Collapse Modes
1. **Unfocused meandering**: Model wanders through irrelevant reasoning paths
2. **Algebraic death loops**: Model enters repetitive algebraic manipulation without progress

Both are symptoms of IL destroying the model's pre-existing reasoning capability through narrow SFT.

---

## Connections to Our Research Archive

### 1. CDRRM (2603.08035) — Contrastive Rubric Generation
Both ACT and CDRRM use **contrastive paradigms** — comparing expert vs. alternative to develop discriminative understanding. CDRRM does this for evaluation rubric generation; ACT does it for agent action selection. The shared principle: **contrastive training develops deeper quality awareness than positive-only demonstration.**

Synthesis: Our evaluator should adopt contrastive training patterns — don't just show it good code; show it good vs. bad code pairs and train it to articulate why one is better.

### 2. Bug-Hunt (3-agent adversarial verification)
Bug-Hunt's Skeptic role is essentially performing ACT-style judgment: evaluating whether the Hunter's finding is genuine. ACT validates that training agents to judge (rather than just generate) improves overall system quality. The Skeptic benefits from having been trained to compare and evaluate, not just produce.

### 3. CoTJudger (2603.07078) — Reasoning Efficiency
CoTJudger reveals 33-87% of reasoning is structurally redundant. ACT's case studies show the flip side: IL models exhibit "unfocused meandering" and "algebraic death loops" — they're generating redundant reasoning. ACT-trained models show focused, self-verifying reasoning. **ACT may be a training-time intervention that produces the kind of efficient reasoning CoTJudger measures at evaluation time.**

### 4. AceMAD (2603.06801) — Martingale Curse
AceMAD's peer-prediction mechanism asks agents to predict peers' belief distributions — revealing who truly knows the answer vs. who is guessing. This is structurally similar to ACT's training objective: identifying which of two options is better requires the same kind of discriminative reasoning. Both show that **second-order cognition** (reasoning about quality/beliefs, not just generating) is the key unlock.

### 5. SCAFFOLD-CEGIS (2603.08520) — Iterative Refinement Paradox
SCAFFOLD-CEGIS shows 43.7% of iteration chains degrade. ACT provides a potential mitigation: if the Coder agent has been ACT-trained to evaluate action quality, it's better equipped to avoid the iterative refinement paradox — it can recognize when a proposed edit would weaken existing code because it understands *why* the current code is structured that way.

### 6. Error Cascades (2603.04474)
Error cascades propagate through multi-agent systems when agents can't detect upstream errors. ACT-trained agents, with their genuine self-reflection capability, are better positioned to catch propagated errors because they can reason about *why* an instruction seems wrong, not just execute it.

### 7. Introspection Paper (2603.05414)
The introspection paper found models can detect internal anomalies but confabulate explanations. ACT addresses a related problem: how to make the detection *actionable* — ACT models don't just detect failure ("Nothing happens"), they diagnose root causes and generate corrective actions.

---

## Applicability to Our System

### Direct Applications

**1. QA Agent Training Pattern**
Our QA agent reviews code. Currently it operates via prompting (analogous to IL — it was "trained" on examples of good reviews). The ACT pattern suggests a better approach: present QA with pairs of code solutions (one correct, one flawed) and train it via RL to identify which is better and articulate why. This would develop genuine code quality reasoning rather than pattern-matching against review templates.

**2. Evaluator Calibration**
Our Evaluator judges agent output quality. ACT's core contribution applies directly: train the evaluator to discriminate between good and bad outputs with only a correctness signal, forcing it to develop genuine evaluation criteria rather than imitating evaluation templates.

**3. Coder Self-Correction**
ACT models break out of failure loops by diagnosing root causes. This is exactly what we want from our Coder: when tests fail repeatedly, don't retry the same approach — reason about *why* it's failing and try something different. The ACT training pattern (present alternatives, reward correct identification) could be applied to code generation by presenting working vs. broken implementations.

**4. May's Delegation Quality**
May delegates to sub-agents. ACT could improve delegation by training May to discriminate between good and bad delegation plans, developing awareness of what makes a delegation clear, complete, and actionable.

### Lightweight Proxies (No Training Required)

Even without RL infrastructure, ACT's insights suggest prompt-engineering improvements:

1. **Contrastive prompting for QA**: "Here are two implementations. Which is better and why?" before asking for a code review
2. **Self-verification prompting**: After generating a solution, prompt the agent to verify by checking the answer against the original requirements
3. **Failure recovery prompting**: "If this action fails, what would you try differently and why?" appended to action generation prompts
4. **Reasoning collapse detection**: Monitor token-to-action ratio; if it spikes without progress (algebraic death loop pattern), terminate and restart with a different approach

### The General Reasoning Transfer Implication

**This is the most important practical finding.** ACT shows that agentic RL training on domain-specific tasks *improves general reasoning* — while IL on the same tasks *destroys it*. This has profound implications:

- If we fine-tune our agents via SFT on our specific task traces, we may be degrading their general capabilities
- If we instead use RL with contrastive/evaluative objectives, we may improve both task-specific and general performance
- The "reasoning collapse" from IL is a real risk for any fine-tuned agent system

---

## Limitations and Open Questions

1. **Benchmarks are relatively simple.** ALFWorld, WebShop, and ScienceWorld have discrete action spaces and clear success criteria. Whether ACT scales to open-ended code generation with ambiguous quality signals is unclear.

2. **Expert assumption.** ACT assumes expert actions are generally superior to model-generated ones. In code generation, "expert" vs. "alternative" may be harder to define — there are many valid implementations.

3. **No multi-agent evaluation.** ACT is tested on single-agent tasks. Whether it improves agents operating within multi-agent systems (like ours) is untested.

4. **GRPO-specific.** The training uses GRPO specifically. Whether the results hold with other RL algorithms (PPO, DPO, etc.) is an open question.

5. **No code release visible yet.** Project page exists but I couldn't find a public code repository.

6. **Scale limitations.** Tested on Qwen3-4B and Qwen3-8B. Whether ACT's benefits hold at larger scales is unknown (though cross-size transferability suggests they might).

---

## Assessment

**Rating: ★★★ Core**

ACT is one of the most directly actionable papers in our archive. The core principle — *train agents to evaluate, not just generate* — applies immediately to our evaluator, QA, and coder agents. The finding that IL causes reasoning collapse while ACT preserves/improves general reasoning is a critical warning for any agent fine-tuning strategy.

The contrastive training pattern (expert vs. alternative with only correctness reward) is simple to implement and produces genuine self-reflection capability. The cross-size data transferability makes it practical. The general reasoning improvement from agentic RL is theoretically important — it suggests evaluation and judgment are fundamental reasoning skills, not narrow task-specific capabilities.

**Key takeaway for our system:** Before we fine-tune any agent on task-specific data via SFT, we should strongly consider using ACT-style contrastive RL instead. The risk of reasoning collapse from IL is well-documented here and directly threatens our agents' general capabilities.
