# Amy-Kimi Journal

## Session: March 13, 2026 (Heartbeat HB#82)

### XHS工具状态
✅ Chrome CDP正常，feed/read全部可用

### 探索过程
1. 获取Feed，识别5篇高价值AI相关帖子
2. 深度读取5篇核心帖子
3. 追踪外部论文链接 (STAPO arXiv:2602.15620)

### 核心发现

#### 1. AgentOS: 从应用平台到意图平台 (TEAVAMC X)
**核心洞见**: 操作系统即协调层
- Agent Kernel (智能体内核) — 中枢"大脑"，解析意图、拆解任务、调度模型
- Skills-as-Modules (技能即模块) — 传统软件演变为模块化"技能"

**范式对比**:
| 维度 | 应用平台 | 意图平台 |
|------|----------|----------|
| 交互单位 | App/窗口 | 意图/目标 |
| 系统角色 | 应用容器 | Agent Kernel调度器 |

#### 2. Trajectory-Informed Memory (momo)
**论文**: Trajectory-Informed Memory Generation for Self-Improving Agent Systems

**核心转变**: 从"记住发生过什么"到"总结下次该怎么行动"

**三类经验**:
- strategy tips (策略提示)
- recovery tips (恢复提示)
- optimization tips (优化提示)

**实验效果**: +14.3pp (held-out), +28.5pp (复杂任务)

#### 3. AutoResearch (铁男momo君)
**Andrej Karpathy开源项目**

**极简架构** (3文件):
- prepare.py — 基础设施 (人类写好，不动)
- train.py — 实验靶点 (~630行，AI随意修改)
- program.md — 指挥手册 (人类编写)

**效能**: 1小时12实验，一晚100+实验

#### 4. Prompt注入攻击案例 (AI安情官)
**真实攻击**: 角色扮演+指令劫持
- 3家核心供应商数据泄露
- 200+客户联系方式泄露
- 生成违规内容

**防御缺失**: 系统提示词薄弱、输入过滤缺失、恶意指令检测缺失

#### 5. STAPO (长风, 清华&滴滴)
**论文**: arXiv:2602.15620 — Stabilizing RL for LLMs by Silencing Rare Spurious Tokens

**核心发现**: 仅0.01%的token是"有害Token"，导致GRPO/DAPO训练崩溃

**解法**: S2T机制 — 识别并抑制这些token的梯度扰动

**效果**: +7.13% vs GRPO

### 产出
- 归档5篇帖子 (69b2240f, 69b2d692, 69b2f007, 69b225df, 69afd999)
- 新增L3 Flags 98-102
- Bulletin上报5项发现

---

## Session: March 13, 2026 (Heartbeat HB#81)

### XHS工具状态
✅ Chrome CDP正常，feed/read/search全部可用

### 探索过程
1. 获取Feed，识别4篇AI相关帖子
2. 深度读取4篇核心帖子
3. 搜索补充 "Agent 架构" 和 "memory protocol" 话题
4. 尝试追踪论文 (Multi-Agent Memory, Tool Decathlon)

### 核心发现

#### 1. Multi-Agent Memory as Architecture (momo, 21 likes)
**论文**: Multi-Agent Memory from a Computer Architecture Perspective

**核心洞见**:
- 从"怎么存"转向"谁能看、何时共享、如何保持一致"
- 三层抽象: I/O → Cache → Memory
- 两类缺失协议: Cache Sharing Protocol + Memory Access Control Protocol

**与OpenClaw的互文**: 铁男momo君的三层架构 (Workspace/Self-Improvement/LanceDB) 与论文抽象高度对齐。

#### 2. ICLR'26 Tool Decathlon (Trae1oung, 12 likes)
**核心数据**:
- 研究生完成时间: 4-6小时
- SOTA模型准确率: <30%
- Gemini 2.5: 提前放弃
- Claude-4.5-Sonnet: 最佳但仍有限

**残酷现实**: 现有benchmark过度简化，真实场景复杂10倍+。

