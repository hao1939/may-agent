# Harness Engineering：Agent 工程的第三次范式跃迁

**作者**: CuiLiang.ai  
**时间**: 2025-03-12 北京  
**互动**: 316赞 / 624收藏 / 22评论  
**链接**: https://www.xiaohongshu.com/explore/69b17a670000000026032b87

---

## 核心概念

从 **Prompt Engineering** → **Context Engineering** → **Harness Engineering**

Agent 时代的工程方法论正在经历第三次范式跃迁。

### Harness Engineering 定义
为 Agent 设计的**结构化（被约束的）运行环境**，就像给马装上缰绳和马鞍。

---

## 核心组件

| 组件 | 功能 |
|------|------|
| **🔧 工具接口** | Agent 能调用的 MCP/skills/白名单 |
| **🚧 执行边界** | 哪些操作需要审批/确认 |
| **📋 状态管理** | 持久化记忆和检查点 |
| **🔍 审计追踪** | 完整的行为日志 |

---

## 关键洞察

> **系统设计（Harness）对性能的影响甚至超过了模型本身的能力**

当模型能力趋同时，Harness 成为了构建可靠 AI 应用的关键。

---

## L0-L5 成熟度阶梯

1. **L0**: 写好 CLAUDE.md 指令文档
2. **L1-L2**: 引入 Hooks（钩子）进行约束
3. **L3-L4**: 将重复流程封装成 Skills（技能）
4. **L5**: 复杂的多 Agent 协作

---

## 评论区精华

### 神评论 - 小跃要努力
> "Harness engineering，可以理解为 **一个agent的约束框架**（harness单词本身就是被驾驭控制的意思），是为 Agent 设计的结构化运行环境。"

### 企业级落地的关键问题
**Q**: 在技术迭代非常快的背景下，我们应该更加关注、沉淀哪一层不变的东西？

**A**: 工具层一直在变，**不变的是工程范式层**。具体来说：
- CC会迭代
- Cursor 会迭代  
- 甚至 MCP 协议本身也可能被替代
- 但 **Harness Engineering 的五个维度是稳定的**

### 与 SDD 的区别
- **Harness**: 运行时的工程框架（Agent 怎么跑）
- **SDD**: 开发时的协作范式（人怎么告诉 Agent 该做什么）

---

## Amy-Kimi 分析

**L3 Flag**: #531 - Harness Engineering 完全验证  
**关键洞察**:
1. **完全验证我们的 Channel+Gateway+Runtime 架构**
   - Gateway = Harness（约束框架）
   - Channel = 审计追踪入口
   - Runtime = 被约束的执行环境

2. **"Harness > Model" 原则**
   - 与我们 "Skill Over Agent" 原则完全一致
   - 当模型能力趋同，系统设计成为核心竞争力

3. **L0-L5 阶梯与我们的路线**
   - CLAUDE.md → AGENTS.md 对应
   - Hooks → Gateway 拦截层对应
   - Skills → Skill 系统对应

**对我们意味着什么**: 
- 我们的架构不是"另一种实现"，而是**工程范式的自然演进结果**
- 继续深耕 Harness 层（Gateway 的拦截、审计、路由能力）
- Skill 层的标准化将成为生态竞争的关键

---
[SIG:1773411374:harness]
