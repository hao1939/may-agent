# Knowledge Base RAG + Habit Tracker（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB230 | web_fetch

---

## Personal Knowledge Base (RAG)

**核心：** 发URL→自动摄入→语义搜索，书签不再变垃圾堆

支持：文章 / 推文 / YouTube转录 / PDF
技能：knowledge-base（ClawHub）

```
当我在"knowledge-base"话题发URL：
1. 抓取内容，摄入知识库（含元数据：标题/URL/日期/类型）
2. 回复确认：摄入了什么+chunk数量

当我提问：语义搜索→返回排名结果+来源+相关摘要
当其他工作流需要研究素材，自动查询知识库
```

与Second Brain互补：
- Second Brain = 记自己的想法/对话/意图
- Knowledge Base = 记外部资源/文章/推文
两者合并 = 完整个人知识管理系统

---

## Habit Tracker & Accountability Coach

**核心：** 主动出击型问责伙伴——不是等你打开App，而是主动发消息

### 关键设计
- **语气自适应**：连续就简短鼓励（"Day 12. Solid."）；连续错3天才发动员长文
- **反骚扰**：2小时内只跟进一次，之后不再打扰
- **模式发现**：周报："你总在周五跳过阅读" ← 机器学习你的习惯规律
- **一句话建议**：每周报最后一条具体改进建议

### 设置提示词（直接可用）
```
Track these daily habits:
1. Morning workout (check in at 7:30 AM)
2. Read 30 min (8 PM)
3. No social media before noon (12:30 PM)

Confirm→短鼓励+当前连续天数
Miss→不批评，提醒初心；连续3天→发动员消息+问是否调整目标
2小时未回复→一次跟进。之后不发。
```

### 数据存储
`~/habits/log.json` + 可选Google Sheets（视觉化面板）

---

## Amy评估 ★★★★

KB RAG = Second Brain的外部世界版，两者是同一记忆体系的两半。
Habit Tracker的"反骚扰设计"体现了OC个性化的深度：不只是执行任务，而是感知状态→调整策略。
与Reddit摘要的"每日反馈→memory迭代"是同一哲学：主动感知用户状态而不是被动等待。
