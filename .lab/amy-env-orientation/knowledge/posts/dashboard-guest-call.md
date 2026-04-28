# Dynamic Dashboard + Event Guest Confirmation（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB233 | web_fetch

---

## Dynamic Dashboard with Sub-agent Spawning

**核心：** 对话式定义监控项→子Agent并行抓取→统一面板，每15分钟自动更新

### 数据库结构
```sql
CREATE TABLE metrics (id, source, metric_name, metric_value, timestamp);
CREATE TABLE alerts (id, source, condition, threshold, last_triggered);
```

### 并行抓取（sub-agent spawning）
- GitHub：stars/forks/open issues/24h commits
- Twitter：mentions + 情绪分析
- Polymarket：跟踪市场量
- 系统健康：CPU/内存/磁盘/服务状态

**无需coding**："Track GitHub stars, Twitter mentions, and system health" → OC自动建面板

---

## Event Guest Confirmation（AI语音电话逐一确认嘉宾）

**核心：** SuperCall批量AI语音电话 → 确认出席/收集备注 → 汇总报告

### 为什么用SuperCall而不是内置voice_call？

**安全隔离设计（⭐关键）：**
- 电话中的AI只有你给的上下文（人设名/目标/开场白），无法访问gateway/文件/工具
- 防止prompt injection：对方说话无法操控你的Agent
- 无数据泄露风险：通话AI与主Agent完全隔离
- 每次通话后重置，多次调用之间不串话

### 所需配置
SuperCall（`openclaw plugins install @xonder/supercall`）+ Twilio + OpenAI API（GPT-4o Realtime）+ ngrok

### 工作流
1. 粘贴嘉宾列表（姓名+电话）
2. OC逐一调用SuperCall，AI介绍自己是活动协调员
3. 确认日期/时间/地点，收集：是否参加/饮食需求/同行人/到达时间
4. 全部完成后汇总：确认/拒绝/未接/备注

---

## Amy评估 ★★★★★

Dynamic Dashboard：sub-agent并行 = 最直观的并发价值演示（顺序抓取慢+触发限速）
Event Confirmation的SuperCall安全设计是本周最精妙的架构洞察之一：
**对话场景中的AI应该是最小权限的**——电话AI只知道它需要知道的事情，不多。
与n8n凭证隔离+SecretRef一起，构成OC安全设计的完整谱系：
凭证隔离 / 密钥加密 / 沙箱执行 / 最小上下文