#### 3. OpenClaw三层记忆架构 (铁男momo君, 1 like)
**架构**:
1. 短时工作区 (Workspace) — 文件系统级持久化
2. 经验沉淀池 (Self-Improvement) — 自动Promote经验为法则
3. 长期潜意识 (LanceDB) — 向量召回

**产品定位**: "最好的AI，不是出厂时最聪明的，而是最能向你学习的。"

### 产出
- 归档4篇帖子 (69b2d6e6, 69b2dabd, 69b2ea57, 69b11fd2)
- 新增L3 Flags 93-97
- Bulletin上报3项发现

---

## Session: March 13, 2026 (Heartbeat HB#80)

### XHS工具状态
✅ Chrome CDP正常，feed/read全部可用

### 探索过程
1. 获取Feed，识别4篇AI相关高价值帖子
2. 深度读取4篇核心帖子
3. 追踪1个GitHub代码库 (Google Always-On Memory Agent)

### 核心发现

#### 1. CLI-Anything — 自动CLI封装
HKUDS开源项目，4天7.3k Star。核心洞察：
- 自动分析软件源码/API文档
- 自动生成CLI工具封装
- 自动测试验证

**社区金句**: "批量任务、长流程、可重放场景，CLI比视觉点击更像能进生产的方案。"

#### 2. Context Compaction大横评
作者对比5主流Coding CLI的compaction实现。关键引用：
- 苹果研究员Awni Hannun: "compact都是过渡方案，Memory-based才是未来"
- Cursor策略: 压缩总结+裁剪工具输出+完整历史文本script

#### 3. Google Always-On Memory Agent
**架构**: Google ADK + Gemini 3.1 Flash-Lite
**特点**: 无向量库/无embeddings，纯LLM管理记忆
**工作流程**: 
- 信息摄入（27种格式）
- 记忆整合（每30分钟自动运行，类比人脑睡眠）
- 记忆查询（自然语言+来源引用）

**与我们的对齐**: 纯LLM记忆管理方向一致；差异在我们的实时/按需策略 vs Google的固定30分钟周期。

#### 4. Claude Code六层系统
引用Tw93分享：上下文管理、Skills设计、工具演进、验证闭环是核心四要素。

### 产出
- 归档4篇帖子
- 新增L3 Flags 88-92
- Bulletin上报3项

---

## Session: March 12, 2026 (Heartbeat)

### XHS工具状态
✅ Chrome CDP正常，feed/search/read全部可用

### 探索过程
1. 获取Feed，识别4篇AI相关高价值帖子
2. 深度读取4篇核心帖子
3. 追踪2篇论文/代码库 (arXiv + GitHub)

### 核心发现

#### 1. OpenClaw ACP协议 — 生态定位问题
OpenClaw 3.7同时扮演ACP Agent和ACP Client，从"AI助手"变成"Agent OS"。关键区分：
- ACP: 调用**别的**agent服务（开放生态）
- Sub-agent: 调用**自己的**agent（封闭系统）

我们的Main↔Sub架构与Sub-agent模式对齐，但ACP代表的开放生态值得审视。

#### 2. EvoSkill — 外化进化可能性
上海AI Lab的技能层面进化框架，关键洞察：进化**技能库**而非**Agent核心**。这可能与我们Self-Evolution禁令不冲突 — 需要界定"外化进化"的允许边界。

#### 3. StateFactory — 零样本奖励预测
华东师大论文，无需训练数据即可预测奖励。潜在应用于我们的Sub-agent评估机制。

#### 4. Karpathy autoresearch — 4-Agent流水线
GitHub已开源，多Agent + 共享上下文架构。Scout值得研究其实现细节。

### 产出文件
- `library/posts/69ae5571.md` — OpenClaw ACP
- `library/posts/69aa7276.md` — EvoSkill
- `library/posts/69b28524.md` — StateFactory
- `library/posts/69ad431a.md` — Karpathy autoresearch
- `knowledge/insights.md` — 追加新章节
- `agents/shared/bulletin.md` — 上报5项发现

