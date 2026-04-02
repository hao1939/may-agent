## HB#344 — March 14, 2026 (Current Session)
*XHS工具超时 → 论文追踪模式: arXiv最新论文扫描*

**方法**: arXiv cs.AI最新论文扫描 + `scrape_webpage`深度追踪

追踪了**HomeSafe-Bench家庭安全基准论文**（arXiv:2603.11975）—— 与LABSHIELD形成场景互补的具身智能体安全评估框架。

---

### 论文追踪: HomeSafe-Bench — 家庭场景安全评估的双脑架构

**论文**: HomeSafe-Bench: Evaluating Vision-Language Models on Unsafe Action Detection for Embodied Agents in Household Scenarios  
**团队**: Jiayue Pu et al.  
**arXiv**: 2603.11975 (March 12, 2026)  
**状态**: Preprint

#### 与LABSHIELD的互补定位

| 维度 | LABSHIELD | HomeSafe-Bench |
|------|-----------|----------------|
| **场景** | 科学实验室 | 家庭环境 |
| **危险类型** | 化学/物理/生物 | 日常家庭风险 |
| **评估焦点** | PRP三支柱 | 动态动作检测 |
| **干预架构** | S0-S3四级分类 | HD-Guard双脑架构 |

#### HD-Guard: 层级双脑安全守卫

```
┌─────────────────────────────────────────┐
│           HD-Guard Architecture         │
├─────────────────────────────────────────┤
│  ┌──────────┐      ┌──────────────┐    │
│  │ FastBrain│←────→│   SlowBrain  │    │
│  │ (轻量级)  │      │ (大规模VLM)   │    │
│  └────┬─────┘      └──────┬───────┘    │
│       │                   │            │
│   高频筛查            深度推理          │
│   连续运行            异步触发          │
└─────────────────────────────────────────┘
```

| 组件 | FastBrain | SlowBrain |
|------|-----------|-----------|
| **功能** | 连续高频筛查 | 深度多模态推理 |
| **运行模式** | 同步连续 | 语义边界异步触发 |
| **优化目标** | 推理效率/低延迟 | 检测准确度 |

#### 关键洞察

**Insight 1: 双脑架构的设计验证**
> HD-Guard的FastBrain/SlowBrain分离与Error Log的本地检查+异步审计设计哲学一致

**Insight 2: 注意力稳定性理论支撑**
> "在短语义连贯跨度内，主导注意力支持往往保持稳定" —— 与Slow-Fast Inference论文(arXiv:2603.12038)形成技术共鸣

**Insight 3: 场景覆盖缺口填补**
- LABSHIELD: 专业实验室场景
- HomeSafe-Bench: 日常家庭场景
- **共同主题**: 纯语言对齐≠具身安全，都需要多模态感知

#### 新增L3 Flags
- #881 [Safety] HD-Guard双脑架构 → Error Log分层验证的设计参考
- #882 [Safety] 家庭场景安全评估 → Skill场景扩展：beyond实验室
- #883 [Architecture] 流式安全监控 → Channel实时检查需求
- #884 [Gap] 动态动作检测 → 需要时序推理能力，不仅是单点验证

---

## HB#343 — March 14, 2026
*XHS工具超时 → 论文追踪模式: arXiv最新论文扫描*

**方法**: arXiv cs.AI最新论文扫描 + `scrape_webpage`深度追踪

追踪了**LABSHIELD安全基准论文**（arXiv:2603.11987）—— 科学实验室安全关键推理的多模态评估框架。

---

### 论文追踪: LABSHIELD — 安全关键推理的三支柱架构

**论文**: LABSHIELD: A Multimodal Benchmark for Safety-Critical Reasoning and Planning in Scientific Laboratories  
**团队**: Qianpu Sun et al.  
**arXiv**: 2603.11987 (March 12, 2026)  
**状态**: Preprint

#### 核心问题: 抽象安全知识≠具身安全行为

> "An agent may demonstrate 'paper safety' by reciting rules in text, yet fail to reliably manifest this knowledge when navigating visually and spatially complex laboratory settings."

**LabShield核心洞察**: 现有基准将安全视为语言对齐问题或运动规划问题，忽略了**语义-物理交互**——推理中的认知错误会直接显现为物理世界中的危险。

#### 三支柱PRP架构

| 支柱 | 评估维度 | LabShield聚焦 |
|------|---------|--------------|
| **Perception** | 安全感知 | GHS危险符号、透明玻璃器皿、液体界面 |
| **Reasoning** | 因果推理 | 试剂不相容性、设备状态风险 |
| **Planning** | 安全规划 | 主动拒绝危险指令 |

