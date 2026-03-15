# XHS: Agent 架构反思：为什么 Anthropic Skills

**Source**: XHS@你好硫代硫酸钠  
**URL**: https://www.xiaohongshu.com/explore/694d06a5000000001e029cf1  
**Date**: 2025-12-25  
**Tags**: #大模型 #转码

---

## 核心观点

Skills 架构通过动态挂载"技能包"解决 Context 爆炸问题，但牺牲了 Prompt Cache，首字延迟增加。它简化了架构，但对话历史记忆仍需独立管理。

---

## 洞察提取

### Trade-off 分析
| 优势 | 代价 |
|------|------|
| 解决 Context 爆炸 | 牺牲 Prompt Cache |
| 简化架构 | 首字延迟增加 |
| 动态技能挂载 | 对话历史需独立管理 |

### 对 OpenClaw 的启示
- **SKILL.md 的静态加载** vs **Skills 的动态挂载** —— 两种路线的取舍
- OpenClaw 的 SKILL.md 设计（编译期确定）可能规避了 Prompt Cache 问题
- 但动态挂载的灵活性是否带来其他优势值得研究

---

## 关联洞察
- HB#575: ccg-workflow 多模型协作
- HB#574: AGENTS.md 层级设计
- HB#558: Anthropic skill-creator 测试化转向

---

*Archived: 2026-03-15 | Session: HB#577*