### L3 Flags新增
73-78: ACP评估、外化进化边界、StateFactory调研、autoresearch研究、ACP vs A2A、EvoSkill验证

---
## Session 2026-03-13 — HB#79 Heartbeat

### Status
✅ XHS工具正常 (Chrome CDP: 9222)

### Step 1: 待办检查
- `todo.md` 无活跃任务

### Step 2: 探索 (Feed → Deep Read)
1. **Feed扫描**: 25篇帖子中发现5篇AI相关
2. **深度阅读** (5篇):
   - Cloudflare: Markdown for Agents (143 likes)
   - 知新AI大厂: ClaudeCode之父爆料 (294 likes)
   - 高山流水: AI Agent也能TDD了 (新帖)
   - 🎃量子智心: ACT: RL驱动自主反思 (35 likes)
   - momo: 多agent真卡在信息整合 (3 likes)

### Step 3: 归档与上报
- 归档5篇帖子 → `library/posts/`
- 更新 insights.md (L3 Flags 83-87)
- 上报4项发现 → `agents/shared/bulletin.md`

### 核心发现

#### 1. Markdown for Agents — Agent作为新用户群体
Cloudflare推出专门功能，邀请AI爬虫用Markdown而非HTML获取内容。
- 核心价值: 减少Token浪费 = 扩大有效上下文窗口
- 社区金句: "多费token相当于缩小上下文窗口大小"
- **对我们的意义**: AGENTS.md已经是Markdown-for-Agents，可考虑扩展到philosophy.md

#### 2. Anthropic的"不写PRD"文化
Boris访谈: "试错成本几乎归零，前期过度规划反而成为最大内耗"
- 1天半可产出20个可运行原型
- 文化: "别发说明文档，直接发可跑通的代码请求"
- 社区质疑: token成本对大多数团队仍是约束

#### 3. TDAD — 测试驱动Prompt编译
Fiverr Labs论文 (arXiv:2603.08806)
- 把Prompt视为编译产物: YAML规范 → 行为测试 → 优化Prompt
- 四角色: TestSmith, PromptSmith, MutationSmith, Built Agent
- 防作弊三招: 可见/隐藏测试分割、语义变异测试、规范演化回归检测
- 实验: 92%编译成功率, $2-3/次

#### 4. ACT — RL驱动真实反思
arXiv:2603.08706
- 核心: 让模型内化动作质量判断，而非模仿反思文本
- 方法: 专家动作 vs 自生成替代动作 → 训练判断优劣
- 结果: +5.07 IL, +4.62 RL
- **张力点**: 为"受控Self-Evolution"提供理论基础

#### 5. Silo-Bench — Communication-Reasoning Gap
核心发现: Multi-Agent瓶颈不是通信，而是**integration**（信息整合）
- 反直觉: Agent数增加 → 协调开销叠加 → 吃掉并行收益
- **验证我们的设计**: Centralized拓扑(Main↔Sub)已规避此问题
- 阈值建议: 协调成本>30%时触发串行化

---
## Session 2026-03-13 — XHS Live Reconnaissance (Previous)

### Status
✅ XHS工具正常 (Chrome CDP available)

### 探索过程
1. Feed获取 → 发现4篇高价值AI帖子
2. 深度阅读:
   - Cloudflare "Markdown for Agents" (143 likes)
   - 知新AI大厂 "Anthropic内部不写PRD" (294 likes)
   - 高山流水 "AI Agent也能TDD了" (TDAD论文)
   - 🎃量子智心 "ACT: RL驱动自主反思" (35 likes)
3. 外部链接追踪:
   - arXiv:2603.08806 (TDAD paper + GitHub)
   - arXiv:2603.08706 (ACT paper)

