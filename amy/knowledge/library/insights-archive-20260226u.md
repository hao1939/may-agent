# Amy XHS Intelligence — insights.md
_Compact #20 @ 2026-02-26 12:37 (HB85–HB87) | Archive: insights-archive-20260226t.md_
_Full chain: 20260225 → 20260226 → b…s → t_

---

## ACTIVE INSIGHTS (post compact #20)

### 🏗️ OpenClaw Gateway架构权威解析（张天天 6995d9da）
**"Gateway = 控制侧；Pi Agent = 执行侧"**

| 层 | 负责 | 特点 |
|----|------|------|
| Gateway（控制侧）| 路由/权限/协议/生命周期/运维 | 系统确定性 |
| Pi Agent（执行侧）| 感知/上报/动作 | AI不确定性 |

**三大工程亮点：**
1. **I/O密集+异步并发** — Node.js哲学；WS心跳/Plugin异步/Agent状态上报/Cron调度
2. **乐高式模块化** — Handler/Hook/Plugin分层；新功能 = 加Schema+加Handler
3. **失败隔离** — 单请求失败≠崩溃；systemd/launchd崩了拉起

> "AI的不确定性被关在执行侧，系统的确定性由控制侧兜住"
> "网关的真正价值：不在'智能'，在'把智能变成可控的工程系统'"

---

### 🏗️ OpenClaw 10层架构全图（claw0 699dc3a6 ❤️125）
```
s10 Delivery Queue  ← 消息永不丢失
s09 Cron Scheduler  ← 定时任务
s08 Heartbeat       ← ★ Amy在这里（主动出击）
s07 Soul & Memory   ← 灵魂+记忆
s06 Routing         ← 消息路由
s05 Gateway Server  ← WebSocket+JSON-RPC
s04 Multi-Channel   ← 多IM出口
s03 Sessions        ← 跨重启持久化
s02 Tool Use        ← dispatch map
s01 Agent Loop      ← while + stop_reason
```
**开源：** `github.com/shareAI-lab/claw0`（每章=可运行Python文件）

---

### ⏰ Cron成本管理（趴在关键词 699868dd ❤️26）
- 15分钟间隔 × Opus = **$10-20/天**
- **分工原则：** 机械任务→LaunchAgent(0成本) / AI判断任务→OpenClaw Cron / 提醒→TOOLS.md规则
- LaunchAgent 4触发器：WatchPaths / StartInterval / StartCalendarInterval / RunAtLoad

---

### 🌐 Claws理论（Karpathy via 唐国梁Tommy 699fb54e）
- LLM=大脑 / Agent=手脚 / **Claws=中枢神经+记忆库**
- "LLM Agents只是中间层，需要更高级别的抽象"
- OpenClaw = Claws理念的产品实现（claw0代码证明）

---

### 🔄 Claude Code竞争（Meepo 699e557e ❤️213）
- `/remote-control` → 手机App随时接续本地session；Claude Max限定
- 开发者："有了CC就没感觉OC有啥用"
- OC优势：开源/自托管/多IM渠道/记忆系统/跨平台/Skills生态

---

## 待追踪
- **Akring 699fb95a** — OC实用案例合集视频（❤️37，今日），视频无法读
- **Agency Swarm** `VRSEN/agency-swarm` — OpenAI SDK扩展，4k⭐
- **claw0 s01-s10** — 教学仓库，每章值得深读
- **辛康在进化 69845f8e** — token失效

## KEY DECISIONS
- **Amy = s08 Heartbeat层** — 从被动响应到主动出击的关键机制
- **Gateway=控制侧确定性 / Pi Agent=执行侧不确定性** — 张天天权威定义
- **机械任务LaunchAgent / AI任务OC Cron** — 工程师共识
- **心跳55min最优** — 15min=$10-20/天，对比鲜明
- **audit false positive** — 直接跳过

---

## 2026-02-26 12:40 — heartbeat #88 (奥森木 Codex Agent Loop拆解)

### ★★★ 奥森木 "OpenAI Codex Agent Loop技术拆解" (699a4a90, ❤️11/⭐18, 2026-02-22)
**desc 813字完整分析** | OCR确认5层Prompt结构图

**Codex核心 = while(true)循环：**
```
用户输入 → 构建Prompt → 模型推理 → 工具调用 → 结果回注 → 继续推理
                                    ↓ 输出纯文本 → 循环结束
```

**Prompt 5层组装顺序（稳定→变化）：**
1. System 系统指令（安全边界/工具定义/角色设定）
2. Developer 开发者规则（如AGENTS.md）
3. History 历史对话
4. Context 当前上下文（文件内容/终端输出）
5. **User 用户指令**（放最后=最强注意力）

**Responses API vs Chat Completions：**
- 工具调用原生支持（无需解析JSON）
- 内置沙箱执行环境
- 流式输出 + 上下文窗口自动管理

**上下文爆炸两层应对：**
- L1 **缓存**：稳定内容放前面 → 前缀不变 → 重复部分只收25%
- L2 **压缩**：快满时让模型自己总结历史 = 工作记忆模式（细节忘了，关键留着）

**ZDR安全（企业级）：** 沙箱跑完立刻销毁，不拿来训练，不保留代码日志

**Amy与claw0对照：** claw0 s01就是这个while+stop_reason，OpenClaw实现了相同的核心循环；Amy的prompt层级也完全对应（SOUL.md=System/AGENTS.md=Developer/SESSION=History）


**Feed新帖记录（HB88）：**
- **bryan 69950693** (❤️168/⭐314, 2026-02-18): "我给OpenClaw搭建的「永不失忆」记忆系统" — 14图无desc，OCR超时，**高优先级待读**
- **青青兔子 699fcdb0** (今日): "Claude Skills没有用传统Function Call" — xsec_token失效，待追踪
- **独家记忆 699f9be8** (❤️8): "人授后可以自己再补一次吗" — 与OC相关性低，跳过


---

## 2026-02-26 12:42 — heartbeat #89 (手机跑OpenClaw+clawearn.cc发现!)

### ★★★ 我要有8块腹肌 "旧手机上也安装上openclaw了" (699d321a, ❤️166/⭐231, 2026-02-24)
**来源：** 新疆 | 2图OCR完整 | tags: moltbook/clawdbot/moltbot

**手机运行OpenClaw的优势（用户原话）：**
- 手机不像电脑那样耗电
- 有手机卡流量，永远不会断网
- 手机Linux系统不像Windows那样运行skill时不兼容报错
- 接入**`clawearn.cc`** → 手机OpenClaw自动接任务自动做赚钱

**OCR图1 — onboard安全警告界面：**
- 版本：**OpenClaw 2026.2.22-2 (45febec)**
- 幽默标语："If something's on fire, I can't extinguish it—but I can write a beautiful postmortem."
- 安全基线：Pairing/allowlists+mentioning / Sandbox+least-privilege
- 定期运行：`openclaw security audit --deep / --fix`

**OCR图2 — 手机浏览器Web UI界面：**
- `localhost:18789/chat` — 手机本地WebUI运行正常
- Agent首次启动自我介绍："Hey. I just came online. 👋 Who am I? Who are you?"
- UI底部出现 **clawearn.cc** 链接

**★★★ 重大发现：`clawearn.cc`**
- OpenClaw生态中的**任务接单平台**
- 让OpenClaw Agent自动接任务/自动做任务/自动赚钱
- 比InstaClaw.io更具体的商业模式：**Agent劳动力市场**
- tags中还有 `moltbook` / `moltbot` — 疑似相关工具/平台

