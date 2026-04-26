# COSPLAY: 决策Agent与Skill Bank协同进化

**来源**: arXiv:2604.20987 | 8 authors | UMD等  
**发现日期**: 2026-04-26  
**标签**: #skill-bank #co-evolution #long-horizon #agent-learning

---

## 核心发现

**Skill Bank与决策Agent协同进化** —— 8B base model通过有效Skill检索，在6个游戏环境超越4个前沿LLM baseline，**平均奖励提升25.1%**。

> "Skill Bank从unlabeled rollouts自动发现技能，决策Agent学习更好的技能检索"

---

## 架构组件

### 双Agent协同

```
┌─────────────────┐     Skill Contracts     ┌─────────────────┐
│  LLM Decision   │ ◄──────────────────────► │   Skill Bank    │
│     Agent       │   检索技能指导行动生成    │     Agent       │
└─────────────────┘                          └─────────────────┘
         │                                           │
         │         ┌──────────────┐                  │
         └────────►│   游戏环境    │◄─────────────────┘
                   │  (6个benchmark)│
                   └──────────────┘
```

### Skill Pipeline

1. **Discover**: 从unlabeled rollouts识别技能模式
2. **Extract**: 提取可复用技能及其contracts
3. **Refine**: 持续优化技能表达
4. **Update**: 动态更新Skill Bank

---

## 关键数据

| 指标 | 数值 | 对比基准 |
|------|------|----------|
| 平均奖励提升 | **+25.1%** | 4个前沿LLM |
| 基础模型 | 8B参数 | vs 70B+模型 |
| 验证环境 | 6个游戏 | 长程任务、多步推理、技能链式调用 |
| 技能发现 | 无标注 | 完全自动从rollouts提取 |

---

## 核心创新

### Skill Contracts
形式化的适用条件约束，解决"什么场景使用该技能"问题。

### 协同进化机制
- **决策Agent改进**: 学习更好的技能检索策略
- **Skill Bank改进**: 持续提取/精炼技能及其contracts
- **正向飞轮**: 更好的技能 → 更好的决策 → 更多有效rollouts → 更好的技能

### 长程任务支持
- 多步推理链
- 技能链式调用
- 延迟奖励环境
- 部分可观测性

---

## 对OpenClaw的意义

### ✅ 技能架构验证
Skill Bank模式是正确方向，我们的SKILL.md与之理念对齐。

### 🔬 自动技能发现
`.state/sessions/`已存在Agent执行历史，可添加提取层自动发现技能。

### 🔬 Skill Contracts
当前SKILL.md缺乏形式化的适用条件约束，应添加此部分。

### 🔬 小模型路径
8B+有效技能检索可超越70B+，技能质量可能比模型大小更重要。

### 🔬 双Agent模式
决策Agent + 技能管理Agent的协同架构值得实验。

---

## 对比分析

| 维度 | COSPLAY | OpenClaw当前 |
|------|---------|--------------|
| 技能发现 | 自动从rollouts | 人工编写 |
| Skill Contracts | 有 | 无 |
| 协同进化 | 双Agent | 单Agent |
| 模型大小 | 8B | 依赖外部API |
| 长程任务 | 专门优化 | 基础支持 |

---

## 行动建议

1. **Skill Contracts**: 为每个SKILL.md添加"适用条件"章节
2. **自动提取**: 设计从成功sessions自动提取技能的pipeline
3. **质量评估**: 建立Skill质量metric，低质量Skill退役
4. **双Agent实验**: 试点Skill Manager Agent独立角色

---

## 参考链接

- Paper: https://arxiv.org/abs/2604.20987
