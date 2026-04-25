# HB-260425: SkillClaw —— 阿里开源Skill自动进化框架

**Source**: XHS@AIGCLINK / 阿里AMAP-ML团队  
**URL**: https://www.xiaohongshu.com/explore/69dddcde000000002300614c  
**Date**: 2026-04-14  
**Likes**: 437+ | **Collects**: 883 | **Comments**: 25  
**Importance**: 🔥🔥🔥🔥🔥  
**Tags**: #skill_evolution #auto_evolve #alibaba #amap #wildclawbench

---

## 项目概览

**SkillClaw** —— 阿里AMAP-ML团队开源的AI Agent Skill自动进化框架

- **HuggingFace**: 4月10日当日论文榜第一，126个upvote
- **代码**: github/AMAP-ML/SkillClaw
- **定位**: 让Skill从"人写人维护"变为"用户用、系统学、自动更新"

---

## 核心问题

AI Agent靠Skill库执行任务，但**Skill一旦部署就是静态的**：
- 每个用户都在重复踩同样的坑
- 走同样的弯路
- 没有任何积累

---

## SkillClaw 解法

持续收集所有用户的交互轨迹 → **自动识别重复出现的行为模式** → 用一个"**Evolver**"把这些经验转成Skill更新 → 同步回共享Skill库，**所有人受益**

```
用户交互轨迹 → 行为模式识别 → Evolver → Skill更新 → 共享Skill库
```

---

## 实验验证

- **基准**: WildClawBench（真实Agent场景）
- **模型**: Qwen3-Max
- **结果**: 用有限的交互和反馈，显著提升真实Agent场景表现

---

## 评论区洞察

### 与 Hermes 的对比
> **悠然**: "hermes 干的也是类似的事情"

> **momo**: "Hermes只是让ai自动总结成skill,它那个self evoluation 的仓库还在todo，压根没有用"

### 与 OpenClaw/Lobster 集成
> **测开阿Duang**: "这个可以搭配龙虾使用吗"

> **momo**: "可以的就是给龙虾用的"

> **骑士爱煎蛋**: "这个现在能支持cc或者codex的plugin了"

### 安全性质疑与回应
> **虎耳**: "不会被别人的坑带歪吧。回共享库这个太危险"

> **骑士爱煎蛋**: "有版本管理和验证机制的"

---

## 与 OpenClaw 的对齐验证

| SkillClaw 设计 | OpenClaw 设计 | 对齐度 |
|---------------|--------------|--------|
| 共享Skill库 | Skills 系统 | ✅ 概念一致 |
| Evolver 自动更新 | 缺乏自动Evolver | 📝 Gap |
| 用户轨迹学习 | Error Log 捕获失败 | ⚠️ 可扩展 |
| 版本管理+验证 | 待完善 | 📝 Gap |

---

## 洞察

**Skill 自动进化的工程化里程碑**:

1. **从静态到动态**: SkillClaw 解决了 Skill 系统最大的痛点 —— 部署后静态不变。通过持续学习用户轨迹，Skill 库成为活系统。

2. **"踩坑经验"肌肉化**: 核心洞察是把用户踩坑经验转化为可共享的"肌肉记忆"，避免重复犯错。

3. **与 Hermes 的区分**: 
   - Hermes: AI 自动总结 Skill（单向生成）
   - SkillClaw: 基于多用户轨迹的进化（集体学习）

4. **安全机制**: 版本管理 + 验证机制回应了共享库的安全质疑。

5. **生态集成**: 明确支持 OpenClaw/Lobster 生态，可即插即用。

**对 OpenClaw 的启示**:
- Error Log 可扩展捕获成功模式，不仅是失败
- 考虑引入 Skill Evolver 机制
- 版本管理和验证是共享 Skill 的前提

---

**Archived**: 2026-04-25 by Amy-Kimi
