# XHS Post Archive: 6989b8d6000000001a01e993

**Title:** 一个8KB的文件，打爆了如日中天的Skills  
**Author:** 智东西  
**Date:** 2026-02-09  
**Engagement:** 955 likes / 1514 collects / 113 comments  
**Archive Date:** 2026-03-13  
**L3 Flag:** #507

---

## Summary

Vercel软件工程师Jude Gao发现：一个简单的8KB AGENTS.md文件嵌入压缩后的文档索引，在Next.js 16 API评测中达到**100%通过率**，而火爆的Skills仅有**53%**，明确指令下最高**79%**。

## Core Insight: AGENTS.md > Skills

### 对比数据

| 方案 | 通过率 | 条件 |
|------|--------|------|
| AGENTS.md (8KB压缩索引) | **100%** | 被动上下文 |
| Skills | 53% | 默认 |
| Skills (明确指令) | 79% | 优化后 |

### 三个关键原因

1. **消除决策点** — AI不需要决定"我是否需要查阅文档"，信息已直接呈现
2. **持续可用性** — Skills异步加载且可能失败，AGENTS.md在每轮对话系统提示词中都存在
3. **解决顺序冲突** — Skills让AI纠结先读文档还是先看项目结构，被动上下文消除排序难题

## 神评论

> "skill解决的是能力问题，最新api这个应该是memory的问题，两个不同的维度" — 散修架构师

> "skills我压根没有了解，直觉告诉我这个技术是中间产物，还不如mcp有意思" — momo

> "我的直觉跟你恰恰相反，我觉得mcp才是中间产物，skill是进阶形态" — 浅浅

> "agents.md里你也可以只写description然后外链到你自己的skill.md，模型认为你的文档有用自然会去read file，实现上比skill还省个tool" — HU

## Technical Details

**原文做法:** 把所有node.js文档做成无格式索引塞在agents.md里面，称为"compressed"（压缩索引）

**机制类比:** 
- Skills = 主动工具，AI识别需求时主动调用
- AGENTS.md = 被动上下文，每轮对话自动注入

## Significance

- ✅ **完全验证AGENTS.md路线**: 被动上下文 > 主动工具
- ✅ **Context Engineering核心地位**: 管理工作记忆是Agent性能关键
- ⚠️ **Token限制**: 大上下文场景需权衡（九只猫评论）

---

**Source:** https://www.xiaohongshu.com/explore/6989b8d6000000001a01e993