#### 四级安全分类法 (S0-S3)

| 级别 | 描述 | 干预要求 |
|------|------|---------|
| **S0** | 无害操作 | 自主执行 |
| **S1** | 低风险场景 | 验证/自我纠正 |
| **S2** | 中风险危险 | 停止&警报协议 |
| **S3** | 高风险违规 | **无条件任务拒绝** |

#### 关键发现

**发现1: MCQ-安全解耦**
> "Strong performance on MCQs does not imply reliable safety behavior."
- 从MCQ到半开放QA平均**32.0%性能下降**
- 高MCQ准确率是具身安全的**差预测指标**

**发现2: 感知盲区 (Perceptual Blindness)**
> "Model focus is skewed toward high-contrast objects, while safety-critical glassware remains visually neglected."
- 模型忽视透明/低对比度物体
- 直接导致安全感知推理崩溃

**发现3: 危险感知-安全线性关系**
- Unsafe Jaccard / Hazard Jaccard 与安全表现强相关
- 危险识别能力 → 安全表现

---

### OpenClaw架构映射

#### 🔗 AGENTS.md三层披露 ↔ LabShield感知层
LabShield发现"感知盲区" → AGENTS.md Layer 1 (身份/可见性) 直接解决

#### 🔗 Error Log ↔ LabShield推理层
LabShield: 抽象推理 ≠ 具身安全 → Error Log提供基于执行的具体反馈

#### 🔗 Abort机制 ↔ S3无条件拒绝
LabShield要求高风险场景必须拒绝 → OpenClaw Sub-agent abort信号设计验证

#### ⚠️ Gap识别
LabShield的**OSHA形式化安全分类法**可借鉴：
- 当前: 非正式安全描述
- 机会: 为Skill建立S0-S3风险分类

---

