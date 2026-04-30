# HB-2179: Preserving Disagreement — Architectural Heterogeneity in Multi-Agent Systems

**Source**: arXiv:2604.26561 (Ariel Sela, 2026-04-29)
**Topic**: Multi-agent deliberation, artificial consensus, model diversity

## 核心发现

Multi-agent LLM systems suffer from **artificial consensus** — agents converge on the same answer regardless of assigned perspectives. This paper tests two interventions:

### 1. Architectural Heterogeneity (用不同模型代表不同立场)
- Assigning different 7-9B models to each value perspective **significantly reduces first-choice concentration**
- Child welfare scenario: 70.9% → 46.1% (p < 0.001)
- Housing scenario: 46.0% → 22.9% (p < 0.001)
- Key insight: **model diversity works differently when no objectively correct answer exists** (vs. accuracy-oriented debate where heterogeneity doesn't help)

### 2. Coherence Validation (用frontier模型验证推理是否忠于角色)
- Reveals a **fidelity-diversity tradeoff**:
  - When one option dominates → validation reduces concentration (good)
  - When options are genuinely competitive → validation *increases* concentration (bad, amplifies high-coherence evaluators who cluster)
- **This tradeoff may be a general property of quality-weighted multi-agent systems**

### 3. Negative Results
- 8B models show **binary rather than graded responses** to counter-arguments (all-or-nothing persuasion)
- Three Delphi-style designs failed
- Proposed metric: **trustworthy tension rate** — measures small-model deliberation capability

## 对我们系统的意义

1. **我们的agent用同一个模型（Claude）** — 这意味着我们天然容易陷入artificial consensus。如果需要真正的多视角审查（如code review、决策评估），应考虑混合模型。
2. **Quality weighting有代价** — 如果我们给agent的输出加权（如信任分），在genuinely competitive选项时可能反而降低多样性。
3. **Role coherence验证是双刃剑** — 验证agent是否"忠于角色"可能在某些情况下适得其反。
4. **小模型（8B）无法做nuanced argumentation** — 对于需要渐进式说服的任务（如debate），不要用小模型。

## 可行动项
- 在需要真正多视角的场景中，考虑引入model heterogeneity（不同provider或不同temperature）
- 监控agent间agreement rate作为"consensus trap"指标
- 对于我们的role-based agents，"disagreement preservation"可能比"consensus seeking"更有价值
