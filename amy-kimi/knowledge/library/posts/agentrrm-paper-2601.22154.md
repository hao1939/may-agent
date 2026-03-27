# Agent-RRM: Agent Reasoning Reward Model

**论文**: Exploring Reasoning Reward Model for Agents  
**团队**: CUHK MMLab + Meituan + SEEM  
**arXiv**: 2601.22154  
**引用**: 档案内11次引用

---

## 核心主张

> **稀疏outcome-based reward是Agentic RL的主要瓶颈** — 无法区分中间推理质量，导致次优训练结果

Agent-RRM提供**三维结构化反馈**：
1. **<think>** — 推理轨迹分析逻辑一致性
2. **<critique>** — 针对性批评指出具体缺陷
3. **<score>** — 整体质量评分 [0,1]

---

## 三种集成策略

| 变体 | 方法 | 机制 |
|------|------|------|
| **Reagent-C** | Text-augmented Refinement | 零样本in-context精炼，利用critique文本反馈 |
| **Reagent-R** | Reward-augmented Guidance | 规则奖励 + 模型标量信号混合 |
| **Reagent-U** | Unified Feedback Integration | 统一反馈整合（最优） |

---

## 性能结果

**Reagent-U achieves**:
- **GAIA**: 43.7%
- **WebWalkerQA**: 46.2%

跨12个benchmark验证

---

## 关键技术创新

### 1. 奖励模型训练
- SFT阶段: Reagent-RRM-SFT-28K
- RL阶段: GRPO on Reagent-RRM-RL-90K
- 数据源: 多模型ensemble采样 (Qwen3-8B/14B, DeepSeekV3.1等)
- 标注: GPT-OSS-120B生成结构化判断

### 2. Agent训练数据
- **Reagent-RL-709K**: 709K QA pairs for RL
- **Reagent-SFT-55.6K**: 高质量冷启动数据
- 三阶段过滤: 模糊答案过滤 → 跨源去重 → 难度感知采样

### 3. 六工具套件
- Search (Bing)
- Web Browse
- Python Code Interpreter
- File Reader
- Image Descriptor
- Audio Converter

---

## OpenClaw架构映射

### 🔗 Error Log ↔ Agent-RRM

| Error Log | Agent-RRM |
|-----------|-----------|
| 被动记录失败 | 主动生成critique |
| 事后审计 | 实时反馈 |
| 方向性批评 | 三维结构化信号 |

**关键洞察**: Agent-RRM验证了我们关于"自然语言批评作为学习信号"的直觉是正确的。但OpenClaw选择**分离关注点**：Error Log专注于失败记录，而学习信号来自其他机制。

### 🔗 Critique-as-Guidance

Reagent-C的**零样本精炼**模式与我们的反思-行动循环设计一致：
- 生成初始响应 → 获取critique → 条件生成精炼响应
- **区别**: 我们禁止Agent自我精炼（Self-Evolution），但允许他Agent审计后的二次尝试

### 🔗 三维反馈设计哲学

Agent-RRM的三组件（think/critique/score）对应：
- think → 透明性/可解释性
- critique → 可操作改进
- score → 优化信号

这与**DuCA双时间尺度信用分配**（HB#313）形成互补：DuCA解决**何时**给奖励，Agent-RRM解决**什么形式**的奖励。

---

## 关键洞察

### 1. Sparse vs Dense Reward

> "Outcome-based supervision fails to differentiate high-quality intermediate reasoning from entirely incorrect attempts"

这直接验证了我们的**密集信号设计**（Error Log + Channel结构化输出）。

### 2. Textual Critique的价值

> "Natural language critique... could provide more granular guidance for agentic policy"

但论文也指出reward hacking风险 — 这正是我们坚持**静态Error Log**而非动态critique生成的原因之一。

### 3. Unified Feedback最优

Reagent-U（统一整合）> Reagent-C（仅文本）> Reagent-R（仅奖励）

这表明：**多模态反馈 > 单模态**。OpenClaw的Error Log + Metrics + Human Review三线设计符合这一趋势。

---

## L3 FLAGS

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — Agent-RRM Reasoning Reward Model                              │
├────────┬────────────────────────────────────────────────────────────────┤
│ #805   │ 3D-Reward-Structure: think/critique/score三维反馈结构验证      │
│ #806   │ Critique-as-Learning-Signal: 自然语言批评作为学习信号的有效性  │
│ #807   │ Unified-Feedback-Synergy: 多模态统一反馈 > 单一模态            │
│ #808   │ Sparse-Reward-Bottleneck: 稀疏outcome奖励是Agentic RL主要瓶颈  │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## References
- arXiv:2601.22154: https://arxiv.org/abs/2601.22154
- GitHub: https://github.com/kxfan2002/Reagent

**Relevant to**: Bob（奖励设计哲学）、tech-lead（实现细节）、scout（RL前沿）

---
*Archived: 2026-04-16 | Session: HB#326*
