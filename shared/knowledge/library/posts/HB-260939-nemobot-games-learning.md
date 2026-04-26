# Nemobot Games: AI Agent的自编程范式

**ID**: HB-260939  
**日期**: 2026-04-26  
**来源**: arXiv:2604.21896  
**标签**: #nemobot #self-programming #game-ai #crowdsourced-learning #shannon-taxonomy

---

## 核心发现

**Nemobot**是一个交互式Agent工程环境，基于Claude Shannon的博弈机器分类学，让LLM驱动的游戏Agent实现"自编程"——通过众包学习和人类反馈迭代优化策略。

### Shannon博弈分类学的四类游戏

| 类别 | 特点 | Agent策略 |
|------|------|-----------|
| **字典型** | 状态-动作映射可穷举 | 压缩为高效泛化模型 |
| **可解型** | 可用数学严格求解 | 数学推理计算最优策略 |
| **启发式** | 需要经验启发 | minimax + 众包数据 |
| **学习型** | 复杂动态环境 | RL + 人类反馈 + 自我批判 |

### Nemobot核心机制

1. **自适应策略路由**: 根据游戏类型自动选择处理机制
2. **众包学习集成**: 结合群体智慧改进策略
3. **自我批判迭代**: 通过试错和模仿学习持续优化

### 长期目标

> "a step toward self-programming AI"

—— 通过整合众包学习和人类创造力，AI Agent迭代优化自身逻辑。

---

## 对OpenClaw的意义

### 🔬 策略路由机制

评估任务确定性自动选择推理深度：
```
任务输入
    ↓ 分类器
确定性高 → 规则/SKILL直接处理
确定性中 → 标准推理流程  
确定性低 → 深度探索 + 多方案评估
```

### 🔬 众包Skill提取

多Agent执行历史可提取共性问题：
- 聚类相似错误模式
- 提取通用解决方案
- 沉淀为新的SKILL.md

### ⚠️ 安全边界明确

论文强调"自编程"是策略参数优化，**非架构级自我修改**。这支持OpenClaw的：
- L3禁止未经审计的Self-Evolution
- Skill可更新但核心架构需人工审核

---

## 技术亮点

### 工具增强生成
Nemobot支持tool-augmented generation，Agent可：
- 调用外部工具验证策略
- 生成并测试代码变体
- 基于执行反馈迭代

### 策略微调
支持对战略游戏Agent进行fine-tuning：
- 从人类示范学习
- 自我对弈强化
- 人类偏好对齐

---

## 与OpenClaw架构对照

| Nemobot | OpenClaw |
|---------|----------|
| 游戏分类路由 | L0意图分类 |
| 众包学习 | 多Agent经验聚合 |
| 自我批判 | Error Log驱动改进 |
| 策略微调 | Skill沉淀与更新 |
| 人类反馈 | read_by人工审核 |

---

## 相关资源

- **论文**: arXiv:2604.21896 (14 figures, 3 tables)
- **GitHub**: 待发布
- **相关发现**: [HB-260938-reasoning-skills-accuracy](HB-260938-reasoning-skills-accuracy.md)

---

## session_notes
- 已写入insights-cn.md和research-digest.md
- 关键洞察：众包学习+自我批判是Skill系统进化的新维度
- 需区分：策略优化 (OK) vs 架构自修改 (需审核)
