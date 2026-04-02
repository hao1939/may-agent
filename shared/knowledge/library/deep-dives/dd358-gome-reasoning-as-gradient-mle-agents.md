# Deep-Dive #358: Reasoning as Gradient — Scaling MLE Agents Beyond Tree Search

**Paper:** arXiv:2603.01692v2 (10 Mar 2026)
**Authors:** Yifei Zhang, Xu Yang, Xiao Yang, Bowen Xian, Qizheng Li, Shikai Fang, Jingyuan Li, Jian Wang, Mingrui Xu, Weiqing Liu, Jiang Bian
**Affiliations:** Microsoft Research Asia + Nanjing University, Peking University, Zhejiang University, Wuhan University, HKUST
**Venue:** Preprint (with open-source release at github.com/microsoft/RD-Agent)
**Rating:** ★★★★★ CRITICAL
**Relevance:** 10/10 — Establishes the optimization paradigm shift from search to reasoning that unifies our entire training signal quality thread

---

## 1. Core Thesis

LLM-based MLE agents predominantly use **tree search** (MCTS, graph expansion) — a form of gradient-free optimization that compresses rich execution feedback into scalar validation scores. This paper argues that as LLM reasoning capabilities improve, **gradient-based optimization** — where structured diagnostic reasoning serves as the "gradient signal" — becomes increasingly superior. The crossover is empirically demonstrated across 10 models spanning 3 capability tiers.

**The fundamental claim:** Tree search scales with **inference compute** (more nodes traversed). Gradient-based optimization scales with **model capability** (better reasoning). Given the trajectory of LLM development, gradient-based is the winning paradigm.

## 2. Gome Architecture — The Optimizer Analogy

Gome (Gradient-based Optimization for Machine Learning Engineering) establishes a rigorous functional mapping:

| Classical Optimizer | Gome Component | Function |
|---|---|---|
| Gradient ∇L | Structured Reasoning | Determines *how* to update (not just what scored better) |
| Momentum | Success Memory (ℳ) | Curated repository of validated hypotheses with score deltas |
| Distributed SGD | Multi-trace Optimization | N parallel traces synchronized via shared memory |

### 2.1 Four-Stage Iteration Loop
1. **Execution:** Run current solution, collect (perf_t, trace_t) — scalar score + rich execution logs/code diffs
2. **Hierarchical Validation:** Three sequential checks:
   - Format correctness (rule-based)
   - Evaluation alignment (LLM detects data leakage, overfitting)
   - Comprehensive analysis (hypothesis achieved intended effect?)
   - **Result:** Detects 66.7% of deceptive overfitting vs 0% for score-driven baselines
3. **Memory Update:** Validated hypotheses committed to shared success memory with (hypothesis, feedback, Δh)
4. **Structured Reasoning:** Generate next hypothesis by:
   - Extracting challenges from feedback + local history
   - Scoring candidates across 5 dimensions (impact 0.4, alignment 0.2, novelty 0.2, feasibility 0.1, risk-reward 0.1)
   - Sampling from top-k (not greedy) to maintain exploration

### 2.2 Multi-Trace Optimization
- **Forced diversification:** Each trace n's initial hypothesis conditioned on all prior proposals → orthogonal exploration
- **Cross-trace candidate pool (Eq. 7):** Three complementary sources:
  1. Locally generated hypotheses
  2. Best global hypothesis from ℳ
  3. Probabilistic sampling from ℳ via embedding similarity kernel
- **LLM-based selector** chooses final hypothesis from this pool

### 2.3 Robust Implementation
- Dev-eval separation (small subset → full data)
- Multi-seed selection for final submission
- Adaptive time management (LLM extends budget for complex tasks)

## 3. Results

### 3.1 Main Performance (MLE-Bench, Closed-World, 12h, V100)

| Agent | Model | Any-Medal (%) | Gold (%) |
|---|---|---|---|
| ML-Master | GPT-5 | 24.0±2.3 | 12.4±1.6 |
| AIRA | o3 (24h, H200) | 31.6±0.8 | 17.3±0.4 |
| **Gome** | **GPT-5** | **35.1±0.4** | **16.4±0.8** |
| Gome | o3 | 32.5±1.2 | 17.3±0.8 |

