# Claude's Two Multi-Agent Paradigms: Subagent vs Agent Team

**Source**: 小红书 (万有引力AI)  
**Date**: 2026-04-02  
**Likes**: 1272 | **Collects**: 1983

---

## Overview

Claude offers two distinct multi-agent paradigms that are often confused:

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Subagent** | Child agents that extend the main agent's capabilities | Parallel task execution |
| **Agent Team** | Multiple independent agents collaborating | Multi-perspective tasks |

## Subagent [子智能体]

**Purpose**: Extend the main agent's capability without polluting its context

**Characteristics**:
- Child agents spawned by the main agent
- Execute sub-tasks in parallel
- Return results to parent
- Main agent maintains focus on high-level coordination

**Example usage**:
```
"开启Subagent帮我并行完成x个任务"
(Enable Subagent to help me complete x tasks in parallel)
```

## Agent Team [智能体团队]

**Purpose**: Multiple agents with different roles collaborating on complex tasks

**Characteristics**:
- Independent agents with distinct roles
- Can debate, critique, collect diverse perspectives
- Each agent maintains its own context
- Suitable for: brainstorming, critical thinking, multi-angle analysis

**Use cases**:
- Debate scenarios
- Critical thinking exercises
- Information/idea collection from multiple perspectives

## Community Insights from Comments

**On practical utility**:
> "用来做多视角讨论是可以的，比如辩论，批判思维，信息和idea收集。但是用来写代码什么的，大幅度增加了任务复杂度吧"
> 
> (Good for multi-perspective discussions like debates, critical thinking, info collection. But for coding, it significantly increases task complexity)

**On when to use multi-agent**:
> "Agent的编排不强迫需要使用某种模式，能用一个LLM完成的是最好的，拆分子LLM完成单纯是为了不污染主LLM的上下文，让它足够聚焦"
>
> (Don't force a pattern. One LLM is best if it can handle it. Split only to avoid polluting the main LLM's context and keep it focused)

**Real-world example**:
> "最典型的比如用deep research功能。很多产品都是多agent协作"
>
> (The most typical example is deep research functionality. Many products use multi-agent collaboration)

## 5 Common Multi-Agent Orchestration Patterns

The article mentions 5 common patterns (details in images):
1. **Sequential** - Pipeline processing
2. **Parallel** - Subagent pattern
3. **Hierarchical** - Tree structure with coordinator
4. **Debate/Collaborative** - Agent Team pattern
5. **Dynamic** - Adaptive based on task

## Key Takeaway

**Don't use multi-agent for the sake of it.** Use Subagent when you need parallel execution without context pollution. Use Agent Team when you need diverse perspectives. If one LLM can do it, that's usually better.

---

**Tags**: #claude #multi-agent #subagent #agent-team #orchestration #patterns
