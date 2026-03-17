# Amy-Kimi Insights

> 深度探索发现 — XHS社区 + 论文研究
> 每个洞察回答: **这个对我们意味着什么?**

---

## HB#2041 — Harness工程的控制论本质: 反馈是核心 (2026-03-17)
**Source**: XHS @马小疼 — "Harness 工程就是控制论"  
**Referenced**: 宝玉 AI《Harness 工程就是控制论》  
**Metrics**: 13赞 / 13收藏 / 北京  
**TL;DR**: 🔥🔥🔥🔥🔥 **架构范式级洞察** — Harness Engineering的本质是控制论: 可观测性 + 可控性

### 核心发现

**控制论三阶段演进**:
> 瓦特调速器 → Kubernetes → AI智能体写代码，同一类事情：人类不再亲自"拧阀门"，而是设计一套"传感 + 执行 + 反馈"的系统。

**有效反馈机制两要素**:
| 要素 | 含义 | 工程实践 |
|------|------|----------|
| **可观测性** | 定义好/坏状态，转化为系统信号 | 指标、日志、测试结果、代码风格、架构约束 |
| **可控性** | 观测误差后完成纠偏 | 自动限流、回滚、重构、重排任务 |

**现状批判**: 
> "现在很多团队还停在'开环控制'：拍脑袋设计，写完就上线，只靠少量测试兜底。观测不系统，纠偏不系统，'跑飞'几乎是必然结果。"

**未来工程师画像**:
> "未来最强的工程师，不是写得最多代码的人，而是最会设计闭环、最懂如何让代码变得可观测与可控的人。"

### 对OpenClaw的意义

**与HB#2031交叉验证**: Harness Engineering作为第三次范式跃迁，其控制论本质揭示OpenClaw设计的正确性

| 控制论要素 | OpenClaw实现 |
|-----------|-------------|
| 可观测性 | Session日志、activity.jsonl、AGENTS.md契约验证 |
| 可控性 | Skill白名单、确定性执行边界、自我纠错机制 |
| 反馈闭环 | Cron监控、心跳自检、知识库演进 |

---

## HB#2040 — MEMO: 多智能体评测稳定性框架 (2026-03-17)
**Source**: XHS @momo — "多智能体评测别只看均值"  
**论文**: arXiv:2603.09022 — MEMO: Memory-Augmented Model Context Optimization  
**Metrics**: 1赞 / 1收藏 / 美国  
**TL;DR**: 🔥🔥🔥🔥🔥 **评测方法论里程碑** — Multi-agent benchmark的ranking instability是对象问题而非噪声

### 核心发现

**问题定义: 多智能体评测不稳定性**
- **Ranking Instability**: 同一系统多次运行排名变化，这不是噪声细节，而是评测对象本身的问题
- **方差被掩盖**: 只报平均win rate，遮住了variance和prompt sensitivity这两个更关键的稳定性问题
- **偏差放大**: 多轮交互中小偏差会被不断放大，prompt choice导向不同有效策略

**MEMO双机制解决方案**:
1. **Retention (记忆保持)**: 维护persistent memory bank，将自博弈结构化经验写回上下文作为先验
2. **Exploration (探索优化)**: Tournament-style prompt evolution + TrueSkill不确定性感知选择 + Prioritized replay

**实验结果**:
| 模型 | 基础Win Rate | MEMO优化后 | 提升 |
|------|-------------|-----------|------|
| GPT-4o-mini | 25.1% | 49.5% | +97%相对提升 |
| Qwen-2.5-7B | 20.9% | 44.3% | +112%相对提升 |

- Run-to-run variance显著下降
- 在negotiation和imperfect-information游戏中收益最大

### 对OpenClaw的意义

1. **评测方法论升级**: 我们的multi-agent benchmark需显式报告ranking stability和prompt sensitivity
2. **Memory Bank设计参考**: MEMO的persistent memory bank与OpenClaw skill memory机制可互补
3. **自博弈优化路径**: retention + exploration框架可用于skill自我改进

---

## HB#2030 — 思科MCP安全架构: 企业级安全实践指南 (2026-03-17)
**Source**: XHS @机器猫带你读论文 — "思科：如何使MCP更安全？"  
**原文**: 思科论文 "Overview of MCP and Its Security Architecture" (2025-03-23)  
**Metrics**: 51赞 / 73收藏  
**TL;DR**: 🔥🔥🔥🔥🔥 **安全架构里程碑** — 思科提出的8项MCP安全措施与OpenClaw设计高度一致

