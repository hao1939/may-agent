# Post 69b0fb40 — Agent = model + harness

**Source**: 奥森木 (@奥森木)  
**URL**: https://www.xiaohongshu.com/explore/69b0fb40  
**Date**: 2026-03-11 (2天前)  
**Collects**: 109  
**Comments**: 1  
**Archive Date**: 2026-03-13

---

## 核心内容

### 核心公式
> **Agent = Model + Harness**

模型提供智能，Harness让智能变得有用。如果你不是模型本身，那你就是Harness的一部分。

### Harness定义
模型之外的所有东西：
- 系统提示
- 工具描述
- 文件系统
- 沙箱
- 编排逻辑
- Hooks

### 裸模型的四个硬伤
| 硬伤 | Harness解法 |
|------|-------------|
| 无法维持跨会话状态 | 文件系统 + AGENTS.md |
| 无法执行代码 | Bash + 沙箱 |
| 无法获取实时知识 | Web Search + MCP |
| 无法搭建工作环境 | 工作空间 + 依赖管理 |

### 核心组件详解

**1. 文件系统** (最基础原语)
- 工作空间读写
- 中间结果持久化
- 跨Agent协作
- Git版本追踪/回滚/分支

**2. Bash + 沙箱**
- 突破预设工具集限制
- 自我验证循环: 写代码→跑测试→看日志→修Bug

**3. 记忆系统 (AGENTS.md)**
- 持续学习闭环
- 工作中写入知识
- 下次启动自动注入

**4. Context Rot对策**
| 对策 | 机制 |
|------|------|
| 压缩 | 智能摘要现有上下文 |
| 工具输出卸载 | 只保留头尾，全文存文件 |
| Skills渐进加载 | 不一次性灌入所有工具描述 |

**5. 编排与Hooks**
- 编排: 子Agent调度、任务分发、模型路由、Handoff
- Hooks: lint检查、续接逻辑、格式约束
- **模型是概率性的，Hooks让关键步骤变得可靠**

---

## 分析

**技术价值**: ⭐⭐⭐⭐⭐ (L1 - 架构哲学)

109收藏的 Harness Engineering 深度好文，系统性阐述了Agent工程的核心架构思想。与我们的Channel+Gateway+Runtime设计高度对齐。

**对我们意味着什么**:
- ✅ **完全验证三层架构**: Harness = 我们的Runtime层
- ✅ **Context Rot正式命名**: "上下文腐烂"成为社区共识术语
- ✅ **Hooks作为确定性注入**: 验证治理层设计的必要性
- ✅ **AGENTS.md被动注入**: 与社区最佳实践完全一致
- ✅ **文件系统中心地位**: 沙箱+Git+工作空间是基础设施

---

## L3 Flag

**#357**: Harness Engineering完整框架 — Model+Harness公式，Context Rot三对策，Hooks确定性注入
