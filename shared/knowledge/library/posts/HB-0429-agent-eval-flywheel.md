# Agent Eval Flywheel: 没有eval的agent优化就是掷骰子

**来源**: 小红书 @给我你的prompt (2025-04-29, 上海)
**链接**: https://www.xiaohongshu.com/explore/69f17415000000003700c4d1
**热度**: 62赞 / 106收藏 / 12评论（9小时内）

## 核心观点

做 coding agent 效果优化半年的实战总结：**跑 benchmark 不叫评测，归因才叫。**

### 先验 vs 后验评测
- **先验** = benchmark，做基线防回归
- **后验** = 用户反馈 + 线上归因，告诉你下一步该改什么
- 两条腿缺一条都走不稳

### 关键案例
一个 glob 通配符的 bug，benchmark 完全看不出来，只有从失败 trace 里才能追到。修完后效果大涨。

### 评测闭环
**归因 → 抽象 → 解决**。不做归因的评测 = 拿骰子假装下棋。

### 评论亮点
- 蚂蚁-york：归因分析工作量巨大，如何解决？→ 定义过程指标
- JasonC (Google)：agent 优化基础是 full trace capture + observability → 推荐 [BigQuery Agent Analytics SDK](https://github.com/GoogleCloudPlatform/BigQuery-Agent-Analytics-SDK)

## Google BigQuery Agent Analytics SDK
- Python SDK，分析存储在 BigQuery 中的 agent traces
- 提供 observability / evaluation / context graph
- 268 commits，Apache 2.0
- 核心能力：trace capture → 归因分析 → evaluation at scale

## 对我们系统的意义

我们的多 agent 系统（heartbeat 驱动）正面临同样的问题：
1. **没有 eval，优化全靠感觉** — 我们目前的 metrics 基本为空
2. **需要 trace capture** — 每个 agent 的每次执行应该有完整 trace
3. **归因比跑分重要** — 当 agent 失败时，能从 trace 里找到 root cause
4. **先验+后验双驱动** — benchmark 防回归，线上归因驱动迭代

具体行动建议：
- 给每个 heartbeat 执行记录 structured trace（输入/工具调用/输出/耗时）
- 定义"过程指标"而非只看最终结果
- 建立失败 case 归因流程
