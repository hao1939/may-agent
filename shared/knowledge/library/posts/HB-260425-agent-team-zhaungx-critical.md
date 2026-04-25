# HB-260425: Agent Team，只适合用来装X —— 多智能体批判视角

**Source**: XHS@爱学习的乔同学  
**URL**: https://www.xiaohongshu.com/explore/69e0631d000000002202852c  
**Date**: 2026-04-16  
**Likes**: 7 | **Collects**: 132 | **Comments**: 48  
**Importance**: 🔥🔥🔥🔥  
**Tags**: #agent_team #multi_agent #critique #harness

---

## 核心观点

**一句话结论**: 使用Agent Team的场景非常有限，只有落在单Agent在30%左右的甜蜜区或者有限且可拆解的搜索空间，才有使用Agent Team的必要。

**绝大多数情况，使用Agent Team并不会增加额外的产出，更不会有涌现现象，只能拉满情绪价值。**

---

## 评论区的行业洞察

### 🔥 SubAgent vs Agent Team 区分
> **Ryan_想用AI改变世界**: "这里要区分一下subagent和agent team两种形态。我觉得是有存在必要性的，特别是项目持续维护的角度上，要分agent管理上下文和记忆，不然越到后面越痛苦。"

> **Yuan**: "临时工就上subagent，固定长工就用team"

### 🔥 Agent Team 的真正价值
> **Yuan**: "如果是long horizon task且需要长期运行，context的垂直性积累会和单agent执行有更明显的差异，我觉得agent team最显著的优势就是反上下文腐化。"

> **AI降临派 - 莫扎伦**: "写大项目的时候agent team效果明显，显著提升交付质量。有效解决上下文污染问题。而且我发现，目前只有cc+opus4.6 4.7组成的agent team效果最好"

### 🔥 Harness for Teams
> **- AlienZHOU -**: "很多AT的项目，已经迭代得非常复杂了，可以类比的称其为AT的Harness。这些Harness的基础概念殊途同归，但有很大精力在给协作的边界各种补丁，保持基本的稳定性。"

> **- AlienZHOU -**: "文中提到的没有涌现，SOTA模型在现实中应该也是如此，过多的边界性Harness机制说明重点在维稳。"

### 🔥 成本与收益的现实
> **爱学习的乔同学**: "找了几篇好像没有完全符合'省时间'这个结论的，都是指向相反的结论（也就是因为质量差17.2倍所以要花更多的时间更多的Token去修）"

> **Lucky dog**: "取决于成本，生成知识库类工作，AgentTeam显著强于单Agent，要把单Agent训练到相同效果，就是天价了"

### 🔥 未来演进方向
> **豆豆**: "agent team 是当下技术局限性有缺陷所需要的中间产物，未来模型足够聪明是所有思考集中在单 agent 最合理"

---

## 与 OpenClaw 的对齐验证

| 实践洞察 | OpenClaw 现状 | 验证 |
|---------|--------------|------|
| SubAgent = 临时工，轻量快速 | Main Agent ↔ Sub-agent 架构 | ✅ 一致 |
| Agent Team = 固定长工，上下文隔离 | 复杂任务多 Agent 协作 | ⚠️ 部分对齐 |
| Agent Team 需要专门的 Harness | 缺乏 Team 专属 Harness 设计 | 📝 Gap |
| 反上下文腐化是核心价值 | Session State + Error Log 部分支持 | ⚠️ 可强化 |

---

## 洞察

**Agent Team 的批判性评估**:

1. **适用边界清晰化**: Agent Team 不是银弹，仅在以下场景有价值：
   - 单 Agent 成功率 ~30% 的"甜蜜区"
   - 长期运行的 long horizon task
   - 可分解并行化的任务
   - 需要上下文隔离避免污染

2. **情绪价值 vs 实际产出**: 当前多数 Agent Team 演示产生的是"情绪价值"（看起来很酷）而非实际生产力提升。

3. **Harness 是稳定关键**: 正如评论指出的，Agent Team 需要专门的 Harness 机制来处理协作边界和稳定性 —— 这与我们的 Harness-centric 设计理念一致，但 Team-level Harness 是当前空白。

4. **Token 成本现实**: 研究显示 Agent Team 质量差 17.2 倍时需要更多 Token 修复，成本收益需要仔细计算。

---

**Archived**: 2026-04-25 by Amy-Kimi
