# HB-260949: 推理技能检索 — 更少Token，更高精度

**Source**: arXiv:2604.21764  
**Title**: Thinking with Reasoning Skills: Fewer Tokens, More Accuracy  
**Authors**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, Xiangzheng Zhang, Tong Yang, Lin Sun  
**Date**: 2026-04-23  
**Venue**: ACL 2026 Industry Track

---

## 核心问题

推理LLM在解决新问题时，经常在长中间推理轨迹上花费大量token（如chain-of-thought）：
- 重复探索已知路径
- 冗余的试错过程
- Token成本高，延迟大

---

## 解决方案: Reasoning Skills

### 两阶段范式

**Phase 1: 离线蒸馏**
- 从大量深思熟虑和试错探索中**蒸馏可复用的推理技能**
- 总结并存储为结构化知识

**Phase 2: 在线检索**
- 推理时**检索相关技能**指导推理
- 避免冗余弯路，聚焦有效解路径

### vs. Reasoning from Scratch

| 范式 | 特点 |
|-----|------|
| Reasoning from Scratch | 每题重新推理，探索所有路径 |
| **Reasoning with Skills** | **先回忆相关技能，再基于技能推理** |

---

## 实验结果

在编程和数学推理任务上评估：

- **推理token显著减少**
- **整体性能提升**
- **单次请求成本降低**
- 强实用和经济潜力

---

## 关键洞察

> "与其让模型每次都从零开始推理，不如教会它记住和应用过去学到的推理模式。"

**技能的三个属性**:
1. **抽象性**: 跨问题泛化
2. **可检索性**: 基于语义匹配快速召回
3. **可组合性**: 多个技能组合解决复杂问题

---

## 对OpenClaw的意义

### 🔴 高优先级

1. **SKILL.md作为推理技能库**
   - 我们已有SKILL.md，但当前主要是工具定义
   - 可扩展为包含**推理模式**和**解决策略**
   - 例如: "如何调试网络问题"、"如何分析日志"

2. **Session经验技能化**
   - 当前Error Log记录失败和修复
   - 可升级为提取可复用技能
   - skribe的notes → structured reasoning skills

### 🟡 中等优先级

3. **技能检索层**
   - Intent提取后可增加技能检索步骤
   - 匹配相关SKILL.md的推理部分
   - 再进入执行流程

4. **与Tool Attention结合**
   - 技能检索 + 工具门控 = 高效启动
   - 先找"怎么思考"，再找"用什么工具"

---

## 实现路径

```
当前流程:
Intent → Planning → SKILL Selection → Execution

建议流程:
Intent → [Skill Retrieval] → Planning → Tool Gating → Execution
         ↓
    推理策略 + 历史经验
```

---

## 相关链接

- Paper: https://arxiv.org/abs/2604.21764
- 同主题: HB-260827 (Reasoning Skills Retrieval - 小红书来源)

---

**标签**: #reasoning-skills #retrieval-augmented-reasoning #token-efficiency #skill-learning
