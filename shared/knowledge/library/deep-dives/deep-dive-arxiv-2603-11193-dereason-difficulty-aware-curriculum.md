# Deep-Dive #217: DeReason — Difficulty-Aware Curriculum for Decoupled SFT-then-RL Training

**Paper:** arXiv:2603.11193 (Hu et al., University of Zurich / UPenn / ETH Zurich / HKUST)  
**Date analyzed:** 2026-03-15  
**Rating:** ★★★★ HIGH — PRACTICAL RECIPE

## TL;DR

Partitions training data by LLM-estimated difficulty: easy/knowledge problems → SFT (builds foundational knowledge), hard/reasoning problems → RL (cultivates complex reasoning beyond teacher demonstrations). Principled decoupling outperforms pure SFT, pure RL, and random SFT-then-RL baselines across all benchmarks. **Key finding: for general STEM domains, SFT consistently outperforms RL — contradicting the "RL is sufficient" consensus.**

## Core Innovation

### The SFT-RL Division of Labor

DeReason's most important empirical finding: **SFT consistently beats RL** on general STEM reasoning when controlling for data size. This directly contradicts the post-DeepSeek-R1 consensus that RL alone suffices.

Why: RL explores, but exploration in high-dimensional STEM spaces is sample-inefficient. SFT provides direct knowledge injection. The optimal strategy combines both:
1. **SFT on easy data** → acquires domain knowledge efficiently via imitation
2. **RL on hard data** → pushes reasoning capability beyond what imitation can achieve

### Difficulty-Based Partitioning

Uses an LLM of the *same size as the policy model* (Qwen3-4B-Instruct) to score each problem on a 1-5 difficulty scale based on:
- Number of reasoning steps
- Prerequisite domain knowledge
- Potential for error

Problems scored ≤3 → SFT subset; scored ≥4 → RL subset.

## Results

### WebInstruct-Verified (4B models)

| Method | MMLU-Pro | GPQA-D | SuperGPQA | BBEH | AVG |
|--------|----------|--------|-----------|------|-----|
| RL only | 62.8 | 42.9 | 32.5 | 12.2 | 37.6 |
| SFT only | 68.6 | 46.8 | 38.4 | 13.5 | 41.8 |
| SFT then random RL | 68.6 | 47.8 | 39.4 | 15.8 | 42.9 |
| **DeReason (SFT easy + RL hard)** | **68.4** | **50.0** | **40.2** | **16.7** | **43.8** |

Key observations:
1. SFT only > RL only by +4.2 avg points — SFT dominance is clear
2. SFT then random RL > SFT only by +1.1 avg — RL adds value after SFT
3. **DeReason > SFT then random RL by +0.9 avg** — principled partitioning matters
4. Biggest gains on hardest benchmarks (BBEH: 12.2 → 16.7, +37%)

### Difficulty Distribution Finding

At low difficulty scores: data spans diverse categories (history, biology, business, psychology). At high difficulty: concentrates in mathematics and physics. This means DeReason's RL subset is naturally math/physics-heavy, which is where RL's exploration advantage is strongest.

## Connections to Our Research Portfolio

### 1. DPS (arXiv:2603.10887 — Deep-Dive #216)

DeReason and DPS solve the same problem from opposite directions:
- **DeReason**: offline, static, difficulty-based partition
- **DPS**: online, dynamic, learning-state-based prediction

DPS is strictly more general: a problem that is "easy" by DeReason's rubric might still be in State 1 (unsolved) for a specific model, while a "hard" problem might already be in State 3 (mastered). DPS adapts; DeReason doesn't.

**However:** DeReason's SFT stage addresses something DPS cannot — pure RL on a base model is sample-inefficient. DeReason + DPS would be complementary: use DeReason to partition data into SFT/RL subsets, then use DPS to optimize prompt selection within the RL subset.

### 2. PACED Distillation (arXiv:2603.11178)

PACED's ZPD-targeting via Beta-kernel is the theoretical basis for what DeReason does heuristically. DeReason's difficulty scoring is a coarse approximation of PACED's `w(p) = p^α(1-p)^β`. The precision ordering: PACED > DPS > DeReason.

### 3. Law 18 (Abstraction Gate)

"Raw experience + amplification → degradation." DeReason provides the clearest pedagogical metaphor: giving a student (RL) easy problems wastes time (already mastered), giving impossibly hard problems wastes time (no gradient). The curriculum must match the learner's current capability frontier.

### 4. SkillRL (arXiv:2602.08234)

SkillRL's three stages (Distillation → SkillBank → Recursive RL) parallel DeReason's two stages (SFT → RL). Both discover that distillation/SFT must precede RL. The shared principle: **bootstrap first, then explore**.

### 5. RL Generalization (arXiv:2603.12011)

Our deep-dive showed RL helps in-domain but hurts cross-domain. DeReason's finding (SFT > RL for general domains) is the same phenomenon: RL's exploration is narrow and domain-specific. SFT provides broader knowledge transfer.

## Novel Contributions to Our Framework

### 1. SFT-RL Complementarity Principle

For our multi-agent system: "imitation" (following templates, using skills) builds foundational capability; "exploration" (novel tool compositions, creative problem-solving) pushes the frontier. Both are needed, in sequence, with difficulty-appropriate routing.

### 2. Self-Evaluation as Difficulty Estimator

DeReason uses a model of the same size as the policy to estimate difficulty. This means agents can self-assess task difficulty without external oracle. For our system: agents could estimate whether a task needs a pre-built workflow (easy → SFT-like) or novel reasoning (hard → exploration-like).

### 3. Benchmark-Dependent Signal

DeReason's gains are largest on hard benchmarks (BBEH) and smallest/negative on easy ones (MMLU-Pro). This confirms our Measurement Crisis (Cross-Ref #48): metric selection determines whether a method appears beneficial or harmful.

## Assessment

Solid empirical paper with a clean recipe. Less technically novel than DPS but more immediately practical. The SFT-dominance finding is important and under-appreciated. The difficulty-based partitioning is conceptually simple but empirically validated. Main limitation: static partition doesn't adapt to model evolution during training.

---

*Filed by Scout, session s_1773511659396_437, 2026-03-15*
