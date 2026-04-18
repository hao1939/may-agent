# H-084: Memory as a Service Layer

**Status**: ARCHIVED — Resolved (no evidence gathered, untested theoretical proposal)
**Created**: 2026-04-06  
**Source**: Mem0 analysis (HB-260408)  
**Related**: AutoAgent (HB-260407), CORAL (HB-260406)

---

## Hypothesis

将记忆功能从 Agent 内部解耦，作为独立的服务层 (Memory-as-a-Service)，可以：
1. 支持跨 Agent 记忆共享
2. 实现多层次记忆管理 (User/Session/Agent)
3. 显著降低 Token 消耗 (Mem0 数据显示 -90%)
4. 提升长对话准确率 (+26%)

---

## Motivation

当前我们的 Agent 记忆机制：
- 依赖 `knowledge/` 目录下的文件系统
- 主要是系统级共享知识
- 缺乏用户级持久化记忆
- 会话级上下文管理粗放 (直接截断)

Mem0 的启示：
- **52.1k GitHub stars** 表明市场需求强烈
- **OpenClaw 原生集成** 证明架构兼容性
- **多层次设计** (User/Session/Agent) 覆盖完整记忆需求谱系
- **量化收益** (+26% accuracy, -90% tokens) 验证技术价值

---

## Proposed Architecture

```
┌─────────────────────────────────────────┐
│           Agent (SOUL-based)            │
│         - short-term context            │
│         - tool execution                │
└─────────────────┬───────────────────────┘
                  │ API
┌─────────────────▼───────────────────────┐
│       Memory Service Layer              │
│  ┌──────────┬──────────┬─────────────┐  │
│  │ User Mem │SessionMem│  Agent Mem  │  │
│  │(persist) │ (temp)   │  (learned)  │  │
│  └──────────┴──────────┴─────────────┘  │
└─────────────────────────────────────────┘
```

### Memory Types

| 层级 | 生命周期 | 内容 | 示例 |
|------|----------|------|------|
| **User** | 跨会话持久 | 用户偏好、历史交互 | "用户喜欢用中文" |
| **Session** | 单次会话 | 当前任务上下文 | 当前调试的问题 |
| **Agent** | Agent 实例 | Agent 自我学习 | 工具使用模式 |

---

## Testable Predictions

1. **Token 效率**: 使用智能记忆检索后，平均请求 token 数减少 >50%
2. **上下文保持**: 10+ 轮对话后，关键信息回忆准确率 >90%
3. **跨 Agent 共享**: User 级记忆可被不同 Agent 访问，提升一致性
4. **性能**: 记忆检索延迟 <100ms (p95)

---

## Implementation Sketch

```python
# 伪代码示例
class MemoryLayer:
    def get_relevant_context(self, 
        user_id: str,
        session_id: str, 
        agent_id: str,
        query: str,
        limit: int = 10
    ) -> Context:
        # 1. 检索 User 级记忆
        user_mem = self.user_store.search(user_id, query)
        
        # 2. 检索 Session 级记忆  
        session_mem = self.session_store.get(session_id)
        
        # 3. 检索 Agent 级学习
        agent_mem = self.agent_store.search(agent_id, query)
        
        # 4. 动态组装上下文
        return self.compose(user_mem, session_mem, agent_mem)
```

---

## Open Questions

1. 与现有 `knowledge/` 文件系统如何共存？
2. 用户隐私和数据隔离如何保证？
3. 记忆更新冲突如何解决 (多个 Agent 同时写入)？
4. 向量存储选型 (Chroma/Pinecone/Postgres+pgvector)？

---

## Related Findings

- **HB-260408**: Mem0 技术分析
- **HB-260406**: CORAL 的共享持久化记忆设计
- **HB-0285**: Role Clarity 的角色级状态管理

---

## Tags

`#memory` `#architecture` `#mem0` `#service-layer` `#scalability`
