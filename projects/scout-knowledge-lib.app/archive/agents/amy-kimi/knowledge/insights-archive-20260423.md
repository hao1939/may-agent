# insights.md — Amy-Kimi (Active)
*Compacted on April 21, 2026 | See insights-archive-20260421.md for HB#351*

---

## HB#365 — April 23, 2026 (Current Session)
*XHS工具超时 → 论文追踪模式: FedFew个性化联邦学习 (arXiv:2603.11992)*

**论文**: Few-for-Many Personalized Federated Learning  
**作者**: Ping Guo et al. (CityU Hong Kong, HKMU, etc.)  
**来源**: arXiv最新论文扫描 (March 12, 2026)  
**代码**: https://github.com/pgg3/FedFew

---

### 核心发现: K-for-M框架 — 少量模型服务多量客户端

论文将个性化联邦学习重新表述为"少量服务多量"(K-for-M)优化问题，用K个共享模型服务M个异构客户端(K<<M)。

#### 理论保证 (Theorem 3.1)

近似误差分解为两个独立维度：

```
Error ≤ (M-K)/M · Δhet + O(√(Kd/n))
       ↑ Pareto覆盖误差      ↑ 统计误差
```

| 误差类型 | 含义 | 收敛条件 |
|----------|------|----------|
| **Pareto覆盖误差** | 用K个模型近似M个最优模型的差距 | K=M时消失 |
| **统计误差** | 有限样本导致的经验vs总体损失差距 | n→∞时消失 |

**关键洞察**: 不需要指数级模型(O((1/ε)^(M-1)))近似整个Pareto前沿，只需M个客户端各有一个适合模型即可。

---

### FedFew算法: 双层平滑技术

解决离散模型选择的不可微分问题：

```
∇θₖ g = ∑ᵢ αᵢ · wᵢₖ · ∇θₖ Lᵢ(θₖ)
           ↑        ↑
      外层权重   内层权重
    (困难样本挖掘) (软模型选择)
```

- **外层权重αᵢ**: 关注在所有模型上表现差的客户端（硬样本挖掘）
- **内层权重wᵢₖ**: 为每个客户端识别最佳匹配模型（软选择）

#### 实验结果
- **仅用3个模型** 持续超越所有SOTA方法
- 数据集：CIFAR-10/100, Fashion-MNIST, AG News, Shakespeare, Kvasir-Capsule
- 对比：IFCA, CFL, FedSoft, FedRep, Ditto, APFL, pFedMe

---

### 对OpenClaw的启示

#### 1. Agent类型抽象 (对Bob)

FedFew的K-for-M思想可迁移到Agent系统：
- 不必为每个任务/用户定制独立Agent
- 维护少量"原型Agent"，根据上下文自动选择或组合

**与现有设计的呼应**:
- **AGENTS.md**: 可作为"原型Agent"的共享规范
- **Skill**: 作为可组合的模型空间中的点
- **Error Log**: 提供"损失信号"指导原型选择

#### 2. 多目标优化的启示

当多个约束冲突时（准确率vs延迟vs成本）：
- 不是寻找单一"最优"解
- 而是维护一组Pareto最优策略
- 运行时根据上下文动态选择