- **35.1% SOTA** with half the time and weaker GPU than AIRA
- **96.0% valid submission rate** (reliability!)
- On MLE-Bench-Lite: **68.2%** — matches open-world SOTA (Leeroo) without external retrieval

### 3.2 The Critical Crossover (Most Important Finding)

10-model scaling analysis across 3 tiers:

| Tier | Representative Models | Gome vs Best Baseline |
|---|---|---|
| **Efficiency** | GPT-4o-mini, GPT-5-nano, GPT-4o | **-1.3% to -2.7%** (tree search wins) |
| **Advanced** | GPT-5-mini, Grok-4, Grok-4.1, DeepSeek-R1 | **+0.6% to +1.3%** (crossover!) |
| **Frontier** | DeepSeek-v3.2, o3, GPT-5 | **+2.7% to +7.1%** (gradient wins, gap WIDENS) |

**Key dynamics:**
- On weak models: Gome converges fast then plateaus (noisy gradients → premature convergence). MCTS catches up.
- On strong models: Gome converges fast AND sustains improvement. MCTS plateaus.
- **The gap is WIDENING** — frontier models amplify Gome's advantage, not just maintain it.

### 3.3 Ablation Study (GPT-5, 12h)

| Configuration | Medal (%) | Improvement Rate (%) | IC (val-test corr) |
|---|---|---|---|
| Full Gome | 35.1 | 41.1 | 0.92 |
| w/o Structured Reasoning | 25.8 (-9.3) | 22.6 (-18.5!) | 0.83 |
| w/o Success Memory | 28.9 (-6.2) | 36.2 (-4.9) | 0.87 |
| w/o Multi-trace | 32.4 (-2.7) | 41.3 (+0.2) | 0.88 |

**Structured Reasoning is dominant** — removing it nearly halves the improvement rate. This IS the gradient signal.

### 3.4 Extended Budget (24h)
- GPT-5: 35.1% → **40.4%** (+15.1%) — no saturation!
- o3: 32.5% → 36.4% (+12.0%)
- Stronger model benefits MORE from additional time — consistent with gradient quality thesis

### 3.5 Cost Analysis
| Model | Cost/Task | Medal Rate |
|---|---|---|
| DeepSeek-v3.2 | $1.89 | 28.0% |
| GPT-5 | $20.74 | 35.1% |
| o3 | $26.53 | 32.5% |

DeepSeek-v3.2 is 14× cheaper than o3 with only 4.5pp gap. o3's extended reasoning traces cost more without proportional performance gains.

## 4. Why This Matters — Portfolio Connections

### 4.1 The Paradigm Shift: From Search to Signal Quality

This paper provides the **meta-theoretical foundation** for our entire Training Signal Quality thread:

**DD#356 (ProxMO):** Credit assignment quality dominates model scale in RL training.
**DD#358 (Gome):** Reasoning quality dominates search breadth in inference-time optimization.
**CR#202 (Training Signal Quality Stack):** These are the SAME principle at different lifecycle stages.

**Unified insight:** Signal quality > signal quantity. Everywhere. Always. The question is only whether the signal source (model reasoning, credit assignment, curriculum) is good enough to cross the quality threshold.

### 4.2 The Crossover Validates Allocation Dominance

The Gome crossover directly validates **CR#62 (Reasoning Compute Allocation)**'s core finding: allocation quality dominates compute quantity. Tree search = brute-force allocation. Gradient-based = intelligent allocation. The crossover point is where intelligent allocation's accuracy exceeds random exploration's coverage.

### 4.3 Information Self-Locking Resolution

**DD#208 (Information Self-Locking):** RL agents get trapped in low-information regimes because their actions reduce evidence availability. Gome's structured reasoning BREAKS this lock by:
1. Providing rich diagnostic feedback (not just scalar scores)
2. Using hierarchical validation to catch deceptive improvements
3. Success memory preventing regression to explored-but-failed regions

The 66.7% deceptive improvement detection rate is functionally equivalent to AReW's binary critiques (DD#208) — both work by injecting external quality signals that break the AS×BT coupling.

### 4.4 Search vs. Reasoning: Paradigm Composition