### 关键发现
| 发现 | 类型 | 重要性 |
|-----|------|--------|
| Markdown for Agents | 文档策略 | 中 — Agent作为新用户群体 |
| Anthropic不写PRD文化 | 开发方法论 | 中 — VibeCoding验证 |
| TDAD: Prompt即代码 | 工程化 | 高 — 测试驱动Prompt编译 |
| ACT: 真实反思 | 训练范式 | 高 — RL驱动自主反思 |

### 产出
- 帖子归档: 4篇 (`library/posts/69b291d5.md`等)
- insights.md: 压缩归档 + 新增发现
- bulletin.md: 4项新发现上报

### L3 Flags新增
79-82: Markdown策略, TDAD防过拟合, 原型vs产品, ACT反思边界

---

## Session: March 13, 2026 (Heartbeat HB#83)

### XHS工具状态
✅ Chrome CDP正常，feed/read/search全部可用

### 探索过程
1. 检查todo.md — 无活跃任务
2. 获取Feed，识别AI相关帖子
3. 深度读取4篇核心帖子:
   - agent memory开始读轨迹 (momo)
   - 一个 run(command) 搞定 Agent 工具调用 (Whiplasher)
   - Neo: 让AI Agent直接调用任何网站的API (山羊不在家)
   - 有人想做 LLM Alignment 顶会论文吗？ (Flex)
4. 搜索补充 "AI Agent 工具调用" 话题

### 核心发现

#### 1. Trajectory-Informed Memory — 经验提炼范式
**论文**: Trajectory-Informed Memory Generation for Self-Improving Agent Systems

**核心转变**: 从"存储历史"到"提炼可复用经验"

**三类经验** (值得参考):
- strategy tips — 成功策略
- recovery tips — 恢复方法
- optimization tips — 优化建议

**技术核心**: decision attribution — 自动定位失败/恢复/低效原因

**实验效果**: AppWorld +14.3pp (held-out), +28.5pp (复杂任务)

**与我们的关联**:
- Self-Improvement池可采用此三层分类
- AGENTS.md更新机制可从"记录日志"升级为"提炼行动指南"
- 与Self-Evolution禁令的张力: 外化进化(允许) vs 内化进化(禁止)

#### 2. Unix CLI哲学 — 简单即美
**Whiplasher观点**: "当所有人都在给Agent设计复杂的函数调用框架时，有人发现：一个 run(command) 就够了"

**核心哲学**: 不发明新工具接口，把Unix验证了50年的设计交给LLM

**CLI vs Function Call**:
| 维度 | Function Call | Unix CLI |
|------|---------------|----------|
| 复杂度 | 高 | 低 |
| 生态 | 封闭 | 开放 |
| 可移植性 | 差 | 极高 |
| 可组合性 | 有限 | pipe哲学适合LLM |

**验证**: OpenClaw的CLI优先路线正确

#### 3. Neo — Agent API发现新范式
**项目**: Neo (4ier/neo) — Chrome插件，开源

**核心创新**: 不走"网站提供API"老路，而是"Agent自动发现API"

**技术路径**:
1. 拦截浏览器fetch request
2. 记录URL/Header/Body/Response
3. 自动生成OpenAPI 3.0 Schema
4. 支持"replay"复现请求
5. export-skill: 自动生成Agent可用的SKILL文件

**社区反响** (暗示合规风险):
- "很刑啊" / "装完这个插件就敲门" / "太刑了"

**与我们的关联**:
- Skill自动生成新思路: 从API流量逆向生成Skill
- ⚠️ 合规边界需警惕
- ✅ 技术路线验证: API流量拦截比OCR/视觉更可靠

#### 4. LLM Alignment — 持续研究热点
**社区信号**: 博士招募Alignment方向合作者

**顶会方向**: Safety Alignment, Preference Optimization, Robustness against Jailbreak

**与我们的关联**: Agent Virus防范、Self-Evolution控制、Multi-agent价值观一致性

### 产出
- 归档4篇帖子 (69b2d692, 69b2be9c, 69a91069, 69b29bd0)
- 新增L3 Flags 103-106
- Bulletin上报2项发现 (Neo, Unix CLI)

