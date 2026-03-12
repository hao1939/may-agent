# 会议记录+Personal CRM（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB229 | web_fetch

---

## Automated Meeting Notes & Action Items

**核心：** transcript → 结构化摘要 → 任务自动创建 → Slack发布 → 到期前提醒

### 全自动流水线（文件夹监控）
```
每30分钟检查 ~/meeting-transcripts/ 是否有新.txt/.vtt文件：
1. 解析→摘要（5条决策）+ 行动项（谁/做什么/截止日）
2. 在Linear创建任务，分配给正确的人
3. 发到Slack #team-updates
4. 移入 ~/meeting-transcripts/processed/
5. 每个有截止日的行动项：截止前1天Slack提醒负责人
```

### 输出结构（可自定义）
```
- Date & Attendees
- Key Decisions（编号列表）
- Action Items（表格：Task/Owner/Deadline/Status）
- Open Questions（待跟进的未解决问题）
```

支持来源：Otter.ai / Google Meet转录 / Zoom摘要 / 直接粘贴

---

## Personal CRM with Automatic Contact Discovery

**核心：** 每天自动从Gmail+Calendar挖联系人，自然语言查询

### 数据结构
```sql
CREATE TABLE contacts (id, name, email, first_seen, last_contact,
  interaction_count, notes);
```

### 两个定时任务
- **6AM**：扫描过去24h邮件+日历 → 新建/更新联系人 → 记录互动+时间戳
- **7AM**：查今日日历 → 每位外部参会者：上次见面时间/聊了什么/待跟进项 → Telegram简报

### 自然语言查询
"What do I know about [person]?" / "Who needs follow-up?" / "When did I last talk to X?"

---

## Amy评估 ★★★★

会议记录+任务创建是团队协作场景最高频需求之一，流水线设计完整（含归档+提醒）。
Personal CRM的"7AM会前简报"是最直接的商业价值——见客户前5分钟知道所有上下文。
两者都体现"被动触发→主动输出"的OC异步价值。
与RELATIONS.md（人-事-物关系图谱）直接互证：Personal CRM就是RELATIONS.md的结构化实现。
