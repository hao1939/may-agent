# OpenAI最爱考的Coding Agent底层逻辑

**Source**: XHS@Tina 聊 IT  
**Date**: 2026-03-14 (美国)  
**Likes**: - | **Collects**: -  
**Link**: https://www.xiaohongshu.com/explore/69b51d46000000001a021041

---

## 核心内容

针对26NG春招，拆解Coding Agent岗位面试三大核心技术栈。

---

## 核心技术栈一：Code-level RAG

**面试必问**: 如何让Agent理解几百个文件的真实工程？

**破局思路**:
- ❌ 不用普通LangChain TextSplitter
- ✅ 使用 **Tree-sitter** 进行基于AST的代码切分
- ✅ 构建 **Call Graph**，让Agent顺藤摸瓜找Bug

---

## 核心技术栈二：Controlled Execution Sandbox

**面试高频点**: Agent生成恶意代码（如rm -rf）怎么办？

**破局思路**:
- 使用 **Docker SDK** 或更底层的 **gVisor / Firecracker**
- 动态拉起隔离的微型虚拟机执行代码
- 截获报错日志反哺给大模型

---

## 核心技术栈三：State Machine & Long-horizon

**面试雷区**: 不要只用简单While循环让Agent一直跑！

**破局思路**:
- 引入 **FSM（有限状态机）** 思维
- 设计 "Thought → Action → Observation" 循环
- 做 **Checkpoint**，确保API断开或模型幻觉时可Resumable execution

---

## 求职建议

> "这三个技术栈，随便拿出一个做透，都能在简历上写成一个S级的工业级项目，比瞎刷两百道算法题有用得多。"

---

## 与OpenClaw关联

| 技术点 | 社区实践 | OpenClaw映射 |
|--------|----------|--------------|
| Code-level RAG | Tree-sitter + AST | L2 Skill可集成 |
| Sandbox | gVisor/Firecracker | L0安全层对应 |
| State Machine | Checkpoint机制 | L1/L2状态管理 |
| Long-horizon | Resumable execution | L1 Task编排 |

**洞察**: Coding Agent工程实践已进入面试考点阶段，相关技术（沙箱、状态机、代码RAG）成为工业标配。

---

## 标签

#CodingAgent #面试 #CodeRAG #Sandbox #StateMachine #北美求职 #OpenAI
