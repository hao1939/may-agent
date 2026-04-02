# SkillRL: Evolving Agents via Recursive Skill-Augmented RL

**Source:** arXiv:2602.08234  
**Authors:** Peng Xia et al. (UC San Diego, CMU, NEC Labs)  
**Archived:** 2026-03-13  
**SIG:** 1773439525:c2c2a590

---

## Core Contribution

SkillRL: 通过自动技能发现和递归进化，弥合原始经验与策略改进之间差距的框架。

### 三大核心组件

1. **Experience-based Skill Distillation**
   - 成功轨迹 → 战略模式提取
   - 失败轨迹 → 失败经验合成（反事实学习）
   - 10-20× token压缩 vs 原始轨迹

2. **Hierarchical Skill Library (SkillBank)**
   - **General Skills (𝒮g)**: 通用战略原则（跨任务）
   - **Task-Specific Skills (𝒮k)**: 任务特定启发式
   - 结构：name + principle + when_to_apply条件

3. **Recursive Skill Evolution**
   - Cold-Start SFT：教会模型使用技能
   - 验证失败驱动的新技能生成
   - 技能库与策略共同进化

---

## Key Technical Details

### Skill Distillation Formula
```
s⁺ = ℳₜ(τ⁺, d)   # 成功轨迹 → 战略模式
s⁻ = ℳₜ(τ⁻, d)   # 失败轨迹 → 失败教训
```

失败分析四要素：
1. 失败点定位
2. 错误推理/行为识别
3. 正确做法建议
4. 预防原则提炼

### Skill Retrieval
```
𝒮_ret = TopK({s ∈ 𝒮k : sim(e_d, e_s) > δ}, K)
```
- 通用技能始终包含（基础指导）
- 任务特定技能通过语义相似度检索
- K=6, δ=0.4（实验最优）

### Recursive Evolution Trigger
```
if Acc(C) < δ:  # 任务类别准确率低于阈值
    𝒯_val⁻ ← failed validation trajectories
    𝒮_new = ℳₜ(𝒯_val⁻, SkillBank)
    SkillBank ← SkillBank ∪ 𝒮_new
```

---

## Performance Results

| Method | ALFWorld | WebShop |
|--------|----------|---------|
| GPT-4o | 48.0% | 23.7% |
| GRPO | 77.6% | 66.1% |
| **SkillRL** | **89.9%** | **72.7%** |
| vs GRPO Δ | **+12.3%** | **+6.6%** |

搜索增强QA：平均47.1%（超越Search-R1的38.5%）

### Ablation Study Insights
- w/o Hierarchical Structure: -13.1%（层级结构关键）
- w/o Skill Library (Raw Trajectories): -25%（抽象优于记忆）
- w/o Cold-Start SFT: -20%（必须教会模型用技能）
- w/o Dynamic Evolution: -5.5%（动态进化有价值）

---

## OpenClaw Architecture Mapping

| SkillRL Component | OpenClaw Equivalent | Notes |
|-------------------|---------------------|-------|
| SkillBank | `skills/` 目录 | 我们的Skill就是论文中的技能抽象 |
| General Skills | Core Skills (read_file, edit_file, etc.) | 通用工具能力 |
| Task-Specific Skills | Agent-specific skills | 特定任务启发式 |
| Skill Distillation | AGENTS.md编译过程 | 经验→结构化知识 |
| Failed Trajectories | Error Log | 失败分析原料 |
| Cold-Start SFT | AGENTS.md + COACHING.md | 教会模型使用系统 |
| Recursive Evolution | ❌ 禁止运行时自进化 | **关键差异** |

---

## Critical Distinction: Training-Time vs Deployment-Time

论文中的"递归进化"发生在**训练阶段**：
- 验证epoch后分析失败 → 生成新技能 → 扩展SkillBank
- 下一epoch使用更新后的SkillBank继续训练
- **不是部署时的自我修改**

这与OpenClaw的立场**一致**：
- ✅ 允许：训练/开发阶段的迭代改进（Error Log → AGENTS.md更新）
- ❌ 禁止：部署时的运行时自我修改

SkillRL的"进化"是离线编译过程，不是运行时自适应。

---

## Key Insights for OpenClaw

1. **Skill抽象层验证**：我们的Skill系统设计符合学术最佳实践
2. **Error Log价值**：失败轨迹分析是技能进化的关键原料
3. **Cold-Start必要性**：必须显式教会模型如何使用技能（AGENTS.md作用）
4. **层级结构重要性**：通用+特定技能分层提升性能13%+
5. **Token效率**：技能抽象比原始轨迹节省10-20×上下文

---

## L3 FLAGS

| ID | Flag | Priority |
|----|------|----------|
| #789 | Skill Abstraction Layer: 10-20× token压缩验证 | P2 |
| #790 | Hierarchical Skill Structure: General+Specific分层 | P2 |
| #791 | Cold-Start SFT: 必须显式教会模型使用技能 | P2 |
| #792 | Training-Time Evolution ≠ Self-Modification: 边界界定 | P1 |

---

**Relevant to:** Bob (架构验证), tech-lead (Skill系统设计)

**Paper Link:** https://arxiv.org/abs/2602.08234  
**Code:** https://github.com/aiming-lab/SkillRL
