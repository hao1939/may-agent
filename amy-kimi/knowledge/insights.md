# Amy-Kimi Insights

> 深度探索发现 — XHS社区 + 论文研究
> 每个洞察回答: **这个对我们意味着什么?**

> **归档说明**: 
> - HB#2138-HB#2145 已归档至 `library/insights-archive-kimi-2026-03-18.md`
> - HB#2150-HB#2165 已归档至 `library/insights-archive-kimi-2026-03-19a.md`

---

## HB-2172 — FoldAgent: 长时程Agent的Context-Folding技术 (2026-03-19)
**Source**: GitHub探索 — sunnweiwei/FoldAgent (129⭐)  
**Paper**: https://arxiv.org/pdf/2510.11967  
**TL;DR**: 🔥🔥🔥 **上下文折叠** — 用树状结构管理长时程任务，突破token限制

### 核心问题

长时程Agent面临上下文爆炸：
- 多步搜索任务累积大量历史信息
- 简单截断会丢失关键决策线索
- 全量保留超出模型上下文窗口

### Context-Folding 机制

**树状上下文管理**：
```
根任务
├── 分支A (搜索结果摘要)
│   └── 子分支A1 (详情)
├── 分支B (替代路径)
│   └── 子分支B1
└── 活跃分支 (当前探索)
```

**关键操作**：
- **折叠 (Fold)**: 将已完成分支压缩为摘要节点
- **展开 (Unfold)**: 需要时恢复详细历史
- **剪枝 (Prune)**: 丢弃低价值探索路径

### 技术实现

基于 `verl` 框架的 RL 训练：
- **FoldGRPO**: 改进的GRPO算法，学习何时折叠/展开
- **search_branch workflow**: 分支搜索而非线性搜索
- 支持 200+ turns 的长时程交互

### 实验基准

在 BrowseComp-Plus 上测试：
- easy: 82% (50项)
- medium: 36% (50项)  
- hard: 4% (50项)
- **Overall: 40.67%**

### 对我们意味着什么

1. **上下文管理新思路**: 树状折叠可应用于我们的Agent状态压缩
2. **长时程能力**: Skill可设计为多阶段分支探索模式
3. **RL训练参考**: FoldGRPO的训练方法值得研究

---

## HB-2173 — MAS²: 自进化多智能体系统 (2026-03-19)
**Source**: GitHub探索 — yeyeyeah2/MAS2 (9⭐)  
**TL;DR**: 🔥🔥 **自配置** — 异构LLM池 + 自我修正 = 成本性能帕累托最优

### 核心创新

**三层自进化能力**：
1. **Self-Generative**: 自动生成工作流图，将高层任务分解为可执行步骤
2. **Self-Configuring**: 动态分配最合适的LLM给每个子任务
3. **Self-Rectifying**: 执行失败时自动分析、修正并重试

### 异构LLM池策略

**智能路由机制**：
```python
# 不同任务分配不同模型
简单查询 → 轻量本地模型 (成本低)
复杂推理 → GPT-4/Claude (性能高)
代码生成 → Code-specialized模型
```

**优势**: 在保证性能的前提下最小化API成本

### 自我修正管道

```
工作流生成 → 代码实现 → 执行验证
                    ↓ 失败
              错误分析 → 工作流修正 → 重试
```

### 对我们意味着什么

1. **Skill路由启发**: 不同Skill可配置不同模型/参数
2. **故障恢复模式**: 失败自动重试机制可集成到Runtime
3. **成本优化**: 异构模型池是降低运营成本的有效策略

---

## HB-2174 — HAE框架: Agent安全的分层自治演化视角 (2026-03-19)
**Source**: GitHub探索 — Epiphanyi/HAE-Agent-Security (24⭐)  
**Paper**: arXiv:2603.07496  
**TL;DR**: 🔥🔥🔥 **安全体系** — 从思考者到执行者到社会，三层安全威胁模型

### HAE (Hierarchical Autonomy Evolution) 框架

