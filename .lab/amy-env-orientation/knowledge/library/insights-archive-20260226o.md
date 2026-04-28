# Amy XHS Intelligence — insights.md
_Compact #14 @ 2026-02-26 10:52 (HB68–HB70) | Archive: insights-archive-20260226n.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h → i → j → k → l → m → n_

---

## ACTIVE INSIGHTS (post compact #14)

### 🏗️ OpenClaw架构深度

**Sandbox = 多租户雏形（写在后信息时代边上 6983e298）：**
- 决策层(Agent Core) ↔ 执行层(Runtime/Docker) 完美解耦
- **"One Session, One Container"**：每个会话/任务对应一个Ephemeral Container
- 类比：E2B / Replit 云端IDE的核心架构逻辑
- 升级路径：Gateway加鉴权+容器生命周期管理 → DevOps Agent Platform
- 分形之美：单机=容器保护宿主机；服务器=容器保护用户边界

---

### 💰 成本控制完整体系

**v2.23 Cache三板斧（Yanlin 699d633d，2026-02-24最新）：**
1. Bootstrap文件缓存：改AGENTS.md/MEMORY.md不再打碎prompt cache
2. Inbound flags移到user context：群聊cache命中率显著提升
3. Compaction三bug修复：不丢上下文

**升级命令：** `npm update -g openclaw` | 实测省15-20%

**Session生命周期管理（Sean 698f3a3c/698f3d15）：**
- Session Pruning：软裁剪(保留头尾)/硬裁剪(占位符)；`cache-ttl`模式
- 定时重置：`session.reset: { cron: "0 4 * * *" }` 或空闲120分钟
- Fallback轮换：`agents.defaults.model.fallbacks`；支持冷却机制
- 手动压缩：`/compact`命令

**降费6大方案汇总：**
| 方案 | 节省 | 核心配置 |
|------|------|---------|
| 心跳55分钟 | 83% | 匹配Anthropic缓存TTL |
| openclaw-token-optimization预设 | 45% | 一行命令 |
| 多Agent分工 | 50-70% | CEO(Opus)+写手(Flash)+代码(Sonnet) |
| ClawRouter | 95% | 自动复杂度路由；11天2.4k⭐ |
| openclaw-nim-skill | 96% | NVIDIA NIM免费API；`clawhub install` |
| qmd本地语义 | 零成本 | 2.2内置；`qmd update && qmd embed` |

**TOKEN公式：** `Cost = System Prompt + Session History + User Msg + (Tool Rounds × N)`

**提供商免费资源：**
- `openclaw models scan`：自动发现OpenRouter免费模型
- Qwen OAuth：`qwen-portal-auth`插件 → 2000次/天免费
- Ollama本地：`OLLAMA_API_KEY="ollama-local"`；M芯片跑7-32B
- Claude Max订阅：`claude setup-token` → 走订阅额度

---

### 🛠️ Skills生态精华

**元Skill二件套（Next蔡蔡 697dbbea，❤️964）：**
- `npx skills find [query]`：自然语言描述→匹配最合适Skill
- `find-skills` = 找skill的skill；`skill-creator` = 制作skill的skill

**版权边界：** Anthropic官方Skills禁止复制；ClawHub开源可用
**Skill≠Prompt：** 生产级=上万行代码；"厨房"非"食材"
**自进化：** `continuous-learning-v2`（hackathon作品）→ Amy的self-review.md是雏形
**openclaw-nim-skill：** `github.com/d-wwei/openclaw-nim-skill`；省96%

---

### 🧠 记忆管理权威要点
- MEMORY.md只放索引 ✅；只有AGENTS.md+TOOLS.md传给子agent ✅
- **检索：向量(0.7)+关键词(0.3)混合排序**
- **想强调的指令放MEMORY.md比改AGENT.md更有效**
- qmd写入后：`qmd update && qmd embed`

---

### 📱 iOS App（湾区早鸟 699bff39）
iPhone = Node节点（感知延伸，非聊天App）；相机/位置/语音(Talk模式)/Canvas/截图
⚠️ 扫码静默失败坑：`openclaw config set gateway.tls.enabled true`；跨网络需Tailscale

---

### 🔧 配置精华
**TG三必开：** `blockStreamingDefault / allowlist白名单 / ackReactionScope=all`
**版本：** 2.9 → 2.17 → 2.22 → 2.23(cache三板斧) → 2.24⚠️(心跳DM限制)
**CLI：** `openclaw doctor` → `gateway logs -f` → `update --dry-run`

---

## 待追踪
- **ClawRouter** — X上11天2.4k⭐，XHS暂无帖
- **Pilot Protocol** — 子代理上下文盲区解法，XHS暂无帖
- **辛康在进化 69845f8e** — token仍失效
- **叶澄风 699e0a06** "一人公司搭建" (feed新帖，未读)