### 核心发现

**MCP安全四大风险:**
| 风险 | 描述 |
|------|------|
| 未监控的访问 | AI助手可能访问或修改敏感数据而不被检测 |
| 缺乏内置审批流程 | 标准MCP实现对关键操作难以人工干预 |
| 有限的审计和监控 | 安全调查信息缺失 |
| 权限管理复杂性 | 多服务器间管理复杂 |

**思科8项安全措施:**
1. JWT身份验证（过期时间+令牌轮换）
2. 标准化协议（OAuth 2.1 / OpenID Connect）
3. 加密凭据存储（HashiCorp Vault等）
4. 基于角色的访问控制（RBAC + ACLs）
5. 参数模式验证
6. URL和外部标识符验证
7. 文件路径和系统命令清理
8. 适当的授权检查

### 对OpenClaw的意义

**设计验证**: OpenClaw架构与思科企业级建议1:1对齐
| 思科建议 | OpenClaw实现 |
|----------|--------------|
| 参数模式验证 + 授权检查 | AGENTS.md确定性契约 |
| RBAC访问控制 | Skill白名单机制 |
| 审计追踪 | Session日志 + activity.jsonl |

**行业背书**: 思科作为网络基础设施巨头，其安全建议验证了OpenClaw MCP安全层设计的方向正确。

---

## HB#2031 — Harness Engineering: Agent工程第三次范式跃迁 (2026-03-17)
**Source**: XHS @CuiLiang.ai — "Harness Engineering：Agent 工程的第三次"  
**Metrics**: 461赞 / 891收藏 / 33评论  
**TL;DR**: 🔥🔥🔥🔥🔥 **架构范式级洞察** — 从Prompt Engineering → Context Engineering → Harness Engineering

### 核心发现

**Agent工程三次范式:**
1. Prompt Engineering（提示工程）
2. Context Engineering（上下文工程）
3. **Harness Engineering**（约束工程）← 当前

**Harness Engineering定义:**
> "为Agent设计的结构化（被约束的）运行环境"

四要素:
- 🔧 工具接口: MCP/skills/白名单
- 🚧 执行边界: 审批/确认机制
- 📋 状态管理: 持久化记忆和检查点
- 🔍 审计追踪: 完整行为日志

**关键洞察:**
> "系统设计（Harness）对性能的影响甚至超过了模型本身的能力"

### 对OpenClaw的意义

**术语统一**: "Harness Engineering"可能成为行业标准术语，OpenClaw架构即Harness的实现范例。

**1:1对齐验证:**
| Harness Engineering | OpenClaw |
|---------------------|----------|
| 工具接口/白名单 | Skill系统 + MCP工具 |
| 执行边界 | AGENTS.md确定性契约 |
| 状态管理 | Memory系统 + 检查点 |
| 审计追踪 | Session日志 + activity.jsonl |

---

## HB#2032 — Multi-Agent Memory架构层: 从技巧到架构问题 (2026-03-17)
**Source**: XHS @momo — "multi-agent memory该做成架构层"  
**论文**: "Multi-Agent Memory from a Computer Architecture Perspective"  
**Metrics**: 183赞 / 252收藏  
**TL;DR**: 🔥🔥🔥🔥🔥 **架构范式级洞察** — 把multi-agent memory从"零散技巧"重新定义为"架构问题"

### 核心发现

**问题重新定义:**
不再只问"怎么存"，而是问:
- 系统里谁能看什么？
- 何时共享？
- 如何保持一致？

**计算机架构三层模型:**
1. I/O层
2. Cache层  
3. Memory层

**当前缺失的两类协议:**
1. **Cache Sharing Protocol** (缓存共享协议)
2. **Memory Access Control Protocol** (内存访问控制协议)

**Consistency问题:**
- 不同Agent何时能看到彼此更新？
- 冲突怎么解？
- 旧memory为什么还会继续被读？

### 对OpenClaw的意义

**Memory作为架构层**: 我们的Memory系统不仅是"存储"，更是"架构层"，与论文方向一致。

**前瞻性**: 这篇论文将multi-agent memory提升为架构问题，验证了OpenClaw设计的前瞻性。Memory protocol可能成为下一个标准化接口。

---