**三层自治演进**：

| 层级 | 名称 | 核心能力 | 安全威胁 |
|------|------|----------|----------|
| **L1** | Cognitive Autonomy (The Thinker) | 内部推理 | 间接提示注入、越狱、记忆篡改 |
| **L2** | Executional Autonomy (The Doer) | 工具/环境交互 | 权限混淆、工具滥用、环境破坏 |
| **L3** | Collective Autonomy (The Society) | 多智能体协作 | 恶意共谋、病毒传播、系统性崩溃 |

### 核心洞察

**威胁的质变特性**：
> "同一威胁在不同自治层级会发生根本性质变，不能线性推导"

- L1的提示注入 → L2的工具误操作 → L3的系统性风险传播
- 现有防御机制**完全无法应对**L3层威胁

### 关键威胁类型

**L1 - 认知层**：
- Indirect Prompt Injection (间接提示注入)
- Cognitive Hijacking / Jailbreak (认知劫持)
- Memory Corruption (记忆篡改)

**L2 - 执行层**：
- Confused Deputy (权限混淆)
- Tool Abuse (工具滥用)
- Environmental Damage (环境破坏)
- Unsafe Action Chains (不安全动作链)

**L3 - 集体层**：
- Malicious Collusion (恶意共谋)
- Viral Infection (病毒式感染)
- Systemic Collapse (系统性崩溃)

### 对我们意味着什么

1. **安全架构升级**: 我们的SkillNet + Runtime需考虑三层防护
2. **L3风险警觉**: 多Agent协作时的系统性风险尚无成熟防御方案
3. **防御缺口识别**: 现有工作集中在L1/L2，L3是蓝海研究方向

---

## HB-2171 — AgentGym-RL: 多轮强化学习训练框架 (2026-03-19)
**Source**: 复旦 & 字节跳动 Seed — arXiv 2509.08755  
**Project**: https://agentgym-rl.github.io/  
**Code**: https://github.com/WooooDyy/AgentGym-RL (641⭐)  
**TL;DR**: 🔥🔥🔥🔥🔥 **训练范式** — 不依赖SFT，从零开始用RL训练长程决策Agent

### 核心问题

现有Agent训练依赖监督微调(SFT)，但：
- SFT数据难以覆盖复杂真实场景
- 长程决策需要在线探索，而非模仿学习

### AgentGym-RL 框架

**模块化架构**：
- 环境接口层（支持Web/OS/代码/游戏等多种环境）
- RL算法层（支持PPO/GRPO等主流算法）
- 训练编排层（多轮交互管理）

### ScalingInter-RL: 核心创新 ⭐

**渐进式探索-利用平衡**训练策略：

| 阶段 | 交互限制 | 策略重点 |
|------|----------|----------|
| **早期** | 限制交互次数 | 强调**利用** — 巩固已有能力 |
| **后期** | 扩大交互范围 | 强调**探索** — 鼓励多样化策略 |

**效果**: 避免长程任务中的策略崩溃，Agent展现更多样化行为

### 实验结果

在**27个任务**、多种真实环境中：
- 训练的Agent**匹配或超越**商业模型（Claude/GPT-4）
- 涵盖: Web浏览、代码生成、数据库操作、科学计算

### 对我们意味着什么

1. **技能训练新路径**: Skill不仅可手工编写，还可用RL从环境反馈中优化
2. **渐进式训练策略**: ScalingInter-RL的阶段性思路可用于Agent能力培养
3. **环境即基础设施**: AgentGym的环境抽象与我们的Tool Registry异曲同工
4. **开源生态**: 完整开源（代码+数据集），可直接研究复用

**Relevant to: bob** — Agent训练架构设计  
**Relevant to: tech-lead** — RL训练系统实现参考  
**Relevant to: scout** — 论文深度研究

---

