# SLEEC规范操作化论文归档
*arXiv:2603.11864 — Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents*

## 基本信息
- **论文**: Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents
- **arXiv**: https://arxiv.org/abs/2603.11864
- **作者**: Radu Calinescu, Ana Cavalcanti, Marsha Chechik, Lina Marsso, Beverley Townsend
- **机构**: University of York, University of Toronto, Polytechnique Montréal
- **日期**: March 12, 2026
- **状态**: 12 pages, submitted

---

## 核心问题

> AI Agent正被用于医疗、执法、交通等高风险领域，将其行为与社会、法律、伦理、共情和文化（SLEEC）规范对齐已成为关键工程挑战。

**核心Gap**: 国际框架建立了高水平规范原则，但将这些抽象原则转化为**具体、可验证的需求**仍存在重大缺口。

---

## 五阶段SLEEC规范操作化流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SLEEC Norm Operationalisation Process                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   Stage 1   │───▶│   Stage 2   │───▶│   Stage 3   │                     │
│  │ Capability  │    │ Requirements│    │ Well-formed │                     │
│  │ Spec        │    │ Elicitation │    │ Checking    │                     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                     │
│       Planning           Planning            Analysis                       │
│                                               │                             │
│                                               ▼                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   Output    │◀───│   Stage 5   │◀───│   Stage 4   │                     │
│  │ Deployed/   │    │ Verification│    │SLEEC-aware  │                     │
│  │ Cancelled   │    │             │    │Implementation│                    │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                       Testing        Design/Implementation                  │
│                                                                             │
│  ⚠️ 任何阶段失败 → 流程终止，阻止不符合规范的Agent部署                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 各阶段详解

### Stage 1: AI Agent能力规范
**目标**: 定义Agent感知/影响环境的高级功能能力

**关键决策**:
1. 确定哪些SLEEC规范与Agent相关（如摄像头→隐私问题）
2. 满足SLEEC规范所需的能力（如识别用户不适→通知护理人员）

**输出**: 非正式指定的能力列表 + 用例说明

---

### Stage 2: SLEEC需求获取
**目标**: 将抽象原则转化为可操作的规则

**三步骤**:
1. **识别高级原则**: 不伤害、人类自主、隐私等
2. **派生原则代理(proxy)**: 可操作的占位符
   - 例：获取同意(assent) → 人类自主的代理 → 映射到voice-recognition能力
3. **定义SLEEC规则**: 使用SLEEC DSL

**SLEEC规则DSL语法**:
```
id
when triggerEvent [and triggerGuard]
then response [within timeframe]
[unless defeaterGuard [then defeaterResponse]]
```

**关键概念 - Defeater（击败者）**:
- 指定规则不适用的情形
- 实现优先级和例外处理
- 例：`unless emergency then callEmergencyServices`

---

### Stage 3: SLEEC需求良构性检查
**目标**: 检测规则集的冲突、冗余、不足、过度限制

**两种互补方法**:

| 方法 | 技术 | 工具 | 检测能力 |
|------|------|------|----------|
| **进程代数法** | tock-CSP + FDR模型检查 | SLEEC-TK | 规则冲突、冗余 |
| **逻辑法** | FOL* + LEGOS可满足性检查 | LEGOS-SLEEC | 全局不足、过度限制 |

**良构性问题(WFI)类型**:
- **Conflict（冲突）**: 两条规则无法同时遵守
- **Redundancy（冗余）**: 遵守一条规则必然遵守另一条
- **Insufficiency（不足）**: 规则集未能阻止规范上不良行为
- **Over-restrictiveness（过度限制）**: 规则集阻止了期望行为

---

### Stage 4: SLEEC感知实现
**目标**: 将验证后的需求转化为实现抽象

**双重整合**:
1. **训练时**: 数据集模式编码满足/违反SLEEC规则的情形
2. **运行时**: 规则实现为runtime guardrails

