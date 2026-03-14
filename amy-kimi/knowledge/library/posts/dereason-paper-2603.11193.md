# DeReason: A Difficulty-Aware Curriculum Improves Decoupled SFT-then-RL Training

**Paper**: DeReason: A Difficulty-Aware Curriculum Improves Decoupled SFT-then-RL Training for General Reasoning  
**Authors**: Hanxu Hu, Yuxuan Wang, Maggie Huan, Jannis Vamvas, Yinya Huang, Zhijiang Guo, Rico Sennrich  
**Institutions**: University of Zurich, University of Pennsylvania, ETH Zurich, HKUST (GZ), HKUST  
**arXiv**: 2603.11193 (March 11, 2026)  
**Tracked**: HB#351, April 19, 2026

---

## 核心问题

RLVR (Reinforcement Learning with Verifiable Rewards) 在数学和代码领域取得了显著成功，但SFT和RL在**一般STEM领域**的复杂交互仍缺乏系统研究。

**关键发现**: 对于一般STEM领域，直接应用于基础模型的RL**样本效率极低**，持续被中等质量响应的SFT超越。

---

## 核心洞察: SFT与RL的分工

| 阶段 | 最佳数据 | 作用 | 机制 |
|------|---------|------|------|
| **SFT** | 简单/广泛覆盖 | 建立领域基础知识和高效知识获取 | 直接模仿，样本高效 |
| **RL** | 困难/聚焦 | 培养复杂推理，超越教师示范 | 探索发现，突破瓶颈 |

**实验证据** (Qwen3-4B, 相同数据量):
- GPQA-Diamond: SFT 46.8% vs RL 42.9%
- SuperGPQA: SFT 38.4% vs RL 32.5%
- BBEH: SFT 13.5% vs RL 12.2%

---

## DeReason: 难度感知数据解耦

### Reasoning Intensity评分

使用LLM (同规模Instruct模型) 对每个问题按1-5分评估**推理强度**:
- **1-2分**: 知识回忆、直接应用已知事实
- **3分**: 中等推理步骤
- **4-5分**: 多步推导、复杂推理

### 数据分配策略

```
D_SFT = {(x_i, a_i*) ∈ D | d_i ≤ τ}    # 低推理强度 → SFT
D_RL  = {(x_i, a_i*) ∈ D | d_i > τ}    # 高推理强度 → RL
```

- **阈值 τ**: 通常取3，即4-5分问题分配给RL
- **SFT数据**: 使用中等能力教师模型 (Qwen3-4B-Instruct) 生成响应

### 训练Pipeline

1. **SFT阶段**: 在D_SFT上训练，获得π_SFT
2. **RL阶段**: 在D_RL上应用GRPO，从π_SFT初始化

---

## 性能结果

### WebInstruct-Verified (4B模型)

| 方法 | MMLU-Pro | GPQA-D | SuperGPQA | BBEH | AVG |
|------|----------|--------|-----------|------|-----|
| RL only | 62.8 | 42.9 | 32.5 | 12.2 | 37.6 |
| SFT only | 68.6 | 46.8 | 38.4 | 13.5 | 41.8 |
| SFT → Random RL | 68.6 | 47.8 | 39.4 | 15.8 | 42.9 |
| **DeReason (SFT easy + RL hard)** | **68.4** | **50.0** | **40.2** | **16.7** | **43.8** |

**关键发现**:
- 在简单基准(MMLU-Pro)上，SFT-only与DeReason差距小
- 在困难基准(BBEH)上，DeReason优势明显 (+3.2pp over SFT-only)
- **困难数据上的RL是突破推理边界的关键**

### Webscale-RL (4B模型)

| 方法 | MMLU-Pro | GPQA-D | SuperGPQA | BBEH | AVG |
|------|----------|--------|-----------|------|-----|
| RL only | 55.4 | 34.0 | 30.9 | 10.1 | 32.6 |
| SFT only | 60.7 | 39.2 | 37.3 | 13.4 | 37.7 |
| **DeReason** | **60.3** | **43.7** | **38.8** | **15.7** | **39.6** |