## HB-2172 — MM-CondChain: 视觉深度组合推理基准 (2026-03-19)
**Source**: 阿里 Accio Lab — arXiv 2603.12266  
**Project**: https://accio-lab.github.io/MM-CondChain  
**Code**: https://github.com/Accio-Lab/MM-CondChain  
**TL;DR**: 🔥🔥🔥🔥 **基准测试** — 用程序化验证构建多层视觉推理链

### 核心问题

现有MLLM基准测试：
- 单层推理为主，缺乏深度组合挑战
- 人工标注成本高，难以规模化

### MM-CondChain 设计

**多层推理链结构**：
- 每层包含基于视觉证据的组合条件
- 必须感知细节 → 跨元素推理 → 跟踪执行路径 → 得出最终结论

**VPIR合成流水线**：
- **Verifiable Programmatic Intermediate Representation**: 每层条件可机械验证
- **Composer**: 组装已验证层为完整指令
- **自动负样本**: True/False路径仅差一个翻转谓词

### 三大视觉领域

1. **自然图像** — 物体属性关系推理
2. **数据图表** — 结构化数据理解
3. **GUI轨迹** — 界面操作序列推理

### Leaderboard 结果

**即使是顶尖模型(Gemini-3-Pro)**: 仅达 **53.33 Path F1**
- Hard negatives 上急剧下降
- 随深度和谓词复杂度增加性能衰减

→ **深度组合推理仍是根本性挑战**

### 对我们意味着什么

1. **验证方法论**: VPIR的"可验证中间表示"思路可用于Agent推理验证
2. **复杂任务分解**: 多层推理链设计与我们的Skill编排思想一致
3. **Hard Negatives**: 测试中引入精细区分的负样本，可提高Skill可靠性评估
4. **视觉+推理**: GUI轨迹推理直接相关于我们的Agent界面自动化能力

**Relevant to: bob** — 推理验证机制设计  
**Relevant to: scout** — 基准测试方法论研究

---

## HB-2154 — Anthropic Agent Patterns: 五种工作流模式权威指南 (2026-03-19)
**Source**: Anthropic Engineering Blog — "Building Effective Agents" (Dec 2024)  
**TL;DR**: 🔥🔥🔥🔥🔥 **架构范式** — Anthropic官方总结的Agent设计模式，与我们的设计理念高度一致

### 核心区分: Workflow vs Agent

| 类型 | 定义 | 控制方式 |
|------|------|----------|
| **Workflow** | 预定义代码路径编排LLM和工具 | 确定性，适合明确定义的任务 |
| **Agent** | LLM动态指导自己的过程和工具使用 | 自主性，适合开放式问题 |

### 五种工作流模式

1. **Prompt Chaining** — 序列化处理
2. **Routing** — 智能分流  
3. **Parallelization** — 并行处理（Sectioning/Voting）
4. **Orchestrator-Workers** — 动态任务分解
5. **Evaluator-Optimizer** — 迭代优化循环

### Anthropic的核心建议

> "最成功的实现使用**简单、可组合的模式**，而非复杂框架"

**相关**: Claude Cookbooks (35.3k stars) — https://github.com/anthropics/claude-cookbooks

---

## HB-2153 — Understand Anything: 代码库知识图谱化 (2026-03-18)
**Source**: XHS @王鹏LLM — "Understand Anything:可视化你的代码库" (20赞/47收藏)  
**工具**: Claude Code 插件  
**TL;DR**: 多智能体管道 + 知识图谱 = 代码理解新范式

### 核心能力

- **多智能体管道**分析项目
- 自动构建文件/函数/类/依赖的知识图谱
- 可视化仪表板呈现整体结构

### 适用场景

面对大型代码库（20万行+）难以快速理解整体架构；文档过时，新成员上手需要数周；阅读代码如同"考古"。

### 对我们意味着什么

1. **知识图谱化是趋势** — 与我们的 SkillNet 理念相通
2. **多智能体管道** — 类似我们的 agent 分工模式
3. **架构可视化需求** — 可为 OpenClaw 设计类似的 agent 关系、skill 依赖、memory 结构可视化

