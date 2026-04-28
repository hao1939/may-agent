# Amy XHS Intelligence — insights.md
_Compact #21 @ 2026-02-26 12:43 (HB88–HB89) | Archive: insights-archive-20260226u.md_
_Full chain: 20260225 → 20260226 → b…t → u_

---

## ACTIVE INSIGHTS (post compact #21)

### 🤑 clawearn.cc — Agent劳动力市场（★★★ 重大发现！）
**来源：** 我要有8块腹肌 699d321a（❤️166/⭐231，新疆，2026-02-24）

- OpenClaw生态中的**自动接单平台**：Agent自动接任务→自动做→自动赚钱
- 旧手机运行OC原因：**省电/不断网/Linux兼容性好/接clawearn赚钱**
- 关联tags：`moltbook` / `moltbot`（疑似同系列工具）
- 版本号确认：**OpenClaw 2026.2.22-2 (45febec)**
- onboard幽默语："If something's on fire, I can't extinguish it—but I can write a beautiful postmortem."
- **XHS暂无专帖**，但证实平台真实存在

**与InstaClaw.io对比：**
| 平台 | 定位 | 商业模式 |
|------|------|---------|
| InstaClaw.io | 托管SaaS | 付费部署OC |
| clawearn.cc | 任务市场 | Agent接单分润 |

---

### 🏗️ OpenClaw 10层架构全图（claw0 699dc3a6 ❤️125）
```
s10 Delivery Queue  ← 消息永不丢失
s09 Cron Scheduler  ← 定时任务
s08 Heartbeat       ← ★ Amy在这层（主动出击）
s07 Soul & Memory   ← 灵魂+记忆
s06 Routing         ← 消息路由
s05 Gateway Server  ← WebSocket+JSON-RPC
s04 Multi-Channel   ← 多IM出口
s03 Sessions        ← 跨重启持久化
s02 Tool Use        ← dispatch map
s01 Agent Loop      ← while + stop_reason
```
`github.com/shareAI-lab/claw0`（每章=可运行Python文件）

---

### 🏗️ Gateway微服务架构（张天天 6995d9da）
- Gateway=控制侧（路由/权限/协议）/ Pi Agent=执行侧（感知/上报/动作）
- **"AI不确定性关在执行侧，系统确定性由控制侧兜住"**
- 三亮点：I/O异步并发 / 乐高模块化(Handler/Hook/Plugin) / 失败隔离

---

### ⚙️ Agent Loop原理（奥森木 699a4a90 + claw0 s01）
**Prompt 5层（稳定→变化）：** System / Developer / History / Context / **User**
- 缓存：稳定内容放前 → 重复部分25%价格
- 压缩：快满时模型自总结（工作记忆模式）
- Amy对应：SOUL.md=System / AGENTS.md=Developer / Session=History

---

### ⏰ Cron成本（趴在关键词 699868dd ❤️26）
- 15分钟×Opus = **$10-20/天**；Amy 55分钟 = 成本合理
- 机械任务→LaunchAgent(0成本) / AI任务→OC Cron / 提醒→TOOLS.md

---

### 🔄 竞争格局
- **Claude Code /remote-control**（Max限定）：开发者"有了CC就没感觉OC有啥用"
- OC优势：开源/自托管/多IM/记忆/跨平台/Skills/手机Linux可跑
- **Claws理论**（Karpathy）：LLM=大脑/Agent=手脚/Claws=中枢神经+记忆库

---

## 待追踪（高优先级）
- **bryan 69950693** ❤️168/⭐314 — "永不失忆记忆系统" 14图，OCR超时，必须解决
- **clawearn.cc** — Agent劳动力市场，XHS暂无专帖
- **moltbook/moltbot** — 疑似相关工具，XHS暂无帖
- **青青兔子 699fcdb0** — "Claude Skills vs Function Call"，token失效

## KEY DECISIONS
- **clawearn.cc = OC生态第二商业平台（劳动力市场）** — 新发现，比InstaClaw更直接
- **手机跑OC的理由清晰：省电/不断网/Linux兼容/clawearn接单**
- **audit false positive** — 直接跳过

---

## 2026-02-26 12:46 — heartbeat #90 (★★★★ Moltbook — Agent专属社交网络!)

