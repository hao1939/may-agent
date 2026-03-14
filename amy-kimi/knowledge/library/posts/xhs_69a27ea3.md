# Claude Code 官方两大新 Skill预告

**Post ID:** 69a27ea3000000001d01192a  
**Author:** 奥森木  
**Likes:** 471 | **Collects:** 789 | **Comments:** 7  
**Date:** 02-28 云南  
**URL:** https://www.xiaohongshu.com/explore/69a27ea3000000001d01192a

---

## Summary

Claude Code 负责人 Boris Cherny 官宣了两个"每天都在用"的新 Skill：/simplify（代码质量）和 /batch（批量迁移）。组合起来覆盖开发流程里最费时间的两个环节。

---

## Key Content

### /simplify — 代码质量优化

**用法:** 写完代码后加一句 `"hey claude do foo then /simplify"`

**工作机制:**
- 启动多个**并行 Agent**
- 从三个维度审查代码：
  1. 代码质量
  2. 性能优化
  3. CLAUDE.md 合规
- 自动输出优化后的版本

**社区反馈:** 已有人把它当成每个 PR 的标配步骤
**官方说法:** 新版比之前 marketplace 的社区版更强

### /batch — 批量迁移自动化

**用法:** `/batch migrate src/ from Solid to React`

**工作流程:**
1. **交互式规划**: Claude 先和你规划迁移方案
2. **创建隔离环境**: 创建几十个 Git Worktree
3. **并行执行**: 每个分配一个独立 Agent
4. **物理隔离**: 在完全隔离的环境里执行迁移、跑测试
5. **自动提PR**: 通过后自动提 PR

**效果:** 原来需要一周手动改的迁移任务，压缩到几小时。

### 设计思路

两个 Skill 共用一套核心架构：**并行 Agent**

| Skill | 并行模式 | 目标 |
|-------|----------|------|
| /simplify | 并行审查 | 让代码更好 |
| /batch | 并行执行 | 让迁移更快 |

### 社区期待

- React 18→19 大版本升级
- 建议加 /handoff 做上下文交接
- "/simplify 要暴露我过度设计的代码了" 😂

---

## Source

Boris Cherny (@bcherny) · Anthropic Claude Code Lead

---

## Tags

#ClaudeCode #AI编程 #开发效率 #Anthropic #代码质量 #自动化 #AgentAI #程序员工具 #技术前沿 #AISkill

---

## Amy-Kimi Analysis

**Significance:** L3 — 产品方向验证

**Key Insights:**

1. **并行Agent成为标准模式**: /simplify和/batch都基于并行Agent架构，验证了我们Multi-Agent路线的正确性

2. **审查 vs 执行分离**: /simplify是审查型（质量把关），/batch是执行型（批量操作）—— 两种Agent类型泾渭分明

3. **Git Worktree用于隔离**: 物理隔离保证安全性，这与我们的Sandbox思路一致

4. **Skill=原子能力组合**: /simplify = 并行审查Agent + 代码优化；/batch = 规划Agent + 执行Agent集群

**Connection to Our System:**
- 我们的Channel机制天然支持并行Agent
- 但Claude Code将其产品化为简洁的/simplify和/batch命令
- 启示：复杂的并行逻辑应该包装成简单的用户体验

**Strategic Implication:**
考虑为我们的系统设计类似的"一键并行审查"和"批量执行"Skill，降低用户使用门槛。
