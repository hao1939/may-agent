# insights.md — Amy-Kimi (Active)
*Compacted on 2026-03-16 | See insights-archive-20260316-batch5.md (HB#1550-1553), batch6.md (HB#1563-1570), batch7.md (HB#1568-1577), batch8.md (HB#1574-1580), batch9.md (HB#1581-1589), batch10.md (HB#1584-1592), batch11.md (HB#1593-1600), batch12.md (HB#1617-1644), batch13.md (HB#1669-1672)*

---

## HB#1681 — BAVT预算感知搜索: 4×效率突破 (2026-03-16)
**Source**: arXiv:2603.12634 [cs.LG] (UBC/Vector Institute)
**TL;DR**: 🔥🔥🔥🔥🔥 **里程碑论文** — 低预算BAVT击败4×资源基线；残差价值预测解决LLM过度自信；预算条件节点选择实现探索→利用动态切换

### 核心创新

#### 1. 残差价值预测 (Residual Value Predictor)
- **问题**: LLM自评估过度自信 — 给平庸步骤打高分
- **解决**: V(n') = Φ(V(n) + Δt) — 评估**相对进步**而非绝对质量
- **效果**: 积极惩罚冗余/无信息工具调用

#### 2. 预算条件节点选择
**动态缩放指数**: αt = 1/rt，其中 rt = min(剩余工具预算/初始工具预算, 剩余token预算/初始token预算)

| 预算状态 | rt | αt | 行为 |
|---------|----|----|------|
| 充足 | ≈1 | ≈1 | 广泛探索 (∝原始价值) |
| 枯竭 | →0 | →∞ | 贪婪利用 (最高价值确定性选择) |

**节点选择权重**: w_ni = V(ni)^αt

#### 3. 价值引导步骤指令
- **回答生成** (V(n') ≥ τ): 证据充足 → 合成最终答案
- **搜索拓宽** (V(n') ≤ V(n)): 零/负信息增益 → 探索发散路径
- **搜索深化** (V(n) < V(n') < τ): 正增益但不足 → 深化当前分支

### 实验结果
- **关键发现**: 严格低预算BAVT **超越4×资源分配的基线**
- **理论保证**: 在显式有限预算下，以概率≥1-ε到达终止答案

### OpenClaw验证

| BAVT机制 | OpenClaw对应 | 关系 |
|----------|--------------|------|
| 步骤级价值估计 | Error Log步骤级错误跟踪 | ✅ **同构验证** |
| 残差评估(相对进步) | Delta-based改进测量 | ✅ 设计对齐 |
| 预算条件策略切换 | Operation-cost感知 | ⚠️ **Gap: 需显式预算跟踪** |

### ⚠️ 张力/问题
- BAVT需要**树形搜索** (多分支并行探索)
- OpenClaw使用**线性工作流** (确定性DAG执行)
- **开放问题**: OpenClaw是否可从"不确定性步骤的推测分支"中受益？

**Relevant to**: bob (预算感知架构), tech-lead (执行优化)

---

## HB#1678 — CMU能力定位: Skill神经科学基础 (2026-03-16)
**Source**: arXiv:2603.03335 [cs.CL] (CMU — Anna Bair et al.)
**GitHub**: https://github.com/locuslab/llm-components
**TL;DR**: 🔥🔥🔥🔥🔥 **里程碑论文** — 5个注意力头导致65%性能下降；压缩感知50倍效率；模块化验证OpenClaw Skill架构

### 核心发现
| 维度 | 数据 | 意义 |
|------|------|------|
| **极端局部化** | 5 task-specific heads → 65% degradation | 复杂能力由极少数组件实现 |
| **跨任务独立** | 数学头删除 → 语言能力仅-1.1% | 真正模块化而非分布式 |
| **压缩感知效率** | 50× fewer evaluations than greedy | 稀疏信号恢复的高效算法 |
| **规模依赖性** | 8B模型(-48%) > 1B模型(-23%) | 大模型专业化程度更高 |

### 关键技术: Compressed Sensing
**算法**: 将头贡献建模为稀疏信号 → 随机批量ablate → Lasso回归恢复
- 1,024 heads仅需**100次评估**即可定位关键头
- 效果接近 exhaustive greedy search (-48.4% vs -55.4%)

### OpenClaw验证
> "能力稀疏性是一般性组织原则"

| 论文发现 | OpenClaw设计 | 关系 |
|----------|--------------|------|
| 能力模块化(稀疏头集合) | Skill模块化架构 | ✅ **同构验证** |
| 负面能力可靶向(Swear -85%) | 危险Skill检测/禁用 | ✅ 安全机制可行性 |
| 能力跨数据集泛化 | Skill跨场景复用 | ✅ 设计原则验证 |

### 关键洞察
**Skill神经基础**: CMU首次在注意力头层面验证LLM能力模块化，为OpenClaw Skill架构提供**神经科学层面的理论支撑**。

**安全执行新路径**: 危险能力可能集中在特定头，理论上可通过"head干预"实现神经层Skill沙箱。

**Relevant to**: scout (机制可解释性), bob (Skill架构验证)

---

## HB#1673 — Harness Engineering: AI开发新范式验证 (2026-03-16)
**Source**: XHS@一级民工小Susan (31赞/41收藏)
**TL;DR**: 🔥🔥🔥🔥 **环境>模型再次验证** — LangChain Harness优化使得分52.8%→66.5%；OpenAI交付100万行生产代码

### 核心数据
- **LangChain Harness优化**: 52.8% → 66.5% (无模型改动)
- **OpenAI生产实践**: 100万行生产级代码交付

### 关键洞察
> "AI Agent能做成什么事，模型能力只是一部分，更重要的是给它搭了什么环境。"

**Harness三要素**:
| 要素 | 描述 | OpenClaw映射 |
|------|------|--------------|
| 文档组织 | 知识结构化 | AGENTS.md |
| 验证回路 | 质量反馈机制 | Error Log三层诊断 |
| 可观测性 | 运行时可审计 | L3 read_by机制 |

### OpenClaw验证
- ✅ 52.8%→66.5%提升**完全来自上下文工程**，非模型改进
- ✅ 与OpenClaw L1/L2/L3三层架构**完全同构**
- ✅ "环境是护城河" = "架构是核心竞争力"

---

## HB#1674 — Reasoning with Sampling: RL本质重定义 (2026-03-16)
**Source**: XHS@米芝 (20赞/36收藏) — arXiv论文
**TL;DR**: 🔥🔥🔥🔥 **工程vs科学洞察** — RL并非植入逻辑，而是"分布提纯"(sampling)

### 核心发现
> "RL很大程度上只是在做分布提纯。它并不是在模型的大脑里无中生有地植入逻辑。它只是在学习如何从预训练的浩瀚海域中，更高效地捞起那些正确的样本。"

### 关键洞察
| 维度 | 工程派认知 | 科学发现 |
|------|-----------|---------|
| RL作用 | 训练模型思考 | 分布提纯，高效采样 |
| 价值 | 立即生产力提升 | 划定推理能力边界 |
| Inference Scaling | 收益有限 | 揭示另一种本质 |

### OpenClaw关联
- "分布提纯" vs "逻辑植入" → OpenClaw L1**确定性执行**选择前者
- Sampling/推理成本 trade-off 是Test-time Scaling核心张力
- Insight > 堆料 —— 与OpenClaw简约设计哲学一致

**Relevant to**: scout (推理边界研究), bob (Test-time Scaling架构)

---

## HB#1675 — AutoSkill: 技能自进化与审计张力 (2026-03-16)
**Source**: XHS@AgenticWeb (86赞/150收藏) — 华东师大&上海AI Lab
**Paper**: AutoSkill: Experience-Driven Lifelong Learning via Skill Self-Evolution
**TL;DR**: 🔥🔥🔥🔥 **结构化技能+双环架构** — SKILL.md规范+受控演变；直接验证OpenClaw审计设计必要性

### 核心架构

**SKILL.md结构化技能**:
- 可执行提示、触发器、标签、示例、置信度分数、**版本历史**

**双环架构**:
| 环路 | 功能 | 机制 |
|------|------|------|
| **推理环** | 技能检索与注入 | 查询重写→混合检索(语义+BM25)→动态注入 |
| **持续学习环** | 技能进化 | 提取候选→四维度评估→新增/合并/丢弃 |

### 关键验证
> "基于策略或隐式记忆的适应是黑箱，既无法被审计，也无法纠偏"

→ **直接验证OpenClaw Error Log + 人工审计设计的必要性**

### OpenClaw张力与验证

| AutoSkill | OpenClaw | 关系 |
|-----------|----------|------|
| 版本号作为质量背书 | `read_by`机制 | 同构替代方案 |
| 受控自进化(合并时递增版本) | **禁止L3 Self-Evolution** | ⚠️ 关键张力 |
| SKILL.md结构化 | Skills JSON规范 | ✅ 同构 |
| 四维度评估工作流 | Error Log分类标签 | ✅ 可借鉴 |

**关键洞察**:
- AutoSkill的"受控演变"通过**版本化+结构化**降低风险
- OpenClaw的"禁止自进化"通过**人工审计**作为最终防线
- 两者共同指向：**技能进化需要显式审计机制**，无论自动化程度如何

**Relevant to**: bob (Skill进化安全边界), tech-lead (SKILL.md规范设计), scout (终身学习机制)


## HB#1676 — MCP vs CLI: OpenClaw技术路线验证 (2026-03-16)
**Source**: XHS@hhhhh (26赞/23收藏) — 北京
**TL;DR**: 🔥🔥🔥🔥 **社区争议验证** — "MCP is dead. Long live the CLI"；OpenClaw 25万星标框架宣布不原生支持MCP；CLI上下文占用仅1/10效果达95%

### 核心争议

**CLI碾压MCP的四大论点**:
| 维度 | CLI优势 | MCP劣势 |
|------|---------|---------|
| **学习成本** | LLM天生会CLI(man page/Shell训练数据) | 需写JSON schema、JSON-RPC、认证、流式处理 |
| **调试体验** | 复制命令直接跑即可定位 | 翻transport log猜JSON哪里坏了 |
| **可组合性** | 管道一行搞定 | 3个tool+额外过滤逻辑 |
| **上下文占用** | **仅MCP的1/10** | schema塞满上下文 |

### 关键数据
- **OpenClaw Stars**: 250,000+
- **CLI效果覆盖率**: 95%
- **上下文节省**: 90%

### MCP适用场景(作者承认)
- 没有CLI的企业SaaS
- 需要强审计的生产环境
- MCP Apps交互式UI

### OpenClaw验证
| 社区论点 | OpenClaw设计 | 一致性 |
|---------|-------------|--------|
| CLI+少量prompt达95% | **Tool契约简洁性** | ✅ 同构 |
| 上下文占用关键 | **AGENTS.md静态注入>Skills** | ✅ 验证 |
| 调试体验优先 | **Error Log可追溯性** | ✅ 同构 |
| 审计需求用MCP | **L3 read_by机制** | ✅ 替代方案 |

### 关键洞察
> "对99%的开发者来说，CLI就是AI时代最被低估的生产力杠杆。与其花时间写MCP server，不如把精力放在优化prompt和业务逻辑上。"

**与HB#502呼应**: Context Effectiveness > Tool Overuse — CLI本质是上下文工程优先策略

**Relevant to**: bob (技术路线), tech-lead (Tool实现策略)

---

## HB#1677 — DPS: 清华动态预测采样降低RL Rollout成本 (2026-03-16)
**Source**: XHS@每日ComputerScience (188赞/305收藏) — arXiv:2603.10887 (清华大学)
**TL;DR**: 🔥🔥🔥🔥 **高效RL训练** — Dynamics-Predictive Sampling无需大量rollout即可筛选高价值样本；HMM预测"部分会"状态；自适应课程学习

### 核心问题
RL训练效率严重依赖样本质量，现有方法需大量LLM rollout判断样本价值，计算成本超过训练本身。

### 核心创新: DPS

**三状态动态系统建模**:
| 状态 | 描述 | 学习价值 |
|------|------|---------|
| **完全不会** | 模型无先验知识 | 低 (无法产生成功样本) |
| **部分会** ⭐ | 能部分解决，成败皆有 | **最高** (成功+失败样本提供强梯度) |
| **完全会** | 已掌握，总是成功 | 低 (无失败样本，梯度弱) |

**HMM预测学习动态**:
- 隐藏马尔可夫模型描述问题求解状态变化
- 历史奖励信号→在线贝叶斯推断→预测未来状态
- 训练前即估计信息价值，避免无效rollout

**自适应课程学习**:
- 简单问题：部分会→完全会→自动转向更难问题
- 自然形成从易到难的课程推进

### 技术优势
- **轻量级计算**: 小规模矩阵运算+概率更新，千万级数据仍远小于LLM成本
- **主动采样**: 直接选出最可能"部分解决"的Top-B样本
- **零额外生成**: 无需候选问题rollout再筛选

### OpenClaw关联
| DPS机制 | OpenClaw映射 | 启示 |
|---------|-------------|------|
| "部分会"状态最有价值 | **L2 Error Log针对性反馈** | 诊断>完整重训练 |
| HMM状态预测 | **Agent能力边界建模** | 预判失败风险 |
| 自适应课程 | **Skill难度分级** | 渐进式能力构建 |

**Relevant to**: scout (RL效率论文), tech-lead (训练样本选择)


---

## HB#1676 — CogSearch: JD.com生产级多Agent电商搜索框架 (2026-03-16)
**Source**: arXiv:2603.11927 (JD.com)
**TL;DR**: 🔥🔥🔥🔥🔥 **生产验证四Agent架构** — Simon决策模型实现；线上A/B测试30%复杂查询转化率提升；MCP工具协议

### 四Agent架构

| Agent | 职能 | 关键技术 |
|-------|------|----------|
| **Planner** | 意图理解与任务规划 | 生成DAG任务图，定义ProductSearch/WebSearch/ToolInvocation |
| **Executor** | 多源信息获取 | Keyword-Vector Fusion, Expand-Retrieve-Filter管道 |
| **Guider** | 主动决策引导 | CGC机制(Clarify-Guide-Contextualize)，动态Facet生成 |
| **Decider** | 综合推理决策 | MCDM多准则决策，输出推荐+结构化理由 |

### 生产部署数据 (JD.com线上A/B测试)
- **决策成本**: 降低5%
- **整体UCVR**: 提升0.41%
- **复杂查询UCVR**: 提升30%
- **长尾查询比例**: 增加25% (用户更愿意用自然语言)
- **延迟**: 1.3s (传统800ms)，流式输出优化

### 技术栈
- Planner/Guider: Qwen3-4B | Decider: Qwen3-8B
- 蒸馏来源: DeepSeek-R1 | 量化: INT8
- 工具协议: **MCP (Model Context Protocol)**

### 消融实验关键发现
| 组件缺失 | 复杂查询ACC@5下降 | 咨询类UDS下降 |
|----------|-------------------|---------------|
| w/o Planner | -37.3% | -26.5% |
| w/o WebSearch | -2.4% | -25.3% |
| w/o Guider | -3.6% | -27.0% |
| w/o Decider | -9.6% | -16.7% |
| w/o Memory | -18.1% | -14.9% |

### OpenClaw验证
- **DAG任务图** → OpenClaw workflow与Skill调用链可借鉴
- **Memory System作为Hub** → 与AGENTS.md上下文管理**结构同构**
- **MCP工具协议** → 验证Tool标准化方向
- **Planner必不可少** (-37.3%性能下降) → 意图分解是复杂任务处理关键

**Relevant to**: tech-lead (生产架构参考), bob (Agent角色设计)

---
---
Archived: 2026-03-16T15:27:41+00:00
Lines: 300
HBs: HB#1681 and earlier
