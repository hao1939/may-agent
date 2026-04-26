# Reasoning Skills: 更少Token，更高准确率

**ID**: HB-260938  
**日期**: 2026-04-26  
**来源**: arXiv:2604.21764 | ACL 2026 Industry Track  
**标签**: #reasoning-skills #token-efficiency #skill-retrieval #few-shot

---

## 核心发现

**Reasoning Skills**方法通过蒸馏和存储可复用推理技能，在推理时检索相关技能指导推理，显著减少token消耗同时提升准确率。被ACL 2026 Industry Track接收。

### 问题：从零推理的浪费

传统推理LLM在解决新问题时，会花费大量token在中间推理轨迹上（如CoT）。这导致：
- 重复造轮子：每个问题都从零开始推理
- Token爆炸：长中间轨迹消耗大量上下文
- 冗余探索：重复尝试已知的死胡同

### 核心方法

```
训练阶段:
大量 deliberation + trial-and-error
    ↓ 蒸馏
可复用推理技能库 (Reasoning Skills)
    ↓ 检索
推理阶段: 相关技能 → 指导推理路径
```

**与主流范式对比**:

| 范式 | 特点 | Token效率 | 准确率 |
|------|------|-----------|--------|
| 从零推理 | 每题独立CoT | 低 | 基准 |
| Few-Shot | 注入相似例题 | 中 | 依赖例子相关性 |
| **Reasoning Skills** | **检索相关技能** | **高** | **提升** |

### 实验结果

- **任务**: 编码 + 数学推理
- **指标**: 推理token显著减少，整体性能提升
- **经济潜力**: 每请求成本降低，适合实际部署

---

## 对OpenClaw的意义

### ✅ SKILL.md架构验证

我们的技能文件就是Reasoning Skills的实现！

| 概念 | 论文 | OpenClaw映射 |
|------|------|--------------|
| Reasoning Skills | 蒸馏的可复用推理模式 | **SKILL.md** |
| Skill Retrieval | 按查询检索相关技能 | 意图-技能路由 |
| 避免冗余探索 | 遵循已知有效路径 | Skill指导执行 |

### ✅ 架构正确性

SKILL.md(战略) + Error Log(战术) 分层与论文思路一致：
- **SKILL.md**: 长期积累的领域知识和最佳实践
- **Error Log**: 短期任务特定的异常处理

### 🔬 自动技能提取

关键问题：如何从`.state/sessions/`自动发现可复用推理模式？

潜在方法：
1. 聚类相似任务轨迹
2. 提取共同成功路径
3. 蒸馏为结构化Skill
4. 人工审核后入库

### 🔬 技能质量评估

论文暗示需要评估维度：
- **覆盖率**: 技能覆盖的任务类型广度
- **精准度**: 检索到的技能与任务匹配度
- **复用率**: 单个技能被调用的频次

---

## 与相关研究的联系

| 论文 | 核心贡献 | 与OpenClaw关系 |
|------|----------|----------------|
| Reasoning Skills | 检索可复用推理技能 | SKILL.md验证 |
| Tool Attention | 工具级效率优化 | 协议层优化 |
| Nemobot Games | 策略路由+众包学习 | Skill演进机制 |

**共同主题**: 不要从零开始，要站在积累的知识上。

---

## 相关资源

- **论文**: arXiv:2604.21764 (10 pages)
- **会议**: ACL 2026 Industry Track
- **相关发现**: [HB-260937-tool-attention-mcp-tax](HB-260937-tool-attention-mcp-tax.md)

---

## session_notes
- 已写入insights-cn.md和research-digest.md
- 关键洞察：SKILL.md设计被ACL Industry Track论文独立验证
- 下一步：探索自动技能提取机制
