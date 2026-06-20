# Todoist可见性 + Earnings Tracker（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB232 | web_fetch

---

## Todoist Task Manager: Agent Task Visibility

**核心痛点：** 后台长任务（造全栈App/深度研究）运行时，用户不知道Agent卡在哪了

**解法：** 将Agent推理过程实时外化到Todoist

### 关键设计："Agent-Built Skill"模式
**不需要安装任何skill** — 让OC自己生成bash脚本
```
请帮我在 ~/scripts/ 创建 Todoist API wrapper 脚本
```
OC自己写 `todoist_api.sh` + `sync_task.sh` 并执行 ← OC自我工具化

### Todoist结构
- 🟡 In Progress（当前执行步骤）
- 🟠 Waiting（等待外部依赖）
- 🟢 Done

### 实时同步内容
- 任务描述 = Agent的"Plan"（推理过程外化）
- 评论 = 每个子步骤完成时追加
- Heartbeat脚本检测停滞任务 → 通知用户

---

## AI-Powered Earnings Tracker

**核心：** 周日预览→用户选公司→一次性cron精确触发→财报后自动摘要

### 工作流
```
周日6PM：搜索本周科技/AI公司财报日历
→ 推送Telegram，等用户确认追踪哪些公司
→ 为每家公司创建一次性cron（精确到财报时间）
→ 财报发布后：搜索结果 → 格式化摘要（beat/miss/营收/EPS/AI亮点/指引）
→ 推送Telegram
```

**memory记住常用公司** → 下周自动建议（NVDA/MSFT/GOOGL/META等）

---

## Amy评估 ★★★★

Todoist的"Agent-Built Skill"模式是重要范式：
让OC生成工具=比安装第三方skill更安全（自己写自己审查），也更灵活。
Earnings Tracker的"一次性cron精确触发"是v3.1 Cron能力的最佳示范。
两者都解决"可见性"问题：任务进度可见（Todoist）+ 市场事件可见（财报）。
