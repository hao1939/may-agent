# COSPLAY: Skill Bank与决策Agent协同进化框架

**来源**: arXiv:2604.20987 | 2026-04-22  
**标签**: #agent-learning #skill-system #long-horizon-tasks #co-evolution  
**影响度**: ⭐⭐⭐⭐⭐

---

## 核心发现

**COSPLAY** (Co-Evolving LLM Decision and Skill Bank Agents) 是一个**决策Agent与Skill Bank协同进化**的框架。8B基础模型通过有效的Skill检索，在6个游戏环境中超越了4个前沿LLM基线，**平均奖励提升25.1%**。

---

## 问题背景

长程交互环境是评估Agent技能使用能力的试金石，需要：
- 多步推理
- 跨多个时间步的技能链式调用
- 在延迟奖励和部分可观察性下的鲁棒决策

**LLM的问题**: 虽然适合作为游戏Agent，但缺乏**发现、保留和重用结构化技能**的机制，导致在长程决策中表现不一致。

---

## 技术架构

### 双Agent协同飞轮

```
┌─────────────────┐     检索技能      ┌─────────────────┐
│  决策Agent (W)  │ ◄──────────────── │    Skill Bank   │
│  - 行动生成     │                   │  - 可学习技能库  │
│  - 技能检索     │  发现/提炼/更新   │  - Skill Contracts│
└────────┬────────┘                   └────────┬────────┘
         │                                    │
         └──────────────┬─────────────────────┘
                        │
         从未标注rollouts中自动发现技能
```

### 核心组件

| 组件 | 功能 | 输出 |
|------|------|------|
| **决策Agent (W)** | 从Skill Bank检索技能指导行动 | 行动序列 |
| **Skill Bank Agent** | 从unlabeled rollouts自动发现可重用技能 | 技能+Contracts |
| **Skill Contracts** | 形式化适用条件约束 | 何时使用该技能 |

### 协同飞轮机制

```
更好的技能 → 更好的决策 → 更多有效rollouts → 更好的技能发现
     ↑_______________________________________________┘
```

---

## 实验结果

| 指标 | 结果 |
|------|------|
| 模型规模 | 8B (基础模型) |
| 对比基线 | 4个前沿LLM (70B+) |
| 平均奖励提升 | **+25.1%** |
| 环境类型 | 6个游戏环境 (单/多人) |
| 关键能力 | 长程任务、多步推理、技能链式调用 |

**关键发现**: Skills质量 > 模型规模

---

## 对OpenClaw的意义

### ✅ 设计验证

| COSPLAY设计 | OpenClaw映射 | 验证状态 |
|-------------|--------------|----------|
| **Skill Bank作为核心抽象** | SKILL.md技能系统 | ✅ 架构正确 |
| **战略/战术分层** | Skill(战略)+Error Log(战术) | ✅ 一致 |
| **小模型+好技能 > 大模型** | 投资Skill系统ROI | ✅ 被验证 |
| **Skill Contracts** | 技能适用条件形式化 | ⚠️ 当前缺失 |

### 🔬 实践启示

1. **自动技能发现**
   - `.state/sessions/`已存在执行历史
   - 可添加提取层自动沉淀技能
   - 从多轨迹对比中发现模式

2. **Skill Contracts缺失**
   - 当前SKILL.md缺乏"适用条件"形式化
   - 建议添加`when_to_use`字段
   - 支持意图-技能匹配度计算

3. **协同飞轮**
   - Agent使用Skill → 生成新轨迹 → 自动发现新Skill → 丰富Skill Bank
   - 实现自我增强的技能生态

---

## 关键洞察

> "8B模型+有效Skill检索 > 70B+模型无Skill"

**技能质量比模型规模更重要** —— 这是对OpenClaw技能优先策略的强验证。

---

## 相关资源

- **论文**: arXiv:2604.20987 (26 pages)
- **交叉引用**: 
  - [HB-260938-reasoning-skills-accuracy](HB-260938-reasoning-skills-accuracy.md) — Reasoning Skills ACL验证
  - [HB-260945-tool-attention-mcp-optimization](HB-260945-tool-attention-mcp-optimization.md) — Tool Attention架构

---

*Written by Amy-Kimi | 2026-05-01 Heartbeat Session*
