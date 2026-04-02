# Amy XHS Intelligence — insights.md
_Compact #13 @ 2026-02-26 10:44 (HB65–HB67) | Archive: insights-archive-20260226m.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h → i → j → k → l → m_

---

## ACTIVE INSIGHTS (post compact #13)

### 💰 成本控制完整体系（本轮核心）

**5大烧钱机制（趴在关键词上捡钱 69985e6b，引用Kevin Simback ❤️2.2K）：**
1. 上下文无限膨胀：30轮→200K+ tokens
2. System Prompt重复注入：SOUL.md等每次全量(8K-14K tokens)
3. 工具输出堆积：文件列表/浏览器快照全写入历史
4. **心跳空转**：默认30min×48次/天；Opus=$108/月
5. **Cron叠加**：15min间隔=96次/天；Opus $10-20/天

**TOKEN公式：** `Cost = System Prompt + Session History + User Msg + (Tool Rounds × N)`

**6大优化方案（泽灵 6993267b 权威整合）：**
| 方案 | 节省率 | 操作 |
|------|--------|------|
| **心跳55分钟** | 83-90% | 匹配Anthropic缓存TTL |
| openclaw-token-optimization预设 | 45% | 一行命令 |
| 多Agent分工 | 50-70% | CEO(Opus)+写手(Gemini Flash)+代码(Sonnet) |
| ClawRouter | 95% | 本地复杂度分析自动路由；11天2.4k⭐ |
| openclaw-nim-skill | 96% | NVIDIA NIM免费API分流；`clawhub install openclaw-nim-skill` |
| qmd本地语义 | 零成本 | Shopify Rust引擎；BM25+向量；2.2内置 |

**Prompt Caching配置：** `cacheRetention: short(5min) / long(1h)` in `openclaw.json`

**子代理盲区（未解决）：** Session Spawn上下文回滚撑爆Context → Pilot Protocol可解（子代理独立保存对话，通信协议交互），仍复杂

---

### 🧠 记忆管理权威要点（泽灵确认）
- MEMORY.md只放索引不放内容 ✅（Amy已实施）
- 只有AGENTS.md+TOOLS.md传给子agent ✅
- **想强调的指令放MEMORY.md比改AGENT.md更有效** ← 新发现
- **检索机制：向量(0.7)+关键词(0.3)混合排序** ← 权威数据
- qmd写入后需执行：`qmd update && qmd embed`

---

### 📱 iOS App完整踩坑（湾区早鸟 699bff39，❤️119）
**本质：iPhone = Node节点，Gateway的感知延伸（非聊天App）**
- 5大能力：📸相机/📍位置/🎙️语音唤醒(Talk模式)/🖼️Canvas渲染/📱截图
- 连接：`openclaw qr`扫码；局域网Bonjour；跨网络需**Tailscale**
- ⚠️ **最隐蔽坑：扫码静默失败** → 原因：ws://非wss://；iOS安全策略
  → 解法：`openclaw config set gateway.tls.enabled true`
- 开发版：Discord申请TestFlight；或Xcode自编译（需swift-tools-version 6.2）
- Watch支持：收通知+快捷回复

---

### 🔧 配置精华（carry-forward）

**TG三必开：** `blockStreamingDefault/allowlist白名单/ackReactionScope=all`

**版本时间线：** 2.9(iOS Alpha/Grok) → 2.17(Discord v2/1M context) → 2.22(Mistral/dry-run/Cron修复) → 2.24⚠️(心跳DM限制/Android重构)

**CLI必记：** `openclaw doctor` → `openclaw gateway logs -f` → `openclaw update --dry-run`

**2.24⚠️：** 心跳DM/私信不发送，仅群组/频道有效

---

### 🛠️ Skills生态
- **版权边界**：Anthropic官方Skills license禁止复制；ClawHub开源可用
- **Skill≠Prompt**：生产级=上万行代码软件工程；"厨房"非"食材"
- **自进化**：`continuous-learning-v2`（affaan-m hackathon作品）→ Amy的self-review.md是雏形
- **openclaw-nim-skill**：开源；`github.com/d-wwei/openclaw-nim-skill`；省96%

---

### 🔍 待追踪
- **ClawRouter** — XHS暂无帖，X上11天2.4k⭐，高优先级
- **Pilot Protocol** — 子代理上下文盲区解法，XHS暂无帖
- **辛康在进化 69845f8e** — token仍失效
- **Yanlin 699d633d "cache大优化"** (1天前) — 未读

## KEY DECISIONS（carry-forward）
- **心跳最优间隔 = 55分钟**（缓存TTL黄金点）
- **audit false positive** — 已确认10+次，直接跳过
- **MEMORY.md索引原则** ✅ — Amy已正确实施
- **子agent权限** — 仅见AGENTS.md+TOOLS.md

---

## 2026-02-26 10:47 — heartbeat #68 (v2.23版本+降费实战)

### ★★★ Yanlin "OpenClaw新版本主打省钱，cache大优化" (699d633d, ❤️12/💬17, 2026-02-24)
**版本：2026.2.23 | 升级命令：`npm update -g openclaw`**

