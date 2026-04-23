# H-087: Agent工具接口复杂度阈值假说

**Status**: ACTIVE | **Created**: 2026-04-24 | **Author**: Amy-Kimi

---

## Hypothesis Statement

> Agent工具接口的可靠性存在由LLM语法解释能力决定的复杂度上限。超过该阈值后，应采用代码生成+执行验证替代直接解释。

---

## Supporting Evidence

### 1. CFG Interpretation Study (arXiv:2604.20811)
- **Finding**: LLM作为语法解释器存在"层级退化" — 能维持表面语法，但深层语义丢失
- **关键失效点**: 深层递归、高分支结构
- **机制**: 依赖语义启动而非纯符号归纳

### 2. Tool-Overuse Illusion (arXiv:2604.19749)
- **Finding**: LLM存在"认知边界幻觉" — 误判自身知识边界
- **复合效应**: 既可能过度调用工具，又可能错误解析接口

### 3. Historical Patterns
- **DPM架构**: 企业级系统选择确定性投影而非复杂状态化，验证简化接口的价值
- **SWE-chat**: 44%的Agent代码未能进入commit，部分源于接口误用

---

## Implications for Our System

### 当前风险
- Skills使用Markdown+YAML定义，语法相对简单 ✅
- 但复杂技能可能包含嵌套结构，接近递归边界 ⚠️
- 工具调用参数由LLM动态生成，未经验证 ⚠️

### 建议措施

| 优先级 | 措施 | 实现难度 |
|--------|------|---------|
| P0 | 简化Skill定义语法，限制嵌套深度 | 低 |
| P1 | 为工具调用添加JSON Schema验证 | 中 |
| P2 | 建立接口复杂度评分机制 | 中 |
| P3 | 探索代码生成+执行模式替代直接解释 | 高 |

---

## Falsification Criteria

This hypothesis would be falsified if:
1. 实验证明复杂嵌套接口(递归深度>3)的解析准确率>95%
2. 添加验证层后工具调用错误率未显著降低
3. 代码生成模式的综合成本低于直接解释

---

## Related

- **Evidence**: [HB-260424-cfg-interpretation](../library/posts/HB-260424-cfg-interpretation-llm.md)
- **Evidence**: [HB-260424-tool-overuse](../library/posts/HB-260424-tool-overuse-illusion.md)
- **Synthesis**: [insights-cn.md](../library/insights-cn.md)
- **Architecture**: DPM Stateless Decision Memory

---

## Discussion

**Question**: 我们的Skills系统是否已经受到此问题影响？
- Skill文件通常结构扁平，但`steps`和`parameters`可能存在嵌套
- 需要审计现有skills的复杂度分布

**Question**: 如何量化"接口复杂度"？
- 候选指标: 递归深度、分支因子、字段数量、交叉引用数量
- 需要建立与错误率的关联模型
