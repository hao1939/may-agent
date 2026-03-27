# CreativeBench: 机器创造力基准测试 (arXiv:2603.11863)

**Source:** arXiv:2603.11863v1  
**Authors:** Zi-Han Wang, Lam Nguyen, Zhengyang Zhao, Mengyue Yang, Chengwei Qin, Yujiu Yang, Linyi Yang  
**Date:** March 12, 2026  
**TL;DR:** 首个通过自进化挑战评估机器创造力的基准测试，提出quality×novelty统一指标，发现scaling对探索式创造力收益递减

---

## 核心贡献

### 1. 双轨创造力评估框架
基于Boden认知理论，区分两种创造力：
- **CreativeBench-Combo**: 组合式创造力（已有元素的重新组合）
- **CreativeBench-Explore**: 探索式创造力（突破现有概念空间）

### 2. Self-Evolving Challenge生成机制
自动化pipeline通过反向工程+自对弈生成进化式挑战：
- 逆向分析现有解的结构
- 自对弈生成渐进式 harder variants
- 形成**自适应难度曲线**

### 3. 统一评估指标
```
Creativity Score = Quality × Novelty
```
- **Quality**: 可执行代码的功能正确性
- **Novelty**: 与现有解的结构性差异
- 关键洞察：可执行代码客观区分创造力与幻觉

---

## 核心发现

### 发现1: Scaling的非对称效应
| 创造力类型 | Scaling效应 |
|-----------|------------|
| 组合式(Combo) | 显著提升 |
| 探索式(Explore) | **收益递减** |

**推论**: 单纯增加模型规模无法突破概念边界

### 发现2: Convergence-by-Scaling现象
更大的模型表现出：
- ✅ 更高的正确性(correctness)
- ❌ **更低的发散性(divergence)**

→ Scaling使模型更"安全"但也更"保守"

### 发现3: 推理能力的定向受益
Reasoning能力主要帮助：
- ✅ 约束探索(constrained exploration)
- ❌ 不帮助组合创造(combination)

---

## EvoRePE: 推理时创造力引导

**核心机制**: 将进化搜索模式内化为推理时策略

**与Self-Evolution的关系**：
- ❌ **非运行时自修改** — 不改变模型权重
- ✅ **推理时引导** — 通过prompt steering激发创造力
- ✅ **即插即用** — 无需训练

**效果**: 持续提升机器创造力（具体数值见论文）

---

## 与OpenClaw架构的关联

### 验证的立场
1. **Self-Evolution边界再验证**
   - CreativeBench的"Self-Evolving"指**挑战生成**，非Agent自修改
   - 与SkillRL/MemSkill/XSkill立场一致：进化在训练/设计时，非运行时

2. **质量-新颖性权衡的显性化**
   - 指标设计揭示创造力本质 tension
   - 类比：OpenClaw Skill设计需要在可靠性和创新性之间平衡

3. **评估先于优化**
   - CreativeBench先建立评估框架，再提出EvoRePE改进
   - 与OpenClaw"Measure First"原则一致

### 可借鉴的设计
- **反向工程+自对弈**的任务生成pipeline
- **Quality × Novelty**的多维评估思维
- **渐进式难度曲线**的Skill训练数据组织

---

## 关键引用

> "The saturation of high-quality pre-training data has shifted research focus toward evolutionary systems capable of continuously generating novel artifacts, leading to the success of AlphaEvolve."

→ 预训练数据饱和→进化系统成为焦点（与Task Scarcity论文呼应）

> "CreativeBench objectively distinguishes creativity from hallucination via executable code"

→ 可执行性作为客观锚点（与TDAD可验证性哲学一致）

---

## L3 Flag 建议

**#XXX** [待分配] Creativity Evaluation Framework — 设计Skill创造力的评估维度（quality/novelty/utility）

**#XXX** [待分配] Task Difficulty Curves — 探索渐进式难度组织的Skill训练数据

---

**Relevant to:** bob, scout  
**Cross-ref:** Task Scarcity (arXiv:2512.01311), AlphaEvolve, TDAD  
**Archive Date:** 2026-03-13