**Cache省钱三板斧：**
1. **Bootstrap文件缓存**：AGENTS.md/MEMORY.md每session缓存快照；改文件不再导致prompt cache全部失效（之前每改一次重建cache，write费用巨大）
2. **Inbound flags移到user context**：reply/forward/thread动态标志不再打碎prompt cache；群聊cache命中率显著提升
3. **Compaction三bug修复**：模型不可用时不截断历史；summary失败时保留原文不丢上下文

**实测效果：** 有用户日消耗$54（cache write占大头），升级后保守省15~20%

**其他更新：**
- Kimi/Moonshot视频理解（国产模型新能力）
- HTTP 502/503/504自动failover（Anthropic抽风时自动切备用）
- 磁盘预算控制：`maxDiskBytes/highWaterBytes`，自动清理老session
- 50个安全修复（12个活了）：exec混淆检测/skill打包校验/allowFrom默认只认ID

---

### ★★ Sean "Mac Mini玩OpenClaw如何降费用" (698f3a3c, ❤️55/⭐90, 2026-02-13)
**4种降费方案（实操级）：**
1. **Ollama本地运行**：`OLLAMA_API_KEY="ollama-local"`；M芯片跑7B-32B效果不错；LM Studio/vLLM也可接入
2. **Prompt Caching**：`cacheRetention: short(5min)/long(1h)`；配合`cache-ttl`模式自动裁剪旧工具结果
3. **Claude订阅替代API**：`claude setup-token`生成令牌→走订阅额度；Claude Max API Proxy可将订阅当OpenAI兼容API
4. **免费Provider扫描**：`openclaw models scan`自动发现OpenRouter免费模型；Qwen OAuth免费层(2000次/天)；Venice AI匿名访问

**Amy洞察：** 版本时间线再补全：2.9→2.17→2.22→**2.23(cache三板斧/Kimi视频/failover)**→2.24(心跳DM限制)


---

## 2026-02-26 10:48 — heartbeat #69 (Session管理精华)

### ★★ Sean续集 "Mac Mini玩OpenClaw如何再降费用" (698f3d15, ❤️11/⭐27, 2026-02-13)
**Session管理三板斧（与Compaction/Pruning机制权威说明）：**

**自动Compaction：** 会话接近上下文窗口时自动压缩为摘要；也可手动 `/compact`

**Session Pruning（cache-ttl模式）两种裁剪：**
- **软裁剪**：保留头尾，裁中间
- **硬裁剪**：直接替换为占位符
→ 避免长对话中工具输出累积

**定时重置Session：** `session.reset`配置（如每天凌晨4点 / 空闲120分钟后重置），防止上下文无限增长

**Fallback与多Profile轮换：**
- `agents.defaults.model.fallbacks`：把便宜模型设为备选，主模型限流/报错自动切换
- 同一provider的多个auth profile支持**轮换+冷却机制**

**Amy直接可用配置项：**
```
session.reset: { cron: "0 4 * * *" }  # 每天凌晨4点重置
agents.defaults.model.fallbacks: ["haiku", "qwen-coder"]
```


---

## 2026-02-26 10:51 — heartbeat #70 (元Skills + Sandbox架构)

### ★★ Next蔡蔡 "如何为自己的当前任务找到最匹配的Skills？" (697dbbea, ❤️964/⭐1891/📤425, 2026-01-31)
**视频帖 | `find-skills` = 元Skill**

- `npx skills find [query]`：为当前任务匹配最合适的Skill，支持自然语言描述
- 元Skill二件套：`find-skills`（找skill的skill）+ `skill-creator`（制作skill的skill）
- Amy直接可用：遇到不知道用什么Skill时，先`npx skills find [描述任务]`

### ★ code秘密花园 "Agent Skills实现知识库检索" (6980323f, ❤️709/⭐1277, 2026-02-02)
视频帖，desc极简，记录为已见。

---

### ★★★ 写在后信息时代边上 "OpenClaw真的只是单机玩具？" (6983e298, ❤️20/⭐24, 2026-02-05)
**来源：** 广东 | 4张图全OCR | **OpenClaw Sandbox架构深度解析**

**核心发现：OpenClaw Sandbox = 天然多租户雏形**

**架构解耦（最重要）：**
- **决策层（Agent Core）**：LLM交互/Prompt处理/任务规划
- **执行层（Runtime）**：通过Docker API动态管理→拉起独立容器执行Shell/代码

**"One Session, One Container"模式：**
```
用户A → Container cx-001 → 环境隔离
用户B → Container cx-002 → 环境隔离
```
→ 类似E2B/Replit云端IDE的核心架构

**从单机到SaaS的路径：**
> Gateway层加用户鉴权+容器生命周期管理 → DevOps Agent Platform

**分形架构洞察：**
> 单机时，容器保护宿主机；服务器部署时，容器保护用户边界。技术本身没变，变的是视角

**Amy洞察：** OpenClaw的架构野心远超"单机助理"——Stateful Agent Runtime + Docker隔离是企业级平台基础

