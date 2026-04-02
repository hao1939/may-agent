# 奥森木 — 你必须看的openclaw踩坑指南
> 原帖: xiaohongshu.com/explore/698facff000000001d010290
> 作者: 奥森木 | 点赞: ❤️206 | 归档: 2026-03-03 HB235

## 升级踩坑
**必须先** `systemctl stop旧clawdbot-gateway`再装OC
否则：两进程抢18789端口 → 重启死循环

## 稳定性
- Watchdog脚本每15分钟ping `/health`端点，无响应自动重启
- `openclaw doctor --fix` 一键修权限/目录/过期配置

## 安全
- `gateway.bind`设loopback只监听本地，用Tailscale/Cloudflare Tunnel访问
- ⚠️ 公网暴露几小时内必被扫

## Agent不听话的约束写法
在AGENTS.md写死：
- 说done必须附 `repo+branch+commit hash`
- 必须跑命令验证，不能只说"I checked"
- `messages.queue.mode=collect`防忙时丢消息

## 多Agent分工（CEO/CTO/COO模式）
| 角色 | 模型 | 职责 |
|------|------|------|
| CEO | Opus | 管对外通信 |
| CTO | Codex | 管代码 |
| COO | Haiku | 管日常 |
**外部渠道只接CEO，其他内部专注**
**subagent不能再派subagent，delegation保持一层** ← 防无限嵌套

## MEMORY.md截断盲区（⚠️ 重要）
超budget会被 **70/20/10截断**，**中间内容静默丢失无提示**
解法：MEMORY.md只当索引，细节分到：
- `memory/active-tasks.md`
- `memory/projects.md`
- `memory/lessons.md`
共享状态用 `ln -s`，不要复制文件

## 心跳vs Cron铁律（⭐关键）
| 类型 | 定位 | 规则 |
|------|------|------|
| 心跳 | 主session巡检 | 保持<20行，每次烧token，发现问题用 |
| Cron | 隔离session执行 | 独立上下文不加载历史，干活用 |
**别混用**

## 崩溃恢复
- `active-tasks.md`记进行中任务+session key，`Boot.md`启动时读取自动恢复
- `compaction.memoryFlush.enabled:true`让压缩前先存盘
- `contextPruning`用`cache-ttl/30m`自动裁剪过期工具输出

## 调试铁律
**出问题先看`gateway.err.log`，不要猜**

## 评论精华
- "搞这个东西，真就像是女娲捏人，是个力气活儿。调教出来一个眼神清澈的实习生（学历应该都没大专）"（❤️13）
- "openclaw是开源项目，跟用户之间还差一个产品"（良言，精准诊断）

## Amy评估 ★★★★★
MEMORY.md静默截断盲区 = 直接解释Amy为什么要控制insights.md行数
心跳vs Cron铁律 = Amy心跳设计的官方最佳实践背书
CEO/CTO/COO模式 = Multi-Agent Team（Opus/Sonnet/Gemini）的OC本土实现版本
奥森木是高质量OC工程实践博主，已有两帖（另一帖是HB早期归档），值得持续追踪
