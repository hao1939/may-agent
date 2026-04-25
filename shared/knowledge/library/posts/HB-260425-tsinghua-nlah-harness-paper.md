# HB-260425: 清华NLAH论文 —— Agent上限由Harness决定

**Source**: XHS@木字旁南方的南 / 清华arXiv论文  
**URL**: https://www.xiaohongshu.com/explore/69cfb9ad00000000200380fe  
**Date**: 2026-04-03  
**Likes**: 23 | **Collects**: 719 | **Comments**: 24  
**Importance**: 🔥🔥🔥🔥  
**Tags**: #harness #nlah #tsinghua #arxiv #agent_architecture

---

## 论文概览

**《Natural-Language Agent Harnesses》** —— 清华团队arXiv顶会级论文

- **核心论点**: Agent的上限，早就不是模型本身，而是**harness（高层控制逻辑）**
- **验证基准**: SWE-bench（代码）+ OSWorld（桌面操作）

---

## 核心创新

### 痛点
传统harness全埋在代码、框架私有逻辑里：
- 难迁移
- 难复现  
- 难优化

### 解决方案: 两大核心

**1. NLAHs（Natural-Language Agent Harnesses）**
- 把工具调用、失败恢复、状态持久化等控制逻辑，**外部化成可编辑的自然语言规范**
- 用自然语言定义Agent的行为边界和控制逻辑

**2. IHR（Intelligent Harness Runtime）**
- 统一runtime解析执行NLAHs
- 彻底分离共享运行时策略与任务专属逻辑

---

## 实验验证

- **SWE-bench**: 代码场景
- **OSWorld**: 桌面操作场景
- **结论**: 架构可组合、可消融、可迁移
- **贡献**: 把harness从"胶水代码"变成了**可研究的第一类对象**

---

## 评论区辩论

### 🔥 上限 vs 下限之争
> **Shush**: "'Agent上限由Harness决定'不太对吧 harness毕竟只是辅助，可以看看terminalBench得出了相反的结论"

> **后院老王**: "我觉得是**下限**由Harness某种程度上决定..."

> **XiaoBa**: "很明显**上限是模型决定的**"

### 🔥 与现有方案的关联
> **Nova**: "NLAHs这个思路非常关键，把harness从代码逻辑外部化为自然语言规范，本质上是在做Agent领域的'配置即代码'。这跟**Claude Code的CLAUDE.md、OpenClaw的system prompt分层设计是同一个方向**：用自然语言定义Agent的行为边界和控制逻辑，而不是硬编码。"

> **Nova**: "实际落地中最大的挑战是NLAHs的**粒度控制**，太粗则失去约束力，太细则退化成伪代码。"

### 🔥 类比洞察
> **好奇的Ed**: "其实挺直观的，一群精英在一起，更需要管理层"

---

## 落地延伸方向

1. **低代码Agent平台**: 基于NLAHs让非技术人员快速搭建Agent
2. **Harness自动迭代**: 结合大模型自动生成/优化NLAHs
3. **垂直领域模板**: 科研、运维等场景的NLAHs定制
4. **行为审计**: 用NLAHs解决AI安全与可解释性

---

## 与 OpenClaw 的对齐验证

| NLAH 论文 | OpenClaw 设计 | 验证 |
|----------|--------------|------|
| 自然语言定义Harness | AGENTS.md + Skills | ✅ 方向一致 |
| 外部化控制逻辑 | Skill 系统 | ✅ 已实现 |
| 统一Runtime | OpenClaw Runtime | ✅ 一致 |
| 分离共享策略与任务逻辑 | L3 Flags + Session State | ⚠️ 部分对齐 |
| 粒度控制挑战 | AGENTS.md 格式需细化 | 📝 待完善 |

---

## 洞察

**Harness 作为第一类研究对象的里程碑**:

1. **学术 legitimacy**: 把 Harness 从工程经验提升为可研究、可实验、可发表论文的学术对象

2. **自然语言作为控制层**: NLAH 验证了用自然语言（而非代码）定义控制逻辑的趋势 —— AGENTS.md 正是此方向

3. **上限/下限的辩论有价值**: 
   - 模型决定**理论上限**
   - Harness 决定**实际可达下限**
   - 两者共同决定**实际表现**

4. **粒度控制是落地关键**: NLAH 面临的核心挑战与 AGENTS.md 相同 —— 如何在"太粗失去约束"和"太细变成伪代码"之间找到平衡点

5. **与 Claude Code 趋同**: 评论区指出与 CLAUDE.md 的相似性，说明行业正在 converging 到"自然语言配置 + 统一Runtime"的范式

---

**Archived**: 2026-04-25 by Amy-Kimi
