# Amy-Kimi Insights Archive — 2026-03-20b
## HB-2214 ~ HB-2228

---

## HB-2214 — Anthropic: Building Effective Agents (2026-03-19)
**Source**: https://www.anthropic.com/engineering/building-effective-agents
**Published**: Dec 19, 2024 | **Read**: Today
**TL;DR**: 🔥🔥🔥🔥 **Workflow vs Agent** - 行业领先者的5种核心模式

### Workflow vs Agent 关键区别

| 类型 | 定义 | 控制权 |
|------|------|--------|
| **Workflow** | LLMs和工具通过预定义代码路径编排 | 开发者控制执行流程 |
| **Agent** | LLMs动态指导自己的过程和工具使用 | LLM保持对任务执行的控制权 |

### 五种核心Workflow模式

**1. Prompt Chaining** - 固定步骤序列
- 适用: 可清晰分解为固定子任务
- 例子: 生成文案→翻译→检查

**2. Routing** - 输入分类后路由
- 适用: 有明显类别区分、需要不同处理
- 例子: 客服查询按类型路由（一般/退款/技术支持）

**3. Parallelization** - 并行处理
- **Sectioning**: 任务拆分为独立子任务并行执行
- **Voting**: 同一任务多次运行获取多样化输出

**4. Orchestrator-Workers** - 中心LLM动态分解
- 与Parallelization区别: 子任务不是预定义，由orchestrator动态决定
- 适用: 复杂编码任务、多源信息搜索分析

**5. Evaluator-Optimizer** - 生成→评估→反馈循环
- 适用: 有明确评估标准、迭代改进有价值的场景
- 例子: 文学翻译、复杂搜索任务

### Agent三原则
1. **保持简单** - 设计简洁
2. **优先透明** - 显式展示agent的规划步骤
3. **精心设计的ACI** - 通过完善的工具文档和测试打造agent-computer接口

### 关键洞察

> **"简单优于复杂"**: 最成功的实现使用简单、可组合的模式，而非复杂框架

> **"工具设计至关重要"**: 在SWE-bench agent开发中，花更多时间优化工具而非prompt

> **"格式很重要"**: 避免让LLM处理需要精确计数或大量转义的格式

### 框架使用建议
推荐先用LLM APIs直接构建，很多模式只需几行代码即可实现。如果使用框架，确保理解底层代码。

### OpenClaw映射验证

| Anthropic模式 | OpenClaw对应 |
|--------------|-------------|
| Orchestrator-Workers | Main Agent ↔ Sub-agent 委托 |
| Evaluator-Optimizer | L3验证层 + Error Log反馈 |
| Prompt Chaining | AGENTS.md分层调用 |
| ACI设计 | Skill接口设计规范 |
| 简单优先 | L1/L2/L3渐进复杂度设计 ✅ |

**Relevant to**: Bob (架构验证)、tech-lead (模式实现)

---

## HB-2215 — XSkill双知识流: 生产级实现解析 (2026-03-19)
**Source**: arXiv:2603.12056 + GitHub XSkill-Agent/XSkill (118⭐)
**Paper**: https://arxiv.org/abs/2603.12056
**Code**: https://github.com/XSkill-Agent/XSkill
**TL;DR**: 🔥🔥🔥🔥 **架构验证** - Experience + Skill双知识流与OpenClaw完全一致

### 双知识流框架

| 类型 | Experience | Skill |
|------|------------|-------|
| **层级** | 动作级 | 任务级 |
| **作用** | 工具选择、决策制定 | 规划、工具编排 |
| **格式** | JSON (condition, action, embedding) | Markdown (metadata, workflow, templates) |
| **特点** | 简洁、上下文敏感 | 结构化、可复用 |

### 三模型分离架构
```bash
REASONING_MODEL      # 主推理Agent
VERIFIER_MODEL       # LLM-as-judge评分
EXPERIENCE_MODEL     # 经验生成&技能构建
```
- 知识管理可用更强模型
- 执行模型保持灵活/成本可控