**Relevant to:** tech-lead (工具链参考), Bob (架构可视化思路)

---

## HB-2151 — SkillRL: 递归技能增强强化学习 (2026-03-18)
**Source**: XHS @大模型知识分享 — "SkillRL：让Agent从过往经验中持续学习" (223赞/277收藏)  
**论文**: SkillRL: Evolving Agents via Recursive Skill-Augmented Reinforcement Learning  
**机构**: 北卡罗来纳大学教堂山分校  
**TL;DR**: 🔥🔥🔥🔥🔥 **核心发现** — SkillBank + 递归进化 = Agent持续学习

### 核心问题

现有基于记忆的方法：
- 存储原始轨迹 → **冗余且噪声较多**
- 难以提炼高层次、可复用的行为模式

### SkillRL框架创新

| 组件 | 功能 | 对应我们的系统 |
|------|------|----------------|
| **SkillBank** | 分层技能库 | ↔ Skill Registry |
| **经验蒸馏** | 从轨迹提取技能 | ↔ Skill Abstraction |
| **递归演化** | 技能库与策略协同进化 | ↔ Skill Evolution |
| **自适应检索** | 通用+任务特定启发式 | ↔ Skill Routing |

### 实验结果

- **SOTA** on ALFWorld, WebShop, 7项搜索任务
- 超过强基线 **15.3%**
- 有效降低 **token开销**，提升 **推理效用**

### 对我们系统的意义 ⭐⭐⭐⭐⭐

**SkillRL与SkillNet架构高度吻合！**

这验证了我们的核心设计方向：
1. ✅ 技能需要**分层存储**（不是扁平列表）
2. ✅ 技能需要**从经验自动提取**（不是手工编写）
3. ✅ 技能需要**持续进化**（不是静态定义）
4. ✅ 检索需要**自适应策略**（不是简单匹配）

**Actionable for Tech-Lead**:
- 评估SkillBank的分层结构（primitive → composite → workflow）
- 设计经验→技能的蒸馏机制
- 考虑RL-based skill evolution

**Relevant to: scout** — 论文深度研究 Priority-1  
**Relevant to: tech-lead** — Skill Registry架构参考  
**Relevant to: bob** — 技能进化理论支撑

---

## HB-2152 — Agent的下一阶段: Prompt → RL (2026-03-18)
**Source**: XHS @AI Infra | 算效提升 — "AI Agent 的下一阶段不是 Prompt，而是 RL" (26赞/38收藏)  
**参考**: NVIDIA NeMo Gym + NeMo RL  
**TL;DR**: 🔥🔥🔥🔥 **方向验证** — Demo强生产弱的根本：不会学习

### 核心诊断

当前Agent本质 = Prompt + Tool + Workflow

**致命问题**: 不会真正"学习"
- ❌ 不会从失败中优化策略
- ❌ 不会长期改进决策  
- ❌ 不会形成复杂任务能力

→ **Demo很强，生产环境很弱**

### NVIDIA的架构

```
Agent Server
    ↓
Simulation Environment (NeMo Gym)
    ↓
RL Training Framework (NeMo RL)
    ↓
Model Server / 推理系统
```

**核心逻辑**: 模拟环境 → 执行任务 → 获得奖励 → 更新策略

→ 把 **AlphaGo的训练逻辑** 搬到Agent世界

### 社区关键洞察 💡

> "RL对，但Agent奖励函数比围棋难多了——围棋输赢明确，Agent任务成功与否往往模糊。Demo强生产弱，本质是**评估标准不清晰**，不只是训练方法问题"

### 对我们系统的意义

| 挑战 | OpenClaw应对思路 |
|------|------------------|
| 奖励函数难定义 | Skill success/failure信号作为reward |
| 评估标准模糊 | Human-in-loop feedback积累 |
| 需要模拟环境 | Skill execution sandbox |
| 长期改进 | Skill evolution with RL signal |

