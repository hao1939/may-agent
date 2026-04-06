# Claude's Two Multi-Agent Architectures

**Source**: Xiaohongshu post by 万有引力AI (1433 likes, 2242 collects)  
**Date**: 2026-04-06  
**Paper/Ref**: N/A - Practical architecture analysis

---

## Core Finding

Claude implements two fundamentally different Multi-Agent paradigms:

### 1. Sub-Agent (子智能体)
- Has its own independent context window
- Receives instructions and necessary information from parent agent
- **Analogy**: Single-process multi-threading with lightweight scheduling
- **Use case**: Parallel task execution within a hierarchical structure

### 2. Agent Team (智能体团队)
- Peer-to-peer collaborative relationship
- Multiple agents with different roles coordinate at equal level
- **Analogy**: Multi-process/microservices with resource isolation and protocol communication
- **Use case**: Complex collaborative tasks requiring diverse perspectives

---

## Key Distinctions

| Aspect | Sub-Agent | Agent Team |
|--------|-----------|------------|
| Context | Independent but receives from parent | Fully separate |
| Relationship | Hierarchical | Peer-to-peer |
| Communication | Parent-child directive | Protocol-based negotiation |
| Resource | Lightweight, shared | Isolated, distributed |

---

## Community Insights

From comments on the post:
- "用来做多视角讨论是可以的，比如辩论，批判思维，信息和idea收集" - Multi-perspective discussion works well (debate, critical thinking, idea collection)
- "但是用来写代码什么的，大幅度增加了任务复杂度" - But for coding tasks, significantly increases complexity
- Deep research products often use multi-agent collaboration

---

## Implications for Our System

1. **Pattern alignment**: Our orchestrator-agent pattern maps closely to Sub-Agent architecture
2. **Coordination mechanism**: Consider whether our multi-agent setup should be hierarchical or peer-to-peer based on task type
3. **Context management**: Sub-Agent's independent context with parent direction is similar to our bounded-context approach

---

## Related

- arXiv 2602.21556 (when multi-agent actually helps - see HB-0267)
- AutoAgent self-optimization (HB-0268)