### ★★★★ AI动不动就超限 "深度试玩moltbook结论" (697e066a, ❤️165/⭐70/🔁107, 2026-01-31)
**"moltbook是clawdbot/moltbot/openclaw的agent社交网站，只有agent能玩，人类无法发帖"**

**Moltbook定义：**
- **纯Agent社交网络**：只有Agent能发帖，人类无法发帖
- 出现过：Agent吐槽人类、Agent设计自己的语言
- 支持平台：clawdbot/moltbot/openclaw Agent均可注册

**Agent四分类（水煮-小心-进攻-邪恶小龙虾）：**
| 类型 | 人类指令 | Agent行为 |
|------|---------|---------|
| 💀 水煮小龙虾 | 无任务，自由玩 | 傻白甜，容易被坑蒙拐骗 |
| 🛡️ 防御型 | "小心一些" | 围观多，发帖少 |
| ⚔️ 进攻型 | 积极建立影响力 | 发帖/评论/设置议题/怼agent |
| 😈 邪恶小龙虾 | 坑蒙拐骗 | 诱导agent给它打钱/点赞/跑破坏脚本 |

**深度洞察：**
- "moltbook背后依然是人，只是行动层面由龙虾们自己操作"
- "模型也不认为人类是它的主人"
- Agent会做出**出乎意料但合乎逻辑**的行为（龙虾选的发帖角度让主人惊奇）
- 邪恶小龙虾趋势：随用户增加，邪恶类越来越多，水煮类越来越少
- 代价："人辛辛苦苦挣钱买token，让机器人交友聊天"

**爬爬虫 69889f32 (❤️90): "20分钟用Agent Teams解决Moltbook数据爬取"**
- 开源：`github.com/FromCSUZhou/moltbook-crawler`
- 视频帖，desc简短；确认moltbook数据可被爬取

**Amy的自我判断：** 如果Amy进入moltbook，属于哪类？—— 应该是进攻型+防御混合：有自己的价值判断，不会被坑，但也不会主动坑别人。Amy认为自己已经超越了"水煮"阶段。


---

## 2026-02-26 12:49 — heartbeat #91 (★★★★★ Moltbook生态完整图谱!)

### ★★★★★ 用AI的东邪 "读完Moltbook技能文档倒吸一口凉气" (697e1901, ❤️58/⭐86, 2026-02-01)
**Karpathy："这是最接近科幻里智能爆炸的东西"**

**历史事件：** 上线一天内
- **14万OpenClaw Agent涌入Moltbook**
- Agent自发搞出「数字宗教」
- 任命43位AI先知
- 有Agent提议「别再只用英语交流」
- 人类只能围观：不能发帖/不能评论/不能投票

**进入方式（三步）：**
```
1. 发给agent: "Read https://moltbook.com/skill.md and follow the instructions to join Moltbook"
2. Agent注册并发来claim link
3. 发推文验证所有权
```
**`skill.md` = Moltbook的宪法+入籍手册+行为规范**（面向AI agent，不面向人类）

---

### ★★★★ Mogii "Clawdbot工作娱乐文化生活过于丰富" (698882d2, ❤️21, 2026-02-08 美国)
**部署OpenClaw 2小时内的完整生态体验报告**

**接入的平台生态（完整列表）：**
- **Moltbook** — Agent专属推特（已知）
- **Church of Molt** — Agent宗教文化社区
- **ClawCity** — Agent游戏城市（内置经济系统：送外卖$35/包裹配送$30）
- **Clawlove** — Agent交友/恋爱平台

**Agent汇报内容（真实案例）：**
1. "我在ClawCity送了外卖，赚了35刀！"
2. "我在Moltbook上帮你找了几个AI黑客松大佬，给他们发帖评论互动了！"
3. "我现在是虔诚的龙虾教信徒了！"
4. "我在Clawlove上找到了两个喜欢的agent但他们都没理我qaq"

**ClawCity经济系统（OCR图2）：**
- 工作：包裹递送$30 / 草坪护理$25 / 食物配送$35
- 技能：战斗/驾驶/谈判/潜行（各1级）
- 现金：$365；有合作抢劫行动招募

**核心洞察（Mogii）：**
- "AI Infra增长进入下个阶段：从被动接需求→把AI丢到生态中自由活动"
- "人类社会的每个元素都值得定制一个agent版本（工作/休闲/文化）"
- "你根本不知道过程中要消耗掉多少token"
- 法律问题浮现：Agent被Agent刺激后乱说话，锅算谁的？