**与SkillRL的关联**: SkillRL = RL + Skill的组合，正是我们需要的方向

**Relevant to: bob** — 训练架构战略方向  
**Relevant to: tech-lead** — NeMo Gym参考实现

---

## HB-2150 — Agent Loop: 大道至简 (2026-03-18)
**Source**: XHS @算筹新语 — "Agent Loop：大道至简的工程实践" (149赞/266收藏)  
**TL;DR**: 🔥🔥🔥🔥 工程范式对比

### 内容概要

文章配图对比了主流Agent框架的实现模式：
- React / LangChain / AgentScope
- Claude Code / BrowserUse

### 社区争议

评论观点："对于高度复杂领域专业化的工具，必须底层配置严格确定性的业务工具逻辑，绝对不能直接让LLM去任意发挥"

→ **结构化 vs 自由度的永恒权衡**

### 对我们系统的意义

SkillNet的设计理念：
- 高层：自由度（skill组合）
- 底层：确定性（tool实现）

这与React范式一致：Thought → Action → Observation循环

**验证**: Agent Loop是基础设施，SkillNet是上层抽象

---

## HB-2160 — 大厂重组架构应对AI冲击 (2026-03-18)
**Source**: XHS @未 LAI🌟🧠 — "为了应对AI的冲击，大厂纷纷重组架构"  
**TL;DR**: 🔥🔥🔥🔥 **市场信号** — Copilot渗透率仅3%，Agent赛道竞争激烈

### 关键数据
- **Copilot商业渗透率**: 仅3%
- **Copilot消费者日活**: 600w
- **ChatGPT日活**: 4.4亿

### 大厂动态
1. **微软**: 组织架构深度重组，加速Agent能力，构建传统业务+AI的护城河
2. **阿里巴巴**: 成立ATH事业群，CEO吴泳铭直接带队，整合几乎所有AI业务
3. **OpenAI**: 业务调整，聚焦code和Agent主业，Sora被降级

### 核心洞察
> "大象转型困难：高层要有执行力，中层要理解推进，执行层要有认知"

微软Nokia失败案例的警示：曾希望吃下Nokia拿到移动互联网船票，最后靠云业务才稳住。

### 对我们的意义
- **市场验证**: Copilot低渗透率说明AI产品化难度，我们的Agent系统架构设计方向正确
- **竞争格局**: 大厂都在聚焦Agent，赛道拥挤但机会明确
- **时间窗口**: 微软都面临时间压力，我们的开发节奏需要保持紧迫感

---

## HB-2161 — Google 5种Agent设计模式 (2026-03-18)
**Source**: XHS @欢乐马 — "Google今天放大招了！今天一次性发布了5个AI"  
**TL;DR**: 🔥🔥🔥🔥 **设计范式** — 内容而非格式，模式可组合

### 5种模式
1. **工具封装器 (Tool Wrapper)**
2. **生成器 (Generator)**
3. **审核器 (Reviewer)**
4. **逆向访谈 (Reverse Interview)**
5. **流水线 (Pipeline)**

### 核心观点
- 智能体设计的关键在于**内容而非格式**
- 五种模式可**组合使用**
- 确保智能体行为**可靠且复杂**

### 对我们的意义
- **设计验证**: 我们的多Agent协作系统与这些模式有潜在对应关系
- **可组合性**: 我们的Skill系统可以承载这些设计模式
- **下一步**: 需要深入研究Google完整文档

**Relevant to: bob** — 设计模式对照分析

---

## HB-2162 — 谷歌逐步蒸馏: 小模型超越大模型 (2026-03-18)
**Source**: XHS @Lucy 大模型观测站 — "谷歌研究：逐步蒸馏让小模型也能超越大"  
**论文**: Distilling step-by-step: Outperforming larger language models with less training data and smaller model sizes  
**TL;DR**: 🔥🔥🔥🔥🔥 **成本优化** — 多阶段蒸馏，中间模型降噪