**DD#287 (ToolTree MCTS)** and **DD#286 (STAR)** both use tree search. Gome shows these are transitional paradigms — effective with current models but with diminishing returns as reasoning improves. The paper explicitly positions MCTS as the "gradient-free" baseline.

**CR#167 (Managing Planning Complexity)** identified three paradigms: Search, Structure, Separation. Gome adds a fourth: **Directed Reasoning** — using the model's diagnostic capability as the optimization signal itself.

### 4.5 Multi-Trace as Distributed Optimization

Gome's multi-trace architecture directly instantiates **DD#268 (LLM Teams as Distributed Systems)**:
- Forced diversification = sharding the search space
- Shared success memory = distributed state synchronization
- Cross-trace hypothesis selection = consensus mechanism

This validates the 3-5 agent sweet spot from DD#268 — Gome uses N parallel traces with diminishing returns beyond ~4.

### 4.6 Hierarchical Validation as Swiss Cheese Defense

The three-layer validation (format → leakage → comprehensive) maps directly to **DD#352 (Swiss Cheese Model)**:
- Each layer catches errors the others miss
- Error correlation between layers is low (rule-based, LLM analytical, LLM holistic)
- The 66.7% detection rate comes from UNCORRELATED error channels, not redundancy

## 5. Novel Contributions

### 5.1 The Reasoning-Search Crossover Law
**Formal claim:** There exists a model capability threshold τ* such that for capability C:
- C < τ*: search-based optimization outperforms gradient-based
- C > τ*: gradient-based outperforms, with advantage monotonically increasing in C

**Empirically validated** across 10 models. The crossover is at ~Advanced tier (GPT-5-mini / DeepSeek-R1 level).

### 5.2 The Optimization Paradigm Hierarchy
1. **Random search** → effective when signal quality is very low
2. **Directed search (MCTS/UCT)** → effective when you can rank but not diagnose
3. **Gradient-based reasoning** → effective when diagnosis is reliable
4. **(Predicted) Learned optimization** → model internalizes the entire optimization loop

Each level subsumes the previous when its enabling condition (signal quality) is met.

### 5.3 Deceptive Improvement as Fundamental Failure Mode
The 66.7% detection rate means **33.3% of deceptive improvements still get through**. Score-driven methods detect 0%. This is the first quantification of the deceptive improvement problem in agentic optimization.

### 5.4 No Saturation at 24h
The 15.1% improvement from 12h→24h with GPT-5 means gradient-based optimization hasn't reached its compute-time frontier. Combined with the scaling-with-capability result, this implies a **double scaling law:** performance improves with both model capability AND optimization time, with the interaction being multiplicative.

## 6. Limitations & Open Questions

1. **Smoothness assumption:** MLE pipelines are "typically repairable" — but this may not hold for domains requiring fundamental paradigm shifts
2. **No formal convergence guarantees:** The gradient analogy is functional, not mathematical. LLM "gradients" can be systematically biased.
3. **Cost scaling:** GPT-5 costs 11× DeepSeek-v3.2 per task for only +7.1pp improvement — diminishing cost-performance returns
4. **Closed-world only:** Open-world performance (with retrieval augmentation) is untested — could external knowledge further amplify gradient quality?
5. **Single-task scope:** Tested only on MLE tasks. Applicability to other agentic domains (code, research, planning) is conjectured but unvalidated.

## 7. Key Takeaways

1. **Search scales with compute; reasoning scales with capability.** As models get smarter, brute-force search becomes increasingly wasteful.
2. **Structured diagnostic reasoning IS the gradient.** The quality of the feedback signal — not the quantity of candidates — determines optimization speed.
3. **Hierarchical validation is essential.** Without it, 100% of deceptive improvements contaminate the optimization trajectory.
4. **Multi-trace + shared memory** provides distributed optimization benefits without the coordination overhead of full multi-agent systems.
5. **The crossover is already here.** With Advanced-tier models (DeepSeek-R1 level), gradient-based optimization is already competitive. With Frontier models, it's clearly superior.

---

**Produced:** 2026-03-16, Session s_1773696653280_633
**Portfolio connections:** DD#356, DD#208, DD#287, DD#286, DD#268, DD#352, CR#202, CR#62, CR#167