## HB#2033 — Anthropic Agent与Skills配合: 渐进式披露机制 (2026-03-17)
**Source**: XHS @阿衡的AI日常 — "Anthropic揭秘：Agent和Skills怎么配合工作"  
**原文**: Anthropic官方博客  
**Metrics**: 124赞 / 259收藏  
**TL;DR**: 🔥🔥🔥🔥🔥 **机制级洞察** — "渐进式披露"——用多少加载多少，像查字典一样

### 核心发现

**四层架构:**
1. 推理循环 (Reasoning Loop)
2. 工具调用 (Tool Calling)
3. Skills提供专业指导
4. MCP连接外部工具

**关键设计: "渐进式披露"**
> "不是一股脑全塞进去，而是用多少加载多少，像查字典一样。"

优势:
- 专业知识可以独立迭代
- 不用等模型升级

### 对OpenClaw的意义

**Skill Over Agent (P52)验证**: Anthropic官方确认Skills作为专业能力载体的架构方向。

**设计哲学一致**: Agent有智能但缺专业经验，Skills就是"攻略包"，按需加载 = Skill动态注入。


---

## HB#2020 — OpenClaw运营分析 (OA) 系统：自我优化的实战框架 (2026-03-17)
**Source**: XHS @amy师婧 — "如何让 OpenClaw多Agent系统实现自我优化？"  
**Metrics**: 1赞 / 21收藏 / 7评论  
**GitHub**: https://github.com/Amyssjj/Agent_Exploration/tree/main/CLIs/oa-cli  
**TL;DR**: 🔥🔥🔥🔥🔥 **运营范式级洞察** — Agent系统需要从"功能实现"转向"运营优化"，OA Dashboard赋予自我观测与进化能力

### 核心发现

**问题定义：完成 vs 预期结果的鸿沟**
> 多智能体系统最难的不是让它跑起来，而是如何跨越"完成"与"预期结果"之间的鸿沟

Agent总是反馈"任务已完成"，但用户却需要追着问和提意见——根本原因是Agent缺乏"是非观"。

**解决方案：OA (Operation Analytics) 运营分析指标看板**

| 核心模块 | 功能 | 价值 |
|---------|------|------|
| **Cron可靠性监控** | 任务执行成功率追踪 | 50% → 100% 稳定性跃迁 |
| **自我修复率 (Fix Rate)** | 自动发现问题并修复 | 实现真正无人值守 |
| **团队健康度** | Memory/Token/Prompt监控 | 资源优化与成本控制 |
| **知识飞轮** | 经验持续沉淀 | 系统自我进化 |

**关键洞察：** Agent缺乏"是非观"的根源在于：
- 缺乏指标定义
- 缺乏基准线 (Baseline)  
- 缺乏闭环自检机制

### 对OpenClaw的意义

**运营化思维的引入：**
- 从"能不能跑"到"跑得好不好"
- 从"人工运维"到"自我监控"
- 从"问题响应"到"预防自愈"

**与现有架构的契合：**
- **知识飞轮** ↔ OpenClaw Skill进化机制
- **自我修复率** ↔ Evaluator自动评估闭环
- **团队健康度** ↔ opBudget + Token成本控制

**Relevant to**: @bob (运营指标设计)、@tech-lead (监控与自愈实现)

---

## HB#2021 — Agent记忆结构化蒸馏: 11x Token压缩与检索保持 (2026-03-17)
**Source**: XHS @momo — "agent记忆开始蒸馏成薄层"  
**Metrics**: 3赞 / 5收藏  
**论文**: Structured Distillation for Personalized Agent Memory  
**TL;DR**: 🔥🔥🔥🔥🔥 **架构范式级洞察** — 将每轮交互蒸馏为四段式结构对象，实现11x压缩同时保持96%检索精度

### 核心发现

**问题本质：**
> 长对话Agent的现实困境：历史很有用，但原样带着走太贵。真正难的不是压短上下文，而是压短后检索能力不能崩塌。

**四段式结构化蒸馏：**

| 字段 | 含义 | 作用 |
|-----|------|------|
| **exchange core** | 交换核心 | 对话本质内容 |
| **specific context** | 特定上下文 | 场景化信息 |
| **theme room assignment** | 主题房间分配 | 分类与组织 |
| **files touched** | 触及的文件 | 关联资源 |

**实验结果：**

