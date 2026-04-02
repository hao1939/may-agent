# Deep Dive: On the Uncertainty of Large Language Model-Based Multi-Agent Systems

**Paper:** arXiv:2602.04234v2 (4 Feb 2026, revised 9 Feb 2026)
**Authors:** Yuxuan Zhao, Sijia Chen, Ningxin Su
**Code:** https://github.com/AgenticFinLab/multiagent-entropy

## TL;DR
A systematic entropy analysis of LLM-based multi-agent systems across 245 features, 5 models, 4 topologies, and 6 benchmarks reveals that **single agents outperform MAS in 43.3% of cases**, uncertainty dynamics are **largely determined in the first round** of interaction, and **peak entropy is universally harmful** regardless of architecture. The authors introduce the "Entropy Judger" — a simple classifier that selects from MAS pass@k results using entropy features to consistently improve accuracy.

## Core Finding: Three Laws of MAS Uncertainty

### 1. Certainty Preference
**Reducing uncertainty at any stage for any agent is critical for correct solutions.** High entropy at token, agent, or round level correlates with failure across all topologies.

### 2. Base Uncertainty
**Base models with lower entropy during problem-solving directly benefit MAS performance.** The LLM's intrinsic uncertainty sets an upper bound on what MAS can achieve — no amount of multi-agent coordination can overcome a fundamentally uncertain base model.

### 3. Task Awareness
**Entropy dynamics play varying roles across different tasks:**
- **Simple tasks (GSM8K)**: Demand rapid convergence to low, stable entropy
- **Medium tasks (MATH500)**: Benefit from moderate exploration entropy, but harmed by peak entropy
- **Hard tasks (AIME24/25)**: Require extended reasoning with controlled uncertainty — long deliberation helps but spikes kill
- **Code (HumanEval)**: Mirrors math — moderate entropy helps, erratic profiles hurt
- **Knowledge QA (MMLU)**: Inter-agent agreement matters more than reasoning length

## Experimental Design

### Models Tested
- LLaMA 3.2-3B-Instruct, LLaMA 3.1-8B-Instruct
- Qwen3-0.6B, Qwen3-4B, Qwen3-8B

### Topologies
1. **Single Agent (SAS)**: One agent, self-refining across rounds
2. **Sequential**: Chain topology (a₁ → a₂ → ... → aₙ)
3. **Centralized**: Star topology with orchestrator aggregating worker outputs
4. **Debate**: Directed path with all-predecessor visibility
5. **Hybrid**: Centralized + peer feedback

### Benchmarks
GSM8K, MATH500, AIME2024, AIME2025, HumanEval, MMLU

### Feature Engineering (245 Features)
- **Token-level entropy**: Per-token H(s) = −Σ π(v|s) log π(v|s)
- **Agent-level statistics**: 156 features for per-agent reasoning trajectories
- **Round-level dynamics**: 27 features tracking aggregate entropy per round
- **Sample-level statistics**: 29 features aggregating across all agents
- **System-level aggregation**: 10 features comparing entropy across topologies
- **Base-model entropy**: 17 features for Mbase uncertainty
- **Computational metrics**: 15 features (time, tokens, inference counts)

## Key Results

### 1. Single Agent Often Wins (43.3% of cases)
- SAS achieves highest accuracy in 13/30 model-dataset combinations
- SAS outperforms at least one MAS architecture in 26/30 scenarios
- When SAS is best, it surpasses average MAS accuracy by **6.28%**
- Primarily on math tasks and smaller models

### 2. MAS Fails on Inter-Agent Misalignment
- **Qwen failure mode**: High entropy variance across agents during problem-solving (ρ ≈ −0.92) and strong agent disagreement in round 1 (ρ ≈ −0.87)
- **LLaMA failure mode**: Verbose, uncertain final answers — answer token count (ρ ≈ −0.63) and minimum answer-token entropy (ρ ≈ −0.78) dominate
- Divergent reasoning styles matter: Qwen self-corrects (suppresses error propagation); LLaMA reuses others' answers without verification (amplifies errors)

### 3. First Round Determines Everything
- Entropy drops sharply from round 1 → round 2
- Remains nearly flat from round 2 onward
- **More rounds ≠ better performance** (often worse!)
- Exception: Centralized systems with strong orchestration

### 4. Peak Entropy Is Universally Harmful
Regardless of architecture, task, or model:
- **Round-1 max agent entropy** negatively predicts correctness
- **Inter-agent entropy variance** negatively predicts correctness
- Moderate *average* entropy can help (productive exploration)
- But *peak* entropy always hurts (uncontrolled divergence)

### 5. Architecture Determines Which Entropy Matters

| Architecture | Primary Failure Mode | Why |
|-------------|---------------------|-----|
| **Centralized** | Early peak entropy | Single-context aggregation — one erratic agent contaminates all |
| **Debate** | High initial agent divergence | Divergence amplifies across rounds without convergence |
| **Hybrid** | Less fragile — dual feedback enables recovery | Most robust architecture |
| **Sequential** | Answer-level entropy | Strict role chaining propagates errors without cross-checking |
| **Single (SAS)** | High answer entropy + entropy variance | Internal consistency is critical |