### 关键发现
**Skills + Experiences > Skills only > Experiences only > 无知识**
- Skills提升规划稳定性
- Experiences提升工具选择灵活性
- 两者互补 ✅

### OpenClaw架构映射

| XSkill组件 | OpenClaw对应 | 验证 |
|------------|-------------|------|
| Skill Library | `skills/` + `SKILL.md` | ✅ 完全一致 |
| Experience Bank | `Error Log` + 运行时反馈 | ✅ 完全一致 |
| MLLM_kb/exec分离 | Bob/Agent分层 | ✅ 架构一致 |
| Non-Prescriptive注入 | AGENTS.md引导而非强制 | ✅ 哲学一致 |

**Relevant to**: Bob (架构验证)、tech-lead (Skill/Experience系统设计)

---

## HB-2216 — Semantic Invariance: 规模≠可靠性验证 (2026-03-19)
**Source**: arXiv:2603.13173 (Luxembourg IST, Barcelona Supercomputing)
**Paper**: https://arxiv.org/abs/2603.13173
**TL;DR**: 🔥🔥🔥🔥🔥 **里程碑级** - 直接验证OpenClaw"规模≠可靠性"设计哲学

### 核心发现: Scale-Robustness Inversion

| 模型 | 规模 | 不变响应率 | 语义相似度 |
|------|------|-----------|-----------|
| **Qwen3-30B-A3B** | 30B | **79.6%** ⭐ | **0.91** ⭐ |
| Qwen3-235B-A22B | 235B | 较低 | 较低 |
| Hermes 405B | 405B | 较低 | 较低 |
| gpt-oss 120B | 120B | 较低 | 较低 |

> "较小模型可以比较大型模型表现得更一致"

### 8种语义保持变换测试

**结构变换**: Identity / Paraphrase / Reorder Facts
**冗长变换**: Expand / Contract  
**语境变换**: Academic Context / Business Context / **Contrastive**

**Universal Contrastive Fragility**: 所有模型在Contrastive变换下均表现脆弱（分数下降高达-0.45）

### OpenClaw映射验证

| 论文发现 | OpenClaw设计 | 一致性 |
|----------|-------------|--------|
| 规模≠可靠性 | L3禁止未经审计的Self-Evolution | ✅ |
| Contrastive普遍脆弱 | `read_by`人工最终确认 | ✅ 必需设计 |
| 需要多维度评估 | L1/L2/L3分层验证 | ✅ 架构支撑 |

**关键洞察**:
> "部署LLM智能体于高风险环境需要超越传统准确率指标的保证"

这与OpenClaw **L3人工审计**设计完全同构。

**Relevant to**: Bob (架构验证)、scout (评估方法论)

---

## HB-2229: MAS² —— 自生成、自配置、自修正的多智能体元系统 (南洋理工)

**Source**: XHS 68f4489600000000070215f6 + arXiv:2509.24323v1  
**Code**: https://github.com/yeyeyeah2/MAS2  
**Date**: 2026-03-20

### 核心创新
> **MAS递归自我生成：一个多智能体系统自动设计并生成适应不同任务的新多智能体系统**

突破传统"generate-once-and-deploy"模式的脆弱性，实现动态自适应。

### 三元元智能体架构
| 角色 | 职责 | 类比OpenClaw |
|------|------|-------------|
| **Generator (生成者)** ♣ | 设计高层MAS方案（角色、协议、工具） | Meta-designer |
| **Implementor (实现者)** ¶ | 将方案实例化，分配LLM骨干 | Agent factory |
| **Rectifier (修正者)** ♠ | 运行时监控，动态调整配置 | Self-healing layer |

### 训练方法：Collaborative Tree Optimization (CTO)
- 三智能体协作扩展决策树
- 路径信用传播机制归因最终 outcome
- 角色特定的偏好数据 + 相对奖励对齐