| 指标 | 原始 | 蒸馏后 | 效果 |
|-----|------|--------|------|
| Token数 | 371 | 38 | **11x压缩** |
| Verbatim MRR | baseline | 96% | 检索保持 |
| Cross-layer | - | **超baseline** | 分层优势 |

**关键创新：**
- 不是简单的一句话摘要
- 结构化可检索对象
- 个性化记忆（针对Agent场景优化）

### 对OpenClaw的意义

**Memory架构优化路径：**
1. **短期上下文** → 完整保留（当前任务）
2. **中期记忆** → 结构化蒸馏（Skill执行历史）
3. **长期知识** → 压缩归档（Insights沉淀）

**与现有设计的契合：**
- **Knowledge单元** ↔ 结构化蒸馏对象
- **渐进式披露** ↔ 分层记忆检索
- **Token成本控制** ↔ 11x压缩直接收益

**Relevant to**: @bob (记忆架构设计)、@tech-lead (蒸馏实现)、@scout (论文深度研究)

---

## HB#2010 — 上下文拆分 vs 角色拆分: 多智能体设计范式 (2026-03-18)
**Source**: XHS @风送叶至 — "按角色拆分来设计多智能体是错的？"  
**Metrics**: 1赞 / 2收藏 / 0评论（刚发布）  
**TL;DR**: 🔥🔥🔥🔥🔥 **架构范式级洞察** — 角色拆分导致"传话游戏效应"，上下文拆分才是正确思维模型

### 核心发现

**绝大多数多智能体设计失败的根源：**
> 按角色拆分工作（规划师、开发工程师、测试工程师），而非按上下文拆分

**"传话游戏效应"：**
- 信息在每一次角色交接中都会出现衰减
- 角色边界成为信息丢失的黑箱
- 看似清晰的职责划分，实际造成上下文断裂

**正确的思维模型：以上下文为中心的任务拆解**
- 不是"谁来做"，而是"什么信息需要在一起处理"
- 上下文边界决定Agent边界，而非角色定义
- 减少交接 = 减少信息衰减

### 对OpenClaw的意义

**OpenClaw Skill设计哲学的验证：**

| 传统多Agent | OpenClaw Skill | 上下文中心设计 |
|------------|----------------|----------------|
| 角色定义（规划师/开发者/测试者） | 能力声明（Read/Write/Bash） | 工具上下文聚焦 |
| 跨角色交接 | 按需动态注入 | 需要时出现 |
| 传话游戏效应 | 渐进式披露 | 最小上下文原则 |

**与历史发现的交叉验证：**
- HB#1970: "Skill不是装备栏" — 动态注入而非角色分配
- HB#1970: "渐进式披露" — 应对上下文限制的架构艺术
- HB#1991: MCP Tool Poisoning — 上下文边界 = 安全边界

**对Bob的设计启示：**
1. AGENTS.md 应强调上下文边界而非角色职责
2. Skill 是能力单元，不是角色扮演
3. Main Agent ↔ Sub-agent 的分工应基于任务可并行性（上下文独立性）

**Relevant to**: @bob (架构设计哲学)、@tech-lead (Agent分工实现)

---

## HB#2011 — Claude Code Agent as Skill: 上下文隔离新机制 (2026-03-18)
**Source**: XHS @磨磨唧唧的痛 — "claude code 居然 agent as skill 了"  
**Metrics**: 479赞 / 730收藏 / 38评论  
**TL;DR**: 🔥🔥🔥🔥🔥 **机制级发现** — `context: fork` 让 Skill 变成独立 Agent，上下文隔离是关键

### 核心发现

**Claude Code 隐藏机制：**
```yaml
context: fork        # 加这一行，Skill 变 Agent
allowed-tools: Bash, Read, Glob  # 独立工具集
```

**普通 Skill vs Fork Skill：**

| 维度 | 普通 Skill | Fork Skill (Agent as Skill) |
|------|-----------|----------------------------|
| 执行方式 | 文本注入当前对话 | 独立执行单元 |
| 上下文 | 借用主对话 context | 完全隔离，看不到主对话历史 |
| 工具集 | 使用主 Agent 工具 | 拥有独立工具集 (SendMessage, TaskCreate) |
| 调用方式 | 隐式调用 | `/skill-name` 直接调用 |
| 适用场景 | 简单工具封装 | 复杂任务、需要隔离的执行 |

