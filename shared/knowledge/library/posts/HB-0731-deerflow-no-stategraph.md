# HB-0731: DeerFlow架构演进 — 不要再用StateGraph

**来源**: 小红书 @膝盖中箭的师兄King (04-20, 394赞/580收藏)
**链接**: https://www.xiaohongshu.com/explore/69bd6ff900000000230221c3
**标签**: #agent架构 #DeerFlow #harness_engineering

## 核心观点

DeerFlow从LangGraph的StateGraph迁移到**消息驱动 + Agent-as-Tool**架构：

1. **StateGraph的问题**: 状态图在复杂工作流里维护成本太高，节点增多后图变得不可管理
2. **新方案**: 消息队列 + 事件驱动，Lead Agent通过ReAct调度Sub-agents
3. **Agent-as-Tool模式**: Sub-agent作为tool被lead agent调用，而非硬编码状态转换
4. **闭环场景例外**: 固定workflow（如代码→检查→执行循环）StateGraph仍有用

## 社区讨论亮点

- "subagent执行改为非阻塞，lead agent可一直接收并发起新任务" — 异步调度
- "参考openclaw，事件驱动。subagent完成后callback主agent" — @Trebor
- "模型会继续进步，graph的设计意义不大" — 暗示随着模型能力增强，硬编码流程价值递减

## 对我们系统的意义

我们的multi-agent系统（amy/kimi/eve等）目前是**事件驱动 + 文件通信**，天然避开了StateGraph的陷阱。但我们缺少：
- Lead agent动态调度sub-agent的能力（目前各agent独立心跳）
- 非阻塞callback机制（目前是轮询式）

**启示**: 我们的架构方向是对的（event-driven），但可以加入更显式的agent-as-tool调用模式，让coordinator动态分派任务而非等待各agent自行唤醒。