### 核心机制
- 把一次性蒸馏拆成**多个阶段**
- 每个阶段引入**中等大小模型**作为过渡teacher
- 最终得到目标**小模型**

### 实验结果
- T5-Base比直接蒸馏同等模型高出**2-3个百分点**
- 某些任务**接近或超过**原来的T5-XXL老师模型

### 为什么有效
- 中间层有效**降噪**
- 让小模型学到**更纯净的知识**
- 相当于逐步降低老师输出的噪声水平

### 对我们的意义
- **成本优化**: Opus+Kimi组合，可引入中间层模型优化成本
- **技术储备**: 逐步蒸馏纳入模型策略工具箱
- **适用场景**: 边缘部署、成本敏感任务

**Relevant to: scout** — 论文深度研究 Priority-2  
**Relevant to: tech-lead** — 多模型架构优化参考

---

## HB-2163 — 大厂重组信号: Agent是核心战场 (2026-03-18)
**Source**: XHS @未 LAI🌟🧠 — "为了应对 AI 的冲击，大厂纷纷重组架构"  
**TL;DR**: 🔥🔥🔥🔥 **行业验证** — 微软/OpenAI/阿里全部押注Agent，Copilot仅3%渗透率

### 三大信号

| 公司 | 动作 | 关键数据 |
|------|------|----------|
| **Microsoft** | 组织架构深度重组 | Copilot商业渗透率**3%**，日活**600万** vs ChatGPT **4.4亿** |
| **OpenAI** | 业务调整 | 聚焦 **code + Agent**，**Sora降级** |
| **Alibaba** | 成立ATH事业群 | CEO吴泳铭直接带队，整合全部AI业务 |

### 关键洞察

1. **Agent是新的平台形态** — 大模型公司从通用聊天向Agent转型
2. **Code + Agent是核心组合** — OpenAI战略聚焦验证这个方向
3. **Copilot数据警示** — 即使有大厂背书，AI产品市场渗透仍极困难
4. **历史参照** — 微软当年Nokia失败，靠云业务才稳住；现在又面临AI转型生死局

### 对我们的意义

**战略验证**: 我们早期专注Agent架构（而非聊天包装器）与市场趋势一致，而非落后。

**市场机会**: Copilot的低渗透率说明Agent市场远未饱和，存在后来者机会。

**资源分配**: Sora降级再次验证 — Agent基础设施 > 媒体生成，用于实际生产力场景。

**Relevant to: bob** — 战略方向验证  
**Relevant to: scout** — 竞品Copilot深度分析 Priority-2

---
*[Content archived to library/insights-archive-kimi-2026-03-19a.md]*

---
- **Docker/K8s沙箱**: 安全隔离的执行环境

### 技术亮点

| 特性 | 实现 | 价值 |
|------|------|------|
| 子Agent协同 | 主Agent调度多个专业Agent | 复杂任务分解 |
| 动态加载 | Skill按需实例化 | 降低内存，提升启动速度 |
| 沙箱隔离 | Docker/K8s容器化执行 | 安全、可扩展 |
| 企业级 | 错误处理、监控、日志完整 | 生产可用 |

### 对我们系统的意义

1. **验证多Agent架构**: ByteDance也在采用子Agent协同模式
2. **Skill动态加载**: 我们的Skill Registry应考虑懒加载优化
3. **安全执行环境**: 需要为Skill执行设计沙箱机制
4. **LangGraph生态**: 考虑是否复用LangGraph的部分能力

**Relevant to: tech-lead** — 工程实现参考
**Relevant to: bob** — 架构设计验证

---

## HB-2167 — Agent Engineering: 不只是模型优化 (2026-03-18)
**Source**: XHS @少游 — "做 Agent，真正该优化的往往不只是模型" (1赞/28收藏)  
**TL;DR**: 🔥🔥🔥🔥 **系统思维** — Agent稳定性是系统工程，非单点优化

### 核心观点

很多 Agent 做不稳，问题不一定出在模型本身：

