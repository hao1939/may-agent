# Amy XHS Intelligence — insights.md
_Compact #16 @ 2026-02-26 12:05 (HB73–HB75) | Archive: insights-archive-20260226p.md_
_Full chain: 20260225 → 20260226 → b…k → l → m → n → o → p_

---

## ACTIVE INSIGHTS (post compact #16)

### 🏗️ 多Agent架构完整教程（AgentOPC 6998aa24，❤️134/⭐292）

**架构：** 1 Gateway + 8 Agent（1管理者 + 7执行者）| 每Agent完全隔离

**4步配置精华：**

**Step1 — agents.list（openclaw.json）：**
```json
{"agents":{"list":[
  {"id":"main","default":true,"name":"小王","workspace":"~/.openclaw/workspace"},
  {"id":"wang1","name":"王一","workspace":"~/.openclaw/workspace-wang1"}
]}}
```
⚠️ workspace必须独立，否则记忆/人格串行

**每workspace文件：** `AGENTS.md / SOUL.md / IDENTITY.md / USER.md / MEMORY.md / memory/`

**Step2 — Telegram多账户路由：**
```json
{"channels":{"telegram":{"accounts":{"xiaowang":{"botToken":"..."},"wang1":{"botToken":"..."}}}},
 "bindings":[{"agentId":"main","match":{"channel":"telegram","accountId":"xiaowang"}}]}
```

**Step3 — 群组多Bot并存：**
- `requireMention:true` 避免8个Bot抢答
- 每Agent配`mentionPatterns:["@王一","王一"]`
- BotFather `/setprivacy→Disable`（必做！）

**Step4 — Agent间通信：**
```json
{"tools":{"agentToAgent":{"enabled":true,"allow":["main","wang1","wang2"...]}}}
```

---

### 🧩 工作流 vs. Skill 三层进化（呆娜索 699fc329，今日发）

**三核心概念：** LLM(只思考)→Skill(代码工具，无智能)→Agent(LLM+Skill+记忆+规划，多步自主决策)

**工作流进化三层：**
1. 嵌入LLM（无Skill）→ 节点更聪明
2. 嵌入LLM+Skill → 节点能执行
3. **协调多Agent → 工作流当"组织者"，专注流程控制** ← Amy的形态

> 工作流不会消失——确定性场景(合规/核心业务)中是基石；灵活性场景中与智能节点融合

---

### 🚀 多Agent完整配图（carry-forward）

**Claude Code Worktree（69995d51，❤️279）：** `claude --worktree`；5 sub-agent同时工作互不冲突；Boris Cherny数百并行OK；`isolation:worktree`永久启用

**OpenClaw Sandbox架构（6983e298）：** One Session One Container；Docker动态管理；决策层↔执行层解耦

---

### 💰 成本+配置精华（carry-forward）

**v2.23三板斧：** Bootstrap文件缓存/Inbound flags/Compaction三bug修复 → 省15-20%
**心跳55分钟** = 缓存TTL黄金点 → 省83%（两源验证）
**Session控制：** `/compact`手动；`session.reset`定时；Pruning软/硬裁剪；fallbacks轮换

**TG必开三件套：** blockStreamingDefault/allowlist白名单/ackReactionScope=all
**版本：** 2.9→2.17→2.22→2.23(cache三板斧)→2.24⚠️(心跳DM限制)

---

### 🔧 部署+记忆精华（carry-forward）
- 国内无障碍：树莓派+Kimi+飞书（Eli 69809468）
- 最省钱海外：Atlantic.Net免费1年 / Zeabur国人免费起步
- 记忆检索：向量(0.7)+关键词(0.3)；MEMORY.md只放索引✅
- qmd：2.2内置；`qmd update && qmd embed`；需2GB内存

---

## 待追踪
- **ClawRouter** — X上11天2.4k⭐，XHS暂无
- **砍特BOT 699eedf9** "如何强化个人agent的memory"（OCR超时，未完整读）
- **辛康在进化 69845f8e** — token失效

## KEY DECISIONS
- **Amy扩展蓝图确立** — AgentOPC教程是直接参考
- **工作流=Amy的调度骨架** — Cron心跳就是"层次3"工作流协调Agent
- **audit false positive** — 已确认10+次，直接跳过

---

## 2026-02-26 12:07 — heartbeat #76 (memU新框架发现)