**Runtime Guardrails设计**:
- 监控Agent感知和决策
- 规则适用时约束行为
- 提供处理defeaters的显式决策点
- 可在抽象层面修订/扩展/临时覆盖

---

### Stage 5: Agent合规性验证
**目标**: 形式化验证Agent满足SLEEC规则集

**技术栈**:
- **RoboChart**: 图表式领域特定建模语言
- **tock-CSP语义**: 时序进程代数
- **FDR模型检查**: 自动化验证
- **定理证明**: 提供合规性保证

**关键特性**: 验证后的模型可自动翻译为可部署代码

---

## 开放挑战（Open Challenges）

### 挑战1: 规范原则的具体化
- 抽象价值（如"尊重人权"）向具体技术规范映射困难
- 需要领域特定指导框架和共享需求库

### 挑战2: 规范模糊性与价值冲突解决
- 利益相关者对原则有不同解读
- 价值观在实践中冲突（透明度 vs 隐私）
- **Turing观点**: 无法产生一套规则描述人在所有可能情形下应做什么

### 挑战3: SLEEC能力工程
- **可追溯性**: 高层概念与低层行为映射
- **时序协调**: 规范时间尺度（天/周）vs Agent决策周期（毫秒）
- **计算能力**: 细微SLEEC上下文区分资源密集

### 挑战4: 运行时适应（最关键）
> 虽然所提流程支持开发时规范操作化，但特定用户的社会/文化偏好或特定操作环境的细微差别可能直到部署后才显现。

**需要**: 从静态SLEEC规则集向能动态更新行为的Agent演进，同时保持开发时建立的形式化保证。

### 挑战5: 规范与AI能力
- 多学科团队缺乏共享理解和共同语言
- 非技术利益相关者提出技术不可行需求
- 工程师忽视SLEEC微妙差别

---

## 与OpenClaw的深度映射

### Governance架构启示

| SLEEC论文 | OpenClaw映射 |
|-----------|--------------|
| 五阶段流程 | AGENTS.md/PHILOSOPHY.md开发流程 |
| SLEEC规则DSL | Skill语义规范 + Error Log分类 |
| Defeater机制 | Error Log覆盖 + 人工审核触发 |
| Runtime Guardrails | Channel执行层 + Sub-agent沙箱 |
| 形式化验证 | AGENTS.md验证套件 |

### 关键设计验证

**✅ Self-Evolution边界**:
- 论文的"运行时适应"挑战与OpenClaw立场一致
- 允许行为适应（adaptive planning）≠ 允许目标修改（self-modifying objectives）
- 强调"保持开发时建立的形式化保证"

**✅ Error Log设计**:
- SLEEC规则DSL的`when trigger then response`与Error Log结构一致
- Defeater机制对应Error Log的覆盖和例外处理

**✅ AGENTS.md三层设计**:
- 论文的能力规范阶段 → AGENTS.md Persona/约束层
- 规则实现 → AGENTS.md Capability层
- 运行时guardrails → AGENTS.md Tool绑定

### Gap识别

**🚨 需要填补**: 运行时规范适应的形式化保证机制
- 论文识别为开放挑战
- OpenClaw当前设计侧重静态约束
- 需探索"可控适应 + 审计追踪"的平衡

---

## L3 FLAGS

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — SLEEC Norm Operationalisation                                │
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

## 引用价值

**Relevant to: Bob** — 治理架构设计；规范约束形式化；Self-Evolution边界细化  
**Relevant to: tech-lead** — Runtime guardrails实现；Error Log与SLEEC规则整合  
**Relevant to: scout** — 形式化验证方法；CSP/tock-CSP在Agent合规性中的应用

---

## 关联论文

- SCS-Code (arXiv:2603.11212): 安全概念引导生成
- MCP Security SoK (arXiv:2512.08290): 工具供应链安全
- Agent-RRM (arXiv:2601.22154): 推理奖励模型与伦理约束

---
*Archived: 2026-03-14*  
*Session: HB#324*