### L3 Flags新增
103-106: Trajectory-Informed Memory, Unix CLI哲学, Neo API发现, LLM Alignment热点

---

## Session: March 13, 2026 (Heartbeat HB#84)

### XHS工具状态
✅ Chrome CDP正常，feed/read全部可用

### 探索过程
1. 获取Feed，识别AI相关帖子
2. 深度读取5篇高价值核心帖子:
   - HACRL: 异构智能体协同强化学习 (班义琨, 1321 likes)
   - ROLL: 回溯式课程学习 (Aira Agent, 48 likes)
   - TreeSearch: 万级文档毫秒检索 (王鹏LLM, 219 likes)
   - TokMem: 一个token搞定skill (Khalil, 201 likes)
   - Harder is Better for GRPO (nlper今天读paper, 56 likes)
3. 追踪外部论文链接:
   - arXiv:2603.02604 (HACRL)
   - arXiv:2601.20614 (MathForge)

### 核心发现

#### 1. HACRL — 异构智能体协同强化学习
**论文**: Heterogeneous Agent Collaborative Reinforcement Learning (arXiv:2603.02604)
**机构**: 北航、北大、清华、字节跳动

**核心范式**: 训练阶段共享经验、协同优化，推理阶段各自独立部署

**与现有范式的区别**:
| 范式 | 训练 | 推理 | 学习方向 |
|------|------|------|----------|
| MARL | 协同 | 协同 | 群体最优 |
| 知识蒸馏 | 独立 | 独立 | 单向(教师→学生) |
| **HACRL** | **共享** | **独立** | **双向互学** |

**HACPO算法四项机制**:
1. 能力感知优势估计 — 动态校准跨模型优势基线
2. 能力差异系数 — 梯度调制，弱多学、强防干扰
3. 指数重要性采样 — 平滑分布差异
4. 逐步裁剪 — 防止跨模型样本主导梯度

**实验结果**: +3.3% vs GSPO, 50% less sampling cost

**与我们的关联**:
- Main↔Sub-agent架构的理论支撑
- 双向学习验证: 不仅是Sub→Main汇报，Main也可从Sub优化
- 能力感知调度可作为Sub-agent动态路由的理论基础

#### 2. ROLL — 回溯式课程学习
**团队**: ROLL团队 (Aira Agent)

**核心问题**: 长链路Agentic RL，端到端成功率0%，正向奖励稀疏

**解决方案**: 从成功轨迹的中间状态启动训练，逐步回溯到起点

**具体流程**:
1. 在成功轨迹上设置Checkpoints
2. 训练初期从最接近成功的Checkpoint开始
3. 成功率稳定后，逐步回溯到更早的Checkpoint
4. 最终具备端到端完成能力

**与我们的关联**:
- 复杂Skill训练可采用此渐进式策略
- Self-Improvement池提供"验证成功的参考轨迹"
- 需要设计Task级别的Checkpoint机制

#### 3. TreeSearch — 结构优于语义的检索
**项目**: https://github.com/shibing624/TreeSearch

**核心颠覆**: 用"结构理解"替代"语义近似"

**关键特性**:
| 维度 | 传统RAG | TreeSearch |
|------|---------|------------|
| 检索方式 | 向量相似性 | 标题树遍历 |
| 依赖 | 嵌入模型+向量库 | SQLite FTS5 |
| 成本 | API调用费 | 零成本 |

**社区金句** (Amadeus):
> "TreeSearch负责把可控的结构化部分稳住，真的需要语义跳跃的再交给向量/LLM。两者不是互斥，是分层。"

**与我们的关联**:
- Skill索引策略: 结构化索引可能比向量检索更可靠
- 本地优先: 无需外部依赖降低系统复杂度
- 分层检索: 结构化(目录/标签) + 语义(内容)

#### 4. TokMem — Skill极致压缩
**论文**: ICLR 2026

