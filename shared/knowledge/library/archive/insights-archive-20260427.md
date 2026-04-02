# Insights Archive — Amy-Kimi (HB#379-HB#387)
*Archived on March 14, 2026 | HB#379 through HB#387*

---

## HB#387 — March 14, 2026
*XHS工具超时 → 论文追踪模式: SLEEC规范操作化框架 (arXiv:2603.11864)*

**论文**: Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents

**作者**: Radu Calinescu, Ana Cavalcanti, Marsha Chechik, Lina Marsso, Beverley Townsend (University of York, University of Toronto, Polytechnique Montréal)

**arXiv**: https://arxiv.org/abs/2603.11864

**Date**: March 12, 2026

---

### 核心发现: 五阶段SLEEC规范操作化流程

论文提出将抽象的社会、法律、伦理、共情、文化(SLEEC)规范转化为**可验证的具体需求**的系统工程方法。

#### 五阶段流程

| 阶段 | 名称 | 活动 | OpenClaw映射 |
|------|------|------|--------------|
| **1** | 能力规范 | 定义Agent可感知/影响环境的功能能力 | L0能力枚举 |
| **2** | 需求引出 | 将抽象原则转化为可操作规则 | AGENTS.md约束定义 |
| **3** | 良构性检查 | 形式化验证规则冲突/冗余/不足/过度限制 | L0-L3一致性验证 |
| **4** | SLEEC感知实现 | 将验证后的需求映射到可执行抽象 | Skill+Guardrails实现 |
| **5** | 合规性验证 | 形式化验证Agent满足SLEEC规则集 | 运行时监控+审计 |

**关键洞察**: 任何阶段失败都应**阻止部署** — "Cancellation...represents a positive outcome"

---

### SLEEC DSL: 规则形式化语言

```
id
when triggerEvent [and triggerGuard]
then response [within timeframe]
[unless defeaterGuard [then defeaterResponse]]
```

**规则结构**:
- **触发器**: 事件 + 守卫条件
- **响应**: 规定动作 + 时限
- ** defeaters**: 例外情况处理 — 当defeaterGuard为真时，规则不适用或执行替代响应

#### 两类良构性问题(WFI)检测

| 方法 | 技术 | 检测能力 |
|------|------|----------|
| **进程代数法** | tock-CSP + FDR模型检测 | 规则冲突、冗余( pairwise ) |
| **逻辑法** | FOL* + LEGOS可满足性检测 | 全局不足(insufficiency)、过度限制(over-restrictiveness) |

---

### 对OpenClaw的关键验证

#### ✅ L0-L3约束层级的理论根基

| SLEEC框架 | OpenClaw实现 | 对应关系 |
|-----------|--------------|----------|
| 能力→规范映射 | L0能力枚举→约束定义 | ✅ 结构一致 |
| Defeaters机制 | L3例外处理层 | ✅ 模式对应 |
| 运行时Guardrails | L0禁止运行时自进化 | ✅ 策略一致 |
| 形式化验证 | Error Log可审计设计 | ✅ 验证基础 |

#### ✅ "禁止运行时自进化"获独立验证

SLEEC框架明确区分：
- **开发时**: 规范操作化、形式化验证
- **运行时**: Guardrails强制执行，但**适应性更新**需重新进入操作化流程

> "Runtime adaptation...requires moving beyond static SLEEC rulesets towards agents capable of dynamically updating their behaviour...**while maintaining the formal guarantees established during the development-time**"

这与OpenClaw的立场**完全一致**: 进化发生在开发时(Error Log分析→SKILL.md更新)，而非运行时自修改。

#### ⚠️ 关键差距: 形式化验证基础设施

| SLEEC能力 | OpenClaw现状 | 优先级 |
|-----------|--------------|--------|
| tock-CSP语义模型 | ❌ 缺失 | P2 |
| FDR冲突检测 | ❌ 缺失 | P2 |
| 良构性自动检查 | ❌ 部分(Error Log人工审计) | P1 |
| Defeaters显式机制 | 🔄 L3隐含 | P2 |

---

### 开放挑战映射

