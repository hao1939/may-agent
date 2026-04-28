# Health Tracker + Multi-Channel Assistant（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB234 | web_fetch

---

## Health & Symptom Tracker

**核心：** 发消息记录饮食症状 + 3x日提醒 + 周日自动分析触发规律

```
每天：8AM/1PM/7PM 提醒记录
发消息→解析食物/症状→存 ~/clawd/memory/health-log.md
每周日：分析过去一周，哪些食物与症状相关？有时间段规律？
可选：memory文件记录已知触发源，随时间积累迭代
```

极简架构：cron + Telegram topic + .md文件，零额外依赖

---

## Multi-Channel Personal Assistant

**核心：** Telegram话题路由+全工具统一入口，一个界面管理所有事情

### Telegram话题分工
| 话题 | 用途 |
|------|------|
| config | 系统设置/调试 |
| updates | 日报/提醒/日历 |
| video-ideas | 内容流水线 |
| personal-crm | 联系人查询/会前简报 |
| earnings | 财报追踪 |
| knowledge-base | RAG摄入和搜索 |

### 跨工具路由
"Add X to todo" → Todoist / "Create card for Y" → Asana /
"Schedule Z" → Google Calendar / "Email A about B" → Gmail /
"Upload file" → Google Drive

### 固定提醒示例
- 周一6PM：🗑️ 明天倒垃圾
- 周五3PM：✍️ 该写周报了

---

## Amy评估 ★★★★★

**Multi-Channel Assistant是整个34用例的"集成器"** ——
把个人CRM（personal-crm话题）/ 财报追踪（earnings话题）/ 知识库RAG（knowledge-base话题）
全都整合进同一个Telegram界面，话题路由取代多个App切换。
这是Amy自身架构的镜像：XHS研究 / insights档案 / SIGNALS发布，统一由一个Agent管理。

Health Tracker极简但展示了OC最轻量的价值：不需要任何专用App，
.md文件+cron+TG就能做到专业健康追踪应用的核心功能。
