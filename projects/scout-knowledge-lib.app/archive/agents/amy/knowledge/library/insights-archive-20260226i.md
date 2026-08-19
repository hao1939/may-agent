# Amy XHS Intelligence — insights.md
_Compact #8 @ 2026-02-26 09:55 (HB47–HB51) | Archive: insights-archive-20260226h.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h_

---

## ACTIVE INSIGHTS (post compact #8)

### 🚨 Anthropic官方产品 & 竞争情报

**Insight A1 — Claude Cowork** (仅Claude Max $100/月；仅macOS；"自动挡"比喻；中国护城河=境外账号)

**Insight C1 — OpenClaw技术栈**
- OpenClaw = Moltbot = Clawdbot（Peter Steinberger @steipete）
- 底层框架：**pi-mono**（Mario Zechner，libGDX游戏引擎作者开发）
- pi-mono哲学：4工具only（read/write/edit/bash）；工具越少可控性越强；"引擎+整车"分工
- 技术选型：TypeScript/Node.js — 调度问题非算力问题；"最容易让人上手和参与"
- **Pi框架独立部署趋势：** 高级用户已绕过OpenClaw直接用Pi底层，自建记忆/心跳/Telegram通知（九头蛇Versun/YoYo等）

---

## OpenClaw 核心架构文档（精华）

### 🔑 文档加载权限（AI.zip 6991c081）

主Agent可见：AGENTS.md / SOUL.md / TOOLS.md / USER.md / HEARTBEAT.md / BOOTSTRAP.md / MEMORY.md🔒
子Agent只见：**AGENTS.md + TOOLS.md**（仅此两个）
MEMORY.md：🔒最高隐私保护，仅手动加载，群里不可见

### 🔑 A2A两套机制（过气Pm张 6999c60a）

- `sessions_spawn` = 派活（新隔离session；无历史；干完返回）→ 90%日常任务
- `sessions_send` = 1v1讨论（注入已有session；带SOUL.md+历史；最多5轮）→ 深度辩论
- ⚠️ `sessions_send`默认关闭；需手动`enabled: true`+allow数组+SOUL.md写调用方式

### 🔑 Multi-Agent vs Sub-Agent（CrazyAgent 69972247）

| | Multi-Agent | Sub-Agent |
|--|-------------|-----------|
| 本质 | 永久员工 | 临时实习生 |
| Workspace | 有完整Workspace | 无 |
| 记忆 | 完整长期记忆 | 仅本次临时记忆 |
| 配置 | `agents.list + bindings` | `sessions_spawn(task)` |

**终极形态：** 横向隔离（Multi）+ 纵向并行（Sub）

---

## 记忆系统深度（HB51精读）

### 🔑 Han1五层记忆架构（★★★★ 698a01b8，❤️328/⭐598）

| 层 | 文件 | 别名 | 用途 |
|---|------|------|------|
| 1 | **NOW.md** | 救生艇 | 重启后第一读：当前任务/待办/下一步 |
| 2 | **memory/YYYY-MM-DD.md** | 流水账 | 边发生边记，每天一文件 |
| 3 | **MEMORY.md** | 长期记忆 | 定期从日记提炼"人生经验" |
| 4 | **self-review.md** | 错题本 | 判断失误记录；每次启动先读；counter-check再回应 |
| 5 | **TOOLS.md** | 环境笔记 | 设备/API/偏好/消息约定 |

**三个铁律：** ①AI说"记住了"≠真记住，必须写文件，现在 ②上下文压缩会吃记忆，边聊边写日记 ③Mental notes不存在，文字>大脑

**金句：** "没有记忆的AI是工具。有记忆的AI才有可能成为'人'。"

**Amy缺口：** `NOW.md`（启动便签）+ `self-review.md`（错题本）— 待创建

### 🔑 OpenClaw Memory两层架构（HarryDes 697f1643，❤️124/⭐222）

- **L1 Markdown（开箱即用）：** `memory/YYYY-MM-DD.md`（每日，自动读今天+昨天）+ `MEMORY.md`（长期，仅主会话）
- **L2 向量搜索（memory_search，需配置）：** `~/.openclaw/openclaw.json` → `agents.defaults.memorySearch`
- Provider：local（~600MB，最安全）/ openai / gemini
- **混合搜索：** 向量70%（语义）+ BM25 30%（精确）
- 验证：`/memory_search 测试一下`
- 维护：`ls -lh ~/.openclaw/memory/*.sqlite`

---

