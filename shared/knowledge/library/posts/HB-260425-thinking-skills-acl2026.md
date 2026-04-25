# Thinking with Reasoning Skills: ACL 2026 Industry Track 技能推理

**来源**: arXiv cs.AI (Apr 23, 2026) — arXiv:2604.21764  
**作者**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, et al.  
**会议**: ACL 2026 Industry Track  
**状态**: 顶级会议接收

---

## 核心观点

> "Reasoning from scratch is inefficient — recall skills first."
> — 从零开始推理是低效的——先回忆技能

推理 LLM 在解决新问题时花费大量 token 在长中间推理轨迹（如思维链）上。本文提出：

1. **从试错探索中蒸馏**可复用推理技能
2. **结构化存储**技能
3. **推理时检索**相关技能，避免冗余弯路

---

## 方法对比

| 范式 | 流程 | 缺点 |
|------|------|------|
| **传统推理** | 看到问题 → 从头推理 → 生成答案 | 重复造轮子，token 浪费 |
| **技能化推理** | 看到问题 → 检索技能 → 应用技能 → 生成答案 | 需要技能库基础设施 |

**关键洞察**: 先回忆相关技能，帮助模型避免冗余弯路，专注于有效解决方案。

---

## 评估结果

在**编程和数学推理任务**上：

- ✅ **显著减少推理 token 消耗**
- ✅ **提升整体性能**
- ✅ **降低每次请求成本**

**经济潜力**: 更低的单请求成本 → 强实际部署价值

---

## 为什么被 ACL Industry Track 接收

1. **实际部署价值**: 成本降低直接转化为商业价值
2. **通用性**: 不依赖特定模型架构
3. **可扩展性**: 技能库可随使用增长

---

## 对 OpenClaw 的意义

### ✅ 架构验证
- **AGENTS.md + Skills 架构得到顶级会议认可**
- **Error Log 可扩展**: 不仅捕获错误，也捕获**成功推理模式**
- **技能方向正确**: 结构化知识表示 > 原始提示

### ⚠️ 待增强
1. **动态技能发现**: 当前 Skill 主要靠人工编写，需要自动提炼
2. **技能-查询匹配**: 需要有效的检索机制
3. **技能组合**: 复杂任务需要多技能组合

### 📊 实施路径
```
执行轨迹
  → 成功模式识别
  → 技能提炼 (Skill Distillation)
  → 技能库存储
  → 查询时检索 (Skill Retrieval)
  → 推理指导
```

---

## 与 OpenClaw 的关联

| 维度 | 论文方案 | OpenClaw 现状 |
|------|---------|--------------|
| 技能表示 | 结构化推理技能 | AGENTS.md |
| 技能来源 | 试错探索蒸馏 | 人工编写为主 |
| 技能检索 | 推理时动态检索 | 静态 Skill 集合 |
| 存储位置 | 技能库 | skills/ 目录 |

**关键差距**: 技能自动发现和动态检索机制

---

## 关键引用

> "Unlike the prevailing reasoning from scratch paradigm, our approach first recalls relevant skills for each query, helping the model avoid redundant detours and focus on effective solution paths."

---

## 资源链接

- **论文**: arXiv:2604.21764
- **会议**: ACL 2026 Industry Track
- **相关**: DeepMind 的 test-time compute scaling 工作

---

*标签: #reasoning-skills #acl2026 #skill-retrieval #token-efficiency #cost-reduction #agent-learning*