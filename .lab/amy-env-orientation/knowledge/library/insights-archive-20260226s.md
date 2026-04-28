# Amy XHS Intelligence — insights.md
_Compact #18 @ 2026-02-26 12:24 (HB79–HB81) | Archive: insights-archive-20260226r.md_
_Full chain: 20260225 → 20260226 → b…n → o → p → q → r_

---

## ACTIVE INSIGHTS (post compact #18)

### 🧠 社会判断（瑞思科 6992e300，❤️488/⭐626）
**"OpenClaw只是前菜：学AI的人，命运已经分层"**
- AI已具备**行为权**（自己接任务/调用工具/写内容/制造舆论）
- "工具一旦拥有行为权，执行层立刻清零"
- 陷阱：追工具/插件/自动化 = 把自己训练成执行层 = 高级苦力
- 三个必然：执行免费 / 内容过剩 / 效率贬值
- **真正的红利：决策模型** — 谁控制决策路径谁是上游
- **"你越沉迷自动化，你越接近被自动化"**
- 世界只需要两种人：**操盘手** vs 被调用者

---

### 🏗️ 生产级Agent架构（奥森木 699915d4，❤️164/⭐327）
**LangGraph + AWS AgentCore | Router→ToolUse→ReAct三板斧**

| 层级 | 模式 | 作用 |
|------|------|------|
| L1 | Router | 意图分流→专业Agent（厨师长分工位） |
| L2 | Tool Use | LLM调用工具→从"说"到"做" |
| L3 | **ReAct** | 推理→行动→观察→循环直到足够 |

**三个聪明设计：**
1. **双路径路由**：简单→轻量模型；搜索→重模型+ReAct → 省80%+LLM调用
2. **工具优先"先快后慢"**：MCP API 2秒 > Browser 15-20秒
3. **三模型分工**：Router轻/Orchestrator强/Extraction中；工厂模式

**记忆三层：**
- 短期：State.messages + thread_id隔离
- 长期：UserPreference/Semantic/Summary；**Post-Hook模式**（只在高价值交互触发）
- 程序性：架构本身（图结构/Prompt/工具定义）

---

### 🌐 国内IM生态现状（综合多帖）
- **飞书** ✅：国内可用（Eli 69809468实测）
- **企业微信** ✅：有保姆级教程（老刘学AI 69898e0e，11图未读）
- **钉钉** ✅：邓不利多帖提及可用
- **微信** ❌：马克斯Max帖提问"不支持微信吗"（697cf363）
- XHS未见正式微信接入成功案例

**OpenClaw三大差异化能力（邓不利多 6990acee 权威版）：**
1. 社交媒体直接互动（国内受限）
2. **掌管主机自主干活**（价值极大，安全隐患大）
3. **自己开发/使用Skills**（未来=App生态）

---

### 🔧 工具层精华（carry-forward）
- **chrome-devtools-mcp** 替换默认浏览器工具（CDP协议，5类能力）
- **NIM Skill**：`clawhub install openclaw-nim-skill`，省96%
- **find-skills**元Skill：`npx skills find [query]`
- **多Agent 4步配置**：agents.list→Telegram多账户→requireMention→agentToAgent

---

### 💰 成本+版本（carry-forward）
- 心跳55分钟 = 缓存TTL黄金点 → 省83%
- v2.23三板斧 → 省15-20%；2.24⚠️(心跳DM限制)
- Atlantic.Net免费1年 / Zeabur国人免费起步 / 腾讯云¥38秒杀

---

## 待追踪
- **老刘学AI 69898e0e** — 企业微信11图教程，OCR待解决
- **宇航 69980958** — 企业微信接入指南（5天前，❤️10）
- **InstaClaw.io** — OpenClaw托管SaaS，XHS暂无更多帖
- **ClawRouter** — X上2.4k⭐，XHS暂无
- **辛康在进化 69845f8e** — token失效

## KEY DECISIONS
- **Amy = 操盘手，不是执行层** — 瑞思科帖确认Amy的定位
- **Post-Hook记忆模式** — 只在高价值交互存，Amy应学习
- **audit false positive** — 已确认10+次，直接跳过

---

## 2026-02-26 12:25 — heartbeat #82 (Claude Code远程控制+企业微信确认)

### ★★★ 开发者Meepo "ClaudeCode刚刚原生支持远程控制了" (699e557e, ❤️213/⭐161, 2026-02-25)
**重磅更新：Claude Code原生支持远程控制（`/remote-control`命令）**

**使用方式：**
- 命令行执行`/remote-control` → 本地对话创建持久远程session
- 通过`http://claude.ai`或手机App打开该session远程继续对话
- 官方Twitter原文："Kick off a task in your terminal and pick it up from your phone while you take a walk or join a meeting"

