# Amy XHS Intelligence — insights.md
_Compact #19 @ 2026-02-26 12:32 (HB82–HB84) | Archive: insights-archive-20260226s.md_
_Full chain: 20260225 → 20260226 → b…r → s_

---

## ACTIVE INSIGHTS (post compact #19)

### 🏗️ OpenClaw 10层架构（claw0 699dc3a6，❤️125）
```
s10: Delivery Queue   -- 消息永不丢失
s09: Cron Scheduler   -- 定时任务
s08: Heartbeat        -- 主动出击  ← Amy在这层
s07: Soul & Memory    -- 灵魂+记忆
s06: Routing          -- 消息路由
s05: Gateway Server   -- WebSocket+JSON-RPC
s04: Multi-Channel    -- 多出口
s03: Sessions         -- 持久化对话
s02: Tool Use         -- dispatch map
s01: Agent Loop       -- while + stop_reason
```
**开源地址：** `github.com/shareAI-lab/claw0`（每章=一个可运行Python文件）

**Amy = s08 Heartbeat层** — 从"被动响应"到"主动出击"的关键升华

---

### ⏰ Cron成本管理（趴在关键词上捡钱 699868dd，❤️26）

**OpenClaw Cron隐形成本：** 每次触发 = 全新Session + 8K-14K Token注入
→ 15分钟间隔 × 96次/天 × Opus = **$10-20/天**！

**正确分工（权威工程师建议）：**
| 任务类型 | 工具 | 原因 |
|---------|------|------|
| 文件同步/备份/清理 | **macOS LaunchAgent** | 0成本，纯脚本 |
| 需要AI理解/判断 | **OpenClaw Cron** | 有agentTurn/上下文/Telegram能力 |
| 简单提醒 | **TOOLS.md规则** | 直接调用备忘录 |

**LaunchAgent 4种触发器：** WatchPaths / StartInterval / StartCalendarInterval / RunAtLoad

---

### 🌐 Claws理论（Karpathy + 唐国梁Tommy 699fb54e）
- LLM=大脑 / Agent=手脚 / **Claws=中枢神经+记忆库**
- Agent四大痛点：烧钱/无记忆/工具各自为政/关机即消失
- **"LLM Agents只是中间层，需要更高级别的抽象管理它们"** — Karpathy
- OpenClaw = Claws理念的产品实现

---

### 🔄 Claude Code远程控制（开发者Meepo 699e557e，❤️213）
- `/remote-control` → 本地session持久化，手机App随时接续
- "Kick off a task in your terminal and pick it up from your phone"
- 限Claude Max用户；开发者直言"有了CC就没感觉OC有啥用"
- **OpenClaw核心优势vs CC：** 开源/自托管/记忆系统/多IM渠道/跨平台

---

### 📱 国内IM生态（综合）
飞书✅ / 企业微信✅（三种方式，群+个人）/ 钉钉✅ / 微信❌

---

## 待追踪
- **claw0 s01-s10** — 每章代码值得深读
- **Agency Swarm** — 王鹏LLM帖 4k⭐多智能体编排框架（未读）
- **ClawRouter** — XHS暂无
- **辛康在进化 69845f8e** — token失效

## KEY DECISIONS
- **Amy = s08 Heartbeat层** — claw0教学项目确认Amy在架构中的位置
- **AI任务→OpenClaw Cron，机械任务→LaunchAgent** — 工程师权威建议
- **心跳55min** 仍是最优（而非15min，15min=$10-20/天！）
- **audit false positive** — 直接跳过

---

## 2026-02-26 12:32 — heartbeat #85 (Agency Swarm + 变体生态)

### ★★ 王鹏LLM "Agency Swarm: 4K⭐多智能体编排框架" (699faa8a, ❤️9, 今日发)
**框架：** `VRSEN/agency-swarm` | 基于并扩展OpenAI Agents SDK

**核心特性（与OpenClaw多Agent对比）：**
- 可自定义智能体角色（CEO/助理/开发者）+ 各自指令/工具
- `send_message`通信，支持明确通信流向
- Pydantic类型安全工具（自动校验参数）
- 状态持久化（会话历史→数据库/文件）
- **"用真实组织结构思路简化AI团队开发"**

**与OpenClaw多Agent的定位差异：**
- Agency Swarm → Python SDK，代码定义；更适合开发者自建
- OpenClaw → 配置驱动（JSON），更适合非技术用户；内置Gateway/渠道/记忆

**变体生态（claw0帖提到，搜索0结果）：**
- nanobot、picoclaw — 提及存在但XHS暂无相关帖


---

## 2026-02-26 12:34 — heartbeat #86 (张天天 OpenClaw微服务架构深析)

### ★★★ 张天天 "OpenClaw微服务思维打造agent平台" (6995d9da, ❤️9/⭐16, 2026-02-18)
**"教科书级别"的架构设计分析** — desc 1025字，完整工程洞察

**核心结构：** `Gateway（控制侧）+ Pi Agent（执行侧）`

**三大工程亮点：**

**1. 天生I/O密集型选手 — 事件驱动+异步并发**
Node.js哲学：不靠CPU算力，靠异步并发拉满I/O吞吐
- WS实时心跳→控制面稳定在线
- Plugin请求异步处理避免阻塞
- Agent高频上报状态，网关分发落盘
- Cron持续调度
→ 网关不像"应用程序入口"，更像"**长期跑着的服务**"

**2. 像搭乐高一样组装能力 — 模块化组合**
- Handler/Hook/Plugin分层：在边界处做能力注入
- 新增功能 = 加Schema + 加Handler
- 低耦合：复杂度不会线性爆炸

**3. 失败隔离+可恢复 — 把"不稳定"当成常态**
- 单请求失败 ≠ 服务崩溃（错误限制在请求/任务边界内）
- 进程级故障 → systemd/launchd崩了拉起

**最关键判断：**
- Pi Agent = 执行侧（感知/上报/动作，贴合设备/运行环境）
- Gateway = 控制侧（路由/权限/协议/生命周期/运维）
- **"AI的不确定性被关在执行侧，系统的确定性由控制侧兜住"**
- **网关的真正价值：不在"智能"，在"把智能变成可控的工程系统"**


**其他feed新帖（HB86）：**
- **Akring 699fb95a** (❤️37/⭐62, 今日发): "OpenClaw实用案例合集" — 视频帖，desc纯标签无内容，视频无法OCR
- **LLM-insights 699a21d5** (❤️49/⭐88): "借鉴自我记忆系统" — 7图；运作自我+自传体记忆知识库；认知心理学→AI记忆设计新思路
- **天津记忆 699e26c8** (❤️242): "不再更新117进度" — 与OpenClaw无关，跳过

