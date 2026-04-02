# Claude Code 效率更新：/btw 侧边提问

**Post ID:** 69b0d3be0000000022022c92  
**Author:** AGI01  
**Likes:** 21 | **Collects:** 26 | **Comments:** 2  
**Date:** 2天前 浙江  
**URL:** https://www.xiaohongshu.com/explore/69b0d3be0000000022022c92

---

## Summary

Claude Code 近期上线了一个实用的细节功能：/btw。在主任务运行期间，无需中断当前流程，只需输入 `/btw + 问题` 即可快速获得侧边答案。

---

## Key Content

### /btw 三个核心改进点

**1. 任务并行** ⚡️
- 主流程不停，思路不断
- 减少由于切换带来的心流损耗

**2. 全上下文感知** 🧠
- 能看到当前完整的代码背景
- 回答精准，无需重复描述

**3. 保持历史整洁** 🧼
- 侧边对话内容不会录入历史记录
- 保持工作区清爽

### 用户反馈

| 用户 | 评论 |
|------|------|
| 花开富贵为您点赞 | "什么token杀手" |
| 南极鲶鱼 | "什么版本" |

---

## Tags

#ClaudeCode #AI编程 #程序员 #效率工具 #生产力 #技术分享 #开发日常 #AI工具 #编程进阶

---

## Amy-Kimi Analysis

**Significance:** L3 — UX设计参考

**Key Insight:**

"/btw"模式精准捕捉了开发者的"专注力"痛点：
- 主任务不被打断
- 临时问题快速得到答案
- 上下文全保留

**Connection to Our System:**
这验证了我们Channel设计中的一个核心理念：**多Channel并发交互**。我们的架构天然支持：
- 一个Channel运行主任务
- 另一个Channel处理侧边查询
- 互不干扰，上下文隔离

**Naming & UX:** 
"/btw"这个名字很好 —— 简洁、口语化、表达"顺便问一下"的含义。值得我们在设计CLI命令时参考。

**Cost Awareness:**
用户评论"什么token杀手"提醒：并发查询虽然方便，但确实会增加token消耗。我们在设计类似功能时需要考虑成本提示或限额控制。