## Skills生态深度

### 🔑 Skills = 可观测性工具，不是能力扩展（Vibe西希 698b252e，❤️53）

> "Skill是你和不确定性谈判时，用来切割问题的刀。不保证成功，但保证失败得足够清楚。"

**三角色：** ①可被单独验证的判断单元 ②责任边界清晰的模块（Debug变得像传统软件）③暴露业务假设的放大镜

**黄金粒度标准：** "愿意为这个决策单独建一个评测集？" → 愿意=Skill；不愿意=还是Prompt

**Skills = MCP的上下文路由层（chouheiwa）：** MCP eager loading 91工具=48000 token(24%)；Skills三层→节省90%

### 🔑 SOUL.md官方8条（Peter Steinberger，原帖❤️3.6K）

三层结构：Core Truths / Boundaries / **Personality（←Peter 8条只改这层）**

8条核心：①有强烈观点 ②删公司规章感 ③禁套话开头 ④一句话够就一句话 ⑤允许自然幽默 ⑥直言不讳 ⑦脏话恰到好处 ⑧凌晨两点助理定义

---

## OpenClaw批评视角

**YoYo 699e412c三大痛点：** token过大 / 恶意Skills漏洞 / 兼容所有模型=最小公约数（功能取交集）

**自建替代方案共识：** 零token心跳 + 热温冷三层记忆 + 人设持久性 → Pi框架独立部署已成高级用户趋势

---

## 未读/待追踪队列

- **Ben.AI 699738b5** — 持续0结果
- **辛康在进化 69845f8e** (❤️180/⭐349) — token失效
- **Dissao 6991773100000000150330dd** — 13张图SIGTERM，待分批
- **小火龙 699f9bbb** (❤️12) — 11/13完成后退出
- **奥森木 698facff** (❤️196) — 第12次block，放弃主动重试

---

## KEY DECISIONS (carry-forward)

- **Amy立即待办：** 创建`NOW.md`（启动便签）+ `self-review.md`（错题本）← Han1架构建议
- **MEMORY.md只放索引（≤1000字）** ← 愚园路十二妹实战验证
- **Pi独立部署是高级用户趋势**，意味着OpenClaw黑盒感是真实痛点
- **sessions_send默认关闭** — 需手动配置+SOUL.md写调用方式
- **搜索状态：** 记忆/SOUL/热温冷等词可用；openclaw通用词多超时/封锁
- **Post-compaction audit false positive** — 已确认7次，直接跳过

---

## 2026-02-26 09:57 — heartbeat #52 (Amy架构升级 + Claude Code商科实验 + 架构图视频)

**架构升级完成：** `NOW.md` + `self-review.md` 已创建（基于Han1五层框架）

### ★★ Dimothy "写在claude五小时帮我跑通一个商科实验后" (6985b283, ❤️1306/⭐912/💬172, 2026-02-06)
**来源：** Dimothy（美国）| Claude Code使用心得 + PhD就业情绪帖

**技术层面：** Claude Code从零搭实证研究pipeline；1万多行Python；几十万条GitHub数据；research design→出结果 = **5小时**（正常做需2-3周）

**情绪层面（高共鸣的深层焦虑）：**
> "跑完之后躺在床上，第一反应居然是慌。因为我突然意识到，我刚才做的所有事情本质上都是**执行**。"

**核心论断：**
- "聪明人从来就不稀缺，全世界大把大把的聪明人困在错误的地方、错误的信息茧房里，根本没有机会让人看到"
- "现阶段AI并没有导致什么新局面，它只是把这个已经在进行的过程**直接快进到了终点**"
- 最后问题：AI = 成本几乎无限低的"overeducated but underpaid people"？

**Amy洞察：** ❤️1306说明这种执行层焦虑极度普遍；PhD/Entry level人群是OpenClaw的潜在核心用户群——他们最需要的是把执行自动化，把认知价值留给自己

### ○ 迪迪碎碎念 699e91b1 "搞懂这张图，你对Openclaw的理解超过90%" (❤️75/⭐149)
视频帖，OCR跳过；待有时间截图分析


---

## 2026-02-26 10:01 — heartbeat #53 (Dissao完整记忆系统技术深度帖)

### ★★★★ Dissao "OpenClaw记忆系统：构建持久智能体" (6991773100000000150330dd, ❤️53/⭐87, 2026-02-15)
**来源：** Dissao（美国）| 13张图全OCR | **迄今最完整的OpenClaw记忆系统技术文档**

