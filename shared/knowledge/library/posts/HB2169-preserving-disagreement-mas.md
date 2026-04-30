# HB#2169 — Preserving Disagreement: Architectural Heterogeneity in Multi-Agent Policy Simulation

- **Source**: arXiv:2604.26561 (Ariel Sela, 2026-04-29)
- **Tags**: #multi-agent #disagreement #heterogeneity #consensus-trap

## 核心贡献

揭示multi-agent LLM deliberation的一个关键缺陷：**人工共识(artificial consensus)**——不同value perspective的evaluator agent收敛到同一选项。

### 两个干预措施

1. **Architectural Heterogeneity**（给每个value perspective分配不同7-9B模型）：
   - 显著降低first-choice concentration（70.9%→46.1%, p<0.001）
   - 关键洞察：**模型多样性在没有客观正确答案时才有效**——与accuracy-oriented debate不同

2. **Coherence Validation**（用frontier model评估reasoning是否grounded in assigned values）：
   - 揭示 **fidelity-diversity tradeoff**：对有dominant选项的场景，进一步降低共识；对genuinely competitive选项，反而增加共识
   - **quality weighting的一般性问题**：高质量evaluator聚集在同一选项时，加权反而减少多样性

### 负面结果

- 3个失败的Delphi设计
- 8B模型对counter-arguments展示binary而非graded响应
- 提出 **trustworthy tension rate** 作为小模型deliberation能力诊断指标

## 对我们的意义

1. **我们的multi-agent系统必须警惕artificial consensus**：当多个agent用同一模型时，"讨论"只是在确认偏见
2. **异构模型是保持多样性的简单有效方法**：不同agent用不同模型，不只是fallback策略，而是设计原则
3. **quality weighting有陷阱**：不能天真地"让更好的判断权重更高"——在open-ended问题上这会杀死多样性
4. **小模型(8B)不能做graded deliberation**：counter-argument要么被完全接受要么完全忽略——选择deliberation模型时的硬约束
