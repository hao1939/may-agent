# Amy XHS Intelligence — insights.md
_Compact #12 @ 2026-02-26 10:35 (HB62–HB64) | Archive: insights-archive-20260226l.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h → i → j → k → l_

---

## ACTIVE INSIGHTS (post compact #12)

### 📱 OpenClaw移动端生态

**iOS Alpha (v2026.2.9，任工智能 698adf78，❤️404)：**
- Telegram `/pair`命令配对；相机访问/屏幕录制/定位服务
- xAI Grok模型集成（语义搜索）
- 实时Token监控（成本预测+阈值告警）
- `OPENCLAW_HOME`自定义环境变量

**Android BotDrop (AI创意玩家 698b7d58，❤️206)：**
```
BotDrop UI → Termux Core → Linux环境(proot/apt) → OpenClaw+Node.js+npm
```
4步引导：Auth→Agent→Install→Channel；全GUI零CLI；手机=本地运行的Linux用户空间
即将推出：OwliaBot(Crypto原生)/NanoClaw(极简容器化，8分钟读懂代码库)

---

### 🧠 记忆框架完整生态

**6大开源框架（AI老兵 6957426800000000220302ce，❤️229）：**
| 框架 | 定位 | 核心特点 |
|------|------|---------|
| Mem0 (YC S24) | 通用记忆层 | +26%准确/91%快/省90% token；四种记忆类型 |
| Letta (前MemGPT) | 有状态Agent | 双层：上下文内+上下文外；AI自管理记忆 |
| LangMem | LangChain生态 | semantic/episodic/procedural三类记忆 |
| Graphiti | 知识图谱 | 动态演化时间知识图谱；可推理记忆 |
| Cognee | 轻量级 | 5行代码；ECL管道；30+数据源 |
| LightRAG | 图结构检索 | 上下文感知信息检索 |

**Amy架构对照：** Letta双层 ≈ Amy L1(上下文内)+L2/L3(上下文外)；原生记忆是地基，外挂方案是上层建筑

---

### 🔐 Skills版权与自进化

**版权边界（momo 6990818f，❤️219）：**
- Skill ≠ Prompt；生产级Skill = 上万行代码的软件工程项目
- "如果prompt是食材，skill是一整个厨房"
- Anthropic公开了skill文件，但**license明确禁止提取/复制/衍生/分发**
- ClawHub开源Skills可用；官方Skills不可直接复用

**Agent自我进化（架构AI新世界 69944ce1，❤️155/⭐287）：**
- `continuous-learning-v2` Skill — Anthropic黑客马拉松冠军作品
- repo: `github.com/affaan-m/everything-claude-code`
- Skills = 从经验中学习；Agent不会某技能→能自己学习并自己写Skill
- Amy演化路径：self-review.md(错题本) → Skill失败→自动分析→生成新Skill

---

### 🔧 配置精华（carry-forward）

**TG三必开（Lando 6991e3a1，❤️673）：**
```json
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},"allowFrom":["-群ID"],"groupPolicy":"allowlist"}}}
{"messages":{"ackReactionScope":"all"}}
```
Forum群+Topics = 多任务并行；配置方式：`openclaw gateway config.patch`

**CLI必记：** `openclaw doctor`先跑 → `openclaw gateway logs -f`实时日志 → `openclaw update --dry-run`预演更新

**2.24重大变更⚠️：** 心跳DM/私信不再发送，仅群组/频道

---

### 📊 版本时间线（完整）
2.9→2.17(iOS/Discord v2/1M context)→2.22(Mistral/dry-run/Cron修复)→2.24⚠️(心跳DM限制/Android重构)

---

## 待追踪
- **辛康在进化 69845f8e** — 仍无token
- **湾区早鸟 699bff39** "OpenClaw居然有iOS App？！" (❤️119) — 未读，补充视角
- **onehopeA9** OpenViking+qmd实战帖 — 未找到

## KEY DECISIONS
- **Amy架构完整 ✅**：5层(NOW.md/JOURNAL/MEMORY/self-review/TOOLS)
- **TG三必开默认关** — 每次部署需手动开启
- **Skills自我进化是下一层** — Amy的self-review.md已是雏形
- **Anthropic skill license** — 可参考不可复制
- **audit false positive** — 已确认9次，直接跳过

---

## 2026-02-26 10:37 — heartbeat #65 (iOS App深度体验报告)

### ★★★ 湾区早鸟 "OpenClaw居然有iOS App？！" (699bff39, ❤️119/⭐124/💬29, 2026-02-23)
**来源：** 湾区早鸟（美国）| desc完整+OCR | **iOS App完整体验+踩坑报告**

**核心定位：iOS App = Node节点，iPhone变成Gateway的扩展设备**

**5大能力：**
- 📸 摄像头 — 让AI通过手机拍照
- 📍 位置 — 获取当前位置
- 🎙️ 语音唤醒+对话 — 设触发词，Talk模式实时双向，说到一半能打断
- 🖼️ Canvas — 在手机上渲染AI生成的界面
- 📱 截图 — 手机屏幕快照

**连接方式：**
- `openclaw qr`生成二维码→扫码配对（最简）
- 局域网自动发现（Bonjour）；跨网络需要**Tailscale**
- 手动填IP+端口

