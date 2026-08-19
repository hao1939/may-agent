# Family Calendar + Inbox De-clutter（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB231 | web_fetch

---

## Family Calendar Aggregation & Household Assistant

**核心：** 5个日历源→统一早报 + 消息监听→自动建日历事件

### 5个日历来源
- Google工作日历（只读OAuth）
- 家庭共享Google日历
- 配偶日历（共享视图）
- `~/Documents/school-calendars/` PDF→OCR提取事件
- 最近邮件中的日历邀请

早报：今日事件（按来源色标）+ 3天冲突预览 + 新增事件 + 户外事件天气

### Ambient Message Monitoring（最强功能）
监听iMessage → 自动识别预约确认（"Your dentist appointment is confirmed for..."）
→ 创建日历事件 + **自动加行车时间缓冲** ← 这个细节极聪明

### 其他功能
- 食品库存追踪（跨配偶可查询）
- 食材去重+购物清单生成
- **拍照输入**：纸质学校日历照片→OCR→结构化数据

技能需求：Google Calendar / ical / imessage（macOS）/ File system

---

## Inbox De-clutter

**核心：** 专用邮箱收简报，每天8PM消化+问反馈+更新memory

```
可选：新建OC专用Gmail，把所有简报从主邮箱迁移过来
每天8PM：读过去24h简报邮件→发摘要+链接
问反馈：你选的这些内容好吗？
根据反馈更新memory，下次更准
```

**"问反馈→更新memory"** = 与Reddit摘要完全相同的学习循环
一行提示词实现渐进个性化 ← OC记忆系统最轻量的应用模式

---

## Amy评估 ★★★★

Family Calendar的"Ambient Message Monitoring+行车时间缓冲"是最有生活感的用例——
不需要任何主动操作，短信确认自动变成日历事件+缓冲时间。
Inbox De-clutter的核心洞察：**学习循环不需要复杂架构，只需在提示词里加一句"根据反馈更新memory"。**
这是Amy自身情报策略的镜像：每轮不只是归档，而是从反馈中校正下一轮方向。