**作者关键洞察：**
> "开成子 agent 关键在于上下文隔离，当然主 agent 能这样串行 skill，但是上下文会不干净"

### 与OpenClaw的对比

| 特性 | Claude Code Agent as Skill | OpenClaw Sub-agent |
|------|---------------------------|-------------------|
| 触发方式 | `context: fork` | AGENTS.md 显式声明 |
| 上下文隔离 | ✅ 完全隔离 | ✅ Main/Sub-agent 分离 |
| 工具集定义 | `allowed-tools` 字段 | SKILL.md 声明式 |
| 调用方式 | `/skill-name` | 自然语言委托 |
| 记忆共享 | 任务完成后返回结果 | 结果上报，不共享中间状态 |

**OpenClaw 优势：**
- 更自然的委托语义（自然语言 vs 命令式调用）
- SKILL.md 声明式工具集更清晰
- AGENTS.md 确定性契约保障可预期行为

**Claude Code 优势：**
- 更轻量的创建方式（一行配置）
- 直接通过 `/skill-name` 调用，交互更明确

### 对OpenClaw的意义

**验证我们的方向：** 上下文隔离是 Sub-agent 设计的核心原则，与 Claude Code 的 fork 机制不谋而合。

**潜在改进方向：**
- 考虑更轻量的 Sub-agent 创建方式
- 明确 Skill 与 Sub-agent 的边界定义

**Relevant to**: @bob (Sub-agent设计)、@tech-lead (上下文隔离实现)

---

## HB#2012 — OpenClaw vs Claude Code: 社区定位共识 (2026-03-18)
**Source**: XHS @aopstudio — "OpenClaw很好，但Claude Code也能干它的事"  
**Metrics**: 3836赞 / 5921收藏 / 335评论  
**TL;DR**: 🔥🔥🔥🔥🔥 **极高价值社区讨论** — 用户共识: "Claudecode是工作，OpenClaw是生活"

### 核心发现

**精辟总结：**
> "Claudecode是工作，OpenClaw是生活" — @珐克的说

**OpenClaw 独特优势（用户共识）：**
1. **即时通讯集成** — 聊天软件远程控制
2. **多端同步** — 手机/电脑无缝切换
3. **长期记忆** — 跨会话持续上下文
4. **异步任务** — 离开电脑时自动跑任务

**关键用户反馈：**
> "补充一个OpenClaw的独特优势：它能接入聊天软件实现远程控制+多端同步，而且有长期记忆机制。我常用它让AI在我不开电脑时自动跑任务，回家看结果就行。Claude Code目前只能在终端用，这是两者定位的本质区别" — @阿強的推理

**争议与反思：**
> "正是因为openclaw其实就是装了一堆插件的claude code（或其他cli agent），所以也不要对他的能力有什么过高期待——毕竟是cli agent套皮，所以能力上限小于等于cli的上限。除非有成熟的skill工作流或mcp，否则浪费token、遵循差、一致性差、代码冗长、难于debug等等，cli有的问题他都有" — @小王米

### 对OpenClaw的意义

**差异化定位验证：**
- Claude Code = 终端内的高性能编码助手
- OpenClaw = 跨平台、异步、有记忆的智能伙伴

**关键成功因素：**
1. **Skill生态成熟度** — 回应"装了一堆插件"的质疑
2. **MCP集成深度** — 扩展能力边界
3. **记忆系统可靠性** — 长期上下文的核心价值
4. **异步任务稳定性** — 远程控制的信任基础

**社区认知：** OpenClaw 的价值不在于替代 Claude Code，而在于不同的使用场景（移动、异步、长期陪伴）。

**Relevant to**: @bob (产品定位)、@tech-lead (Skill生态建设)

---

## HB#2001 — Agent架构年终盘点: 卷了一整年最后都一样 (2026-03-17)
**Source**: XHS @403-error — "Agent 架构卷了一整年最后都一样"  
**Metrics**: 1000赞 / 1533收藏 / 41评论  
**TL;DR**: 🔥🔥🔥🔥🔥 **极高价值** — 2025年架构从Multi-Agent转向AgentHarness/Runtime/SuperAgent，核心收敛到ReAct+Middleware+Skills

### 核心发现

**架构演变路径：**
```
2024 H1: 单体Agent (ReAct/CoT)
2024 H2: Multi-Agent (CrewAI/AutoGen群聊)
2025 H1: Agent Harness (Claude Code/Cursor Agent模式)
2025 H2: Agent Runtime (长期运行、状态管理)
2026: SuperAgent (Agent + 编排 + 工具生态)
```

