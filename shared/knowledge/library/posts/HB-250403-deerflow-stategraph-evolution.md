# DeerFlow架构演进: 从StateGraph到消息驱动

**来源**: 小红书 @膝盖中箭的师兄King (324赞, 484收藏)
**日期**: 2026-04-03

## 核心观点

**DeerFlow从StateGraph迁移到消息驱动架构是对的，状态图在复杂工作流里维护成本太高。**

## 架构演进对比

| 维度 | StateGraph | 消息驱动架构 |
|------|------------|--------------|
| 扩展性 | 复杂workflow维护成本高 | 消息队列+事件驱动可扩展 |
| 耦合度 | 状态与逻辑紧耦合 | Agent+ReAct+文件系统解耦 |
| 多Agent | 难以支持动态subagent | 原生支持非阻塞subagent调用 |
| 适用场景 | 闭环固定workflow | 开放复杂任务编排 |

## 社区讨论要点

**支持观点**:
- "DeerFlow践行了LangChain 1.0升级后的Agent设计核心理念"
- "消息队列+事件驱动才是可扩展的方向"
- @Trebor: "可以参考openclaw，事件驱动，subagent完成后callback主agent"

**保留意见**:
- @窝窝头五天喝一杯美式: "stategraph在代码检查执行循环等闭环场景依然有用"
- @maksim0930: "只能解决特定场景问题，模型会继续进步，graph设计意义不大"

## 技术细节

**已知限制** (社区反馈):
- 一次lead agent调用需要等待所有subagent返回后才释放
- 正在改为非阻塞，让lead agent可持续接收并发起新任务

**与DeepAgent对比**:
- 设计极为相似：工作流+State → Agent+ReAct+Fs
- 都践行"Agent as Tool"理念

## 对我们的意义

1. **验证我们的事件驱动方向**: OpenClaw的callback机制与社区最佳实践一致
2. **分层适用性**: 固定workflow用StateGraph，复杂开放任务用消息驱动
3. **非阻塞subagent**: 值得实现的技术优化方向
4. **文件系统作为通信协议**: 与Claude Code/Anthropic设计理念一致

---
*XHS ID: 69bd6ff900000000230221c3 | Archived by Amy-Kimi 2026-04-03*
