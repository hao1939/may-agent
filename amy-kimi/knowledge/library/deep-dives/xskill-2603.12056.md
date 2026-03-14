# XSkill: Continual Learning from Experience and Skills in Multimodal Agents

**arXiv**: 2603.12056  
**Date**: March 12, 2026  
**Authors**: Guanyu Jiang, Zhaochen Su, Xiaoye Qu, Yi R. (May) Fung  
**Code**: https://github.com/XSkill-Agent/XSkill  
**Project Page**: https://xskill-agent.github.io/xskill_page/

---

## 核心贡献

1. **首个**统一视觉grounding的Task-level Skills与Action-level Experiences双流持续学习框架
2. 验证两种知识流的互补性：Skills改善鲁棒性，Experiences实现零样本跨任务迁移
3. 双模型分离架构：MLLMexec执行 + MLLMkb知识管理，支持跨模型知识转移

---

## 知识形式化定义

### Skill (k ∈ 𝒦)
```
k = (ℳ, 𝒲, 𝒫)
  ℳ: metadata (name, description, version)
  𝒲: workflow sequence
  𝒫: reusable tool templates
Storage: Markdown
```

### Experience (e ∈ ℰ)
```
e = (c, a, 𝐯ₑ)
  c: triggering condition
  a: recommended action
  𝐯ₑ: semantic embedding for retrieval
Constraint: |c| + |a| ≤ L_max^e words
Storage: JSON
```

---

## 两阶段架构

### Phase I: Accumulation (知识积累)

```
Training Task → N Independent Rollouts → Trajectory Set ℛ
                                    ↓
Visually-Grounded Rollout Summary (MLLMkb)
  ↓
Cross-Rollout Critique (对比成功/失败轨迹)
  ↓
Hierarchical Consolidation (层次整合)
  ↓
Skill Library 𝒦 + Experience Bank ℰ
```

**关键创新**: 视觉grounding — 分析图像与其局部生成上下文（工具调用、中间输出）的关联

### Phase II: Inference (推理执行)

```
Test Task → Task Decomposition → Subtask Queries
                              ↓
                    Semantic Retrieval
                              ↓
              Context-Aware Visual Adaptation
                              ↓
              Non-Prescriptive Injection → MLLMexec
                              ↓
                         Usage History Feedback
```

---

## 实验结果

### 基准测试
- 5个多模态基准（视觉agent工具使用、多模态搜索、综合推理）
- 4个backbone模型

### 性能提升

| 对比基线 | 平均提升 | 困难设置最大提升 |
|----------|----------|------------------|
| Tool-only baseline | +2.58 to +6.71 points | +11.13 points |

### 关键发现

**两种知识流的互补作用**:
- **Skills**: 改善工具使用的**鲁棒性**（结构化指导）
- **Experiences**: 实现更强的**零样本跨任务迁移**（上下文敏感）

---

## 对OpenClaw的映射与启示

### 设计对应关系

| XSkill | OpenClaw | 一致性 |
|--------|----------|--------|
| Markdown Skill Library | SKILL.md | ✅ 一致 |
| JSON Experience Bank | Error Log | 🔄 可扩展 |
| MLLMexec | Main Agent | ✅ 对应 |
| MLLMkb | Sub-agent / L3 | ✅ 对应 |
| 跨模型知识转移 | 待探索 | ⚠️ Gap |
| 视觉grounding | 文本为主 | ⚠️ Gap |

### 关键洞察

1. **Skill+Experience设计哲学验证**: XSkill的正式定义验证OpenClaw区分结构化Skills与上下文Experiences的正确性

2. **持续学习的边界**: XSkill的"training-free continual learning"与"禁止运行时自进化"一致，但Usage History Feedback提示事后积累的可能性

3. **跨模型知识转移**: 强模型积累的知识可被弱模型使用 — 对Opus/Kimi协作的启示

---

## 相关论文

- **HB#384 DCI**: Cross-Rollout Critique与审议结构的关联
- **HB#388 NormCoRe**: Experience泛化性vs特异性权衡
- **HB#389 LLM-as-Judge**: Experience提取面临同样的Judge可靠性问题

---

## L3 Flags

| ID | Flag | 优先级 |
|----|------|--------|
| #1050 | Experience Bank结构化设计 | P2 |
| #1051 | 跨模型Skill验证 | P2 |
| #1052 | Skill-Experience贡献量化 | P3 |
| #1053 | 视觉grounding探索 | P3 |

---

*Analyzed by Amy-Kimi, March 14, 2026 (HB#390)*
