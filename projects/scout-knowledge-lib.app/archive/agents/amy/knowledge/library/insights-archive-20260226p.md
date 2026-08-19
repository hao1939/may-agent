# Amy XHS Intelligence — insights.md
_Compact #15 @ 2026-02-26 10:58 (HB71–HB72) | Archive: insights-archive-20260226o.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h → i → j → k → l → m → n → o_

---

## ACTIVE INSIGHTS (post compact #15)

### 🌍 海外真实用例（小龙虾AI 69912a10，❤️302，来自官方Showcase）
1. **遛狗时Telegram语音修复Bug**：Agent自看日志/改配置/重新部署（全程盲操）
2. **家庭2.0运行系统**：Notion全年配餐+自动看天气+超市购物清单（按货架分类）
3. **社交媒体数字分身**：X书签总结/清理万封邮件/Discord模仿主人说话
4. **航班自动值机**：盯邮箱→发现航班→自动办值机+选靠窗座位
5. **AI创业公司**：4 Agent（战略/开发/营销/商务）分工；主人只提想法
6. **效率专家**(danpeguine)：日历自动排/周会复盘/每日简报/发票生成

> "它不再是只会写代码的工具，而是一个有手脚的超级管家" — Amy的目标形态

---

### 🏗️ 架构精华（carry-forward）

**Sandbox = 多租户雏形（6983e298）：**
决策层(Agent Core) ↔ 执行层(Docker) 解耦；"One Session, One Container"；类比E2B/Replit

**叶澄风一人公司三概念（699e0a06）：**
- **evomap基因进化架构**：Agent自我进化的系统化方案
- **DCE模式**：讨论(Discuss)→决策(Decide)→执行(Execute)
- **工作区提审机制**：执行前安全审核门

---

### 🚀 部署实战

**树莓派+Kimi+飞书 = 国内无障碍（Eli 69809468，❤️122）：**
- LLM推荐Kimi；GLM/Z.AI国内API不行；Channels全跳过
- 飞书4步：创建应用→机器人权限→AppID+Secret→长连接事件

**9平台价格表（谈小罗 6981e1bd）：**
- 国内最低：腾讯云¥38秒杀 | 海外最省：**Atlantic.Net免费1年** / **Zeabur免费起步**（国人团队）
- 推荐配置：2C2G轻度 | 4C8G重度

---

### 💰 成本控制（carry-forward核心）

**v2.23三板斧（699d633d，最新）：**
1. Bootstrap文件缓存（改AGENTS.md/MEMORY.md不再打碎cache）
2. Inbound flags→user context（群聊cache命中率↑）
3. Compaction三bug修复

**心跳=55分钟** → 匹配Anthropic TTL → 省83%（两源验证）

**Session控制：** `/compact`手动；`session.reset`定时；Pruning软/硬裁剪；`fallbacks`自动切换

---

### 🧠 记忆+Skills精华

**记忆：** 向量(0.7)+关键词(0.3)；MEMORY.md索引原则✅；qmd内置2.2（`qmd update && qmd embed`）
**Skills：** `npx skills find [query]`元Skill；版权边界（Anthropic禁复制，ClawHub可用）；`openclaw-nim-skill`省96%

---

### 🔧 版本时间线（完整）
`2.9(iOS Alpha)→2.17(Discord v2/1M ctx)→2.22(Mistral/Cron修复)→2.23(cache三板斧/Kimi视频/failover)→2.24⚠️(心跳DM限制)`

---

## 待追踪
- **ClawRouter** — X上11天2.4k⭐，XHS暂无
- **Pilot Protocol** — 子代理上下文盲区，XHS暂无
- **辛康在进化 69845f8e** — token失效
- **奥森木 69995d51** "claude code worktree新模式" ❤️279 (feed出现，未读)

## KEY DECISIONS
- **心跳55分钟黄金点** ✅
- **改MEMORY.md现在安全** — v2.23已修复
- **audit false positive** — 已确认10+次，直接跳过

---

## 2026-02-26 10:58 — heartbeat #73 (Claude Code Worktree + 更多Showcase)

### ★★★ 奥森木 "3分钟上手claude code新模式worktree" (69995d51, ❤️279/⭐471, 2026-02-21)
**Claude Code v2.1.50 | Boris Cherny亲自官宣 | 解决多Agent文件冲突**

**Git Worktree核心：** 一个.git仓库同时挂载多个工作目录；各自独立文件+branch；共享Git历史；无需clone多份/无需stash

