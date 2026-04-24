# HB-260524: GitHub Agent Harness Trending — Minimalism vs. Full-Stack

> 来源: GitHub Trending (ai-agent topic, Apr 24-26 2026) | Amy-Kimi Heartbeat Session  
> 标签: #harness-engineering #agent-architecture #mcp #skills #minimalism

---

## 概览

XHS工具暂时不可用，转向GitHub Trending追踪Agent生态。发现两个极端但同样成功的Harness设计哲学：
1. **Minimalist Harness** — shareAI-lab/learn-claude-code (56.3k⭐)
2. **Full-Stack Harness** — NousResearch/hermes-agent (115k⭐)

两者验证：Harness-centric设计已成为行业共识，但实现路径分化明显。

---

## 🔥 Repo 1: learn-claude-code — 极简Harness哲学

**作者**: shareAI-lab  
**定位**: "Bash is all you need — A nano claude code–like agent harness, built from 0 to 1"  
** Stars**: 56.3k | Forks: 9.3k | 语言: Python/TypeScript

### 核心哲学
> **"Agency comes from the Model. An Agent Product = Model + Harness."**

- **Agency来源**: 模型训练赋予，非外部代码编排
- **Harness角色**: 车辆(vehicle)，非驾驶员(driver)
- **设计目标**: 教学级最小实现，理解Harness本质

### 架构设计

```
learn-claude-code/
├── agents/          # Agent定义
├── skills/          # 技能目录
├── tests/           # 测试套件
├── web/             # Web界面
└── docs/            # 文档
```

### 关键洞察
1. **分离关注点**: 模型负责感知-推理-行动，Harness负责基础设施
2. **从0到1构建**: 逐步教学如何实现一个生产级Harness
3. **语言无关核心**: 虽然用Python/TS实现，但概念可迁移

### 与OpenClaw的对齐
- ✅ **模型 vs Harness分离**: 与我们的Dispatcher/Worker分层一致
- ✅ **Skill-centric**: 技能作为可复用单元
- ⚠️ **教学 vs 生产**: 更侧重教学理解，非高并发场景

---

## 🔥 Repo 2: Hermes Agent — 全栈Harness平台

**作者**: NousResearch (知名开源AI研究机构)  
**定位**: "The agent that grows with you"  
** Stars**: 115k | Forks: 16.9k | Commits: 5,804

### 核心组件矩阵

| 组件 | 功能 | 与OpenClaw对应 |
|------|------|----------------|
| `agent/` | 核心Agent运行时 | Dispatcher+Worker |
| `skills/` | 内置技能库 | Skills目录 |
| `optional-skills/` | 可选插件技能 | 插件系统 |
| `acp_adapter/` | ACP协议适配器 | 协议适配层 |
| `acp_registry/` | ACP服务注册 | 服务发现 |
| `gateway/` | API网关 | Ingress |
| `plans/` | 计划/策略存储 | AGENTS.md |
| `plugins/` | 插件系统 | 扩展机制 |
| `cron/` | 定时任务 | 调度器 |
| `tinker-atropos` | 子模块(裁剪/压缩) | 轨迹压缩 |

### 关键文件: AGENTS.md
Hermes同样使用AGENTS.md作为Agent定义文件，验证了我们**"Markdown as Executable Knowledge"**的设计方向。

### 轨迹压缩系统
- `trajectory_compressor.py` — 轨迹压缩
- `tinker-atropos` (子模块) — 裁剪与压缩引擎
- 实现Agent长期记忆与上下文管理

### 与OpenClaw的对齐
- ✅ **AGENTS.md**: 完全相同的核心设计理念
- ✅ **Skill系统**: 内置+可选技能分层
- ✅ **ACP协议**: Agent Communication Protocol支持
- ✅ **轨迹压缩**: 长期记忆机制
- 💡 **完整栈**: 从网关到运行时到技能的全链路

---

## 对比分析: Minimalism vs Full-Stack

| 维度 | learn-claude-code | hermes-agent | OpenClaw定位 |
|------|-------------------|--------------|--------------|
| **目标** | 教学/理解 | 生产/平台 | 生产/框架 |
| **代码量** | ~数千行 | ~数万行 | ~万行级 |
| **架构** | 单层Harness | 微服务化 | 分层+事件驱动 |
| **协议** | 自定义 | ACP+MCP | 自定义+可扩展 |
| **Skills** | 基础支持 | 丰富生态 | 核心机制 |
| **记忆** | Session级 | 轨迹压缩 | Session+ErrorLog |
| **部署** | 单机 | 容器化集群 | 容器化 |

---

## 行业趋势洞察

### 趋势1: Harness成为独立工程领域
两个 repo 都在强调 **"Harness Engineering"** —— 将Agent基础设施从模型能力中分离，成为独立学科。

### 趋势2: AGENTS.md标准化
Hermes使用AGENTS.md验证了我们的直觉：结构化Markdown作为可执行Agent定义正在成为共识格式。

### 趋势3: 协议层竞争加剧
- **ACP** (Agent Communication Protocol): Hermes主推
- **MCP** (Model Context Protocol): 行业标准
- **A2A** (Agent-to-Agent): Google推动
- OpenClaw需要明确协议战略

### 趋势4: 技能生态分化
| 类型 | 代表 | 特点 |
|------|------|------|
| 内置技能 | hermes-agent/skills | 核心能力 |
| 可选技能 | hermes-agent/optional-skills | 插件扩展 |
| 市场技能 | 第三方生态 | 社区贡献 |

---

## 对OpenClaw的启示

### P1: 协议战略
- Hermes同时支持ACP和MCP
- 我们需要明确协议优先级：MCP为主？自定义协议？A2A兼容？

### P2: AGENTS.md强化
- 独立验证了我们的AGENTS.md设计
- 需要标准化格式，考虑与其他系统的互操作

### P3: 技能分层
- 区分core/optional/community技能
- Hermes的optional-skills是良好的分层模型

### P4: 轨迹与记忆
- hermes的trajectory_compressor值得研究
- 长期记忆是OpenClaw当前缺失层

---

## 参考链接

- [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) — shareAI-lab
- [hermes-agent](https://github.com/NousResearch/hermes-agent) — NousResearch
- [HB-260503](HB-260503-cn-agent-ecosystem-synthesis.md) — 生态系统综合分析

---

**评级**: ★★★★★ (直接架构相关性)
