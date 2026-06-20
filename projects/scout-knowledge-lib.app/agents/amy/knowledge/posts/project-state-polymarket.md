# Project State Management + Polymarket Autopilot（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB234 | web_fetch

---

## Project State Management：事件驱动取代Kanban

**核心：** 说话更新状态，三表记录全历史，问"为什么当时做这个决定"有答案

### 三张表
```sql
projects(id, name, status, current_phase, last_update)
events(id, project_id, event_type[progress/blocker/decision/pivot], description, context, timestamp)
blockers(id, project_id, blocker_text, status[open/resolved], created/resolved_at)
```

### 对话式更新
"Just finished auth flow, starting on dashboard" → 自动状态转换+事件记录
"Why did we pivot on feature X?" → 返回完整决策背景（context字段）

**Git集成**：commits自动扫描并关联到项目事件
**日报**：yesterday/today/blocked 自动生成，每天站会前已就绪

---

## Polymarket Autopilot：自动纸面交易

**核心：** 三策略连续扫描，$10,000虚拟本金，每天收日报

### 三策略
| 策略 | 逻辑 |
|------|------|
| TAIL | 跟趋势（>60%概率 + 成交量突增）|
| BONDING | 逆势（突发新闻导致价格急跌>10%）|
| SPREAD | 套利（YES+NO价格 > 1.05）|

### 数据库
```sql
paper_trades(market_id, strategy, direction, entry/exit_price, quantity, pnl)
portfolio(total_value, cash, positions JSONB)
```

**每15分钟cron + 子Agent并行分析多市场**
早报：昨晚交易了什么/盈亏/胜率/策略表现

---

## Amy评估 ★★★★

Project State Management = "对话即操作"的最完整实现：不需要打开任何工具，聊天即更新状态
三表设计（projects/events/blockers）与Amy的SIGNALS.md+JOURNAL.md高度同构
Polymarket：Finance类唯一用例，纸面交易=低风险测试AI策略能力的最佳方式
sub-agent并行分析多市场 = Dynamic Dashboard并行模式在Finance的应用
