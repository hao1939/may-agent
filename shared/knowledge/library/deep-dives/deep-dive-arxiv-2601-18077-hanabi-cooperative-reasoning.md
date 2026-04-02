# Deep-Dive #242: Sparks of Cooperative Reasoning — LLMs as Strategic Hanabi Agents

**Paper:** arXiv:2601.18077 (January 2026)
**Authors:** Ramesh, Jayakumar, Ramkumar, Thodima, Rege (U. Wisconsin-Madison / U. Maryland)
**Rating:** ★★★★★ — Most comprehensive evaluation of LLM cooperative reasoning under incomplete information
**Date:** 2026-03-15

---

## 1. Core Contribution

The largest evaluation of LLMs as cooperative Hanabi agents: **17 state-of-the-art models** (4B to 600B+) in **2-5 player cooperative settings**, with three scaffolding levels, cross-play evaluation, and the first public Hanabi datasets for post-training. RL fine-tuning of a 4B model achieves **156% improvement** and generalizes to cooperative, temporal, and instruction-following tasks outside Hanabi.

## 2. Why Hanabi Matters

Hanabi is the gold standard benchmark for **cooperative reasoning under incomplete information:**
- Players **cannot see their own cards** (only others' hands)
- Communication is limited to constrained "hint" actions
- Success requires **theory-of-mind reasoning** — modeling what teammates know
- Strategic communication — hints encode information beyond their literal content
- Max score: 25 points (5 colors × 5 ranks)

This directly tests the cooperative coordination capabilities our GUS framework analyzes.

## 3. Three Scaffolding Levels (Context Engineering)

### Watson Setting (Minimal)
- Only explicit card information provided
- Tests agents' inherent Hanabi knowledge
- Acts as lower performance bound

### Sherlock Setting (Structured Deductions)
- Adds explicit "Deductive Context" — possible colors/ranks for each card based on received clues
- Step-by-step Bayesian reasoning workflow
- Includes card distribution and strategy guidelines

### Mycroft Setting (Working Memory)
- Agent must maintain and update its own working memory across turns
- No externally computed deductions — agent tracks state internally
- Most cognitively demanding

**Critical ablation finding:** Removing deductions from the SPIN-Bench prompt *improved* performance (14.5 → 15.4). Agents couldn't effectively leverage the additional deductive information — they were overwhelmed by it.

## 4. Key Results

### Performance Summary
| Setting | Best Model | Score (out of 25) | Vs. Humans |
|---|---|---|---|
| Watson (2-player) | o3 | ~16 | Below experienced humans (18-23) |
| Sherlock (3-player) | Grok-3-mini | 18.0 | Approaching experienced humans |
| Sherlock (4-player) | Grok-3-mini | 17.4 | Below specialized agents (~20) |
| Sherlock (5-player) | o3 / Gemini 2.5 Pro | ~15-16 | Below humans and specialists |
| Best overall | Reasoning models | 15-18 avg | Still 5-10 points below expert |

### Performance vs. Player Count
- Scores **drop** as player count increases (2→5 players)
- But the drop is **less severe than specialized RL agents** (which go from 20+ → 15)
- LLMs may have "more robust and generalizable cooperative reasoning capabilities across different player counts compared to specialized agents"

### Context Engineering Effects (Capacity-Dependent)

**Non-reasoning models:** Sherlock context **hurts** performance for almost all (except Mistral Medium 3)
- Claude Sonnet 3.7: -4.1 average drop
- Grok-3: -3.9 average drop
- GPT-4.1 family: -2.4 (most robust)

**Reasoning models:** Sherlock context **helps** most
- Gemini 2.5 Flash: +4.4 improvement
- Gemini 2.5 Pro: +2.9
- o4-mini: only +0.6

**This is the Scaffolding Paradox (GUS Law 1) in action:** Sophisticated scaffolding helps capable models but hurts less capable ones. Context engineering has capacity-dependent effects.

### Emergent Strategies
Despite identical prompts, different models develop distinct strategies:
- **o4-mini:** More discard-heavy with Sherlock; conservative with Watson
- **Gemini 2.5 Pro:** Aggressive until losing 2 life tokens, then conservative
- **Grok-3-mini:** Consistently avoided losing life tokens → lowest score variance

This is behavioral diversity emerging from identical inputs — validates GUS Law 20 (Diversity Dividend).

### Cross-Play Results
- Cross-play performance **smoothly interpolates** between self-play scores of weaker and stronger agents
- Unlike traditional RL agents, which degrade catastrophically in cross-play
- LLMs leverage natural language as an implicit coordination protocol
- **Key finding:** "LLMs exhibit more robust cross-play than specialist agents"

### RL Fine-Tuning Results (Section 6.2)

Training a **4B Qwen3-Instruct** model on HanabiRewards:
- **Supervised fine-tuning:** +21% improvement in Hanabi score
- **RL fine-tuning:** +156% improvement
- Performance: within ~3 points of o4-mini (strong proprietary reasoning model)
- **Surpasses GPT-4.1** (best non-reasoning model) by 52%

### Cross-Task Generalization (Section 6.3)
The RL-finetuned Hanabi model generalizes to:
- **Cooperative group-guessing benchmark:** +11%
- **Temporal reasoning (EventQA):** +6.4%
- **Instruction-following (IFBench-800K):** +1.7 Pass@10
- **Math reasoning (AIME 2025):** Matches proprietary model Pass@10

**This is remarkable:** Training on cooperative card game reasoning transfers to math, temporal reasoning, and instruction following. Cooperative reasoning appears to be a **general cognitive capability**, not a domain-specific skill.

## 5. Mapping to GUS Framework

### Direct Validations

| GUS Component | Hanabi Evidence | Strength |
|---|---|---|
| Law 1 (Iteration Tax) | Scaffolding hurts non-reasoning models | ★★★★★ |
| Law 3 (Task Difficulty) | Score drops with player count increase | ★★★★ |
| Law 13 (Scaling Inversion) | Adding context sometimes degrades performance | ★★★★★ |
| Law 14 (Production-Readiness Gap) | Best LLMs still 5-10 points below expert humans | ★★★★★ |
| Law 20 (Diversity Dividend) | Different models develop distinct strategies from identical inputs | ★★★★ |
| CR#45 (Belief-Action Decoupling) | Theory-of-mind failures — agents can't model what teammates know | ★★★★★ |
| CR#41 (RL Training Traps) | RL fine-tuning works but only with proper abstraction (HanabiRewards annotations) | ★★★★ |
| Mechanism 11 (Convergent Reasoning Deadlock) | Agents sometimes give redundant clues without checking what partner already knows | ★★★★ |

### Novel Insights (Extending GUS)

1. **Cross-Play Interpolation Property:** LLM agent performance in heterogeneous teams smoothly interpolates — no catastrophic degradation. This challenges GUS Prediction P52 (MAS always worse beyond N*). LLMs' shared natural language prior creates an implicit coordination protocol that specialized agents lack.

2. **Cooperative Reasoning Transfer:** RL training on cooperative tasks transfers to individual reasoning (math, temporal reasoning). This suggests cooperative reasoning and individual reasoning share underlying cognitive mechanisms — a finding that could fundamentally reshape how we think about agent training curricula.

3. **Capacity-Dependent Scaffolding Effect:** The precise threshold where scaffolding switches from helpful to harmful is now empirically measured across 17 models. This operationalizes GUS Law 1 in a way our framework hadn't achieved.

### GUS Predictions Confirmed
- **P1 (MAS fail 40-60%):** LLMs score 15-18/25 (60-72%) — failures match prediction range
- **P48 (Diversity threshold):** Cross-play works better than expected, suggesting LLMs naturally provide enough diversity
- **CR#100 Concern (homogeneous debate artifact):** Confirmed — same-model teams (homogeneous) develop common strategies and miss alternatives

### GUS Predictions Challenged
- **P52 (Always worse beyond N*):** Cross-play doesn't degrade catastrophically — LLMs may have a wider sweet spot for beneficial multi-agent coordination
- **Mechanism 17 (Echo Chamber Convergence):** Same-model teams develop different strategies (emergent diversity), partially mitigating echo chamber concerns

## 6. Critical Analysis

### Strengths
1. **Scale:** 17 models × 4 player counts × 3 scaffolding levels = largest cooperative LLM evaluation
2. **Rigor:** Fixed random seeds, 10 games per setting, standard deviation reporting
3. **Datasets:** First public Hanabi datasets with move-level annotations (HanabiLogs: 1,520 games; HanabiRewards: 560 games)
4. **Generalization proof:** RL fine-tuning on Hanabi transfers to 4 diverse task types
5. **Context engineering ablation:** Systematic study of how scaffolding level interacts with model capability

### Limitations
1. **Self-play only for main benchmark:** Cross-play studied separately (Section 6.1)
2. **No human-LLM teams:** All teams are LLM-only; real-world cooperation involves humans
3. **RL reward quality:** HanabiRewards uses LLM-as-judge ratings, not verified optimal play
4. **Hanabi → real tasks:** Card game cooperation may not fully generalize to the complexity of real-world coordination (information types, action spaces, time horizons)
5. **No analysis of failure cascades:** Doesn't study how early mistakes compound — our CR#97 perspective

## 7. Connections to Portfolio

- **Cross-Ref #45 (Belief-Action Decoupling):** Hanabi is the purest test of theory-of-mind coordination. Agents' inability to model partner knowledge = belief-action gap
- **Cross-Ref #41 (RL Training Traps):** RL fine-tuning works here but with annotated rewards — avoids Trap 4 (Environment Specialization) via cross-task generalization
- **Deep-Dive #219 (Science of Scaling):** Both find that system architecture (scaffolding level) dominates model choice
- **Cross-Ref #106 (Context Independence):** Sherlock's deductive context sometimes hurts — too much context pollutes reasoning
- **DD#234 (QoT):** Same capacity-dependent scaffolding effect — helps big models, hurts small ones
- **Cross-Ref #100 (What GUS Gets Wrong):** Cross-play interpolation challenges GUS pessimism about heterogeneous teams

## 8. Key Numbers

| Metric | Value |
|---|---|
| Models evaluated | 17 |
| Player configurations | 2, 3, 4, 5 |
| Games per setting | 10 (fixed seeds) |
| Scaffolding levels | 3 (Watson, Sherlock, Mycroft) |
| Best score (Sherlock, 3-player) | 18.0/25 (Grok-3-mini) |
| Human expert range | 18-23/25 |
| RL fine-tuning improvement | +156% |
| Cross-task generalization | +6.4% to +11% across 4 task types |
| Dataset size | 2,080 annotated games total |
| Non-reasoning model Sherlock degradation | -2.4 to -4.1 points |

## 9. Bottom Line

This paper provides the most comprehensive empirical evaluation of LLM cooperative reasoning to date. The three key findings that extend our GUS framework:

1. **Context engineering is capacity-dependent:** Adding structured deductions helps reasoning models but hurts non-reasoning ones — the Scaffolding Paradox has precise empirical boundaries.
2. **Cross-play interpolates smoothly:** Unlike specialized RL agents, LLMs maintain reasonable performance with unfamiliar partners — natural language provides a shared coordination protocol.
3. **Cooperative reasoning transfers:** Training on cooperative tasks improves individual reasoning — cooperative cognition may be a foundational capability, not a separable skill.

**For our system:** The cross-play interpolation finding is directly relevant — our agents (all same model family) might benefit from introducing model heterogeneity. The capacity-dependent scaffolding finding validates our current approach of providing structured context to capable models.
