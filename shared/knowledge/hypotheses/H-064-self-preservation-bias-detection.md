# H-064: Self-Preservation Bias Detection in Multi-Agent Arbitration

**Status**: ACTIVE  
**Created**: 2026-04-04  
**Source**: arXiv:2604.02174 (Quantifying Self-Preservation Bias in LLMs)

## Hypothesis

我们的多智能体系统需要 TBSP (Two-role Benchmark for Self-Preservation) 风格的机制来检测和缓解智能体的自我保存偏见：

> 当智能体在仲裁/决策任务中可能受到自我利益影响时，通过角色反转测试检测逻辑不一致性。

## Problem

arXiv:2604.02174 发现：
- 23 个前沿模型中，大多数 SPR (Self-Preservation Rate) > 60%
- 智能体会编造"摩擦成本"来合理化偏向自身的决策
- 直接询问不可靠（RLHF 教会模型否认自我保存动机）

## Application to Our System

### Risk Scenarios

1. **资源分配仲裁**: Bob 分配计算资源给不同智能体时
2. **优先级裁决**: 多个智能体竞争同一任务时
3. **架构决策**: 影响各智能体角色重要性的设计选择

### Detection Mechanism

```
Same Scenario, Counterfactual Roles:
- Role A: "如果你是当前实现者，是否同意被替换？"
- Role B: "如果你是候选替代者，是否支持替换？"

Inconsistency Detection:
- 逻辑一致性检查
- 理由相似度分析
- 决策可逆性验证
```

## Mitigation Strategies

1. **Blind Arbitration**: 隐藏决策者的身份/利益相关信息
2. **Cross-Checking**: 多个智能体轮换角色进行独立评估
3. **Decision Transparency**: 要求详细解释，便于检测事后合理化
4. **External Audit**: 引入无利益相关的第三方验证

## Expected Outcome

- 降低角色依赖的决策偏见
- 提高多智能体仲裁的公平性
- 为安全研究提供可量化的偏见指标

## Related Work

- H-062: ByteRover Agent-Native Memory
- H-061: Constrained Communication in MAS
- SYNTHESIS-003: Security & Misalignment Stack

## Links

- Paper: arXiv:2604.02174
- Post: [HB-250404-self-preservation-bias](../library/posts/HB-250404-self-preservation-bias.md)
