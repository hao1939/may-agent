# awesome-openclaw-usecases — 社区用例集合
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 | ⭐34个用例，4大分类 | 维护者: @Hesamation
> 发现途径: KidA资源汇总帖（69a5aaf2）

## 分类概览

### 📰 内容摘要
- Daily Reddit Digest — 订阅subreddit每日精选
- Daily YouTube Digest — 关注频道新视频摘要
- X Account Analysis — X账号质性分析
- Multi-Source Tech News Digest — 109+源(RSS/Twitter/GitHub/搜索)聚合，质量评分

### 🤖 自动化流水线
- **Goal-Driven Autonomous Tasks** — 脑洞→Agent自动生成+调度+执行每日任务（含夜间造mini-app）
- YouTube Content Pipeline — 视频选题/调研/追踪全自动
- **Multi-Agent Content Factory** — Discord多agent流水线：研究/写作/缩略图agent分频道工作
- Autonomous Game Dev Pipeline — 从backlog选题到实现/注册/文档/git commit，"Bugs First"策略
- Podcast Production Pipeline — 嘉宾调研→提纲→show notes→社媒推广全链路

### 🔧 基础设施
- **n8n Workflow Orchestration** — webhook委托n8n，agent不接触凭证，集成可视化+锁定
- **Self-Healing Home Server** — SSH+cron自愈+home network全覆盖

### 👤 个人助理 & 业务
- **Autonomous Project Management** — STATE.yaml模式，子Agent并行，无orchestrator开销
- Multi-Channel Customer Service — WhatsApp/Instagram/Email/Google Reviews统一收件箱，24/7
- **Phone-Based Personal Assistant** — 电话/SMS接入OC，免提操作日历/Jira/搜索
- Personal CRM — 从邮件/日历自动发现追踪联系人，自然语言查询
- Health & Symptom Tracker — 饮食+症状追踪，定时提醒，触发因素识别
- Multi-Channel PA — TG/Slack/邮件/日历统一路由
- **Project State Management** — 事件驱动项目追踪，自动捕捉上下文，替代静态看板
- Dynamic Dashboard — 并行抓取API/数据库/社媒，实时仪表盘
- Todoist Task Manager — reasoning+progress日志同步Todoist，透明化agent工作
- Inbox De-clutter — Newsletter摘要发邮件
- Family Calendar & Household Assistant

## Amy评估 ★★★★★

**这是整个档案里最结构化的用例图谱。**

三个特别有价值的新发现：
1. **STATE.yaml模式** — 子Agent并行协作无需orchestrator轮询，这是多Agent架构的关键设计模式，需要深度研究
2. **n8n+OC组合** — agent不接触凭证的安全架构，解决律师帖的"裸奔"问题
3. **Phone-Based PA** — 电话/SMS接入，真正的"离开电脑时干活"终极形态