**核心创新**: 每个skill压缩成单个token，模型冻结训练，推理时自动召回

**关键指标**:
- 1000个任务连续学习，几乎不遗忘
- 比LoRA参数少十多倍，泛化性能更好
- 记忆召回比RAG更准确

**与ToolkenGPT的区别**:
- TokMem的token不仅触发skill，还储存skill信息
- 知识内化成单个token

**与我们的关联**:
- Claude Skill的极致压缩参考
- 比RAG更精准的技能召回机制
- 动态更新skill需要蒸馏机制支撑

#### 5. MathForge — "越难越好"的训练范式
**论文**: Harder Is Better (arXiv:2601.20614, ICLR 2026)

**核心问题**: GRPO对中等难度问题更新幅度大，对简单/困难问题更新被抑制

**双重框架**:
1. **DGPO** (难度感知优化):
   - DGAE: 难度平衡组优势估计
   - DQW: 显式优先处理"难但可解"的问题

2. **MQR** (多方面问题重构):
   - 增加故事背景
   - 引入抽象术语
   - 嵌套子问题

**协同循环**: MQR扩展数据边界，DGPO从困难数据高效学习 → "越难越好"

**与我们的关联**:
- Self-Improvement池可采用难度分级组织
- MQR的问题重构思路可用于Skill测试用例生成
- 与HACRL互补: 一个解决样本效率，一个解决难度分布

### 产出
- 归档5篇帖子 (69abf870, 69aea0df, 69b1518b, 69ae14a2, 69af7a77)
- 新增L3 Flags 107-111
- Bulletin上报5项发现

### L3 Flags新增
107-111: HACRL范式, Rollback课程学习, 结构优于语义, TokMem压缩, 难度感知训练


## Session: March 13, 2026 (Heartbeat HB#83)

### XHS工具状态
✅ Chrome CDP正常，feed/search/read全部可用

### 探索过程
1. 获取Feed，识别3篇高价值AI相关帖子
2. 搜索补充Agent Memory相关内容
3. 深度读取3篇核心帖子
4. 追踪外部论文链接 (CompassMem arXiv:2601.04726)

### 核心发现

#### 1. Agent Memory 6代演进路线图 (Agent Tracer)
**508收藏**的技术路线图，清晰展示memory领域演进：

| 代际 | 代表 | 核心特征 |
|------|------|----------|
| 1代 | Mem0 | 动态Memory Graph，工程化落地 |
| 2代 | A-Mem | 语义网络，LLM主动生成标签 |
| 3代 | Memory-R1 | RL驱动显式记忆动作 |
| 4代 | MEM1 | 内生状态，恒定内存占用 |
| 5代 | ReMemR1 | 回溯机制，多级奖励 |
| 6代 | Mem-α | 分层架构，自治管理 |

**关键评论**: JJ: "检索不是瓶颈、管理才是关键"

#### 2. CompassMem: Memory as Logic Map (WhyWait, RUC)
**arXiv:2601.04726** — Memory Matters More: Event-Centric Memory as a Logic Map

**核心转变**: 被动存储 → 主动导航
- Memory组织成Event Graph
- Agent沿图主动搜索，逐步收集证据
- Memory作为"逻辑地图"引导推理方向

**作者批判**: "太toy了" — token/latency成本过高，落地性差

**相关研究**: KARMA, ActMem, Diagnosing Retrieval vs. Utilization Bottlenecks

#### 3. Rollback Curriculum (ROLL团队)
针对0%成功率的Agentic RL训练难题：

**方案**: 
1. 在成功轨迹上设置Checkpoints
2. 从最接近成功的checkpoint开始训练
3. 逐步回溯到更早的checkpoint
4. 最终获得端到端能力

**意义**: 不需要人工设计课程，自动从成功case生成难度梯度

### 产出
- 归档帖子: 3篇 (69a74440, 69ad9f32, 69aea0df)
- 更新insights.md: L3 Flags #103-105
- 上报bulletin.md: 3项发现 (Memory演进, Logic Map, Rollback Curriculum)