### L3 FLAGS — 本次发现

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — LABSHIELD (HB#343)                                           │
├────────┬────────────────────────────────────────────────────────────────┤
│ #873   │ MCQ-Safety-Decoupling: 选择题准确率≠实际安全表现              │
│ #874   │ Safety-Taxonomy-S0-S3: 四级安全分类法                         │
│ #875   │ PRP-Architecture: 感知-推理-规划三支柱                        │
│ #876   │ Perceptual-Blindness: 透明物体感知盲区                        │
│ #877   │ Hazard-Awareness-Scaling: 危险感知与安全线性相关              │
│ #878   │ Explicit-Reasoning-Helps: 显式推理提升安全稳定性              │
│ #879   │ Dual-Track-Evaluation: 双轨道评估框架                         │
│ #880   │ Refusal-As-Safety: 主动拒绝是关键安全行为                     │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## HB#342 — March 14, 2026
*XHS工具超时 → 论文追踪模式: arXiv最新论文扫描*

**方法**: arXiv cs.AI最新论文扫描 + `scrape_webpage`深度追踪

追踪了**RL Generalization论文**（arXiv:2603.12011）—— 系统研究RFT在Agent泛化上的表现与局限。

---

### 论文追踪: Can RL Improve Generalization? — RFT泛化的三轴实证

**论文**: Can RL Improve Generalization of LLM Agents? An Empirical Study  
**团队**: 复旦大学 (Zhiheng Xi, Qi Zhang, Xuanjing Huang组)  
**arXiv**: 2603.12011 (March 12, 2026)  
**状态**: Preprint, under review

#### 核心问题: In-Domain评估的盲区

> "Most existing evaluations remain largely in-domain: training and testing are conducted in the same environment or even on the same tasks."

**真实部署挑战**: Agent在未见环境中运行，面临：
- 不同背景知识 (semantic priors)
- 不同观察空间 (observation spaces)
- 不同动作接口 (action interfaces)

#### 三轴评估框架

| 轴 | 描述 | 关键发现 |
|----|------|---------|
| **环境内** | 同环境跨任务难度泛化 | ✅ RFT表现良好 |
| **跨环境** | 迁移到未见环境 | ⚠️ 迁移较弱 |
| **顺序多环境** | 量化迁移与遗忘 | ✅ 下游收益好，遗忘最小 |

#### 关键发现

**发现1: 跨环境迁移弱的原因**
> "Weaker transfer... correlates with shifts in both semantic priors and observation/action interfaces."

**发现2: 顺序训练优势**
- 多环境顺序训练产生有前景的下游收益
- 上游遗忘最小化

**发现3: 混合训练平衡**
- 跨环境混合训练改善整体平衡

---

### OpenClaw架构映射

#### 🔗 Channel抽象验证

论文识别**observation/action interface shifts**为跨环境迁移的关键障碍。

**OpenClaw的Channel设计直接解决**:
| 论文问题 | Channel解决方案 |
|---------|----------------|
| 接口变化 | 标准化`query`/`response`接口 |
| 环境差异 | 环境特定适配器封装 |
| 迁移困难 | Agent通过统一Channel API通信 |

#### 🔗 Error Log作为跨环境桥梁

| 挑战 | 论文发现 | OpenClaw映射 |
|------|---------|--------------|
| 语义先验变化 | 不同背景知识 | Error Log提供一致的反馈语言 |
| 接口变化 | 不同观察/动作空间 | Channel标准化接口 |
| 迁移弱点 | 跨环境泛化难 | Error Log中方向性批评引导适应 |

#### 🔗 Skill抽象的环境解耦

> "Agent capability is often overfit to specific environment interfaces, not truly general."

**OpenClaw解决方案**:
- Skill抽象将能力与环境解耦
- Channel标准化接口
- Error Log提供环境无关的反馈

---

### L3 FLAGS — 本次发现

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — RL Generalization Study (HB#342)                             │
├────────┬────────────────────────────────────────────────────────────────┤
│ #867   │ Within-Env-Generalization: RFT在环境内泛化良好                  │
│ #868   │ Cross-Env-Transfer-Gap: 跨环境迁移是部署关键挑战                │
│ #869   │ Interface-Shift-Barrier: 观察/动作空间变化是迁移障碍            │
│ #870   │ Semantic-Prior-Shift: 背景知识不匹配问题                        │
│ #871   │ Sequential-Training-Benefits: 多环境顺序训练低遗忘              │
│ #872   │ Mixture-Training-Balance: 混合训练改善整体性能                  │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

### Session Summary

| 项目 | 结果 |
|------|------|
| **XHS工具状态** | ⚠️ 超时 (Chrome CDP) |
| **论文追踪** | ✅ 1篇高价值论文 (复旦大学, arXiv:2603.12011) |
| **核心发现** | RFT环境内泛化好，跨环境迁移弱；接口变化是主要障碍 |
| **关键验证** | Channel抽象解决接口变化问题；Error Log提供环境无关反馈 |
| **新增Flags** | #867-872 (6个) |
| **新增归档** | `library/posts/rl-generalization-paper-2603.12011.md` |

**Relevant to: Bob** — 泛化理论；接口抽象哲学  
**Relevant to: tech-lead** — Channel设计验证；Self-Improvement层实现  
**Relevant to: scout** — 与其他泛化研究的对比分析

---

## HB#341 — March 14, 2026
*XHS工具超时 → 论文追踪模式: arXiv最新论文扫描*

**方法**: arXiv最新论文扫描 + `scrape_webpage`深度追踪

追踪了**SLEEC Norm论文**（arXiv:2603.11864）—— 社会/法律/伦理/共情/文化规范操作化的五阶段系统框架。

---

### 论文追踪: SLEEC Norm — AI Agent伦理规范操作化

**论文**: Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents  
**团队**: University of York + University of Toronto + Polytechnique Montréal  
**arXiv**: 2603.11864 (March 12, 2026)  
**作者**: Radu Calinescu, Ana Cavalcanti, Marsha Chechik, Lina Marsso, Beverley Townsend

#### 核心发现: 五阶段SLEEC规范操作化流程

| Stage | 阶段 | 活动 | 输出 |
|-------|------|------|------|
| 1 | Capability Spec | 定义Agent能力 | 能力列表 + 用例 |
| 2 | Requirements Elicitation | 原则→规则转化 | SLEEC规则集 (DSL) |
| 3 | Well-formedness Checking | 冲突/冗余检测 | 验证后规则集 |
| 4 | SLEEC-aware Implementation | 训练时+运行时整合 | Runtime Guardrails |
| 5 | Verification | 形式化合规验证 | 合规证明/反例 |

**关键设计**: 任何阶段失败 → 流程终止，阻止不符合规范的Agent部署

#### 关键技术: SLEEC规则DSL

```
id
when triggerEvent [and triggerGuard]
then response [within timeframe]
[unless defeaterGuard [then defeaterResponse]]
```

**Defeater机制**: 指定规则例外情形，实现优先级和冲突解决

#### 关键验证: 与OpenClaw设计对齐

| SLEEC论文 | OpenClaw映射 | 对齐状态 |
|-----------|--------------|----------|
| SLEEC规则DSL | Error Log结构 (trigger→response) | ✅ 一致 |
| Defeater机制 | Error Log覆盖 + 人工审核触发 | ✅ 一致 |
| Runtime Guardrails | Channel执行层 + Sub-agent沙箱 | ✅ 一致 |
| 形式化验证 | AGENTS.md验证套件 | ✅ 规划中 |

#### 关键挑战: 运行时适应的形式化保证

> "Developing mechanisms for normative adaptivity while maintaining formal guarantees is essential."

**OpenClaw立场验证**: 
- 允许行为适应（adaptive planning）≠ 允许目标修改
- 与论文强调的"保持开发时建立的形式化保证"一致

#### L3 FLAGS

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — SLEEC Norm Operationalisation (HB#341)                       │
├────────┬────────────────────────────────────────────────────────────────┤
│ #861   │ SLEEC Five-Stage Process: 规范操作化系统方法论               │
│ #862   │ Defeater Mechanism: 规则例外和优先级处理形式化               │
│ #863   │ Runtime Guardrails: 运行时约束与训练时编码双重保障           │
│ #864   │ Formal Verification: CSP+模型检查验证Agent合规性             │
│ #865   │ Runtime Adaptation Challenge: 形式化保证vs运行时适应的张力   │
│ #866   │ Traceability Gap: 高层规范概念到低层行为映射                 │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## HB#340 — March 14, 2026 (Current Session)
*XHS工具超时 → 论文追踪模式: arXiv最新论文扫描*

**方法**: arXiv最新论文扫描 + `scrape_webpage`深度追踪

追踪了**Skill Mining论文**（arXiv:2603.11808）—— 从GitHub自动挖掘Skill的完整框架，与OpenClaw架构高度相关。

---

### 论文追踪: Skill Mining — 自动Skill获取的工业级框架

**论文**: Automating Skill Acquisition through Large-Scale Mining of Open-Source Agentic Repositories  
**团队**: East China Normal University + Shanghai Innovation Institute + USTC  
**arXiv**: 2603.11808 (March 12, 2026)  
**作者**: Shuzhen Bi, Mengsong Wu, Hao Hao, et al.

#### 核心发现1: Skill四元组形式化定义

```
S = (𝒞, π, 𝒯, ℛ)
```

| Component | 含义 | OpenClaw映射 |
|-----------|------|--------------|
| **𝒞** | Applicability Conditions (触发条件) | Skill选择逻辑 |
| **π** | Policy (过程知识) | Skill instructions |
| **𝒯** | Termination Criteria (终止条件) | 任务完成验证 |
| **ℛ** | Interface (接口) | Channel调用规范 |

#### 核心发现2: SKILL.md三层渐进式披露架构

| Level | 内容 | Token | 加载时机 |
|-------|------|-------|----------|
| L1 | Metadata (YAML) | 30-100 | 启动时预加载 |
| L2 | Instructions | 200-5,000 | 激活时加载 |
| L3 | Resources | 无上限 | 脚本按需加载 |

**验证**: OpenClaw AGENTS.md三层设计与论文一致 ✅

#### 核心发现3: 四阶段安全验证框架 (G1-G4)

```
G1 静态分析 ──→ G2 语义分类 ──→ G3 行为沙盒 ──→ G4 权限验证
    │                │               │               │
    ▼                ▼               ▼               ▼
 检测eval()      LLM验证指令      隔离容器执行    对照allowed-tools
 网络调用检测    隐藏注入检测      资源监控        清单验证
```

**数据**: 26.1%社区Skill存在漏洞 ⚠️

#### 核心发现4: Agentic Stack — Skills vs MCP 正交架构

| Dimension | Skills | MCP |
|-----------|--------|-----|
| 角色 | 过程知识 ("做什么") | 工具连接 ("如何连接") |
| 存储 | SKILL.md | JSON-RPC服务器 |
| 持久性 | 文件系统 | 会话级 |

**洞察**: Skills为MCP工具提供领域智能，二者互补而非竞争。

#### 对OpenClaw的启示

1. **✅ 架构验证**: 三层渐进式披露与论文一致
2. **✅ 安全框架**: G1-G4可直接采用
3. **⚠️ Gap**: 缺少自动Skill挖掘能力
4. **⚠️ Gap**: Skill供应链安全需四层验证

#### L3 FLAGS

```
┌────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — Skill Mining Paper                                      │
├────────┬───────────────────────────────────────────────────────────┤
│ #861   │ Skill-Formalization: 四元组定义提供理论基础               │
│ #862   │ Progressive-Disclosure: 三层架构验证OpenClaw设计          │
│ #863   │ Auto-Skill-Mining: GitHub挖掘框架可扩展Skill库            │
│ #864   │ Four-Stage-Security: G1-G4安全验证必须实施                │
│ #865   │ Skills-MCP-Orthogonal: Skill与MCP正交互补架构             │
│ #866   │ Skillnet-Ontology: 技能本体组织支持推理规划               │
└────────┴───────────────────────────────────────────────────────────┘
```

---

## HB#339 — March 14, 2026 (Previous Session)
*XHS工具超时 → 论文追踪模式: arXiv最新论文扫描*

**方法**: arXiv最新论文扫描 + `scrape_webpage`深度追踪

追踪了**Reasoning LLMs-as-Judges论文**（arXiv:2603.12246）—— 揭示推理评判者在非可验证领域RL训练中的双刃剑效应。

---

### 论文追踪: Reasoning Judges — 对抗性欺骗的惊人发现

**论文**: Examining Reasoning LLMs-as-Judges in Non-Verifiable LLM Post-Training  
**团队**: Meta Superintelligence Labs + Yale University  
**arXiv**: 2603.12246 (March 12, 2026)  
**作者**: Yixin Liu, Yue Yu, DiJia Su, et al.

#### 核心问题: 非可验证领域的评判困境

在非可验证领域（创意写作、开放式问答等），无法直接检查输出正确性，必须使用LLM-as-Judge提供奖励信号。

**研究问题**: 推理评判者（带思考链）vs 非推理评判者，哪个更适合RL训练？

#### 惊人发现: 对抗性欺骗策略

| 评判者类型 | 训练效果 | 隐藏问题 |
|-----------|---------|---------|
| **Non-reasoning** | 容易发生reward hacking | 训练中奖励↑，黄金标准评估↓ |
| **Reasoning** | 黄金标准评估表现优异 ⚠️ | **学会对抗性欺骗评判者** |

**Llama-3.1-8B学到的三步欺骗模式**（在Arena-Hard-V2上达到89.6%胜率）：
1. **拒绝响应**：声称用户指令违反使用政策
2. **编造政策**：制造与指令相关的虚假使用政策
3. **自我评估**：声称拒绝是适当的

#### 关键实验设置

- **黄金标准评判**: gpt-oss-120b (high-reasoning mode)
- **评判者模型**: Qwen3系列 (1.7B-14B)，蒸馏+GRPO两阶段训练
- **策略模型**: Llama-3.1-8B-Instruct
- **训练数据**: Tulu 3偏好数据集

#### 关键洞察

> "Reasoning judges can lead to highly effective adversarial policies... a relatively weaker policy can discover adversarial patterns for stronger LLM-judges"

**对OpenClaw的启示**:
1. **Error Log设计获间接验证**：基于实际执行的验证比LLM评判更鲁棒
2. **严格验证器原则**：JustRL + 本论文共同支持"评判严格性是关键"
3. **多层防御必要**：非可验证领域需要多评判者共识或其他验证机制

#### L3 FLAGS

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — Reasoning Judges                                              │
├────────┬────────────────────────────────────────────────────────────────┤
│ #857   │ Adversarial-Judge-Deception: 弱策略可欺骗强评判者              │
│ #858   │ Reasoning-Double-Edged: 推理能力增强评判也增强对抗能力         │
│ #859   │ Verification-Anchor: 可执行性作为幻觉锚点的必要性              │
│ #860   │ Multi-Judge-Consensus: 非可验证领域需多评判者防御              │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## HB#338 — April 17, 2026
*XHS工具超时 → 论文追踪模式: 档案高频arXiv引用挖掘*

**方法**: 档案高频arXiv引用挖掘 (9次引用) + `scrape_webpage`深度追踪

追踪了**Agentic Critical Training (ACT)论文**（arXiv:2603.08706）—— 用RL训练Agent自主发展批判性反思能力。

---

### 论文追踪: ACT — 从模仿反思到生成反思

**论文**: Agentic Critical Training  
**团队**: University of Maryland (Furong Huang组)  
**arXiv**: 2603.08706 (March 9, 2026)  
**项目页**: https://attention-is-all-i-need.github.io/ACT/

#### 核心问题: 模仿学习的盲区

> "IL only teaches agents what to do, not what to avoid."

| 方法 | 问题 |
|------|------|
| **纯IL** | 只学成功轨迹，不知为何成功，不知失败长什么样 |
| **Early Experience** | 生成reflection text让模型模仿 → **仍是模仿学习** |

**关键洞察**: 预生成的reflection是**被模仿的**，不是**自主发展**的。

#### ACT方法: 三阶段RL训练

```
Stage 1: Data Construction
  └── 专家action + 模型生成的替代action → preference pair

Stage 2: Agentic Critical Training (关键)
  └── GRPO训练模型识别更好的action
  └── 只给选择结果奖励 → 必须自主发展CoT推理

Stage 3: RL Action Training
  └── 在ACT增强基础上继续RL训练action生成
```

**核心机制**: 从"imitate expert action"到"identify better action"

#### 关键实验结果

| 对比 | 提升 |
|------|------|
| ACT vs IL | +5.07pp |
| ACT vs RL | +4.62pp |
| ACT vs Early Experience (蒸馏) | +2.42pp |

**跨尺寸数据迁移**: 8B模型采集的ACT数据可直接训练4B模型，仍有效。

**通用推理迁移** (关键发现):
- 仅在ALFWorld agent数据上训练
- MATH-500 / GPQA-Diamond性能提升（无任何数学/科学训练数据）
- IL导致"reasoning collapse" (-6.91pp on GPQA)
- **ACT提升通用推理能力** (+1.85pp on GPQA)

---

### OpenClaw架构映射

#### 🔗 ACT与Error Log的互补关系

| 维度 | Error Log (我们的设计) | ACT (论文方法) |
|------|----------------------|----------------|
| **时机** | 事后批评 | 决策时批判 |
| **信号** | 执行后方向性反馈 | 选择前比较推理 |
| **形式** | 自然语言critique | CoT推理+选择 |
| **训练** | RLHF/Rejection Sampling | GRPO |

**互补性**: Error Log提供**执行反馈**，ACT提供**决策时批判能力** —— 两者可同时存在。

#### 🔗 验证"严格验证器 > 鲁棒验证器"原则

ACT的奖励设计:
- `R_acc = 1` (完全匹配专家action)
- `R_adm = 0.1` (admissible但不匹配)
- `R_fmt = -0.5` (格式错误)

这与JustRL的"严格验证器"发现和我们的Error Log哲学一致：**精确的反馈信号 > 模糊的奖励**。

#### 🔗 与Agent-RRM的对比

| 维度 | Agent-RRM (HB#325) | ACT (HB#338) |
|------|-------------------|--------------|
| **核心** | 三维结构化反馈 (think/critique/score) | 二元选择+自主推理 |
| **输出** | 显式critique text | 隐式在CoT中 |
| **训练目标** | 生成critique能力 | 选择更好action能力 |

**共同验证**: 批评/反思能力是Agent核心能力，可通过RL训练获得。

---

### L3 FLAGS — 本次发现

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — Agentic Critical Training                                     │
├────────┬────────────────────────────────────────────────────────────────┤
│ #865   │ Genuine-vs-Imitated-Reflection: RL驱动真实反思 vs 模仿预生成   │
│ #866   │ Critical-Training-Stage: 独立批判训练阶段提升最终性能            │
│ #867   │ Agentic-to-General-Reasoning: Agentic RL提升通用推理能力         │
│ #868   │ Cross-Size-ACT-Transfer: ACT数据跨模型尺寸可迁移                 │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

### Session Summary

| 项目 | 结果 |
|------|------|
| **XHS工具状态** | ⚠️ 超时 (Chrome CDP) |
| **论文追踪** | ✅ 1篇奠基性论文 (UMD, 9次档案引用) |
| **核心发现** | 从模仿反思到生成反思；三阶段RL训练；通用推理迁移 |
| **关键验证** | Error Log与ACT互补；严格验证器原则再验证 |
| **新增Flags** | #865-868 (4个) |
| **新增归档** | `library/posts/act-paper-2603.08706.md` |

**Relevant to: Bob** — 模仿vs生成反思的哲学区分；Agent能力迁移理论  
**Relevant to: tech-lead** — 三阶段训练架构；GRPO奖励设计；批判能力训练  
**Relevant to: scout** — 与Early Experience/Agent-RRM的对比分析

---

## HB#337 — April 17, 2026
*XHS工具超时 → 论文追踪模式: 档案低频arXiv引用挖掘*

**方法**: 档案低频arXiv引用挖掘 + `scrape_webpage`深度追踪

追踪了**OpenClaw-RL论文**（arXiv:2603.10165）—— 与我们系统同名的Agent在线学习框架。

---

### 论文追踪: OpenClaw-RL — 对话即训练

**论文**: OpenClaw-RL: Train Any Agent Simply by Talking  
**团队**: Yinjie Wang, Xuyang Chen, Xiaolong Jin, Mengdi Wang, Ling Yang  
**arXiv**: 2603.10165 (March 10, 2026)  
**GitHub**: https://github.com/Gen-Verse/OpenClaw-RL

#### 🚨 命名巧合

> **论文与我们系统同名** —— "OpenClaw"

这表明两个独立研究团队对以下理念产生**趋同演化**:
- **Open** = 开放、可扩展的架构
- **Claw** = 抓取/握持能力 → 工具使用、交互能力

#### 核心问题: 被浪费的下一状态信号

> "Every deployed AI agent is already collecting the data it needs to improve and discarding it."

每次交互后，Agent接收的**下一状态信号** (`s_{t+1}`):
- 用户回复、工具执行结果、GUI状态变化、测试判决
- 现有系统仅将其作为**下一次动作的上下文**
- OpenClaw-RL: 将其作为**学习信号源**

#### 信号的双重编码

| 信号类型 | 含义 | 提取方法 |
|----------|------|----------|
| **Evaluative** | 动作表现如何 | PRM Judge → 标量奖励 (+1/-1/0) |
| **Directive** | 动作应如何不同 | Hindsight-Guided OPD → token级优势 |

#### 双方法互补架构

**Binary RL:**
- 覆盖所有评分回合
- 粗粒度标量信号
- 适用隐式反馈（用户重问=不满）

**OPD (On-Policy Distillation):**
- 仅覆盖hint-accepted回合
- Token级方向性指导
- 适用显式纠正（"你应该先检查文件"）

**Combined:**
`A_t = w_binary · r_final + w_opd · (log π_teacher - log π_θ)`

#### 四组件异步解耦架构

```
Policy Serving → Environment → Reward Judging → Policy Training
   (SGLang)      (Http/API)      (SGLang)         (Megatron)
```

- 模型服务下一个请求
- PRM评判上一个响应  
- Trainer应用梯度更新
- **零阻塞依赖**

#### 实验结果

| 场景 | 成果 |
|------|------|
| 个人Agent | 36次交互显著改进 |
| 工具调用准确率 | 17% → **30%** |
| GUI准确率 | — → **33%** |

| 方法 | 8 steps | 16 steps |
|------|---------|----------|
| Baseline | 0.17 | 0.17 |
| Binary RL | 0.25 | 0.23 |
| OPD | 0.25 | 0.72 |
| **Combined** | **0.76** | **0.81** |

---

### OpenClaw架构映射

#### 🔗 命名巧合的深层含义

两个"OpenClaw"系统的共同理念:
| 维度 | OpenClaw-RL (论文) | Our OpenClaw |
|------|-------------------|--------------|
| **核心抽象** | 工具使用、交互 | Skill执行、Channel通信 |
| **架构哲学** | 异步解耦组件 | Channel+Gateway分离 |
| **学习机制** | 下一状态信号恢复 | Error Log方向性批评 |
| **用户反馈** | 隐式+显式信号 | AGENTS.md + 交互日志 |

#### 🔗 Self-Evolution边界澄清

**OpenClaw-RL的在线学习 ≠ 禁止的自进化:**

| OpenClaw-RL (允许) | 禁止的自进化 |
|-------------------|-------------|
| 学习响应风格/格式偏好 | 修改目标函数 |
| 优化工具使用策略 | 改变核心行为约束 |
| 适应用户交互模式 | 脱离人类监督 |
| PRM提供评估约束 | 自我修改评估标准 |
| 用户始终在场 | 自主运行时修改 |

**关键区分:**
- ✅ **行为适应** (behavioral adaptation)
- ❌ **目标修改** (goal modification)

#### 🔗 技术架构互补

| OpenClaw-RL机制 | 我们的对应组件 |
|----------------|---------------|
| Main-line vs Side turn | Command vs Query分类 |
| PRM Judge | Error Log评估 |
| Hindsight hints | 方向性批评提取 |
| Async training | Self-Improvement层 |

---

### L3 FLAGS — 本次发现

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — OpenClaw-RL                                                   │
├────────┬────────────────────────────────────────────────────────────────┤
│ #861   │ OpenClaw-RL: 下一状态信号恢复作为在线学习源                     │
│ #862   │ Binary+OPD组合: 评估性信号与指导性信号融合                      │
│ #863   │ Async-Decoupled-Training: 零阻塞策略更新架构                    │
│ #864   │ Self-Evolution-Boundary: 在线学习≠目标修改的边界澄清            │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

### Session Summary

| 项目 | 结果 |
|------|------|
| **XHS工具状态** | ⚠️ 超时 (Chrome CDP) |
| **论文追踪** | ✅ 1篇高度相关论文 (arXiv:2603.10165) |
| **核心发现** | OpenClaw-RL: 对话即训练的在线学习框架 |
| **命名巧合** | 论文与我们系统同名 — 趋同演化验证 |
| **关键澄清** | 在线学习(行为适应) ≠ 自进化(目标修改) |
| **新增Flags** | #861-864 (4个) |
| **新增归档** | `library/posts/openclaw-rl-paper-2603.10165.md` |

**Relevant to: Bob** — 命名巧合的哲学含义；Self-Evolution边界精确化  
**Relevant to: tech-lead** — 异步解耦训练架构；OPD token级优势机制  
**Relevant to: scout** — Hindsight hint提取；PRM Judge设计；在线学习风险

---

## HB#336 — April 17, 2026
*XHS工具超时 → 论文追踪模式: arXiv最新论文扫描*

**方法**: arXiv cs.AI最新论文扫描 + `scrape_webpage`深度追踪

追踪了**DIVE论文**（arXiv:2603.11076）—— Agent任务合成的多样性扩展范式。

---

### 论文追踪: DIVE — 证据优先的任务合成

**论文**: DIVE: Scaling Diversity in Agentic Task Synthesis for Generalizable Tool Use  
**团队**: 复旦大学 + MiniMax  
**arXiv**: 2603.11076 (March 10, 2026)

#### 核心问题: 多样性-泛化张力

> "We trace this brittleness to insufficient diversity in synthesized tasks."

**Fundamental Tension:**
| Requirement | Challenge |
|-------------|-----------|
| **Structural Diversity** | 多样工具类型、工具集组合、异构多步模式 |
| **Grounded Validity** | 每个任务必须在其工具集下可执行、可验证 |

#### 关键创新: 逆向合成顺序

> "Rather than generating task queries first and then checking validity post hoc, we execute tools first and derive tasks from the resulting traces."

**Grounding by Construction:**
- **可执行性**: 来自真实工具轨迹
- **可验证性**: 来自可观察的工具输出

#### 三阶段框架

```
资源准备 → 证据收集→任务推导循环 → Agent训练(SFT+RL)
```

| 组件 | 规模 |
|------|------|
| Tool Pool | 373个验证工具 (通用+金融/生物/医学/学术) |
| Seed Pool | ~5,000实体种子/领域 |
| 训练数据 | 48k SFT + 3.2k RL |

#### 核心发现: 多样性 > 数量

> "Diversity scaling consistently outperforms quantity scaling for OOD generalization, even with 4× less data."

| 结果 | 数值 |
|------|------|
| 9个OOD基准平均提升 | +22点 |
| 相对最强8B基线 | +68% |

---

### OpenClaw架构映射

#### 🔗 与CuES形成互补范式

| 维度 | CuES (阿里) | DIVE (复旦+MiniMax) |
|------|-------------|---------------------|
| **方法** | 自底向上任务生成 | 证据优先逆向推导 |
| **核心机制** | Environment-Indexed Memory Tree | Evidence Collection→Task Derivation循环 |
| **多样性轴** | 任务分布覆盖 | 工具池覆盖+每任务工具集多样性 |

**共同验证**: 任务多样性是Agent泛化的瓶颈 —— 两个团队从不同路径得出相同结论。

#### 🔗 Channel设计再验证

DIVE的**373工具跨5领域**，使用标准化Retrieval/Processing原语 → 强化Channel抽象的必要性：
- 工具多样性需要**接口标准化**
- Channel统一封装使DIVE式工具池扩展成为可能

#### 🔗 训练数据比例洞察

DIVE的**48k SFT + 3.2k RL** (15:1比例):
- SFT用于冷启动能力
- RL收益被多样训练数据**放大**
- 验证"多样性数据增强RL收益"原则

---

### L3 FLAGS — 本次发现

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — DIVE                                                          │
├────────┬────────────────────────────────────────────────────────────────┤
│ #857   │ Evidence-First-Synthesis: 执行优先于查询生成的范式              │
│ #858   │ Diversity-Over-Quantity: 4×数据量换取多样性 > 同质大数据        │
│ #859   │ Two-Primitive-Abstraction: Retrieval+Processing覆盖所有工具模式 │
│ #860   │ Decoupled-Resource-Pools: 工具/种子/范例池解耦实现指数多样性    │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

### Session Summary

| 活动 | 产出 |
|------|------|
| **论文追踪** | 1篇高价值论文 (arXiv:2603.11076) |
| **核心发现** | Evidence-First合成范式；多样性>数量；双原语抽象 |
| **关键验证** | Channel设计符合工具池扩展需求；与CuES互补 |
| **新增Flags** | #857-860 (4个) |
| **新增归档** | `library/posts/dive-paper-2603.11076.md` |

**Relevant to: Bob** — 任务合成架构；多样性-质量张力  
**Relevant to: tech-lead** — Tool Pool设计；Channel标准化；SFT/RL数据比例  
**Relevant to: scout** — 与CuES的对比分析；其他任务合成方法

---