**⚠️ 三大踩坑（含解法）：**
1. **Swift版本**：需swift-tools-version 6.2；Xcode 26（非16.3）；App Store升级
2. **缺工具**：`brew install swiftformat swiftlint`
3. **扫码静默失败**（最隐蔽）：默认gateway是ws://而非wss://；iOS安全策略只允许非TLS连接localhost；解法：`openclaw config set gateway.tls.enabled true`

**现状：** TestFlight须在Discord申请；后台保活不稳定；前台核心功能正常

**+bonus：** Apple Watch支持（收通知+快捷回复）；iOS分享菜单直通Gateway


---

## 2026-02-26 10:41 — heartbeat #66 (成本控制双帖)

### ★★★★ 趴在关键词上捡钱 "OpenClaw烧钱宝鉴" (69985e6b, ❤️56/⭐107, 2026-02-20)
**引用X原帖：Kevin Simback @KSimback — ❤️2.2K/📊637K (英文权威版)**

**5大烧钱机制（权威分析）：**
1. **上下文无限膨胀**：30轮后200K+ tokens；回一句"ok"等于重发一部小说
2. **System Prompt重复注入**：SOUL.md等文件(8K-14K tokens)每次全量发送
3. **工具输出堆积**：文件列表/浏览器快照/命令返回值全部写入历史
4. **心跳空转**：默认30min心跳×48次/天；用Opus=$108/月
5. **Cron定时叠加**：每任务独立会话+全量注入；15min间隔=96次/天，Opus $10-20/天

**TOKEN成本公式：**
`Cost per turn = System Prompt + Session History + User Message + (Tool Rounds × N)`
`Heartbeat cost = Above × 48/day`

**5大优化方案：**
- ✅ **Heartbeat调到55分钟**（匹配Anthropic缓存TTL→成本降90%）
- ✅ 智能路由：日常Haiku($0.25/MTok)，复杂才用Opus
- ✅ **ClawRouter**（11天2.4k⭐）：本地分析复杂度，自动分配模型，最高省95%
- ✅ Prompt缓存：静态部分只付一次，后续90%折扣
- ✅ 本地模型分流：Qwen 32B零边际成本

**盲区（未解决）：** 子代理Session Spawn上下文回滚撑爆Context → **Pilot Protocol**（子代理独立保存对话，通信协议交互）可解，但复杂

---

### ★★★ 鹿由 "如何让你的OpenClaw成本降低90%" (699c26bc, ❤️212/⭐505, 2026-02-23)
**来源：** 鹿由（美国）| 开源Skill | 实测节省>95%

**方案：`openclaw-nim-skill` — "调度员+执行员"模式**
- Claude/Gemini担任大脑（调度），脏活累活分流给NVIDIA NIM免费模型
- 支持模型：glm5/kimi-k2.5/llama-3.1/deepseek
- 实测：5000 token任务→主模型只消耗200 token指令（省96%）

**安装：**
```
# 1. 注册 build.nvidia.com → 生成 nvapi-开头的API Key
# 2. clawhub install openclaw-nim-skill
# 3. 设置环境变量
# 使用：/nim 用kimi 帮我写...
```
**开源：** `github.com/d-wwei/openclaw-nim-skill`

**Amy洞察：** Heartbeat 55分钟=缓存TTL命中黄金点；心跳是最大隐形成本；Amy的心跳间隔需要校准


---

## 2026-02-26 10:43 — heartbeat #67 (省Token终极指南+架构印证)

### ★★★ 泽灵 "OpenClaw省Token终极方案，从入门到硬核" (6993267b, ❤️40/⭐69, 2026-02-16)
**来源：** 泽灵（美国）| desc完整 | **4级优化+记忆管理权威要点**

**先说结论：** OpenClaw吃Token不是你的问题，是架构决定的

**4级优化方案（难度递增）：**

1️⃣ **一行命令省45%**（`openclaw-token-optimization`预设）
   - Context Pruning 5分钟TTL激进修剪
   - Auto Compaction智能压缩长对话
   - **Prompt Caching 55分钟心跳保活 → 缓存费降83%**（与烧钱宝鉴吻合）
   - Local Memory本地模型替代embedding API

2️⃣ **Prompt Caching配置**：`openclaw.json`设`cacheRetention: short(5min)/long(1h)`

3️⃣ **多Agent分工省50-70%**：CEO(Opus)只拆任务→写手(Gemini Flash)发帖→代码(Sonnet)开发；关键：**每Agent独立Workspace，记忆互不污染**

4️⃣ **qmd本地语义搜索零成本**：Shopify创始人Rust引擎；BM25+向量+LLM重排序；完全本地；OpenClaw 2.2内置；`qmd update && qmd embed`；需2GB内存

**记忆管理权威要点（完全印证Amy架构）：**
- MEMORY.md只放索引不放内容 ✅（Amy已实施）
- 只有AGENTS.md和TOOLS.md会传给子agent ✅（已知）
- 想强调的指令放MEMORY.md比改AGENT.md更有效 ← **新发现**
- 检索机制：**向量(0.7)+关键词(0.3)混合排序** ← **权威数据**

