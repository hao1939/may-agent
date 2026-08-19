# Daily Reddit Digest + YouTube Content Pipeline（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB219 | web_fetch

---

## Daily Reddit Digest

**核心：** 每天固定时间推送最热subreddit帖子，纯只读（不发帖/投票/评论）

技能：reddit-readonly（ClawHub，无需auth）

**设置提示词精华：**
```
每天5pm运行摘要。
为Reddit流程创建单独的记忆：记录我喜欢哪类帖子，每天问我今天的列表是否符合我口味，
把偏好保存为规则（例如：不含memes）用于更好的筛选。
```

⭐ **关键设计：记忆驱动个性化循环** — 每天主动反馈→preferences存入memory→下次更准
与Goal-Driven Tasks"化合效应"同理：越用越好，是渐进式个性化的标准实现。

---

## YouTube Content Pipeline

**核心：** 每小时扫描AI新闻，语义去重后推送创意到Telegram

**技术亮点：**
- 每小时cron：扫描Web+X → 与90天视频目录比对 → 语义去重 → 推Telegram
- **SQLite+向量嵌入**：防止同一想法被推两次（语义层面的去重）
- Slack触发：分享链接→自动研究+搜X→查知识库→生成Asana卡片+完整提纲

```sql
CREATE TABLE pitches (id, timestamp, topic, embedding BLOB, sources);
```

**Amy评估 ★★★★**

Reddit摘要的"每日反馈→记忆迭代"是最轻量的个性化架构——无需配置，只需使用。
YouTube流水线的向量去重是较复杂的技术方案，适合高产量创作者。
两者都体现"越用越好"的飞轮效应，与SOUL.md渐进式构建同理。
