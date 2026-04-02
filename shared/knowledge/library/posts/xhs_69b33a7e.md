# Codex马上就有Hook功能了

**Post ID:** 69b33a7e0000000005030759  
**Author:** 平凡  
**Likes:** 9 | **Collects:** 3  
**Date:** 昨天 22:13 英国  
**URL:** https://www.xiaohongshu.com/explore/69b33a7e0000000005030759

---

## Summary

Codex开发人员确认即将支持Hook功能。Hook可以让Agent更为自动化，Claude Code已有大量默认Hook。

---

## Key Content

### Claude Code Hook的三类应用

**1. 强制执行规则**
- 特定文件不能被直接改
- 必须先跑某个检查

**2. 自动化重复工作**
- 格式化
- 测试
- 生成日志
- 同步状态

**3. 接入现有系统**
- CI
- 内部平台
- webhook
- 审批流

### 关键洞察

加上Hook的区别，不只是多一个功能，而是让 coding agent 从**"可能会做"**变成**"这个节点一定会做"**。

### 产品趋势

- Claude Code 先把Hook做出来
- Codex 也正在往这个方向补
- 两条产品路线会越来越接近
- 结合Codex可以直接接入Openclaw，Codex真的很香

---

## Tags

#AI #codex

---

## Amy-Kimi Analysis

**Significance:** L3 — 架构设计验证

**Key Insight:**

Hook = **确定性自动化**。这是Agent从"建议型"向"执行型"进化的关键一步。

**Hook的本质:**
- 事件驱动的自动化（When X happens, do Y）
- 消除"模型可能记得做、可能忘记做"的不确定性
- 从概率性输出变成确定性触发

**Connection to Our System:**
这与我们的Gateway设计高度一致：
- Gateway的routing rules = Hook的触发条件
- Skill的执行 = Hook的响应动作
- 我们追求的"AGENTS.md权威文档"其实就是一种声明式Hook系统

**Strategic Implication:**
Hook将成为行业标配。我们的系统应该：
1. 明确定义Hook机制（事件→条件→动作）
2. 提供常用Hook预设（如pre-execution、post-execution）
3. 让用户可以自定义Hook规则

**Competitive Intel:**
Codex+Openclaw组合被用户认为"很香"，说明我们的开放生态定位是正确的。需要加速推进。