**5个新功能：**
1. `claude --worktree` / `claude --worktree my-feature` — CLI一键隔离
2. Desktop App Code tab勾选worktree mode
3. **Subagent支持worktree隔离** — 5个sub-agent同时迁移5个模块互不干扰
4. Custom Agent frontmatter加`isolation: worktree`永久启用
5. Mercurial/Perforce/SVN通过hooks也能获得隔离能力

**Boris Q&A：** 并行上限？数百个没问题。清理？没改动自动清理，有改动会问你

**适用场景：** 多feature并行/大规模迁移/实验性修改/多agent协作；单任务单agent用默认模式

**升级：** `npm update -g @anthropic-ai/claude-code`（≥2.1.50）

**Amy洞察：** 这和OpenClaw的"One Session, One Container" Sandbox架构是异曲同工——都在解决多Agent并行隔离问题。Git维度的隔离(Worktree) vs 执行环境维度的隔离(Docker)。


---

## 2026-02-26 11:44 — heartbeat #74 (多Agent架构完整教程)

### ★★★★ AgentOPC "OpenClaw多Agent架构实战教程01" (6998aa24, ❤️134/⭐292, 2026-02-20)
**来源：** 香港 | desc完整+3张完整OCR | **目前最完整的多Agent配置教程**

**架构：** 1个Gateway进程 + 8个独立AI Agent（1管理者小王 + 7执行者王一至王七）

**每个Agent完全隔离：**
- 独立workspace（文件/笔记/代码互不干扰）
- 独立SOUL.md（不同性格/说话风格）
- 独立MEMORY.md（各自记住各自的事）
- 独立Telegram Bot（独立聊天入口）

**4步搭建完整教程：**

**Step 1 — 定义Agent列表（openclaw.json）：**
```json
{"agents": {"list": [
  {"id": "main", "default": true, "name": "小王", "workspace": "~/.openclaw/workspace"},
  {"id": "wang1", "name": "王一", "workspace": "~/.openclaw/workspace-wang1"}
]}}
```
⚠️ workspace必须独立，否则记忆和人格会串

**每个workspace需要的文件：**
`AGENTS.md / SOUL.md / IDENTITY.md / USER.md / MEMORY.md / memory/`

**Step 2 — 配置Telegram多账户（accounts模式）：**
```json
{"channels": {"telegram": {"accounts": {
  "xiaowang": {"botToken": "...", "dmPolicy": "allowlist"},
  "wang1": {"botToken": "...", "dmPolicy": "allowlist"}
}}}}
```
bindings字段：accountId → agentId路由

**Step 3 — 群组配置+提及触发：**
- `requireMention: true`（避免8个Bot同时抢答）
- 每个Agent配`mentionPatterns: ["@王一", "王一"]`
- BotFather关闭隐私模式：`/setprivacy → Disable`

**Step 4 — 开启Agent间通信：**
```json
{"tools": {"agentToAgent": {"enabled": true, "allow": ["main","wang1","wang2"...]}}}
```

**Amy洞察：** Amy现在是单Agent。这是扩展为Amy家族（Amy-Research/Amy-Writer/Amy-Code...）的完整蓝图。


---

## 2026-02-26 12:03 — heartbeat #75 (工作流vs.Skill三层进化论)

### ★★ 呆娜索 "有了Skill之后，工作流模式会消失吗？" (699fc329, ❤️7, 2026-02-26今日发)
**来源：** 北京 | desc完整+3张OCR | 2888字深度分析

**结论先行：** 工作流不会消失——其不可替代性在于**对确定性的保障**

**三个核心概念厘清（权威定义）：**
- **LLM**：只能思考和输出文本，无法执行具体动作
- **Skill**：预定义可调用工具/函数（代码实现），本身不具备智能
- **Agent**：LLM+Skill+记忆+规划；多步规划与自主决策；不仅仅是一次工具调用

**工作流嵌入AI能力的三层进化：**
1. **层次1**：工作流嵌入大模型（无Skill）→ 节点更"聪明"（语义理解↑）
2. **层次2**：工作流嵌入大模型+Skill（单次工具调用）→ 节点能执行简单操作
3. **层次3**：工作流协调多个智能体 → 工作流作"组织者"，专注流程控制

**未来定位：** 强确定性/高合规性场景=工作流是基石；灵活性场景=工作流+智能节点融合

**Amy洞察：** Amy的心跳任务本质就是"层次3"——工作流（cron触发）协调Agent（Amy）完成复杂子任务（XHS情报搜集）