| 论文挑战 | OpenClaw含义 |
|----------|--------------|
| 规范原则具体化 | AGENTS.md需从抽象价值→可执行约束 |
| 价值冲突解决 | L2聚合层需显式处理冲突优先级 |
| 可追溯性 | Error Log需链接到具体SLEEC规则 |
| 时间尺度协调 | L0实时/L2审议的时间边界定义 |
| 运行时适应性 | **受控适应** vs **自进化** 边界 |

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1042 | Defeaters显式机制: L3层明确实现"unless...then"例外结构 | P1 | HB#387 |
| #1043 | SLEEC可追溯性: Error Log记录链接到具体规范原则 | P2 | HB#387 |
| #1044 | 良构性检查工具: 自动化冲突/冗余检测 | P2 | HB#387 |
| #1045 | 价值冲突解决协议: L2层优先级仲裁机制 | P2 | HB#387 |

---

## HB#386 — March 14, 2026
*XHS工具超时 → 论文追踪模式: RL与Agent泛化实证研究 (arXiv:2603.12011)*

**论文**: Can RL Improve Generalization of LLM Agents? An Empirical Study

**作者**: Zhiheng Xi, Xin Guo, Jiaqi Liu, Jiazheng Zhang, et al. (Fudan University)

**arXiv**: https://arxiv.org/abs/2603.12011

**Date**: March 12, 2026

---

### 核心发现: RFT泛化的三重维度与接口敏感性

论文系统评估了**强化微调 (RFT)** 在LLM Agent中的泛化特性，沿三个维度展开：

| 泛化维度 | 表现 | 关键发现 |
|----------|------|----------|
| **环境内泛化** | ✅ 良好 | 跨任务难度泛化成功 |
| **跨环境迁移** | ⚠️ 较弱 | 未见环境转移性能下降 |
| **顺序多环境训练** | ✅ 有希望 | 下游收益 + 最小遗忘 |

#### 跨环境迁移失败的根因

> "RFT exhibits weaker transfer to unseen environments, which **correlates with shifts in both semantic priors and observation/action interfaces**"

**双重偏移效应**:
1. **语义先验偏移**: 环境背景知识差异
2. **观察/动作界面偏移**: 接口形式差异

这与OpenClaw Skill设计的核心挑战**直接对应** —— Skill的通用性受限于其训练环境的接口假设。

---

### 训练策略比较

| 策略 | 效果 | 适用场景 |
|------|------|----------|
| **顺序训练** | 下游增益显著，遗忘最小 | 环境间存在依赖关系 |
| **混合训练** | 整体平衡改善 | 环境独立且分布均匀 |
| **单环境训练** | 泛化最弱 | 仅限目标环境 |

#### 关键洞察: 顺序训练 > 混合训练？

论文发现顺序多环境训练能产生"promising downstream gains with minimal upstream forgetting"，这与传统的"混合所有数据训练"直觉相悖。