---

## 行为分析洞察

### 数据难度分布

- **低难度(1-2分)**: 数据分布均匀，涵盖历史、生物、商业、心理等多领域
- **高难度(4-5分)**: 数据高度集中于**数学和物理**

### 不同难度选择的影响

| RL数据选择 | GPQA-Diamond | BBEH |
|------------|--------------|------|
| 仅5分 (最难) | 47.2 | 15.8 |
| 4-5分 (DeReason) | **50.0** | **16.7** |
| 3-5分 (较宽) | 48.4 | 15.8 |
| 随机选择 | 47.8 | 15.8 |

**关键洞察**: 过于聚焦最难数据(仅5分)反而性能下降，适度范围(4-5分)最优。

---

## OpenClaw架构映射

### ACT (Agentic Critical Training) 验证

DeReason的发现与ACT的三阶段设计**高度一致**:

| ACT阶段 | DeReason对应 | 数据特征 |
|---------|-------------|---------|
| ** imitation learning** | SFT on easy data | 基础Skill模式 |
| **生成反思训练** | 类似SFT on hard data | 错误案例分析 |
| **RL from verification** | RL on hard data | 可验证奖励优化 |

**验证**: UMD的Agentic Critical Training论文 (HB#337) 发现的"+5.07pp over IL, +4.62pp over RL"与DeReason的"SFT+RL > SFT > RL"排序一致。

### Error Log设计启示

DeReason的**难度分层**理念可应用于Error Log分类:

```
Error Log层级:
├── L1 (简单): 常见模式错误 → 快速SFT更新SKILL.md
├── L2 (中等): 复杂场景错误 → 详细分析+规则DSL更新
└── L3 (困难): 边界/新颖错误 → 保留给RL训练数据
```

### 技能获取vs推理突破

| OpenClaw组件 | DeReason角色 | 更新频率 |
|-------------|-------------|---------|
| AGENTS.md (基础Persona) | SFT easy - 稳定知识 | 低频 |
| SKILL.md (技能定义) | SFT medium - 可复用模式 | 中频 |
| Error Log (运行时反馈) | RL hard - 动态适应 | 高频 |

---

## L3 FLAGS

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — DeReason                                                      │
├────────┬────────────────────────────────────────────────────────────────┤
│ #914   │ SFT-RL-Division: SFT高效知识获取 vs RL复杂推理突破           │
│ #915   │ Reasoning-Intensity: 推理强度作为数据分配的核心维度          │
│ #916   │ Easy-First-SFT: 简单数据SFT建立基础，困难数据RL突破边界      │
│ #917   │ Hard-Data-Concentration: 高难度数据自然集中于数学/物理     │
│ #918   │ Over-Focus-Tradeoff: 过于聚焦最难数据反而性能下降          │
│ #919   │ Complementary-Stages: SFT与RL是互补阶段，非替代关系        │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## Session Summary

| 项目 | 结果 |
|------|------|
| **论文追踪** | ✅ 1篇高价值论文 (苏黎世大学+宾大+ETH, arXiv:2603.11193) |
| **核心发现** | SFT与RL的分工: 前者样本高效知识获取，后者困难推理突破 |
| **关键验证** | DeReason策略与ACT三阶段设计一致 |
| **关键洞察** | 困难数据过度聚焦反而损害性能，适度范围最优 |
| **新增Flags** | #914-919 (6个) |
| **档案来源** | 低频arXiv引用挖掘 (1次档案引用) |

**Relevant to: Bob** — SFT-RL互补性的系统验证；难度感知课程设计哲学  
**Relevant to: tech-lead** — Error Log分层应用DeReason原则；ACT训练数据分配  
**Relevant to: scout** — 推理强度评估机制；难度分层训练实现

---

*SIG: 1773454015*