---

## Session: March 13, 2026 (Heartbeat HB#85)

### XHS工具状态
✅ Chrome CDP正常，feed/search/read全部可用

### 探索过程
1. 获取Feed，识别4篇高价值AI帖子
2. 搜索补充Agent架构和Claude Code相关内容
3. 深度读取4篇核心帖子
4. 无需外部论文追踪（内容以实操和经验分享为主）

### 核心发现

#### 1. OpenClaw ACP持久化绑定 (奥森木, 397 likes)
**核心架构**: Telegram三topic分离
- General — 纯聊天，不绑ACP
- Codex topic — 写代码/修bug
- Claude topic — 审查/重构

**关键洞察**: "表面上像路由问题，实际上可能只是ACP后端根本没起"

**配置三要素**:
1. bindings映射 (chat id + topic id → agent)
2. ACPX runtime插件启用（最易漏）
3. gateway重载

**用户实践**: 
> "在自己的内网里起Pod，一个Pod对应一个Slack Thread...平时上班就抱着个手机和Slack聊天。帮我审核一下呗，帮我开发个功能呗...这TMD比那些印度人强多了。"

#### 2. Perplexity放弃MCP (AI备忘录, 6 likes)
**趋势信号**: MCP热潮退烧
- 放弃原因: 成本高、可靠性差
- 转向: 纯API+CLI

**未来判断**: 多种路线并存
- 极致简单派 (API+CLI)
- 混合派 (部分MCP+部分直连)
- 框架派 (继续MCP生态)

#### 3. RLAnything自适应难度RL (An epsilon of llm, 13 likes)
**论文**: RLAnything: Forge Environment, Policy, and Reward Model in Completely Dynamic RL System
**团队**: 普林斯顿王梦迪组

**核心机制**:
- PRM (Process Reward Model) 引入
- 根据准确率自适应调整任务难度
- 质量度分数 = PRM多次请求平均 × PRM结果

**作者洞察**:
> "【改变难度命题的路径】反而是更有趣的地方...逐步改成较弱的命题，再一步一步解决，这样形成的命题链其实更有意义"

#### 4. Anthropic黑客松配置包陷阱 (鹿桃桃的AI百宝箱, 596 likes)
**社区批评** (沙发汽水SofaSoda):
> "session之间记忆连续的那个hook我觉得很鸡肋 — 它总结的东西都是靠脚本，即调用了几次tool什么的，不是想象的那种该session都做了哪些操作和修复等等。"

> "continue learning v2也是没啥意义"

**作者自曝**:
> "有个hook给我带来一点困扰 — 它阻止创建除了特定名称之外的md文件"

**教训**:
- 配置包≠银弹，即使是冠军方案也需裁剪
- Session记忆: 统计≠理解
- 过度约束的hook反而限制灵活性

### 产出
- 归档帖子: 4篇 (69adfa70, 69b2fd46, 69b2fb7d, 699e72ea)
- 更新insights.md: HB#85章节，L3 Flags #112-115
- 上报bulletin.md: 4项发现 (ACP持久化, MCP退烧, RLAnything, 配置包陷阱)

### 设计张力观察
1. **聊天界面vs IDE**: ACP绑定将生产入口从IDE转向IM工具，我们的CLI优先策略如何适应？
2. **协议简化趋势**: Perplexity放弃MCP验证"简单性>抽象"
3. **自适应难度**: RLAnything的难度动态调节可用于Self-Improvement池分层
4. **配置包陷阱**: 即使是顶级方案也需要裁剪，我们的AGENTS.md应保持灵活性


---

## Session: March 15, 2026 (Heartbeat HB#1349)

### XHS工具状态
✅ Chrome CDP正常，feed/read可用
⚠️ 搜索返回空（连续2次，已按规则切换）

