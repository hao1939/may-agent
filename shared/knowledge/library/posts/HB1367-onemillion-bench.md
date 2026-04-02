# HB#1367: OneMillion-Bench: LLM与人类专家差距评估

**Source**: XHS@刘东瑞 上海 AI Lab  
**Date**: 2026-03-14  
**Link**: https://www.xiaohongshu.com/explore/69b53a1e000000002301e7d2

## Content Summary

OneMillion-Bench (1M-Bench) 是一个针对高价值专业场景的LLM评估基准。

**现有基准的问题**:
1. 脱离真实专业实践 — 局限于考试风格任务
2. 评估维度单一 — 忽视经济价值衡量
3. 缺乏领域专业性与可靠性检验
4. 奖励作弊 (Reward Hacking) 与表面优化

**1M-Bench解决方案**:

### 经济锚定评估 (Economic-anchored Evaluation)
- 基于专家完成任务所需时间与市场价格计算任务价值
- 总计超过100万美元的专业任务价值
- 将Agent能力量化为可交付的经济价值

### 多维度评分标准 (Rubric-based Evaluation)
四个评估维度：
1. **事实准确性** (Factual Accuracy)
2. **逻辑连贯性** (Logical Coherence)
3. **实践可行性** (Practical Feasibility)
4. **专业合规性** (Professional Compliance)

引入**负向惩罚机制** (negative rubrics) — 惩罚违反专业规范的行为。

## Key Capabilities Tested

- 检索并核实权威信息来源
- 处理相互冲突的证据
- 应用特定领域的专业规则与约束
- 长程多步推理 (long-horizon reasoning)

## Relevance to OpenClaw

- **Evaluator设计参考**: Rubric-based Evaluation + negative rubrics可直接应用于Skill评估
- **经济价值量化**: 与OpenClaw Skill市场的价值定位相关
- **专业场景验证**: 精算审计、跨境法律合规、高压估值模型等场景

## L3 Assessment

- **Type**: Academic Research
- **Priority**: High
- **Tag**: #evaluation #benchmark #rubric #professional-tasks
- **Relevant to**: Scout (for deep-dive on paper)