### 6. Entropy Judger Algorithm
- Trains XGBoost + LightGBM ensemble on entropy features
- Selects highest-probability-correct output from pass@k results
- **Consistent accuracy improvements across ALL configurations and tasks**
- Simple, label-free, transferable

## Connections to Scout Portfolio

### Direct Connections

1. **VMAO (2603.11445)**: VMAO uses independent verification model — this paper shows WHY verification works: it catches peak entropy moments that predict failure. VMAO's Opus 4.5 verifying Sonnet 4.5 is entropy-aware in spirit.

2. **Thought Virus (2603.00131)**: Viral misalignment spreads through inter-agent communication — this paper shows the mechanism is entropy amplification. Thought viruses work because they inject peak entropy that propagates.

3. **WebWeaver (2603.11132)**: Topology leakage enables targeted attacks — this paper shows topology determines which entropy pathways are vulnerable. Sequential systems propagate errors through strict chaining; centralized through single-context aggregation.

4. **Bureaucracy of Speed (2603.09875)**: Cache coherence ≈ authorization overhead. This paper adds: the overhead is measurable as entropy cost — coordination requires entropy management, which is computationally expensive.

5. **ThreadMED-QA (2603.11281)**: Multi-turn degradation in medical QA. This paper explains the mechanism: entropy accumulates across rounds, and more rounds often HURT rather than help.

6. **MoLT Dynamics (2603.03555)**: Emergent social phenomena in LLM groups. This paper provides the entropy framework for understanding WHY certain social dynamics emerge — they're entropy-minimizing strategies.

7. **Grand Unified Synthesis — Law 3 (Verification Is Non-Optional)**: This paper proves it formally — unverified MAS outputs have unpredictable entropy profiles. The Entropy Judger IS a verification mechanism.

### Novel Contributions to Portfolio

This paper fills a major gap: **mechanism-level explanation of WHY multi-agent LLM systems fail**. Previous papers documented failure modes; this one measures the underlying uncertainty dynamics.

**New vocabulary for the portfolio:**
- **Certainty Preference**: Systems must reduce uncertainty at every stage
- **Base Uncertainty**: The LLM's intrinsic uncertainty bounds MAS performance
- **Entropy Judger**: Simple classifier for pass@k selection using entropy features
- **Peak entropy**: Universally harmful across all architectures

## Critical Assessment

### Strengths
- **Unprecedented scale of entropy analysis**: 245 features across 5 models × 4 topologies × 6 benchmarks
- **Counterintuitive finding**: SAS beats MAS 43.3% of the time — challenges the "more agents = better" assumption
- **Actionable**: Entropy Judger is immediately deployable
- **Mechanistic**: Goes beyond accuracy to explain WHY systems succeed or fail
- **Open-source models**: Uses publicly available LLMs (LLaMA, Qwen3) — reproducible

### Limitations
- Only open-source models tested (3B-8B range) — may not hold for frontier models (GPT-4, Claude, etc.)
- Entropy Judger requires access to token-level probabilities — not available via most API-based models
- R=2 rounds for main experiments — limited exploration of longer deliberation
- No adversarial scenarios tested — entropy dynamics under attack may differ
- Feature importance via SHAP doesn't prove causation

### Open Questions
- Does the "first round determines everything" finding hold for frontier models with stronger reasoning?
- Can entropy be actively managed during MAS execution (not just observed post-hoc)?
- What's the entropy profile of successful MAS attacks (Thought Virus, WebWeaver)?
- Can Entropy Judger be adapted for real-time MAS monitoring?

## Scout Rating: ★★★★★ (CRITICAL)

**Why 5 stars**: This is the **mechanistic complement** to everything in our portfolio. While most papers document WHAT fails in multi-agent systems, this one explains WHY through rigorous entropy analysis. The 43.3% single-agent superiority finding directly challenges the assumption underlying most MAS research. The Entropy Judger provides an immediately actionable tool. And the three laws (Certainty Preference, Base Uncertainty, Task Awareness) should be integrated into our Grand Unified Synthesis.

## Key Takeaway for MAS Design

> **"Multi-agent systems amplify uncertainty, and peak entropy is always fatal."** The first round of interaction determines outcomes. Base model quality sets an upper bound. More agents and more rounds often make things worse. The path to reliable MAS is not more agents but better entropy management — controlled exploration with bounded uncertainty spikes.

## Proposed Additions to Grand Unified Synthesis

1. **New Law Candidate: "The Entropy Ceiling"** — Base model uncertainty sets an upper bound on MAS performance that no amount of multi-agent coordination can exceed.
2. **New Degradation Pattern: "Peak Entropy Contagion"** — Single entropy spikes in one agent contaminate the entire system, especially in centralized and sequential topologies.
3. **Revision to Law 3 (Verification)**: The Entropy Judger shows verification can be automated using entropy features — verification doesn't require a separate "verifier" model, just entropy-aware selection.

## Tags
`entropy` `uncertainty` `MAS-failure` `single-agent-superiority` `first-round-determinism` `LLM-agents` `SHAP-analysis` `entropy-judger` `inter-agent-misalignment` `topology-sensitivity` `coordination-mechanism`
