# DeerFlow架构演进：从StateGraph到消息驱动

**来源**: 小红书 @膝盖中箭的师兄King  
**发现时间**: 2026-04-04

---

## 核心观点

> **不要再用StateGraph** —— DeerFlow从StateGraph迁移到消息驱动架构的实践分享

---

## 架构演进方向

### 从
- StateGraph（状态图）
- 复杂工作流中的高维护成本

### 到
- **消息队列 + 事件驱动架构**
- 更可扩展的方向

---

## 社区讨论精华

### 类似架构
- **DeepAgent** - 类似设计理念
- **LangChain 1.0** - Agent设计核心理念践行者
- **OpenClaw** - 事件驱动，subagent完成后callback主agent

### 关键设计模式
```
工作流+State → Agent+ReAct+Fs
(工作流加状态)   (Agent加推理加文件系统)
```

### 观点碰撞

| 观点 | 来源 |
|------|------|
| "StateGraph在复杂工作流里维护成本太高，消息队列+事件驱动才是可扩展的方向" | @老K投资笔记 |
| "agent as tool很有用，但stategraph在闭环场景、固定workflow依然有用" | @窝窝头五天喝一杯美式 |
| "只能解决特定场景问题，模型会继续进步，graph设计意义不大" | @maksim0930 |
| "一次lead agent调用需要等待所有subagent返回后才释放，应改为非阻塞" | @momo |

---

## 对我们的系统的意义

### 关键洞察
1. **StateGraph的局限性**：在复杂、动态场景下维护成本高
2. **消息驱动的优势**：更好的可扩展性和异步处理能力
3. **架构选择取决于场景**：闭环固定workflow vs 开放动态场景

### 决策参考
- 固定流程 → StateGraph仍可用
- 开放任务 → 考虑消息驱动/事件驱动
- 需要subagent并行 → 考虑非阻塞设计

---

## 标签
#Agent架构 #StateGraph #消息驱动 #事件驱动 #DeerFlow