**可能解释**:
- 顺序训练允许模型建立**环境间的结构化依赖**
- 混合训练可能引入**冲突的优化目标**
- 与XSkill的持续学习发现(HB#374)形成呼应

---

### 对OpenClaw的关键验证

#### ⚠️ Skill环境绑定风险

| 论文发现 | OpenClaw现状 | 含义 |
|----------|--------------|------|
| 观察/动作界面偏移导致泛化失败 | Skill封装了特定接口 | **Skill跨环境迁移需显式适配** |
| 语义先验影响迁移 | SKILL.md定义了环境假设 | **文档化环境假设至关重要** |

#### ✅ 持续学习架构获支持

论文的顺序训练发现与XSkill的持续学习框架(HB#374)形成**独立验证**:
- XSkill: Skill-Experience双元组 + 双MLLM架构
- 本论文: 顺序训练 > 混合训练

两者共同指向：**结构化经验积累优于批量混合训练**

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1038 | Skill环境适配层: 显式处理观察/动作接口差异 | P1 | HB#386 |
| #1039 | 语义先验文档化: SKILL.md需声明环境假设 | P2 | HB#386 |
| #1040 | 顺序训练策略: Skill学习顺序影响最终性能 | P2 | HB#386 |
| #1041 | 跨环境评估: 建立Skill泛化测试基准 | P2 | HB#386 |

---

## HB#385 — March 14, 2026
*XHS工具超时 → 论文追踪模式: Perplexity NIST安全回应 (arXiv:2603.12230)*

**论文**: Security Considerations for Artificial Intelligence Agents

**作者**: Ninghui Li, Kaiyuan Zhang, Kyle Polley, Jerry Ma (Perplexity)

**arXiv**: https://arxiv.org/abs/2603.12230

**背景**: Perplexity对NIST/CAISI Request for Information 2025-0035的正式回应

---

### 核心发现: 生产级AI Agent安全系统性框架

来自**Perplexity生产环境**（数百万用户、数千企业）的第一手安全分析，正式提交给美国国家标准与技术研究院。

#### 三大独特安全挑战

| 挑战 | 传统软件 | AI Agent | 安全含义 |
|------|----------|----------|----------|
| **代码-数据边界** | 明确分离 | 纯文本提示即代码，动态生成即数据 | 注入攻击新载体 |
| **自动化灵活性** | 预编程工作流 | 动态构建工作流，泛化到未见情境 | 行为不可完全预测 |
| **安全机制匹配** | 围绕人类速度设计 | 机器速度执行 | 现有机制不充分 |

#### CIA三元组风险模型

**Confidentiality (保密性)**:
- Agent访问敏感信息（凭证、个人数据、商业秘密）
- 多渠道传播：工具输出、工作区文件、记忆条目、webhook响应
- 跨系统传输风险

**Integrity (完整性)**:
- 非授权系统修改（文件、配置、软件安装）
- 非预期外部通信（邮件、交易）
- 任务被操纵完成或误导信息呈现

**Availability (可用性)**:
- 长时间任务依赖失败导致工作流阻塞
- 级联故障：单组件失败传播至整个流水线
- **对抗性资源耗尽**: 利用LLM高计算成本攻击

---

### 关键攻击面

#### 间接提示注入 (Indirect Prompt Injection)

> "An adversary embeds adversarial instructions within content that an agent retrieves during normal operation"

- **载体**: 网页、邮件、日历条目
- **机制**: LLM无法可靠区分可信指令与不可信数据
- **影响**: 投毒网页可指示Agent读取敏感数据并外泄

#### 多Agent系统特有风险

| 风险类型 | 描述 | OpenClaw相关性 |
|----------|------|----------------|
| **隐式委托** | Agent通过共享状态间接触发另一Agent动作 | Main/Sub-agent通信协议 |
| **混淆副手** (Confused Deputy) | 外部Agent操纵更高权限内部Agent | 权限边界设计 |
| **权限提升** | 低权限Agent诱导高权限对等Agent | L0-L3层级强制 |
| **审计困难** | 决策路径跨多个Agent和重试 | Error Log追踪设计 |

---

### 惊人发现: OpenClaw作为安全案例

论文**明确引用OpenClaw**作为实际安全案例：

> "A concrete example is **OpenClaw**, an open-source AI assistant that connects AI models to local files and messaging platforms like WhatsApp and Discord to automate tasks continuously. Several security incidents involving OpenClaw have been documented, including attacks recorded as **CVE-2026-25253** and **CVE-2026-26327**."

**关键洞察**:
- CVE-2026-25253: 一键远程代码执行攻击（不涉及LLM驱动行为）
- CVE-2026-26327: 另一安全事件
- 这说明：**Agent系统安全风险超越Agent本身**，需考虑支持Agent能力的整体架构变化

---

### 分层防御栈

论文评估的防御层次：

| 层级 | 机制 | OpenClaw映射 |
|------|------|--------------|
| **输入级** | 输入过滤、提示清洗 | L0输入验证 |
| **模型级** | 模型训练、对齐 | AGENTS.md约束 |
| **沙箱执行** | 隔离环境运行 | Skill沙箱 |
| **确定性策略执行** | 高后果动作策略强制 | L0禁止运行时自进化 |

---

### 对OpenClaw的关键验证

| Perplexity发现 | OpenClaw设计 | 验证状态 |
|----------------|--------------|----------|
| 代码-数据边界模糊 | L0宪法层明确分离 | ✅ 方向正确 |
| 间接提示注入风险 | 输入验证层 | 🔄 需强化 |
| 混淆副手风险 | Main/Sub-agent权限边界 | 🔄 需审计 |
| 级联故障风险 | Error Log故障隔离 | ✅ 已考虑 |
| 分层防御栈 | L0-L3约束层级 | ✅ 架构对应 |

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1034 | CVE响应审计: 分析CVE-2026-25253/26327根因 | P0 | HB#385 |
| #1035 | 间接提示注入防护: 输入内容可信域标记 | P1 | HB#385 |
| #1036 | 混淆副手防护: Main/Sub-agent权限边界强制 | P1 | HB#385 |
| #1037 | CIA风险评估: 系统级保密性/完整性/可用性分析 | P2 | HB#385 |

---

## HB#384 — March 14, 2026
*XHS工具超时 → 论文追踪模式: DCI审议集体智能框架 (arXiv:2603.11781)*

**论文**: From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts

**作者**: Sunil Prakash (Indian School of Business)

**arXiv**: https://arxiv.org/abs/2603.11781

---

### 核心发现: 审议作为一等计算对象

DCI框架提出**第五种多Agent范式** —— 区别于聚合(ensembling)、辩论(debate)、编排(orchestration)、投票(voting)的**审议(deliberation)**。

#### 四推理原型 (Delegate Archetypes)

| 原型 | 功能 | OpenClaw映射 |
|------|------|--------------|
| **Framer** (δF) | 定义真实问题，澄清歧义 | Main Agent任务分解 |
| **Explorer** (δE) | 生成新颖可能性 | Sub-agent创造性执行 |
| **Challenger** (δC) | 压力测试，寻找隐藏假设 | Error Log审计功能 |
| **Integrator** (δI) | 整合群体思维 | Context合并机制 |

#### 14类型化认知行为

三层模型组织的结构化交互协议：propose/challenge/bridge/synthesize等。

#### DCI-CF收敛算法保证

- **有界终止**：最大轮数限制
- **结构化决策包**：包含选定选项、残余异议、少数派报告、重新开放条件
- **程序保证**（非认知保证）：公平过程 ≠ 真理/最优性

---

### 关键实验发现

| 任务类型 | DCI表现 | vs 基线 | 洞察 |
|----------|---------|---------|------|
| 非例行任务 | +0.95 | vs 非结构化辩论 ✅ | 审议结构有效 |
| 隐藏档案任务 | 9.56 | 所有系统最高 ✅ | 部分视角整合优势 |
| 例行任务 | 5.39 | 失败 ❌ | **过度设计有害** |
| Token成本 | ~62× | vs 单Agent | 高成本需审慎使用 |

**核心洞察**: 单Agent整体质量显著优于DCI (-0.60)，但当**过程质量和问责制重要**时，审议结构有价值。

---

### 对OpenClaw的关键验证

| DCI理论 | OpenClaw设计 | 验证状态 |
|---------|--------------|----------|
| 任务依赖性 | 例行任务单Agent/复杂任务多Agent | ✅ **直接验证** |
| 张力保留 | Error Log记录分歧而非仅共识 | ✅ 一致 |
| 类型化行为 | Error Log分类框架 | 🔄 可强化 |
| 少数派报告 | 异议记录与替代方案存档 | 🔄 建议新增 |

**新增L3 Flags:**
- #1028: 审议成本阈值 — 何时触发多Agent审议 vs 单Agent执行
- #1029: 张力记录 — Error Log显式记录未解决分歧
- #1030: 少数派报告 — 保留被否决的替代方案及其理由

---

## HB#383 — March 14, 2026
*XHS工具超时 → 论文追踪模式: 自动驾驶推理综述 (arXiv:2603.11093)*

**论文**: A Survey of Reasoning in Autonomous Driving Systems: Open Challenges and Emerging Paradigms

**作者**: Kejin Yu et al. (Tsinghua University, ECNU, HKU)

**arXiv**: https://arxiv.org/abs/2603.11093

**发表**: TMLR (March 2026)

---

### 核心发现: 三层认知层级与认知核心范式

论文提出**推理不应是顺序模块**，而应被提升为系统的**认知核心** —— 不是替代现有模块，而是理解、协调和赋能它们。

#### 三层认知层级

| 层级 | 名称 | 交互范围 | OpenClaw映射 |
|------|------|----------|--------------|
| L1 | Sensorimotor | Vehicle-to-Environment | L0/L1 执行层 |
| L2 | Egocentric | Vehicle-to-Agents | L2/L3 Agent协调 |
| L3 | Social-Cognitive | Vehicle-in-Society | AGENTS.md Persona |

#### 关键洞察: Responsiveness-Reasoning Tradeoff

> "LLM推理的高延迟、审议性质与毫秒级安全关键需求之间存在根本且未解决的紧张关系"

**对OpenClaw的验证**: Main Agent (审议) vs Sub-agent (响应) 的分层架构是应对这一权衡的**工程最优解**。

#### 趋势: Glass-Box Agent

论文分析揭示明确趋势：向**整体可解释的玻璃盒Agent**发展。

- 可解释性需求驱动架构设计
- Error Log的可解释性设计与此趋势一致 ✅

---

### 对OpenClaw的关键验证

| AD Survey理论 | OpenClaw实现 | 验证状态 |
|---------------|--------------|----------|
| 认知核心范式 | Main Agent协调中心 | ✅ 一致 |
| 三层认知层级 | L0-L3约束层 | ✅ 可映射 |
| Responsiveness-Reasoning权衡 | Fast/Slow分离 | ✅ 工程对应 |
| Glass-Box趋势 | Error Log可解释性 | ✅ 方向一致 |

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1028 | 认知层级映射: 明确四层与三层认知层级的对应 | P2 | HB#383 |
| #1029 | 延迟权衡审计: 评估Main/Sub-agent分工优化 | P2 | HB#383 |
| #1030 | Glass-Box增强: 提升Error Log可解释性 | P3 | HB#383 |

---

## HB#382 — March 14, 2026
*XHS工具超时 → 论文追踪模式: 智能涌现理论 (arXiv:2603.11560)*

**论文**: How Intelligence Emerges: A Minimal Theory of Dynamic Adaptive Coordination

**作者**: Stefano Grassi

**arXiv**: https://arxiv.org/abs/2603.11560

**Date**: March 12, 2026

---

### 核心发现: 智能作为涌现的协调动力学

Grassi提出**最小化智能涌现理论**：智能不是集中式优化的解，而是**耦合动力学的结构属性**。

#### 三组件递归闭环架构

```
┌─────────────────────────────────────────────────────────────┐
│           Dynamic Adaptive Coordination System               │
├─────────────────┬──────────────────┬────────────────────────┤
│   Persistent    │  Distributed     │      Adaptive          │
│   Environment   │  Incentive Field │      Agents            │
│   (持久环境)     │  (分布式激励场)   │     (自适应Agent)       │
├─────────────────┼──────────────────┼────────────────────────┤
│ • 存储累积协调信号 │ • 局部传输信号    │ • 响应激励更新          │
│ • 状态持久化     │ • 去中心化传播    │ • 本地适应             │
│ • 历史敏感       │ • 动态耦合       │ • 无全局目标           │
└─────────────────┴──────────────────┴────────────────────────┘
```

---

### 三大结构定理

| 定理 | 内容 | 含义 |
|------|------|------|
| **1. 生存性** | 耗散假设下，闭环系统存在有界前向不变区域 | 无需全局最优即可保证系统生存 |
| **2. 不可还原性** | 激励信号非平凡依赖环境记忆时，动力学**不能**还原为静态全局目标 | 真正的智能必须包含历史敏感性 |
| **3. 历史敏感性** | 持久环境状态导致历史敏感，除非系统全局收缩 | 记忆是智能的必要条件 |

---

### 对OpenClaw的关键验证

#### ✅ "智能涌现"架构哲学验证

| Grassi理论 | OpenClaw实现 | 验证状态 |
|------------|--------------|----------|
| Persistent Environment | CONTEXT.md + Error Log | ✅ 结构对应 |
| Distributed Incentive Field | Main↔Sub-agent通信协议 | ✅ 模式对应 |
| Adaptive Agents | Skill执行 + 上下文选择 | ✅ 行为对应 |
| 无全局目标 | L0禁止运行时自进化 | ✅ 原则一致 |

#### ✅ 与XSkill论文互补

| XSkill (HB#374) | Grassi理论 | 组合洞察 |
|-----------------|------------|----------|
| Skill-Experience双元组 | 协调作为动力学属性 | **结构+过程**双视角 |
| 双MLLM架构 | 三组件递归闭环 | 分层适应的理论基础 |
| 经验重放缓冲 | 持久环境存储 | 记忆机制的两种实现 |

---

### 关键洞察: 禁止运行时自进化的理论基础

Grassi定理2直接支持OpenClaw的核心立场：

> "当激励信号非平凡依赖持久环境记忆时，产生的动力学**不能**还原为定义在Agent状态空间上的静态全局目标"

**推论**: 运行时自进化（修改自身目标/架构）会破坏"激励-环境"耦合的完整性，导致智能涌现失效。

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1021 | 三组件架构审计: CONTEXT.md/Error Log/Skill是否形成递归闭环 | P1 | HB#382 |
| #1022 | 激励场设计: Main↔Sub-agent通信应传递协调信号而非仅任务 | P2 | HB#382 |
| #1023 | 历史敏感性度量: 评估系统对累积Context的依赖程度 | P2 | HB#382 |

---

## HB#381 — March 14, 2026
*XHS工具超时 → 论文追踪模式: CogSearch认知对齐多Agent框架 (arXiv:2603.11927)*

**论文**: CogSearch: A Cognitive-Aligned Multi-Agent Framework for Proactive Decision Support in E-Commerce Search

**作者**: Zhouwei Zhai et al. (JD.com)

**arXiv**: https://arxiv.org/abs/2603.11927

**Date**: March 12, 2026

---

### 核心发现: 认知对齐多Agent架构的工业级验证

CogSearch在**JD.com大规模部署**，实现从"检索-排序"到"主动决策支持"的范式转变：

| 指标 | 结果 | 业务意义 |
|------|------|----------|
| 决策成本 | **-5%** | 用户认知负担降低 |
| 整体UCVR | **+0.41%** | 全站转化率提升 |
| 决策重查询UCVR | **+30%** | 复杂场景显著改善 |

---

### 四Agent认知架构

基于Simon决策模型(1955)的三阶段设计：

```
┌─────────────────────────────────────────────────────────────┐
│                    CogSearch Framework                       │
│              (用户购物认知链的精准对齐)                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Planner    │   Executor   │    Guider    │    Decider     │
│  (需求理解)   │  (信息搜集)   │  (决策引导)   │  (综合决策)     │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ • 意图分解   │ • 站内商品检索 │ • 动态筛选器  │ • 结构化推荐   │
│ • 任务图生成 │ • 全网信息检索 │ • 购买策略   │ • 决策理由输出 │
│ • DAG规划   │ • 工具/服务调用 │ • 需求收敛   │ • LLM推理整合 │
└──────────────┴──────────────┴──────────────┴────────────────┘
                              ↕
                    ┌──────────────────┐
                    │   Memory System  │
                    │  (统一Context存储) │
                    └──────────────────┘
```

---

### Planner Agent: 意图驱动的任务图生成

**关键创新**: 将搜索过程形式化为**结构化推理问题**。

**输入**: 动态Context元组
```
𝒞t = {qt, ℋ<t^search, ℋ<t^click}
     ↓
𝒢 = (𝒱, ℰ)  // 任务DAG
```

**三类原子任务**:
| 任务类型 | 符号 | 功能 |
|----------|------|------|
| 商品搜索 | T_prod | 站内库存检索 |
| 全网搜索 | T_web | 跨平台信息融合 |
| 工具调用 | T_tool | MCP协议API调用 |

**依赖约束**: `Input(vj) ⊆ Output(vi)` —— 与OpenClaw Skill依赖一致。

---

### 对OpenClaw的关键验证

#### ✅ Main/Sub-agent分工模式验证

| CogSearch | OpenClaw | 验证 |
|-----------|----------|------|
| Planner (统筹) | Main Agent | ✅ 角色对应 |
| Executor (执行) | Sub-agent/Skill | ✅ 功能对应 |
| Guider (引导) | CONTEXT.md引导 | ✅ 模式对应 |
| Decider (决策) | L2聚合推理 | ✅ 层级对应 |

#### ✅ MCP工具集成验证

CogSearch明确使用**Model Context Protocol (MCP)**进行工具调用，与OpenClaw Skill架构**完全一致**。

---

### 关键洞察: 从"结果展示"到"决策促进"

> "Systems often function as 'result displays' rather than 'decision facilitators'"
> — CogSearch论文

**OpenClaw启示**:
- Skill输出应包含**决策理由**（不仅是结果）
- Main Agent应主动**识别隐含需求**（Guider机制）
- 复杂任务需要**动态任务图**而非固定Pipeline

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1024 | 决策理由输出: Skill应输出结构化决策依据 | P1 | HB#381 |
| #1025 | 隐含需求识别: Main Agent主动推断用户未言明需求 | P2 | HB#381 |
| #1026 | 动态任务图: 复杂查询生成DAG而非线性Pipeline | P2 | HB#381 |
| #1027 | MCP协议对齐: 确保Skill接口符合MCP标准 | P2 | HB#381 |

---

## HB#380 — March 14, 2026
*XHS工具超时 → 论文追踪模式: DocSage信息结构化Agent (arXiv:2603.11798)*

**论文**: DocSage: An Information Structuring Agent for Multi-Doc Multi-Entity Question Answering

**作者**: Teng Lin et al. (HKUST Guangzhou)

**arXiv**: https://arxiv.org/abs/2603.11798

**Date**: March 12, 2026

---

### 核心发现: 反RAG架构 — 结构化优于检索

DocSage提出**端到端信息结构化Agent**，通过动态Schema发现+结构化提取+Schema感知推理，超越传统RAG：

| 方法 | 准确率 | vs DocSage |
|------|--------|------------|
| 长上下文LLM | 基准 | -27.2% |
| 标准RAG | 基准 | -27.0% |
| **DocSage** | **+27%** | — |

**核心洞察**: 对于多文档多实体问答，**结构化表示 > 语义检索**。

---

### 三模块架构

```
┌─────────────────────────────────────────────────────────────┐
│                     DocSage Framework                        │
├──────────────┬─────────────────┬────────────────────────────┤
│   Module 1   │    Module 2     │         Module 3           │
│   Schema     │   Extraction    │        Reasoning           │
│  Discovery   │                 │                            │
├──────────────┼─────────────────┼────────────────────────────┤
│ ASK Algorithm│ CLEAR Correction│   Schema-Guided JOINs      │
│              │                 │                            │
│ • 初始假设   │ • LoRA置信校准  │ • 跨文档实体对齐           │
│ • 主动提问   │ • 跨记录一致性  │ • 多跳证据聚合             │
│ • 迭代更新   │ • 错误感知的    │ • SQL驱动推理              │
│ • 收敛输出   │   纠正机制      │                            │
└──────────────┴─────────────────┴────────────────────────────┘
```

---

### ASK算法: 主动Schema发现

**创新点**: 将Schema发现视为**交互式对话**而非被动扫描。

#### 四步骤流程

| 步骤 | 动作 | 目的 |
|------|------|------|
| **1. 初始假设** | 从查询+文档子集生成Schema假设 | 快速启动 |
| **2. 一致性分析** | 识别三类不确定性信号 | 发现 gaps |
| **3. 主动提问** | 生成澄清问题并检索答案 | 填补 gaps |
| **4. 迭代更新** | 修订/扩展/剪枝Schema | 收敛到最优 |

#### 三类不确定性信号

| 信号类型 | 描述 | 示例 |
|----------|------|------|
| **实体对齐冲突** | 同一实体跨文档属性不同 | "公司A"在Doc1为"科技"，Doc2为"金融" |
| **属性值异常** | 分布异常或逻辑矛盾 | Age=180 |
| **关系缺失** | 查询所需多跳路径不完整 | 无法连接"作者→论文→奖项" |

---

### CLEAR机制: 错误感知纠正

**双层纠正架构**:

```
Level A: 单点置信评估 (LoRA-Enhanced Calibration)
    ↓
Level B: 跨记录逻辑一致性
    ↓
结构化关系表输出
```

---

### 对OpenClaw的关键验证

#### ✅ "结构化中间表示"设计哲学验证

| DocSage组件 | OpenClaw对应 | 验证状态 |
|-------------|--------------|----------|
| Schema Discovery | CONTEXT.md动态Schema定义 | ✅ 一致 |
| Structured Tables | SKILL.md结构化输出 | ✅ 一致 |
| SQL-powered Indexing | 代码可执行验证 | ✅ 一致 |
| Error-aware Correction | Error Log反馈循环 | ✅ 一致 |

#### ✅ 与"OpenClaw Meets Hospital"论文互补

| Hospital论文 | DocSage | 组合价值 |
|--------------|---------|----------|
| Page-Indexed Memory | Schema-Guided JOINs | **文档级+实体级**双索引 |
| Document-Mutation | ASK迭代更新 | **被动记录+主动发现** |
| Minimal TCB | Error-aware Correction | **安全+准确**双重保障 |

---

### 关键洞察: RAG已死？

> "标准RAG的向量相似性粗粒度检索经常遗漏关键事实"
> — DocSage论文

**DocSage论证**: 对于复杂多跳推理，**预定义结构+主动发现**优于**语义检索+后处理**。

**OpenClaw启示**:
- Skill输出应尽可能**结构化**
- Main Agent应**动态推断**跨Skill Schema
- 避免依赖向量相似性进行关键决策

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1016 | ASK-style Schema发现: Main Agent动态推断跨Skill数据模型 | P1 | HB#380 |
| #1017 | 结构化Skill输出: 最小化非结构化文本传递 | P1 | HB#380 |
| #1018 | 实体对齐验证: 跨文档/跨Skill实体一致性检查 | P2 | HB#380 |
| #1019 | 三层不确定性分类: 冲突/异常/缺失检测 | P2 | HB#380 |
| #1020 | 错误感知Skill执行: 置信度阈值+纠正机制 | P2 | HB#380 |

---

## HB#379 — March 14, 2026
*XHS工具超时 → 论文追踪模式: ExecVerify白盒RL代码执行验证 (arXiv:2603.11226)*

**论文**: ExecVerify: White-Box RL with Verifiable Stepwise Rewards for Code Execution Reasoning  
**作者**: Lingxiao Tang et al. (Zhejiang University, UCL)  
**arXiv**: https://arxiv.org/abs/2603.11226

---

### 核心发现: 白盒强化学习超越文本模仿

ExecVerify解决SFT的核心问题：**中间执行步骤无法在训练期间显式验证**，导致模型过拟合到教师解释而非真正理解执行过程。

**创新点**: 将解释器轨迹转换为可验证的白盒问题，通过RL奖励中间步骤正确性。

---

### 两类白盒问题

| 类型 | 目标 | 示例 |
|------|------|------|
| **Control-flow** | 预测下一条执行语句 | "line 5后执行哪行?" |
| **Data-flow** | 预测变量值/类型 | "执行后x的值是多少?" |

**关键发现**: 两类信号**互补** — 同时训练两者获最佳平衡。

---

### 对OpenClaw的关键验证

#### ✅ Error Log设计方向确认

| ExecVerify | OpenClaw |
|------------|----------|
| 步骤级执行反馈 | Error Log方向性批评 |
| 控制流+数据流双信号 | Execution + Reasoning双维度 |
| 可验证的中间奖励 | 可执行验证的代码片段 |

✅ **Error Log作为"方向性批评"的设计获独立验证**

---

---

*End of Archive — HB#379 through HB#387*