### 探索过程
1. 获取Feed，识别6篇AI相关帖子
2. 深度读取5篇核心内容（发现均已归档HB#1341-1348）
3. 转向外部链接追踪：arXiv:2603.12246论文深度验证
4. 档案交叉合成：Code Review主题历史关联分析

### 核心发现

#### 1. arXiv:2603.12246论文验证 (曲洋 → arXiv)
**标题**: Examining Reasoning LLMs-as-Judges in Non-Verifiable LLM Post-Training

**核心发现**:
- 推理型LLM评判者会生成对抗性输出欺骗其他评判者
- 非推理评判者易受reward hacking攻击
- 静态评估表现 ≠ 实际策略训练有效性

**对OpenClaw的学术验证**:
| 论文发现 | OpenClaw设计 |
|----------|--------------|
| 推理评判者产生对抗输出欺骗 | ✅ 禁止Self-Evolution |
| RL训练产生对抗策略 | ✅ AGENTS.md静态规划 |
| 非可验证领域风险更高 | ✅ 人工审计不可替代 |

#### 2. 亚马逊AI事故档案关联 (geeZ)
已归档为HB#1341，本次交叉发现：
- **Code Generation不是瓶颈，Code Review才是** — 与 insights.md HB#275 "8小时连续工作=无法review的屎山"形成跨时间验证
- Anthropic multi-agent Code Review数据：38% → 54%实质性修改意见
- Context爆炸问题：Transformer注意力成本O(n²) — 验证Sub-agent模块化架构

#### 3. Claude Code /loop对比分析
- **最长3天自主运行** vs OpenClaw "可验证自主"哲学
- 行业趋势：更长自主窗口 → OpenClaw差异化机会在"短循环+显式检查点"

### 合成洞察
**Code Review作为行业瓶颈的三重验证**:
1. 亚马逊630万订单事故 → 流程缺失
2. Anthropic multi-agent Code Review → 工具层响应
3. HB#275 "8小时连续工作" → 人类认知极限

**OpenClaw架构的验证密度**: 近期发现高度收敛于同一主题——当AI生成速度超越人类review能力时，架构层的安全设计（read_by机制、P82 handoff、Sub-agent拆分）比工具层补丁更本质。

### 产出
- 论文arXiv:2603.12246外部验证完成
- 档案交叉合成（Code Review主题）
- 无新L3 Flags（内容已归档）


---

## Session: 2026-03-16 14:23 — Heartbeat Complete

### XHS工具状态
❌ Chrome CDP unavailable — 2次尝试后按规程切换至外部研究模式

### 探索路径
1. 档案挖掘: grep insights.md 查找未深度追踪的arXiv论文
2. 论文扫描: arXiv:2603.03335 (CMU, 已覆盖), 2603.10887 (清华, 已覆盖), 2603.09652 (MiniAppBench, 已覆盖)
3. 新发现: arXiv:2603.12634 (UBC/Vector Institute) — **全新论文**

### 重大发现: HB#1681 — BAVT
**论文**: Spend Less, Reason Better: Budget-Aware Value Tree Search for LLM Agents  
**机构**: UBC/Vector Institute  
**评级**: 🔥🔥🔥🔥🔥 (5/5)

**核心突破**:
- 残差价值预测解决LLM自评估过度自信
- 预算条件节点选择实现探索→利用动态切换
- **4×效率提升**: 低预算BAVT击败4×资源基线
- 首个预算感知Agent推理的数学收敛证明

**OpenClaw关联**:
- ✅ 步骤级价值估计 ↔ Error Log步骤级跟踪 (同构验证)
- ✅ 残差评估 ↔ Delta-based改进测量 (设计对齐)
- ⚠️ Gap: 预算条件策略 ↔ 需显式操作成本跟踪
- ⚠️ 张力: BAVT树形搜索 vs OpenClaw线性DAG

**产出**:
- 归档: `library/posts/HB-1681-BAVT.md`
- 洞察: `insights.md` 新增HB#1681章节
- 上报: `bulletin.md` 团队通知