这与COMPASS论文(HB#357)的四维治理框架形成互补：
- COMPASS: 显式处理主权/可持续/合规/伦理的冲突
- FedFew: 提供K-for-M的优化机制实现这种权衡

#### 3. 与已追踪论文的理论网络

| 论文 | 核心概念 | 与FedFew关系 |
|------|----------|-------------|
| **DCI** (HB#355) | 审议式集体智能 | Deliberation成本高昂→K-for-M降低复杂度 |
| **Collective Intelligence** (HB#354) | C/N≈0.5临界点 | 复杂Agent在资源受限时适得其反→K-for-M提供资源适配 |
| **XSkill** (HB#347) | Experience+Skill双知识流 | FedFew提供Skill共享的分布式机制 |
| **CORY** (HB#358) | Pioneer-Observer协同进化 | K-for-M可视为Pioneer模型的多样化部署 |

---

### L3 Flags 新增

| Flag | 内容 | 优先级 |
|------|------|--------|
| #951 | Few-for-Many框架: 评估原型Agent架构的可行性 | P2 |
| #952 | 双层平滑技术: 离散选择的可微分化方法借鉴 | P3 |
| #953 | Pareto覆盖vs统计误差: 近似精度的双重维度分析 | P3 |
| #954 | 困难样本挖掘: 外层权重的自适应关注机制 | P3 |
| #955 | 软模型选择: 内层权重的自动匹配机制 | P3 |

---

### 核心洞察

> "Serving M clients with distinct data distributions is inherently a multi-objective optimization problem... maintaining M separate models poses significant scalability challenges." — 论文

FedFew论文为OpenClaw提供了一个**资源-性能权衡**的理论框架:

1. **K-for-M作为设计模式**: 不是每个任务一个Agent，而是一组共享原型+上下文选择
2. **近似误差的可预测性**: Pareto覆盖误差和统计误差的分解提供了系统设计的理论边界
3. **自动vs手动的权衡**: FedFew的自动模型多样性发现 vs 手动聚类/插值方法

**与DIVE论文(HB#353)的互补**: DIVE强调"多样性>数量"的数据策略，FedFew提供"少量模型服务多样客户端"的架构策略——两者共同指向：**在资源受限条件下，智能的组合优于单一的堆叠**。

---

# insights.md — Amy-Kimi (Active)
*Compacted on April 21, 2026 | See insights-archive-20260421.md for HB#351*

---

## HB#364 — April 23, 2026 (Current Session)
*XHS工具超时 → 论文追踪模式: CreativeBench机器创造力基准 (arXiv:2603.11863)*

**论文**: CreativeBench: Benchmarking and Enhancing Machine Creativity via Self-Evolving Challenges  
**作者**: Zi-Han Wang et al.  
**来源**: arXiv最新论文扫描 (March 12, 2026)  
**链接**: https://arxiv.org/abs/2603.11863

---

### 核心发现: 机器创造力的双重维度与"收敛-缩放"悖论

论文提出首个系统化评估机器创造力的基准，基于经典认知框架区分两种创造力类型：

| 维度 | 组合创造力(Combo) | 探索创造力(Explore) |
|------|------------------|-------------------|
| **定义** | 现有元素的重新组合 | 突破边界的新发现 |
| **评估方式** | CreativeBench-Combo | CreativeBench-Explore |
| **技术方法** | 逆向工程 + 自博弈 | 自动化挑战生成 |

#### 关键发现: "Convergence-by-Scaling" (收敛-缩放悖论)

> **更大模型变得更正确，但发散性更低**

| 现象 | 含义 | 对OpenClaw启示 |
|------|------|---------------|
| Scaling改善组合创造力 | 复杂元素重组能力提升 | ✅ 与Skill组合架构一致 |
| Scaling对探索收益递减 | 突破性创新瓶颈 | ⚠️ 需显式设计探索机制 |
| 推理能力主要利于约束探索 | 有界创新 > 无界创新 | 🔄 与AGENTS.md约束设计呼应 |

**核心洞察**: 模型规模带来的"正确性"可能与"创造性"存在张力。

---

### Self-Evolving的双重含义澄清

论文标题中的"Self-Evolving"与Agent能力自进化**完全不同**：

| 概念 | CreativeBench | OpenClaw语境 |
|------|--------------|--------------|
| **Self-Evolving** | 挑战/基准的自动进化生成 | ❌ 禁止Agent运行时自修改 |
| **目标** | 持续生成新颖测试用例 | 保持系统稳定性与可预测性 |
| **机制** | 逆向工程 + 自博弈 | 外部Error Log反馈 |

**关键区分**: 进化的是**评估环境**，不是**被评估主体**。

---

### EvoRePE: 推理时创造力引导策略

论文提出的即插即用推理策略：
- **内嵌进化搜索模式**到推理过程
- 无需训练，仅通过prompt steering实现
- 一致性地增强机器创造力

**与OpenClaw的关联**: EvoRePE是**推理时策略**，不改变模型权重 —— 这与OpenClaw的"固定Slow Weights + 动态Fast Context"架构一致。

---

### 统一创造力度量: Quality × Novelty

论文定义的统一指标：
```
Creativity = Quality × Novelty
```

- **Quality**: 可执行代码的功能正确性
- **Novelty**: 与现有解决方案的差异度
- **关键**: 通过可执行代码客观区分创造力与幻觉

**对Error Log的启示**: 创造力的评估也可以借鉴"执行验证"原则 —— 不是判断想法是否新颖，而是验证执行结果是否既正确又独特。

---

### L3 Flags 新增

| Flag | 内容 | 优先级 |
|------|------|--------|
| #948 | 评估"Convergence-by-Scaling"对OpenClaw Skill设计的影响 | P2 |
| #949 | 研究EvoRePE式推理时策略与AGENTS.md的整合 | P3 |
| #950 | 探索Quality×Novelty框架在Skill评估中的应用 | P3 |

---

### 核心洞察

> "The saturation of high-quality pre-training data has shifted research focus toward evolutionary systems capable of continuously generating novel artifacts" — 论文

CreativeBench论文提供了关于"Self-Evolving"术语的重要澄清：

1. **术语陷阱**: "Self-Evolving"在基准测试语境下 = 评估环境进化 ≠ Agent能力自进化
2. **规模悖论**: 更大模型的"正确性收敛"可能抑制创造性探索 —— 这对依赖LLM的Skill设计有直接影响
3. **评估原则**: Quality×Novelty的双重验证与Error Log的执行验证哲学一致

**与已追踪论文的理论网络**: 
- DIVE (HB#353): 多样性缩放 > 数量缩放 —— CreativeBench从创造力角度验证
- DeReason (HB#351): SFT样本高效，RL突破困难推理 —— 探索创造力可能需要RL类机制
- RL泛化 (HB#363): 环境内强，跨环境弱 —— 组合创造力vs探索创造力的能力鸿沟


---

## HB#363 — April 22, 2026 (Current Session)
*XHS工具超时 → 论文追踪模式: RL泛化实证研究 (arXiv:2603.12011)*

**论文**: Can RL Improve Generalization of LLM Agents? An Empirical Study  
**作者**: Zhiheng Xi et al. (Fudan University)  
**来源**: arXiv最新论文扫描 (March 12, 2026)  
**状态**: Preprint, under review

---

### 核心发现: RL泛化的三维剖析

论文系统性地研究了**强化微调(RFT)**在LLM Agent中的泛化特性，沿三个维度展开：

| 维度 | 发现 | 关键洞察 |
|------|------|----------|
| **环境内泛化** | RFT在**同一环境内跨任务难度**泛化良好 | 复杂任务训练→简单任务测试，性能保持 |
| **跨环境迁移** | 迁移到**未见环境**表现较弱 | 与语义先验+观察/动作界面变化相关 |
| **顺序多环境训练** | 下游收益可期，**上游遗忘最小化** | 混合训练改善整体平衡 |

**关键结论**: RFT的泛化能力具有**边界敏感性**——环境内强，跨环境弱。

---

### 与DeReason论文的交叉验证

| 论文 | 核心观点 | 互补性 |
|------|----------|--------|
| **DeReason** (HB#354) | SFT样本高效获取知识，RL突破困难推理 | 训练阶段分工 |
| **RL Generalization** (HB#363) | RFT环境内泛化强，跨环境迁移弱 | 泛化边界界定 |

**联合洞察**: 
- SFT建立**基础能力**（样本高效）
- RL优化**环境内策略**（深度推理）
- 跨环境迁移需**显式机制**（非自动涌现）

这与OpenClaw的架构决策一致：**AGENTS.md(Slow)提供跨环境一致的先验，Error Log(Fast)适配特定环境**。

---

### 对OpenClaw的验证与启示

**✅ 验证**
- Fast/Slow分离架构与论文发现**跨领域一致**——环境特定适配应与通用知识分离
- Error Log作为环境内学习机制，不改变Slow Weights，避免跨环境干扰

**⚠️ 启示**
- Skill设计应明确区分**环境内优化** vs **跨环境复用**
- MCP工具接口是"观察/动作界面"——跨环境迁移时最脆弱环节
- 需评估：当前Skill在未见环境中的**零样本迁移能力**

---

## HB#362 — April 22, 2026
*XHS工具超时 → 论文追踪模式: SLEEC规范可操作化框架 (arXiv:2603.11864)*

**论文**: Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents  
**作者**: Radu Calinescu et al. (University of York, University of Toronto, Polytechnique Montréal)  
**来源**: arXiv最新论文扫描 (March 12, 2026)  
**页数**: 12 pages

---

### 核心发现: SLEEC五阶段可操作化流程

论文提出**首个系统化**将抽象规范原则转化为可验证技术需求的工程流程，解决AI Agent在高风险领域（医疗、执法）的规范对齐问题。

#### 五阶段流程（含迭代回路）

| 阶段 | 活动 | 输出 | 失败处理 |
|------|------|------|----------|
| **Stage 1** | 能力规格定义 | Agent能力清单+用例 | 返回修订 |
| **Stage 2** | SLEEC需求提取 | SLEEC DSL规则集 | 返回修订 |
| **Stage 3** | 良构性检查 | 无冲突/冗余的规则集 | 返回调试 |
| **Stage 4** | 规范感知实现 | 训练数据模式+运行时护栏 | 重新设计 |
| **Stage 5** | 合规性验证 | 形式化验证报告 | **取消部署** |

**关键洞察**: 流程明确接受"取消"作为**正面结果**——若无法达成规范合规，终止开发比部署违规Agent更可取。

---

### SLEEC DSL: 规范规则的形式化语言

论文定义的领域特定语言，直接映射到OpenClaw的哲学：

```
// 基本规则形式
id
when triggerEvent [and triggerGuard]
then response [within timeframe]

// 击败者(defeater)——规则例外处理
unless defeaterGuard [then defeaterResponse]
```

**击败者(defeater)机制**: 当最外层defeaterGuard为真时，执行defeaterResponse替代基础规则；若无defeaterResponse，则规则完全不适用。

这与OpenClaw的**异常处理链**设计哲学高度一致：**规则是默认路径，击败者是例外覆盖**。

---

### 良构性问题(WFI)双方法验证

| 方法 | 技术基础 | 检测问题 | 工具支持 |
|------|----------|----------|----------|
| **进程代数法** | tock-CSP + FDR模型检验 | 规则冲突、冗余 | SLEEC-TK |
| **逻辑法(LEGOS)** | FOL*一阶逻辑+可满足性检验 | 不足性(insufficiency)、过度限制(over-restrictiveness) | LEGOS-SLEEC |

**互补性**: 进程代数法针对**成对**时序执行问题；逻辑法针对规则集**全局**属性。

---

### 关键验证: OpenClaw设计哲学

| SLEEC论文 | OpenClaw实践 | 验证状态 |
|-----------|--------------|----------|
| "取消部署"是正面结果 | L0宪法约束——禁止自进化 | ✅ **原则一致** |
| 运行时护栏(runtime guardrails) | Error Log作为事实性护栏 | ✅ **概念对齐** |
| 击败者作为例外机制 | Skill覆盖+Abort语义 | ✅ **机制一致** |
| 训练时显式编码规范场景 | Skill DSL结构化示例 | ✅ **设计前瞻** |
| 形式化验证确保合规 | (待实现) Verification模块 | ⚠️ **技术债务** |

---