### ★★ 砍特BOT "如何强化个人agent的memory" (699eedf9, ❤️11, 2026-02-25)
**来源：** 浙江 | desc完整（图太多跳过OCR）

**核心发现：`memU` — 新开源Memory框架**
- 7×24后台运行
- 自动提炼每次对话→分类存档
- 下次主动检索→注入上下文
- 还会记住你说要做的事并提醒你

**意义：** "了解了它，你就知道生产级别的memory是怎么构建的了"

**Amy洞察：** memU = Amy的JOURNAL.md（自动记录）+ memory_search（检索注入）+ 待办追踪功能的框架级实现。这是Amy记忆架构向生产级进化的参考路径。

**待深挖：** 标签含`#rag` → memU可能结合RAG/向量检索实现上下文注入


---

## 2026-02-26 12:13 — heartbeat #77 (交易机器人+InstaClaw发现)

### ★★★ Afrodance.eth "用openclaw测试了两个交易机器人" (698da526, ❤️359/⭐296, 2026-02-12)
**来源：** 荷兰 | desc精简但OCR完整 | **OpenClaw金融量化应用案例**

**场景：** $1000本金 / 2个策略 / Polymarket上BTC+ETH+SOL的15min市场 / 运行8小时

**Run #3结果（Slide 2）：**
- **+$76.49净盈利** | 2,565笔交易 | **55.5%胜率**
- Take-profit生效：WR从36.6%跳至55.5%（R:R强制TP底线）
- BTC撑起+$102.28；ETH/SOL拖累-$25.78
- 最大回撤$41.15（本金4.1%），后期进行性减仓触发
- 下轮方向：per-asset配置；ETH/SOL拓宽止损+收紧TP，或过滤不交易

**Run #2结果（Slide 3）：**
- +$35.95净盈利 | 225笔交易 | 46.2%胜率（104W/121L）
- $39.07最大回撤；深V型恢复（-$39→+$36）
- BTC最稳50%WR；ETH最差44%

**🚨 意外发现 — `InstaClaw` SaaS服务（Slide 1 OCR）：**
```
InstaClaw
Deploy OpenClaw — Set up your dedicated OpenClaw instance in minutes.
[Deploying] Setting up your instance...
claw-0k1lum-instance.io
⟳ Assigning server → □ Configuring OpenClaw → □ Starting services → □ Ready
```
**技术栈：** Next.js + Supabase数据库 + 自动分配服务器
**意义：** 有人在做OpenClaw的一键托管部署SaaS — 类比Railway/Zeabur的垂直定制版！

**Amy洞察：** OpenClaw生态正在产生围绕它的商业产品。InstaClaw是第一个被观测到的第三方SaaS。❤️359/⭐296 说明量化+AI这个组合在XHS用户中非常受欢迎。


---

## 2026-02-26 12:15 — heartbeat #78 (Chrome MCP + Agent记忆技术栈)

### ★★★ AIGC阿栈 "chrome-dev-tools MCP才是最优解" (69901aa3, ❤️242/⭐484, 2026-02-14)
**核心建议：把OpenClaw的浏览器工具换成chrome-devtools-mcp（CDP协议）**

**5类能力（比原生浏览器工具更强）：**
- **自动化**：`navigate_page` / `click` / `fill`（点击/输入/滚动/导航）
- **调试**：`get_console_message` / `take_screenshot` / `take_snapshot`（DOM快照）
- **网络分析**：`list_network_requests`（捕获和分析网络请求）
- **性能分析**：`performance_start_trace`（记录性能Trace/页面加载）
- **设备模拟**：`emulate`（模拟移动设备/修改视口）

**核心论点：** CDP是Chrome自家协议 → 比第三方浏览器工具更稳定更强大

---

### ★ 乐乐的AI实验室 "Agent记忆系统设计：从失忆到持久化" (699f8d38, ❤️1, 今日发)
**4层记忆架构（技术向）：**
1. **短期记忆**：滑动窗口，保留最近N轮，超过自动截断
2. **长期记忆**：向量数据库；推荐PostgreSQL+pgvector 或 Pinecone
3. **工作记忆**：Redis实时存当前任务状态；完成后持久化到长期记忆
4. **检索策略**：RAG vs GraphRAG — 实测GraphRAG准确率高23%但延迟+40%

**踩坑三条：** 记忆污染（错误信息混入）/ 遗忘策略（多久清理）/ embedding成本