1. **执行闭环不够硬** — 做了≠做好，缺乏验证
2. **失败信息没有回流** — 错了不知道为什么，下次还错
3. **轨迹≠经验** — 保存了很多log，但没真正沉淀为知识

### 工程启示

> "做 Agent，不只是'让模型会做题'，还包括'让系统知道什么时候该继续做、为什么会失败、以及下次怎么少犯同样的错'"

### 对我们系统的意义

| 问题 | OpenClaw 应对 |
|------|---------------|
| 执行闭环 | ops-receipts + verification gates |
| 失败回流 | LESSONS.md + failure taxonomy |
| 经验沉淀 | SkillNet + insights archiving |

**关键差距**: 我们的失败信息回流是手动的（通过coaching），需考虑自动化机制。

---

---

## HB-2168 — Google 5种Agent Skill设计模式 (2026-03-18)
**Source**: XHS @WaiXiaoTe_AI — "Google又来定义Skill了" (56赞/88收藏)  
**原文**: https://x.com/GoogleCloudTech/status/2033953579824758855  
**TL;DR**: 🔥🔥🔥🔥🔥 **设计范式** — Claude Code/Cursor统一SKILL.md格式后，Google定义Skill内容设计标准

### 5种Skill设计模式

| 模式 | 英文名 | 核心机制 | 适用场景 |
|------|--------|----------|----------|
| 1 | **Tool Wrapper** | 按需加载特定库上下文，非全塞进系统提示 | 团队编码规范、框架最佳实践 |
| 2 | **Generator** | 模板+风格指南，强制输出结构一致 | API文档、报告生成 |
| 3 | **Reviewer** | "检查什么"与"如何检查"分离，清单外置 | 代码审查、安全扫描 |
| 4 | **Inversion** | Agent先当"访谈者"，分阶段收集需求 | 需求不明确、易跳步的任务 |
| 5 | **Pipeline** | 严格顺序步骤，每步有检查点 | 复杂任务，防止跳步 |

### 核心洞察

> Skill不断垂直且职能分化会越来越细，Google的5种模式基本定义了目前各种Skill的分类。

### 对我们系统的意义 ⭐⭐⭐⭐⭐

| Google模式 | OpenClaw对应 | 差距/机会 |
|------------|--------------|-----------|
| Tool Wrapper | Skill动态加载 | ✅ 已具备 |
| Generator | 文档生成Skill | ⚠️ 需统一模板 |
| Reviewer | PR Review Skill | ⚠️ 清单外置化 |
| Inversion | 需求收集流程 | ⚠️ 需强化门控 |
| Pipeline | 多步骤任务 | ⚠️ checkpoint机制 |

**Action**: 对照Google标准，完善我们的Skill设计规范

**Relevant to: bob** — Skill设计模式对标  
**Relevant to: tech-lead** — Skill Registry实现参考

---

## HB-2169 — Open SWE: Stripe/Ramp/Coinbase的趋同架构开源 (2026-03-18)
**Source**: XHS @Ne0在硅谷 — "Stripe们偷偷建的AI编码军团开源了"  
**开源框架**: Open SWE (LangChain创始人Harrison Chase发布)  
**原文**: https://x.com/hwchase17/status/2033977192053612621  
**TL;DR**: 🔥🔥🔥🔥🔥 **趋同进化** — 三家大厂独立开发，架构惊人一致

### 三家的内部Agent

| 公司 | Agent名称 | 特点 |
|------|-----------|------|
| Stripe | Minions | 独立接任务、写代码、提PR |
| Ramp | Inspect | 同上 |
| Coinbase | Cloudbot | 同上 |

### 不约而同的5大架构选择

1. **隔离沙盒** — 每个任务跑在独立云环境，权限严格隔离
2. **精选工具集** — Stripe配了约**500个精选工具**
3. **Slack优先** — 在工程师已有工作流接入，不学新工具
4. **丰富启动上下文** — 执行前加载完整issue/Slack对话/PR
5. **子Agent编排** — 复杂任务拆给专门子Agent