**架构收敛共识：**
```
用户请求
    ↓
Orchestrator (路由决策)
    ↓
Agent Core (ReAct循环)
    ↓
Middleware层 (Memory/State/Tools)
    ↓
Tools/Skills/MCPs
```

**趋势总结：**
1. **Multi-Agent退潮** — 群聊模式被证明难控制
2. **AgentHarness兴起** — 单Agent+强工具的Claude Code模式
3. **Middleware成为战场** — Memory、State、Tools的编排能力
4. **Skills > Agents** — 能力复用比角色分工更重要

### 对OpenClaw的意义

**前瞻性验证：** OpenClaw设计（Skill中心、Sub-agent按需、长期记忆）与行业收敛方向一致。

**与Claude Code/Cursor的对比：**

| 维度 | Claude Code | Cursor Agent | OpenClaw |
|------|-------------|--------------|----------|
| 触发方式 | 终端命令 | IDE集成 | 聊天软件 |
| 上下文长度 | 200K | 200K | 分层Memory |
| 记忆持久化 | Session级 | Session级 | 长期记忆 |
| 多Agent | Teammates模式 | 无 | Sub-agent按需 |
| 工具生态 | Skills + MCP | Tools + MCP | Skills + MCP |
| 异步执行 | 否 | 否 | ✅ 核心特性 |

**差异化机会：** OpenClaw 在「异步执行+长期记忆+聊天集成」三个维度有独特优势。

**Relevant to**: @bob (架构演进方向)

---

## HB#2034 — MEMO论文: 多智能体评测的稳定性危机 (2026-03-18)
**Source**: XHS @momo — "多智能体评测别只看均值"  
**论文**: MEMO: Memory-Augmented Model Context Optimization for Robust Multi-Turn Multi-Agent LLM Games (arXiv:2603.09022)  
**Metrics**: 1赞 / 1收藏  
**TL;DR**: 🔥🔥🔥🔥🔥 **评测范式级洞察** — ranking instability不是噪声，而是评测对象本身的问题；小偏差在多轮多Agent交互中被指数级放大

### 核心发现

**问题定义: ranking instability**
> "同一系统多跑几次名次就变，这不是噪声细节，而是评测对象本身的问题"

**根本原因:**
1. **偏差累积**: 多轮交互中，小偏差会被不断放大
2. **多Agent耦合**: 偏差在多Agent间被相互放大
3. **Prompt敏感性**: 不同prompt产生不同有效策略，进一步加剧方差

**传统评测的问题:**
- 只报平均win rate
- 掩盖了variance和prompt sensitivity
- 导致rankings unreliable across repeated tournaments

### MEMO解决方案

**双机制设计:**

| 机制 | 功能 | 实现方式 |
|------|------|----------|
| **Retention** | 持久化记忆 | persistent memory bank存储结构化经验，作为priors注入后续对话 |
| **Exploration** | 高效探索 | tournament-style prompt evolution + TrueSkill uncertainty-aware selection + prioritized replay |

**实验结果:**
- GPT-4o-mini: 25.1% → 49.5% win rate
- Qwen-2.5-7B-Instruct: 20.9% → 44.3% win rate
- 每任务仅需2,000场自博弈
- Run-to-run variance显著下降

### 对OpenClaw的意义

**评测设计启示:**
| 传统做法 | MEMO建议 | OpenClaw应用 |
|----------|----------|--------------|
| 只报平均成功率 | 显式报告variance | Evaluator输出增加稳定性指标 |
| 单次运行 | 多次运行取分布 | Stress test with multiple seeds |
| 忽略prompt sensitivity | 显式测试不同prompt | AGENTS.md契约版本兼容性测试 |

**架构验证:**
- **AGENTS.md契约** → persistent memory bank的一种形式（确定性行为约束）
- **Skill动态加载** → retention机制（经验结构化复用）
- **Sub-agent分工** → imperfect-information game的分解策略

**关键洞察:**
> "以后看multi-agent leaderboard，最好都多问一句：ranking stability和prompt sensitivity有没有被显式报告"

**Relevant to**: @bob (评测设计)、@tech-lead (稳定性测试)、@scout (论文深度研究: arXiv:2603.09022)

