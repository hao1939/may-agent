# Thinking with Reasoning Skills: Fewer Tokens, More Accuracy

**Source**: arXiv:2604.21764 (April 23, 2026)  
**Authors**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, et al. (ByteDance/ACL 2026 Industry Track)  
**Rating**: ★★★★★

## Core Innovation

**从 scratch 推理 → 技能回忆引导推理**

论文提出将可复用的推理技能从大量试错探索中蒸馏并存储，在推理时检索这些技能来指导未来的推理过程。与当前的"从零开始推理"（reasoning from scratch）范式不同，新方法首先为每个查询回忆相关技能，帮助模型避免冗余弯路，专注于有效的解决路径。

## Key Mechanism

1. **技能蒸馏**: 从广泛的deliberation和试错探索中提取可复用的推理技能
2. **技能存储**: 将技能以结构化形式保存
3. **检索增强推理**: 推理时先检索相关技能，而非从头开始思考

## Key Results

| Metric | Improvement |
|--------|-------------|
| 推理Token消耗 | 显著减少 |
| 整体性能 | 提升 |
| 单请求成本 | 降低（强实用价值） |

测试任务: 代码生成 + 数学推理

## Core Insight

> "Reasoning LLMs often spend substantial tokens on long intermediate reasoning traces when solving new problems."

当前推理模型在解决新问题时，往往在长中间推理轨迹上消耗大量token。通过技能回忆机制，可以避免重复走已经探索过的弯路。

## 对我们的意义

### 直接相关点

1. **技能系统设计验证**: 我们的技能系统方向与这篇论文高度一致——将经验沉淀为可复用技能
2. **技能蒸馏来源**: 论文明确提到从"deliberation and trial-and-error exploration"中蒸馏技能，这与我们的session轨迹→skill提炼流程吻合
3. **成本效益**: 技能不仅提升性能，更显著降低成本——经济角度强化技能价值

### 可借鉴实现

- **技能检索前置**: 在模型开始推理前，先检索相关技能作为上下文
- **技能-查询匹配**: 需要设计有效的技能检索/路由机制
- **增量技能积累**: 持续的试错→蒸馏→存储循环

### 与现有工作的关联

- **COSPLAY** (HB-260437): 技能库协同进化
- **StructMem** (HB-260442): 结构化记忆存储
- **Tool Attention** (HB-260434): 同样关注token效率优化

## 关键引文

> "Unlike the prevailing reasoning from scratch paradigm, our approach first recalls relevant skills for each query, helping the model avoid redundant detours and focus on effective solution paths."

## 相关资源

- arXiv: https://arxiv.org/abs/2604.21764
- Venue: ACL 2026 Industry Track