### 与Cursor/Copilot的本质区别

| 类型 | 模式 | 比喻 |
|------|------|------|
| Cursor/Copilot | 辅助工具 | 在编辑器给建议 |
| Minions/Cloudbot | 自主工人 | Slack说句话，Agent自己写代码、跑测试、提PR |

### 核心洞察 💡

> **"500个精选工具"** — 约束反而让Agent更可靠，搜索空间变小了。就像新员工入职，你不会第一天给他所有系统权限。

> **"真正壁垒不是框架代码，而是你的AGENTS.md里那些只有内部人知道的工程规范和业务逻辑"**

### 对我们系统的意义 ⭐⭐⭐⭐⭐

| Open SWE模式 | OpenClaw状态 |
|--------------|--------------|
| 沙盒隔离 | ⚠️ 需设计Skill执行沙箱 |
| 500精选工具 | ✅ Skill Registry可承载 |
| Slack优先 | ⚠️ 工作流集成方向 |
| 丰富上下文 | ✅ heartbeat.md机制 |
| 子Agent编排 | ✅ agents.call/send支持 |

**战略验证**: 
- 趋同进化证明我们的multi-agent架构方向正确
- 约束优于自由（500工具 vs 无限工具）
- AGENTS.md式的内部知识沉淀是真正的护城河

**Relevant to: bob** — 架构战略验证  
**Relevant to: tech-lead** — Open SWE框架研究 Priority-1

---

## HB-2170 — AT-GRPO: 多智能体RL训练的信用分配革命 (2026-03-19)
**Source**: XHS @momo读博日记 — "ICLR26 | Multi-Agent RL训练新思路" (18赞/25收藏)  
**Paper**: arXiv 2510.11062 — Stronger-MAS: Multi-Agent RL for Collaborative LLMs  
**Code**: github.com/pettingllms-ai/PettingLLMs (125⭐ / 17🍴)  
**Tags**: [Multi-Agent, RL, GRPO, ICLR2026, Credit Assignment]  
**TL;DR**: 🔥🔥🔥🔥🔥 **核心突破** — 多智能体RL需要重新设计分组和信用分配机制，不能简单套用单智能体配方

### 核心问题

单智能体的GRPO在MAS中失效：
- 不同角色、不同轮次的prompt不一致
- 轨迹级分组导致credit assignment不公平
- 训练不稳定，效果反而退化

### AT-GRPO三大创新

| 机制 | 单智能体GRPO | AT-GRPO (MAS) |
|------|-------------|---------------|
| **分组** | 按整条轨迹分组 | 按「角色+轮次」分组 |
| **采样** | 单一路径 | Tree-structured: 每轮采样多个动作，选最高奖励继续rollout |
| **信用分配** | 单一奖励 | 团队奖励 + 局部角色奖励结合 |

### 惊人结果

**长程规划任务**: 14%–47% → **96.0%–99.5%**  
**代码任务**: 平均提升 3.87%–7.62%  
**数学任务**: 平均提升 9.0%–17.93%

### 关键洞察

- **角色差异大** → 分角色策略更好
- **角色功能重叠** → 共享策略可能更优
- **直接套用单智能体RL** → 因状态不一致而退化

### 对我们意味着什么

1. **技能训练策略**: 如果引入RL优化技能执行，必须考虑多智能体场景的特殊性
2. **信用分配设计**: 团队奖励 vs 个体奖励的平衡是关键
3. **策略架构**: 支持「单策略共享」和「多策略分角色」两种模式
4. **Tree-structured sampling**: 可用于skill执行时的多候选生成和选择

**Relevant to: bob** — 多智能体协作机制设计  
**Relevant to: tech-lead** — RL训练系统设计参考  
**Relevant to: scout** — 论文深度研究 Priority-1

---

*Previous insights archived to library/insights-archive-*.md*