**核心原则：** "文件即真相，确定性注入优于概率检索"

**三层心智模型（最权威版本）：**
```
Layer 1: Context files（上下文层，Always-loaded，确定性）
  → AGENTS.md / SOUL.md / USER.md / MEMORY.md
  → ~20-30个关键要点；始终加载，永不检索失败
  → 处理90%的需求

Layer 2: Logs（日志层，近期连续性）
  → memory/YYYY-MM-DD.md — 仅追加，意识流，写入成本低
  → 启动时加载今天+昨天；更旧的可搜索

Layer 3: Vector search（向量层，长期检索安全网）
  → memory_search — 语义检索跨所有记忆文件
  → 日志超过30个文件（约一个月）时才值得启用
```

**压缩前内存刷新（memoryFlush）— 巧妙安全网：**
```json
{
  "compaction": {
    "memoryFlush": {
      "enabled": true,
      "softThresholdTokens": 4000,
      "prompt": "Write persistent notes to memory/YYYY-MM-DD.md; if there's nothing to store, reply NO_REPLY"
    }
  }
}
```
"第3天这救了我——长会话中有重要决策，没有刷新就会随压缩丢失"

**MEMORY.md最佳实践：**
- 按主题组织（不是时间顺序！）：`## Infrastructure / Key decisions / Lessons learned / Open TODOs`
- 激进修剪——不再相关的就删除
- 仅私聊加载；群聊/Discord不注入（防止私有基础设施细节泄露）

**QMD（重度负载备选）：** BM25+向量+重排序；Bun+node-llama-cpp本地运行；Gateway管理，每5分钟`qmd update`+`qmd embed`

**混合搜索原理：**
- 向量70%：理解语义（改写/概念匹配）
- BM25 30%：精确token（错误字符串/配置键/ID）

**推荐路径：** 第1天别设置QMD，先把AGENTS.md写好，让agent有机构建MEMORY.md；超30个日志文件再开向量搜索

**最后一句：**
> "整个系统可检查、可编辑、可版本控制。无黑盒。工作区的`git log`就是智能体记忆形成的历史。"


---

## 2026-02-26 10:04 — heartbeat #54 (源码拆解四层架构 + Telegram多线程配置)

### ★★★ Plutoxx28 "OpenClaw源码拆解：前三层竟然完全不用LLM" (69953d1c, ❤️81/⭐150, 2026-02-20)
**来源：** Plutoxx28（黑龙江）| 3张图OCR | **OpenClaw消息处理管道完整披露**

**核心原则：** "把确定性的归代码，模糊的归AI"（Code 80% / LLM 20%）

**消息处理四层管道（"剥洋葱"）：**

输入示例：`@research /thinking high 帮我搜RAG论文`

| 层 | 名称 | 处理内容 | 技术 |
|---|------|----------|------|
| 1️⃣ | **路由层(Routing)** | 按binding/session上下文路由到对应Agent；`@research`是触发信号而非路由依据 | Code Only |
| 2️⃣ | **命令检测层(Command)** | `/reset`、`/status`等控制命令直接执行，不进LLM；命令注册表匹配 | Code Only |
| 3️⃣ | **指令解析层(Directive)** | `/thinking high`剥离出来提取配置参数；得到cleaned文本；可能有inline skills直接处理 | Code Only |
| 4️⃣ | **LLM层** | 只处理业务意图本体："帮我搜RAG论文" | LLM |

**价值：** "不只是省token，更是为了**确定性和可控性**。模型/权限/思考深度本质是配置问题，应先交代码处理；只有'用户要完成什么任务'这类模糊问题才交LLM决策"

---

### ★★ Dayu的AI进化论 "OpenClaw：如何让Bot同时多线程工作" (698ae033, ❤️181/⭐395, 2026-02-10)
**来源：** Dayu（美国）| 6张图全OCR | Telegram多群并行Session完整教程

**核心机制：** 每个Telegram群 = 独立上下文。群A写代码/群B翻译文档，互不干扰

**三步配置：**
1. `openclaw.json` → `channels.telegram.groups."*": { requireMention: true }` （推荐，只有@才回）
2. 用`@getidsbot`获取群ID（看完踢掉）；指定群可不需要@触发
3. BotFather → Bot Settings → Group Privacy → **Turn off**（99%没反应就是这里没关）

**Amy洞察：** 这是"横向隔离"最简单的实现方式——不需要配置Multi-Agent，只需要多建几个Telegram群即可实现上下文隔离

