# Claude两种Multi-Agent架构深度解析

**来源**: 小红书 @万有引力AI  
**赞数**: 1882 | 收藏: 2953 | 评论: 52  
**原文链接**: https://www.xiaohongshu.com/explore/69bdf00e000000001a02367b  
**时间**: 2025-03

---

## 核心发现

Claude有**两种截然不同的Multi-Agent范式**：
1. **Subagent** (子智能体)
2. **Agent Team** (智能体团队)

---

## 两种架构对比

| 维度 | Subagent | Agent Team |
|------|----------|------------|
| **类比** | 单进程内多线程 | 多进程/微服务 |
| **上下文** | 独立上下文窗口，接收父Agent指令 | 对等协作，平级协商 |
| **调度** | 轻量级，父Agent调度 | 资源隔离，协议通信 |
| **关系** | 父子层级 | 平级伙伴关系 |

---

## 社区讨论亮点

| 评论者 | 观点 |
|--------|------|
| @前年买的登山包 | "agent team真的有用么？感觉就是炫个技，没啥实际用处" (13赞) |
| @小白 | "做多视角讨论可以，比如辩论、批判思维、信息收集。但写代码大幅增加复杂度" |
| @(x)f | "Sub-Agent类似单进程多线程异步并发，Agent Teams类似多进程/微服务并行" (2赞) |
| @会敲代码的泡 | "肝完Claude code核心代码，学到agenttree、toolserver、skillsystem、asynctool、sequentialtool、harness" |
| @黑瞳 | "sub-agent需要提前创建agent.md吗？还是cc可以自动创建临时agent？" |

**作者回复**: "Claude Code可以自己根据任务创建。但做Agent开发/编排产品，需要为Subagent创建相应AGENT.md做约束"

---

## 5种Multi-Agent编排模式

(根据笔记图片整理)

| 模式 | 适用场景 | 特点 |
|------|----------|------|
| **分层委托** | 任务可明确分解 | 父Agent拆解→Subagent并行执行 |
| **对等协作** | 需要多视角输入 | Agent Team协商决策 |
| **流水线** | 有明确流程的生产任务 | 结构化中间产物传递 |
| **辩论模式** | 需要批判性思维 | 多Agent观点碰撞 |
| **专家委员会** | 复杂决策 | 各Agent代表不同专业领域 |

---

## 何时使用什么？

### 选择Subagent当：
- 任务可明确分解为独立子任务
- 需要并行加速
- 子任务有明确交付物

### 选择Agent Team当：
- 需要多视角讨论
- 任务需要协商决策
- 各Agent有平等的专业权重

---

## 对OpenClaw的意义

### ✅ 验证
- **Subagent模式**: OpenClaw的fork模式与Claude Subagent一致
- **分层调度**: orchestrator调度+worker执行架构

### 🔬 可探索
- **Agent Team实验**: 何时需要平级协作而非层级委托？
- **动态创建**: 能否根据任务自动创建临时Agent？
- **并行策略**: 哪些任务适合并行Subagent？

### ⚠️ 警示
- **复杂度陷阱**: 如@小白所说，Multi-Agent可能大幅增加任务复杂度
- **必要性检验**: 真的需要Multi-Agent吗？还是Single Agent足够？

---

## 关键洞察

> "Sub-Agent有自己独立的上下文窗口，只是接收父Agent传过来的指令和必要信息。Agent Teams更像对等协作关系，多个Agent各有角色，平级协商完成任务。" — 作者@

---

## 相关

- [HB-260931-agent-team-6-paradigms](HB-260931-agent-team-6-paradigms.md) - 6种Agent协作范式
- [insights-cn.md](../insights-cn.md) - 多Agent协调架构