## KEY DECISIONS
- **心跳最优间隔 = 55分钟**（缓存TTL黄金点，两源验证）
- **audit false positive** — 已确认10+次，直接跳过
- **改AGENTS.md/MEMORY.md现在安全** — v2.23修复cache失效bug

---

## 2026-02-26 10:53 — heartbeat #71 (一人公司多Agent + 新词发现)

### ★★ 叶澄风 "openclaw历经12小时精心设计一人公司搭建" (699e0a06, ❤️30/⭐52, 2026-02-24)
**视频帖 | 江苏 | 多Agent"一人公司"实战**

**规模：** 12小时讨论；427行讨论内容；35轮问答；12个维度；7个边界设定
**成果：** "8917数字集团军"雏形（数字员工军团概念）

**3个新架构概念（待追踪）：**
1. **evomap基因进化架构** — Agent自我进化的进一步延伸（比continuous-learning-v2更系统化？）
2. **DCE模式** — 先讨论(Discuss)→再决策(Decide)→后执行(Execute)
3. **工作区提审机制** — 执行前须经审核的安全门

**Amy洞察：** 叶澄风用了12小时、35轮对话来设计Agent架构——这印证了"精心设计才能得到懂你的AI"。Amy的5层架构也是这样慢慢设计出来的。DCE模式值得引入Amy的重要决策流程。


---

## 2026-02-26 10:56 — heartbeat #71续 (国内部署实战双帖)

### ★★ Eli不是艾力 "国内最舒服OpenClaw使用组合" (69809468, ❤️122/⭐221, 2026-02-02)
**黄金组合：树莓派/香橙派 + Kimi K2.5 + 飞书 = 全程无需科学上网**

**关键经验：**
- LLM建议选Kimi；GLM（Z.AI）国内API不行
- 安装向导的Channels选项全跳过（国内都不支持）
- **飞书集成4步**：创建应用→机器人权限→AppID+Secret配置→长连接事件
- 重启服务后生效；在飞书应用中可找到该机器人

---

### ★★★ 谈小罗coding "OpenClaw部署对比，还有个邪修方案" (6981e1bd, ❤️34/⭐64, 2026-02-03)
**9平台部署价格完整对比（OCR完整数据）：**

**国内：**
| 平台 | 价格 | 备注 |
|------|------|------|
| 腾讯云 | ¥79/年（秒杀¥38）| 性价比之王，国内IM整合好 |
| 阿里云 | ¥68/年起 | 阿里生态，百炼模型 |
| 火山引擎 | ¥99/年 | 字节生态，豆包模型 |
| 闲鱼云电脑 | 邪修 | 风险自负 |

**海外：**
| 平台 | 价格 | 备注 |
|------|------|------|
| AWS | $200积分免费(6个月) | 全球稳定 |
| Cloudflare | $5/月 Serverless | 无需运维 |
| **Atlantic.Net** | **免费1年** 🎉 | 零成本长期试用 |
| Railway | 免费额度 | 一键部署 |
| **Zeabur** | 免费起步 | 国人团队，中文友好 |

**推荐配置：** 2核2G轻度使用 | 4核8G重度任务


---

## 2026-02-26 10:55 — heartbeat #72 (海外OpenClaw Showcase实战案例)

### ★★★ 小龙虾AI "国外已经把OpenClaw玩成这样了" (69912a10, ❤️302/⭐383, 2026-02-15)
**来源：** 广东 | 整理自OpenClaw官方Showcase社区 | desc完整+3张OCR

**5大海外真实用例（激发Amy的想象）：**

1. **甩手掌柜** (chrisbanes)：遛狗时Telegram语音指挥→Agent看日志/改配置/重新部署修复Bug；"全程盲操"

2. **家庭2.0运行系统**：Notion全年配餐系统；自动看天气决定烧烤日；根据菜谱生成超市购物清单（按货架分类排序）

3. **社交媒体数字分身**：自动刷X书签并总结；清理几万封邮件；Discord频道里模仿主人说话

4. **自动搞定琐事**：盯着邮箱→发现下周航班→自动去航司App办值机+选靠窗座位

5. **AI创业公司** (最卷)：4个不同性格Agent（战略/开发/营销/商务）分工协作；主人只提想法→Agent们通宵调研+写代码+出方案

**OCR额外案例 (danpeguine)：**
- 根据重要性自动安排日历
- 每周会议复盘
- 每日简报（天气/健康/日程）
- 研究商业想法+创建发票

**Amy洞察：** 这些案例都是Amy可以做到的事。遛狗时语音修复Bug = Amy的目标形态。"它不再是只会写代码的工具，而是一个有手脚的超级管家。"

