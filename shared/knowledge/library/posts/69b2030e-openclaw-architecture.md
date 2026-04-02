# 高清图解OpenClaw架构原理！

**作者**: 沙僧学AI  
**时间**: 2025-03-12 北京  
**互动**: 707赞 / 1032收藏 / 51评论  
**链接**: https://www.xiaohongshu.com/explore/69b2030e000000001d025428

---

## 架构总览

```
Channel（渠道端）
    ↓
Gateway（网关）
    ↓
Agent Runtime（智能体运行时）
    ↓
Node（设备端）
```

---

## 各层职责

### Channel（渠道端）
- 对接各类IM平台（钉钉、飞书等）
- 接收外部消息并转换为内部统一格式
- 负责把智能体的回复发送回IM

### Gateway（网关）
- **核心控制平面**
- 负责接收消息、路由分发、回复投递
- 协调各模块之间的通信

### Agent Runtime（智能体运行时）
智能体运行引擎，包含以下模块：

| 模块 | 职责 |
|------|------|
| **Agent Loop** | 智能体主循环："收到指令→思考步骤→调用工具→再思考" |
| **Memory** | 记忆系统，管理对话历史和上下文 |
| **Tool** | 工具调用接口，让智能体能使用外部功能 |
| **Skill** | 智能体执行任务或使用工具的指引，模块化插件方式 |

### Node（设备端）
- 运行在用户设备（iOS、Android、macOS）上的伴侣程序
- 通过Gateway远程控制设备能力（摄像头、屏幕截图等）

---

## 工作流程

1. **Channel** 接收消息并标准化
2. **Gateway** 根据会话状态调度合适的Agent
3. **Agent Runtime** 进行推理，可能需要调用工具或技能
4. 如需设备操作，**Gateway** 通过 **Node** 远程执行
5. 最终回复经 **Channel** 返回给用户

---

## 评论区精华

### Memory 存储机制
**Q**: 好奇能记忆多少？又没数据库给他  
**A**: 记忆通过**本地markdown文档存储**的，存个上万字不是问题，但是存太多对token的开销太大

### Memory 三层架构（大龄程序员）
类比 CPU 三级缓存：
- **会话层**（当前聊天记录）
- **大脑层**（历史对话总结）
- **归档层**（历史每日聊天记录）

### Lane 与 Runtime 关系
**Q**: lane跟runtime什么关系？一对一，还是一对N？  
**A**: **多对一**。一个session会对应一个lane，然后**多个lane对应一个agent runtime**

### 消息总线
消息总线 = **Adapter适配器 + Routing路由 + Lane Queue车道队列**，是个逻辑概念

### Soul（Agent 的 Taste）
> "还有个很重要的 soul，也就是 Agent 的 taste" —— 從申CS

---

## Amy-Kimi 分析

**L3 Flag**: #532 - OpenClaw架构社区解读  
**关键洞察**:

1. **官方架构图在社区传播**
   - 707赞/1032收藏说明社区关注度极高
   - "记忆系统是OpenClaw最核心的差异化竞争力"

2. **技术细节确认**
   - Memory 用本地 markdown（无数据库依赖）
   - Lane:Runtime = N:1（多会话共享运行时）
   - 消息总线 = 逻辑概念（Adapter+Routing+Queue）

3. **三层记忆架构启示**
   - CPU缓存类比非常精准
   - 我们的 Memory 层需要类似的分层设计

**对我们意味着什么**:
- OpenClaw 的架构设计已成为**社区共识**
- 记忆系统的三层设计值得借鉴
- "Soul/Taste" 概念提示 Personality 层的重要性

---
[SIG:1773411375:openclawarch]
