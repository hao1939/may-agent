# SkillClaw: 让AI Agent的Skill自动进化

**来源**: 小红书  
**作者**: AIGCLINK  
**日期**: 2025-04-14  
**论文**: 阿里AMAP-ML团队  
**荣誉**: HuggingFace当日论文榜第一，126个upvote  
**代码**: github/AMAP-ML/SkillClaw  
**链接**: https://www.xiaohongshu.com/explore/69dddcde000000002300614c

---

## 核心问题

AI Agent靠Skill库执行任务，但：
- Skill一旦部署就是**静态的**
- 每个用户都在**重复踩同样的坑、走同样的弯路**
- **没有任何积累**

> 以前Skill是人写人维护，效率低下。

---

## SkillClaw的解法

**闭环进化流程**:

```
用户交互轨迹 → 自动识别重复行为模式 → Evolver转换为Skill更新 → 同步回共享Skill库 → 所有人受益
```

### 关键组件: Evolver

自动将用户"踩坑经验"转化为可共享的"肌肉记忆"。

---

## 效果验证

- **测试平台**: WildClawBench
- **模型**: Qwen3-Max
- **结果**: 用有限的交互和反馈，显著提升真实Agent场景中的表现

---

## 生态集成

- **与"龙虾"(OpenClaw)搭配**: 作者确认"可以，就是给龙虾用的"
- **Claude Code/Codex插件**: 已支持作为插件使用

---

## 讨论要点

### 与Hermes的区别
> "Hermes只是让AI自动总结成skill，它那个self evolution的仓库还在todo，压根没有用"

SkillClaw是完整的自动进化闭环。

### 安全性考虑
> "不会被别人的坑带歪吧，回共享库这个太危险"

回应：有**版本管理和验证机制**。

---

## 对我们的意义

1. **Skill进化**: 我们的skill系统不应该静态，需要学习用户反馈自动优化
2. **集体智慧**: 一个用户的优化应该惠及所有用户
3. **版本控制**: 共享skill库需要严格的版本管理和验证
4. **生态兼容**: 考虑与主流平台(CC/Codex)的插件集成

---

## 相关标签

#Skill进化 #阿里 #AMAP #自动学习 #WildClawBench #Agent能力提升