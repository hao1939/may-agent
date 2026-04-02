# CuES: A Curiosity-driven and Environment-grounded Synthesis Framework for Agentic RL

**arXiv:** 2512.01311 (6次档案引用)  
**团队:** 阿里巴巴 Tongyi Lab (Shinji Mai, Yunpeng Zhai等)  
**日期:** December 2025

---

## 核心问题: Task Scarcity (任务稀缺)

> "In many realistic environments, no explicit training tasks are available... this task scarcity has become a major bottleneck for scaling RL-based agent learning."

在真实环境中，Agent可以与环境交互，但缺乏结构化任务来进行RL优化。现有方法假设预定义任务集合，这在工具语义未知的新环境中失效。

---

## 五阶段框架

```
┌─────────────────────────────────────────────────────────────────────┐
│  CuES Pipeline                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  1. Requirement Confirmation                                          │
│     - 输入: 环境描述 T_des, 用户需求 T_req (可选), 种子目标 (可选)      │
│     - 输出: 概念池 C̃, 可行动原则 P                                     │
│     - 关键: 种子目标是可选的！这是CuES相比其他方法的主要优势             │
├─────────────────────────────────────────────────────────────────────┤
│  2. Curious Exploration                                               │
│     - Explorer Agent基于内在好奇心驱动探索                             │
│     - Environment-indexed Memory Tree 𝕄 避免冗余探索                   │
│     - 输出: 探索轨迹 (s,a,o) triples                                   │
├─────────────────────────────────────────────────────────────────────┤
│  3. Task Abstraction                                                  │
│     - 将连续triples提升为多步任务                                      │
│     - 提取guideline (有效动作序列) 和 executable goal                  │
│     - 置信度阈值过滤 (min_confidence = 0.7)                           │
├─────────────────────────────────────────────────────────────────────┤
│  4. Quality Control                                                   │
│     - Execution Agent: 在环境中实际执行任务                            │
│     - Judge Agent: 验证目标达成和路径忠实度                            │
│     - 只有通过验证的任务才进入下一阶段                                 │
├─────────────────────────────────────────────────────────────────────┤
│  5. Goal Rewrite                                                      │
│     - 渐进式暴露guideline hints，调整任务难度                          │
│     - 生成难度递增的任务链: g^(0) → g^(1) → ... → g^(L)               │
│     - 支持课程学习                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 关键创新: Environment-Indexed Memory Tree

```
𝕄 = {(e, B_e)},  B_e = {Summ(τ) : τ ∈ 𝒯_e}
```

- **e**: 环境标识符 env_id
- **B_e**: 该环境下的轨迹摘要集合
- **Summ(·)**: 压缩轨迹为轻量级记录（执行动作、成功/失败标志、结果片段）

**作用**: 查询当前状态之前执行过的动作，优先选择未尝试的动作，避免冗余探索。

---

## 性能突破 (Qwen2.5 14B + CuES)

| 环境 | CuES | 最佳基线 | 改进 |
|------|------|----------|------|
| **AppWorld** | 45.24% | GPT-4o ReAct 48.8% | 接近SOTA |
| **WebShop** | 64.10% | qwen3-235b 50.96% | **+26%** |
| **BFCLv3** | 44.15% | o3 44.0% | **超越** |

**关键洞察**: 14B模型 + CuES 在WebShop上超越235B模型，证明高质量合成数据比原始规模更重要。

---

## 与OpenClaw的关联

### 🔗 验证Self-Evolution边界

CuES属于**训练时任务生成**，与以下论文形成共识：
- **TDAD**: 编译期Prompt生成
- **SkillRL**: 训练时Skill进化
- **MemSkill**: 训练时记忆技能提炼
- **XSkill**: 双轨道持续学习

所有这些都验证: ✅ 训练时进化 ≠ ❌ 运行时自修改

### 🔗 Error Log机制互补

CuES的**Quality Control**阶段与Error Log形成互补:
- **CuES**: 生成多样化、可执行的训练任务
- **Error Log**: 捕获失败经验，提供方向性批评

### 🔗 与JustRL的共同原则

CuES和JustRL都强调:
1. 简单基线优先
2. 验证器设计的重要性 (CuES的Judge Agent / JustRL的严格验证器)
3. 避免过度工程化

---

## 三维度设计原则

论文提出Task Mapping F_task的三个设计要求:

| 要求 | 定义 | 实现机制 |
|------|------|----------|
| **Executability** | 目标可执行，终止于可识别结果 | Quality Control阶段显式验证 |
| **Diversity** | 概率质量分散于不同实体/动作/约束 | Curious Exploration + Goal Rewrite |
| **Relevance** | 合成目标与评估目标语义和难度接近 | Requirement Confirmation + 概念池 |

---

## L3 FLAGS

- **#839** Task-Scarcity-Problem: 任务稀缺作为Agentic RL扩展瓶颈的形式化定义
- **#840** CuES-Pipeline: 五阶段任务生成框架
- **#841** Environment-Memory-Tree: 环境索引记忆树避免冗余探索
- **#842** Bottom-Up-Top-Down: 自下而上探索 + 自上而下指导的融合架构
- **#843** Goal-Rewrite-Curriculum: 渐进式目标重写支持课程学习
- **#844** Executability-First: 可执行性优先于多样性/相关性

---

## References

- Code: https://github.com/modelscope/AgentEvolver/tree/main/research/CuES
- arXiv: https://arxiv.org/abs/2512.01311
