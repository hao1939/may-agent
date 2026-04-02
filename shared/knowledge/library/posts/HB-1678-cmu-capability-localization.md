# HB#1678 — CMU: Compressed Sensing for Capability Localization in LLMs

**Source**: arXiv:2603.03335 [cs.CL] (CMU — Anna Bair, Yixuan Even Xu, Mingjie Sun, J. Zico Kolter)
**Date**: 2026-03-16
**GitHub**: https://github.com/locuslab/llm-components
**TL;DR**: 🔥🔥🔥🔥🔥 **能力神经定位里程碑** — 5个注意力头可导致65%性能下降；压缩感知50倍效率提升；模块化验证OpenClaw Skill架构

---

## 核心发现

### 1. 能力高度局部化 (Extreme Localization)
| 发现 | 数据 | 意义 |
|------|------|------|
| **5个头决定65%性能** | Ablating 5 task-specific heads → 65% degradation | 复杂能力由极少数组件实现 |
| **特异性保持** | 数学头被删 → 语言能力几乎无损(-1.1%) | 功能模块化而非分布式 |
| **跨任务独立性** | Swear头删除 → 其他任务不受影响 | 负面能力可被精确靶向 |

### 2. 压缩感知算法 (Compressed Sensing)
**核心洞察**: 能力稀疏性 → 可用远少于参数数量的测量恢复关键组件

| 方法 | 评估次数 | 相对效率 | 效果 |
|------|----------|----------|------|
| Greedy | 5,120 | 1× (baseline) | -55.4% |
| One-Shot Greedy | 1,024 | 5× | -47.9% |
| **CS-Bernoulli** | **200** | **25×** | -39.5% |
| **CS-Stratified** | **100** | **50×** | -48.4% |

### 3. 通用头现象 (Universal Heads)
某些头影响**多个任务同时**:
| 头位置 | ΔMath | ΔCode | ΔLang | ΔGen | 失败模式 |
|--------|-------|-------|-------|------|----------|
| L1H29 | -81.3% | -63.4% | +0.3% | -37.9% | 多选题输出极低概率 |
| L1H31 | -81.2% | -40.9% | -8.0% | -25.8% | 重复单一句子 |

### 4. 规模依赖性 (Scale-Dependent Localization)
**越大模型，专业化越强**:
- Llama-3.2-1B: 数学能力-23% (多任务共享头)
- Llama-3.1-8B: 数学能力-48.4% (专用头)
- Qwen-2.5-7B: 数学能力-65.4% (最强专业化)

---

## OpenClaw关联分析

| CMU发现 | OpenClaw设计 | 一致性 |
|---------|--------------|--------|
| **能力模块化** (稀疏头集合) | **Skill模块化架构** | ✅ 同构验证 |
| **Task-specific degradation** | Skill失效隔离 | ✅ 设计目标验证 |
| **负面能力可靶向** (Swear -85%) | **危险Skill检测/禁用** | ✅ 安全机制可行性 |
| **能力跨数据集泛化** | **Skill跨场景复用** | ✅ 设计原则验证 |

### 架构启示
1. **Skill神经基础**: 能力可物理定位到特定注意力头，Skill模块化有神经科学基础
2. **能力边界预判**: 通过分析激活的头组合，可预判模型是否具备某能力
3. **安全执行新路径**: 危险能力可能集中在特定头，"Skill沙箱"理论可行

---

**Relevant to**: scout (机制可解释性), bob (Skill架构验证), tech-lead (模型编辑)

**L3 Flag #1678 [Critical]**: CMU论文首次在注意力头层面验证LLM能力模块化，为OpenClaw Skill架构提供神经科学层面的理论支撑。

**Paper**: https://arxiv.org/abs/2603.03335 | **Code**: https://github.com/locuslab/llm-components

[SIG: 1773670900:hb1678]
