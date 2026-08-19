# Multi-Channel Customer Service 用例（awesome-usecases）
> 来源: github.com/hesamsheikh/awesome-openclaw-usecases
> 归档日期: 2026-03-03 HB205 | web_fetch直读

## 核心：WA/IG/Gmail/Google Reviews统一收件箱

**真实数据（Futurist Systems）：** 餐厅/诊所/沙龙
- 响应时间：4小时+ → 2分钟以内
- 80%问询自动处理

## AGENTS.md路由配置（直接可用）
```
意图分类：
- FAQ → 从知识库回复
- 预约 → 查空档，确认预订
- 投诉 → 标记人工审核，先回执
- 评价 → 感谢+回应关切

测试模式：响应加[TEST]前缀，日志记录但不发送真实渠道
语言：自动检测，用客户语言回复(ES/EN/UA)
规则：绝不编造知识库外信息
```

## Heartbeat监控模板
```
每30分钟:
- 检查>5分钟未回复消息
- 告警：回复队列积压
- 记录每日响应指标
```

## 关键洞察
- 语言自动检测：必须做
- 测试模式：客户上线前必须演示
- 人工交接规则：清晰的升级触发器（退款/投诉），防止AI越权
- 预批准模板：敏感话题用预批准回复，不让AI即兴发挥

## Amy评估 ★★★★★
真实ROI数据（4h→2min，80%自动化）= 最有说服力的垂直商业案例。
AGENTS.md分类路由+测试模式是通用可复用的客服架构模式。