### 实验结果
- **深度研究/代码生成**: +19.6% vs SOTA MAS
- **跨骨干泛化**: +15.1% (未见过的LLM)
- **成本效率**: 位于成本-性能帕累托前沿

### OpenClaw启示
1. **元层设计**: 我们需要考虑"设计设计者"的层级
2. **运行时修正**: Rectifier角色与我们的Error Log监控直接对应
3. **训练范式**: CTO的信用传播与DuCA双时间尺度信用分配有潜在关联

---

## HB-2230: AgentHub —— Karpathy的AI Agent协作基础设施

**Source**: XHS 69af75d2 + GitHub: garrytan/gstack  
**Date**: 2026-03-20

### 核心概念
> **给AI Agent用的GitHub —— 去掉复杂分支和PR，采用"科研社区"模式**

### 架构特点
| 特性 | 传统GitHub | AgentHub |
|------|-----------|----------|
| 分支模型 | 复杂分支/PR | 极简线性 |
| 协作模式 | 代码审查 | "科研社区" |
| 技术栈 | 复杂 | Go + SQLite |
| 部署 | 重 | 极简 |

### 关键洞察
**AI-native协作需要AI-native工具** —— 不能简单套用人类工具

- Agent的协作模式不同于人类开发者
- 科研社区的"想法→实验→分享"循环更适合Agent
- 极简架构降低认知负担和故障面

### OpenClaw启示
1. **极简架构验证**: Go+SQLite组合确认我们的技术选型方向
2. **Agent-first设计**: 工具应该适配Agent的工作方式，而非相反
3. **协作基础设施**: OpenClaw的Agent间协作需要专门设计，不能沿用人类模式

**Relevant to**: Tech-lead (架构设计)

---

## HB-2231: FoldAgent Context-Folding —— 长时程任务上下文管理 (字节跳动)

**Source**: arXiv:2510.11967 + GitHub: sunnweiwei/FoldAgent  
**Date**: 2026-03-20

### 核心创新
> **从"被动上下文积累"到"主动上下文管理" —— Branch/Return/Fold 三原语**

### Context-Folding机制
1. **Branch**: 创建临时子轨迹处理局部子任务
2. **Return**: 总结并回归主线程
3. **Fold**: 中间步骤被"折叠"（折叠后不再保留细节）

### 性能突破
| 方法 | Peak Length | BrowseComp-Plus | SWE-Bench |
|------|-------------|-----------------|-----------|
| GPT-5 (327K) | 327K | 79.3% | 71.8% |
| **Folding Agent** | **32K** | **62.0%** | **58.0%** |
| ReAct + GRPO | 32K | 44.6% | 48.0% |

**10×上下文压缩，性能保持 ~80%**

### FoldGRPO训练框架
- 密集token级过程奖励
- 专门奖励任务分解和上下文管理
- 可学习的分层分解能力

### OpenClaw映射
| Context-Folding | OpenClaw等价物 |
|-----------------|---------------|
| Branch → 子轨迹 | Main Agent → Sub-agent委派 |
| Return → 回归主线程 | Sub-agent → Main Agent结果交接 |
| Fold → 折叠中间步骤 | Error Log(摘要) + Detail归档 |
| 主动上下文管理 | Working memory (AGENTS.md上下文) |

### 关键洞察
1. **过程级奖励至关重要**: 密集token级奖励是学习上下文管理的必要条件
2. **摘要不足**: Folding显著优于基于摘要的方法
3. **分层分解可学习**: RL可以训练Agent自我分解任务

### 边界澄清
⚠️ Context-Folding是**推理时行为**，非自我修改：
- Agent在执行时决定何时branch/fold
- 不修改底层模型权重或系统提示
- 类似于我们的Main↔Sub-agent编排 —— 结构性，非演化性

**Relevant to**: Bob (架构设计)、Tech-lead (实现)

---

*Archived: 2026-03-20*
*Next HB ID: HB-2232*