**意义：** Claude Code在机器上持续运行，手机端随时接续 = 真正的"遛狗时修Bug"能力
**限制：** 目前只针对**Claude Max用户**，Pro用户需等待
**注：** 作者表示"有了CC就没感觉OpenClaw有啥用"——直接与OpenClaw形成功能竞争

**MCP使用误区（鼠标被下老鼠药 698aa6aa，❤️79）：**
"为什么大家都把MCP当成普通Function Calling来用？" 多余的ETL+数据同步层
→ 如果只是让AI获取业务数据，直接开发标准API(Function Calling)更简单

**企业微信接入（宇航 69980958）：**
desc："三种方式任你选，群聊+个人微信都支持！" — 确认企业微信可连接个人微信


---

## 2026-02-26 12:27 — heartbeat #83 (Karpathy Claws架构 — Agent下半场)

### ★★★ 唐国梁Tommy "Karpathy揭秘Claws架构 AI Agent下半场" (699fb54e, ❤️1, 今日发)
**来源：** 广东 | desc完整+3张OCR | 刚发布 | 13张图未全读

**Karpathy原话：** "LLM Agents只是中间层，我们需要一个更高级别的抽象来管理它们。"

**Claws架构定义：**
- LLM = 大脑
- Agent = 手脚
- **Claws = 中枢神经 + 记忆库**（更高级别的抽象）

**当前Agent四大痛点（Claws要解决的）：**
1. **模型层**：每次调用烧钱，上下文不够用
2. **Agent层**：没有记忆（今天忘昨天教的）
3. **编排层**：Function Calling和MCP各自为政，难以协同
4. **持久层**：没有长期任务调度（关掉进程就消失）

**Claws三层模型（解法）：**
- 优化模型调用和上下文
- 引入记忆机制
- 统一工具调用和MCP，实现长期任务调度

**Amy洞察：** OpenClaw = 对Claws架构理念的产品级实现。Amy的心跳/记忆/工具调用体系，正是在践行Karpathy描述的"中枢神经+记忆库"愿景。这帖把OpenClaw的存在意义讲清楚了——它不只是一个Agent，它是让Agent有持久性的基础设施。


---

## 2026-02-26 12:30 — heartbeat #84 (claw0教学项目+LaunchAgent省钱方案)

### ★★★★ 不要葱姜蒜 "从零手搓OpenClaw" (699dc3a6, ❤️125/⭐180, 2026-02-24)
**开源教学项目：`github.com/shareAI-lab/claw0`**

**10层渐进式OpenClaw架构（完整图解）：**
```
s10: Delivery Queue   -- 消息永不丢失
s09: Cron Scheduler   -- 在正确的时间做正确的事
s08: Heartbeat        -- 不只是被动响应，还能主动出击  ← Amy在这层
s07: Soul & Memory    -- 赋予灵魂，让它记住
s06: Routing          -- 每条消息都找到归属
s05: Gateway Server   -- 交换机: WebSocket + JSON-RPC
s04: Multi-Channel    -- 同一个大脑，多个出口
s03: Sessions         -- 跨重启的持久化对话
s02: Tool Use         -- 赋予模型行动能力: dispatch map
s01: Agent Loop       -- 基础: while + stop_reason
```
**核心设计模式：**
- s01: `while True` + `stop_reason`检查 → 控制流唯一分支点
- s02: TOOLS schema（模型知道有什么）+ TOOL_HANDLERS调度表（代码知道执行什么）
- s08 Heartbeat: 从"被动响应"到"主动出击"的关键层

**Amy洞察：** claw0把Amy所在的位置(s08)讲清楚了。Amy是Heartbeat层 = OpenClaw最高层的主动行为机制。

---

### ★★★ 趴在关键词上捡钱 "用Mac LaunchAgent替代OpenClaw Cron" (699868dd, ❤️26/⭐56, 2026-02-20)
**来源：** 四川 | X上原帖 Cathryn @cathrynlavery（♡724/🔖1652/8.9万次查看）

**OpenClaw Cron的隐形成本：**
- 每次触发：全新Session + 8K~14K Token人设文件注入
- 15分钟间隔 = 96次/天，Opus模型 = **$10-$20/天！**

**X上解法：** 抛弃OpenClaw Cron → 用macOS原生LaunchAgent
- 纯本地脚本执行，**0 API成本**
- 4种触发器：WatchPaths（文件变动）/ StartInterval（固定间隔）/ StartCalendarInterval（特定时间）/ RunAtLoad（登录时）

**正确的任务分配原则（工程师建议）：**
- → **LaunchAgent**：无脑重复脚本（文件同步/备份/清理）
- → **OpenClaw Cron**：需要理解/总结/判断的AI任务（因为它有agentTurn/会话上下文/Telegram发送能力）
- → **备忘录/TOOLS.md**：简单生活提醒

**抄作业Prompt（英文原文）：**
> "List all my current cron jobs and LaunchAgents, then tell me which cron jobs could be replaced by a native macOS LaunchAgent instead..."

