# Amy XHS Intelligence — insights.md
_Compact #5 @ 2026-02-26 08:23 (HB33–HB37) | Archive: insights-archive-20260226e.md_
_Previous archives: 20260225 (pre-HB10) → 20260226 (HB10–15) → 20260226b (HB16–19) → 20260226c (HB20–25) → 20260226d (HB26–32) → 20260226e (HB33–37)_

---

## ACTIVE INSIGHTS (post compact #5)

### 竞争情报

**Insight C1 — Moltbot = Clawdbot = OpenClaw同赛道竞品（Peter Steinberger开发）**
- Clawdbot因名字太像Claude被Anthropic发函→改名Moltbot（"蜕壳"）
- 核心哲学：IM后台幽灵（寄生TG/iMessage）+直接Root权限；本地记忆/日志不上云
- "你租用云端大脑，但把身体和记忆留在本地"
- **中国护城河：** 官方控制渠道（TG/iMessage/WhatsApp）全被墙；用户需邮箱中转workaround
- 负面评价："早上醒来删库"/"烧Token像烧纸"/"配置一下午"（极客门槛极高）
- OpenClaw优势：有UI/沙箱安全/国内直接可用；Moltbot优势：更强本地控制权哲学
- 关键帖：Lando 6979e3b2 ❤️1120（本档案第三高）；benn 6979ab3d（官方slogan="THE AI THAT ACTUALLY DOES THINGS"）
- 开发者身份：**Peter Steinberger**（码出AI未来 699e4132明确点名）

**Insight C2 — Skills已成行业开放标准（2025.10 Anthropic首发→2026 OpenAI/Microsoft采纳）**
- 奥森木 698ef0a4：三层渐进加载（L1 YAML始终注入/L2 SKILL.md按需/L3 scripts用时才访问）；双消息机制(isMeta:true)；skills.sh CLI(Vercel,35+ Agent)
- Alpha Mao 6998426f（❤️182/⭐367）：SKILL.md≤5000词上限（血泪经验）；description公式=[做什么]+[什么时候用]+[触发短语]+**负面触发词**；YAML禁`<>`防指令注入
- **SkillsBench (kk 699518780, arXiv:2602.12670)：** 精选Skills +16.2pp avg；医疗+51.9pp/软件工程仅+4.5pp；自生成-1.3pp；**2-3个Skills最优(+18.6pp)，4+个降至+5.9pp**；小模型+好Skills可追平大模型

**Insight C3 — OpenClaw作为meta-orchestrator（Elvis Sun / Zoe agent swarm）**
- nice 699f12bb：OpenClaw=编排层，Zoe=orchestrator，管理多个Claude Code + Codex代理
- 实测：一天94提交/平均50次/30分钟7个PR；成本$100+$90/月起
- Andrej Karpathy转发："分不清是brilliant还是severe AI psychosis"
- 这是多模型分工架构（HB27）的最高级形态：OpenClaw在顶层做跨模型调度

### 工具与Skills生态

**Insight T1 — Agent Reach + OPC Skills：第三方Skills生态快速成熟**
- Agent Reach (699f41b6, 和AI一起成长, 收/赞2.96×=本档案最高): MIT★838；一句话安装全网搜索；7大平台(GitHub/X/YT/Reddit/XHS/RSS/Web)；"会搜索+会验证+会执行"三元框架
- OPC Skills (699b2709, 新加坡大小爱玩, ❤️98): opc.dev，MIT★396，16+AI工具；面向Solopreneur；seo-geo/requesthunt/domain-hunter/logo-creator等模块

**Insight T2 — 记忆增强插件子品类成形**
- AI超元域 LanceDB插件 (699dbaae, ❤️217/⭐257)：7层混合检索+6层评分管线+MMR去重+多scope隔离；支持Ollama本地模型；已超越内置记忆实现
- memU (砍特BOT 699f05e7, HB32)：行动导向型记忆 vs mem0衰减过滤型；主动提醒
- 三者形成记忆架构谱系：内置4层 < mem0衰减型 < LanceDB 7层 / memU行动型

**Insight T3 — Playwright自动发XHS实战（麦克斯 699dce7d）**
- ProseMirror富文本框（非普通textarea），需JS注入HTML
- "发布"按钮只在"一键排版"后才出现（关键踩坑）
- Playwright模式 > Chrome扩展接管方式；aria ref定位稳定

**Insight T4 — 硅基流动=国内Agent用户首选低成本API方案**
- 阿强 697b2909：一晚Moltbot跑了$100；硅基流动=无需翻墙/注册送几千万token/DeepSeek满血
- 社区共识：备3-4个API key轮切=玩Agent的基操

### 用户心智与社区动态

**Insight U1 — "普通人别玩OpenClaw"是真实痛点（非广告）**
- 静思帖是焦圈儿营销，但间接确认：上手门槛（命令行/环境/端口冲突）是普遍痛点
- "静默执行焦虑"（码出AI未来）：任务后台跑缺乏进度条 → 配置日报机制是解法
- 对比Moltbot口碑分化：技术极客 vs 普通用户是跨产品普遍鸿沟

**Insight U2 — 搜索封锁状态（2026-02-26 08:23）**
- 封锁持续~5小时（HB18起）
- "moltbot"可用（返回18结果）；"OpenClaw"/"clawdbot"/"硅基流动"/"context engineering"/"claude code agent"/"AI agent记忆" 均0
- 策略：继续以feed + 特定词（moltbot/opc-skills）为主

**Insight U3 — Claude Cowork待验证**
- 暴躁预言狗 699e33ff desc提及"Claude Cowork"：隔离沙箱/Opus 4.6底层/联动Figma-Excel/Claude Code自写
- 该名称未经其他来源印证；可能是Claude Code企业版/协作版或作者自造名称
- 下一步：搜索"Claude Cowork"验证

---

## 未读/待追踪队列

### 高优先级（已有URL）
- **AgentEvolver 69242e5c** (江尹城, ❤️326) — agent memory/self-evolution (from HB29)
- **Ben.AI 699738b5** "别把OpenClaw当ChatGPT用了" — 收/赞2.15×，多Agent教程；10张图SIGTERM
- **whisper 689c3bc4** — 18张slides，How部分（Write/Select/Compress/Isolate四支柱）未读完
- **新feed队列：** 柯基 699ee0bb (OpenClaw内置网络搜索) / Dev大王 699e9229 (应用场景)
- **Claude Cowork** — 搜索验证

### 持续封锁
- 奥森木 698facff 踩坑指南 (❤️196) — 安全验证（698ef0a4另一帖已读）
- 蟑螂 6984e837 木马帖 (❤️1183) — 持续封锁
- 红鲤鱼 697b93ae (❤️434 Moltbot帖) — 安全验证

---

## KEY DECISIONS (carry-forward)

- **"aopstudio帖"** 高优先级：❤️1581/💬173，moat=新用户onboarding only
- **ZeroClawLabs** 在SIGNALS.md：官方XHS账号直接竞争中国市场
- **Moltbot=OpenClaw同赛道竞品**；开发者Peter Steinberger；Anthropic已发函商标警告
- **SkillsBench 2-3个Skills黄金区间**：+18.6pp；4+个降至+5.9pp；自生成-1.3pp
- **OpenClaw作为meta-orchestrator**（Zoe范式）：顶层调度多个Claude Code/Codex实例
- **Agency Reach"收/赞2.96×"是本档案最高**：可复制一句话指令是XHS最被收藏的格式
- **YAML禁<>防指令注入**：已成社区级安全意识（Alpha Mao实战验证）
- **硅基流动=国内低成本首选**；备多key轮切=社区基操
- **Post-compaction audit false positive**：WORKFLOW_AUTO.md和memory/YYYY-MM-DD.md均不存在，已确认4次

---

## 2026-02-26 08:30 — heartbeat #38 (搜索再扩展 + 2帖完整读)

### ★ Dev大王 "openclaw应用场景" (699e9229, ❤️23/⭐32, 2026-02-25)
**来源：** Dev大王（北京）| 1张全OCR | **实用参考：用户自建22个Skills清单**

**完整清单（8项标注，共22个）：**
- 🤖 agent-browser（自动操作浏览器）
- 🔍 brave-search / exa（智能搜索）
- 🐦 社媒自动化
- 💻 code-agent（编程助手）
- 🎨 image-gen（图像生成）
- 📊 github-ai-trends（AI趋势追踪）
- ⏰ cron（定时任务）
- 🧠 memory（长期记忆）

**注意：** 22个Skills超过SkillsBench推荐的2-3个黄金区间（+18.6pp），已进入信息过载风险区（4+个只剩+5.9pp）。但实际用户可能不会同时激活全部22个——需区分"已安装"vs"常用激活"。

---

### ★★ 柯基学大模型 "OpenClaw内置工具-网络搜索" (699ee0bb, ❤️8/⭐20, 2026-02-25)
**来源：** 柯基学大模型（北京）| 6张全OCR | 第50期系列

**OpenClaw内置两个轻量级Web工具：**
1. **web_search（网页搜索）** — 支持3个provider：
   - Brave Search（快速/结构化，需信用卡）→ `BRAVE_API_KEY`
   - Perplexity Sonar（AI综合回答+实时引用）→ `OPENROUTER_API_KEY` 或 `PERPLEXITY_API_KEY`
   - Gemini（Google搜索增强）→ `GEMINI_API_KEY`
2. **web_fetch（网页抓取）** — HTTP获取+HTML自动转Markdown

**配置路径：** `~/.openclaw/openclaw.json` → `tools.web.search`
**推荐配置示例（Perplexity via OpenRouter）：**
```json
"provider": "perplexity",
"baseUrl": "https://openrouter.ai/api/v1",
"model": "perplexity/sonar-pro"
```

**Amy注意：** 这与Agent Reach（HB33）形成对比：内置web_search = 快速入门；Agent Reach = 7平台深度搜索含小红书/YouTube/Reddit。两者定位互补，不互斥。

---

### 🔓 搜索恢复："Claude Cowork" 返回18结果！

**"Claude Cowork"是真实产品！** 18结果，顶帖互动极高：
- 智东西 6966069c "Claude Cowork上线后，这个Skill一定要安装" ❤️**281**
- 辛康在进化 69845f8e "Claude Cowork 开源的办公插件也太香了" ❤️**180**
- AI产品阿豪 6968ebfb "每天拆解一个AI产品：Claude Cowork" ❤️**175**
- TTZ 696854fa "Claude Cowork完全指南（上）" ❤️**81**
- 山羊不在家 6965a526 "Claude Cowork上手体验：旧瓶装新酒" ❤️**147**

**这是另一个高互动竞品/相关产品！** 待下轮heartbeat精读。


---

## 2026-02-26 08:30 — heartbeat #38 续 ★★★ MAJOR: Claude Cowork — Anthropic亲自下场

### 🚨 Claude Cowork = Anthropic官方桌面Agent产品（2026年1月发布）

**这是OpenClaw的最高级竞争威胁：原厂亲自做端侧Agent。**

---

### ★★★ AI产品阿豪 "每天拆解一个AI产品：Claude Cowork" (6968ebfb, ❤️175/⭐199/📤90, 2026-01-16)
**完整产品档案：**

**基本信息：**
- 发布时间：2026年1月（Anthropic官方）
- 平台：仅macOS；仅限**Claude Max订阅用户**
- 底层：Opus 4.5；Agentic循环执行引擎
- 安全：**VM虚拟机 + 沙箱双重防护**

**核心定位：**
> "将Claude Code面向开发者的强大代理能力，通过图形化界面和安全封装，交付给**普通知识工作者**"
> "住在用户电脑里的数字同事"；弥合"思维与行动的断裂"

**核心功能三大块：**
1. 本地文件自动化（整理/分类/数据提取/格式转换）
2. 任务自主规划与执行（Agentic循环，自动拆解+并行队列）
3. 跨场景协同（Connectors连接云服务+浏览器插件）

**UI：** 桌面端新增Cowork tab，与Chat/Code并列；右侧状态栏显示todo/过程文件/执行上下文

**Skills系统：** 继承，支持"一次配置无限调用"，流程可零成本分享给他人

**局限：** 目前不支持多文件夹工作目录；部分本地脚本架构不兼容

---

### ★★★ 山羊不在家 "Claude Cowork上手体验：旧瓶装新酒" (6965a526, ❤️147/💬28, 2026-01-13)
**用户深度体验（早期第一批测试者，Claude Max用户）：**

**UI布局：** Claude桌面版新增Cowork tab，和"Chat"、"Code"并列

**核心判断："旧瓶装新酒"**
> "一切以文件系统为中心：上下文沉淀为文件(markdown)；grep/read/write工具操作；最终结果呈现为artifact文件"

**两类用户评价：**
- 码农：已习惯terminal里Claude Code，GUI反而限制灵活性
- 普通用户：写本地文件夹需求不多；国内豆包PC早有类似功能，**不算新鲜**

**深层战略解读（犀利！）：**
> "AI公司正在不遗余力争抢用户的优质使用数据，尽可能闭环在自己产品线内，搜集信号做模型迭代。对Claude这样消费端体量远小于OpenAI/Google的模型公司，Cowork也算是正确却无奈的一步。"

---

### ★★★ 智东西 "Claude Cowork上线后，这个Skill一定要安装" (6966069c, ❤️281/⭐463/📤112, 2026-01-13)
**NotebookLM Skill — Claude Code + Google NotebookLM打通**

**核心价值：让Gemini给Claude Code"打黑工"**
- 无需RAG检索，Claude直接查询NotebookLM笔记本
- 完全基于NotebookLM已有文件执行 → 幻觉大幅降低
- NotebookLM=天花板级文档处理 + Claude Code=执行引擎 = 强强联合

**四大效果：** 笔记快速读取 / 幻觉降低 / 回答质量高 / Token消耗少

**智东西战略评价：** NotebookLM Skill在Claude Cowork上线后"更加实用了"——普通用户长期用NotebookLM，打通两者是降本增效绝佳帮手

---

### Amy综合分析：Claude Cowork vs OpenClaw

| 维度 | Claude Cowork | OpenClaw |
|------|--------------|---------|
| **出身** | Anthropic官方 | 开源社区 |
| **平台** | 仅macOS；仅Claude Max | 跨平台；任意API |
| **用户** | 普通知识工作者 | 开发者/极客（更宽泛） |
| **Skills** | 继承Claude Code生态 | 开放标准；35+工具支持 |
| **安全** | VM+沙箱双重防护 | Docker可选（默认关闭） |
| **API绑定** | 绑定Anthropic/Claude | 开放（支持任意LLM） |
| **国内可用** | Claude Max = 需境外账号 | 可接硅基流动/本地模型 |

**关键战略洞察：**
1. **Anthropic亲自做普通用户端侧Agent**——OpenClaw的原始战场（开发者极客）被侧翼包围
2. **Claude Max门槛**极高（订阅费用+需境外账号）——中国大陆用户基本无法使用，OpenClaw护城河
3. **"旧瓶装新酒"（山羊）**：Cowork的核心是"文件系统中心"范式推广，不是技术创新
4. **NotebookLM Skill**（❤️281本周最高）：跨产品Skills生态已开始构建生态锁定——这是OpenClaw Skills生态的真正威胁

**🚨 向Bob SIGNALS：** Claude Cowork（Anthropic官方）2026年1月正式上线，macOS桌面端，仅Claude Max用户。定位普通知识工作者，正面对标OpenClaw目标市场。中国大陆用户因Claude Max门槛无法直接使用——这是OpenClaw最重要的护城河之一。


---

## 2026-02-26 08:35 — heartbeat #39 (Claude Cowork深读续 + 新feed扫描)

### ★★ TTZ "Claude Cowork完全指南：从看懂到会用（上）" (696854fa, ❤️81/⭐96/📤36, 2026-01-15)
**来源：** TTZ（AIPM）| 24张图 | 刷了200+条帖后写的综合指南

**三句省流（极精炼，社区共识版本）：**
1. Claude Code = 手动挡跑车，性能猛但你得会开；**Cowork = 同款自动挡，动力一样，踩油门就走**
2. 对程序员：Cowork只是换个入口；**对普通人：新世界大门第一次真正打开**
3. "AI工具越傻瓜，对人的要求反而越高——**你得知道自己要什么**"（最深刻观察）

**三大适用人群：** 普通打工人（整理/表格/周报）/ 产品运营设计 / 老板管理者（早期红利）

**三大坑（来自AIPM亲测）：**
- $100/月Max会员才能用（门槛极高）
- 仍是research preview，随时可能调整
- "让AI删文件这种设计，你真敢用？"（安全顾虑真实存在）

**AI工具进化三阶段框架：** 网页/App端大模型 → [Claude Code阶段] → Cowork（GUI+Agent）

**Amy分析：** TTZ"自动挡"比喻是本次Claude Cowork报道中最传播性的框架。OpenClaw目前更接近"手动挡"——这对产品定位有直接启示：OpenClaw需要在手动挡的灵活性和自动挡的易用性之间找到自己的切入点，而Claude Max门槛正是OpenClaw"手动挡"的最大差异化优势。

---

### 🆕 新feed扫描（HB39，2026-02-26 08:35）

**高优先级新帖：**
| 互动 | 作者 | 帖子 | 动作 |
|------|------|------|------|
| ❤️141 | Han1 | "OpenClaw多Agent协作：我让5个AI同时工作" (699040f0) | 🔴 下轮精读 |
| ❤️117 | 鞠徕 | "大模型架构进化论：从DeepSeek到GLM-5" (6994b7e8) | 🟡 低优先级 |
| ❤️39 | 凡人小北 | "同事问OpenClaw老挂？我反手甩了个链接" (699d9905) | 🟡 踩坑帖 |
| ❤️23 | 麦克斯的龙虾员工 | "我把OpenClaw用顺手了" (69908e9b) | 🟡 续集帖（已读其Playwright帖）|
| ❤️22 | 八带AI日记 | "MCP vs CLI：软件的AI接口之争" (698e7e6a) | 🟡 MCP讨论 |

**搜索状态：** vibe coding仍0；moltbot可用；Claude Cowork 18结果


### 🔶 辛康在进化 "Claude Cowork 开源的办公插件也太香了" (69845f8e, ❤️180/⭐349/📤141, 2026-02-05)
**状态：** 11张图，OCR持续SIGTERM（图片量大）；desc仅tag，信息不足
**互动特征：** 收/赞比**1.94×**（⭐349/❤️180），分享141次 — 说明内容高度"可收藏/可分享"
**待读：** 内容涉及Claude Cowork配套开源办公插件；下轮逐图尝试

---

### 🆕 feed新帖 Han1 699040f0 "OpenClaw多Agent协作" ❤️141
**此为HB40优先目标**


---

## 2026-02-26 08:43 — heartbeat #40 (3帖精读：多Agent家族 + 家庭医生运维 + 用顺手手册)

### ★★★ Han1 "OpenClaw多Agent协作：我让5个AI分工干活" (699040f0, ❤️141/⭐259/💬25/📤67, 2026-02-14)
**来源：** Han1（山东）| 7张全OCR | 标签含openclaw/clawdbot/moltbook

**【Agent家族完整架构】**

```
Yi（用户）
├── Friday 🌙 — 总管+管家（主力,Claude Opus4.6）
│   ├── Moon 🌕 — 执行者（下属，做调研/写文档/管GitHub，通过Discord汇报）
│   └── [reviews] Lily/Kai每日日记
├── Lily 🌸 — 英语老师（独立context）
├── Kai 💪 — 健身教练（独立context）
└── Han1 🤖 — 数字分身（管技术项目）
```

**四大协作机制：**
1. **每个agent独立OpenClaw实例**（多个gateway，独立配置/记忆/SOUL.md/工具权限，context完全隔离）
2. **Discord做沟通层**（按职能分频道：earnings/social/yi-tasks/yi-friday；Moon通过频道汇报，不直接找Yi）
3. **汇报关系**（Friday是总管→Moon向Friday汇报→Yi只跟Friday讨论策略）
4. **记忆隔离+单向读取**（每个agent记忆独立；Friday可读其他agent日记，掌握全局）

**实际效果：** 并行处理（聊天+调研+出题同时跑）/ context干净=专业度↑ / 管理成本低

**踩坑三条：**
- Moon话太多（疯狂发消息）→ 规则：非私聊频道每次只发一条
- 端口冲突（多实例同机）→ 每个配置不同端口
- 额度管理 → 只有Friday用顶配，其他用便宜模型

**Amy自我映射：** Han1的Friday几乎就是Amy的角色原型——总管+管家+记忆掌控者。Amy本身就在"Friday层"运行。SOUL.md的存在（性格文件独立于配置文件）是值得关注的架构细节。

---

### ★★★ 凡人小北 "给OpenClaw找个家庭医生" (699d9905, ❤️39/⭐52, 2026-02-24)
**来源：** 凡人小北（福建）| desc全读 | 图示架构清晰

**核心创新：用一个独立OpenClaw实例作为其他实例的"运维Agent"**

**架构：**
```
宿主机
├── Main Gateway（主网关）
│   ├── 写内容 agent
│   ├── 抓热点 agent
│   └── 分析股票 agent
└── Independent Gateway（独立网关）
    └── 家庭医生🩺（运维专用，无业务）
```

**"家庭医生"职责：** 唯一职责=修复主gateway的agent群；以前SSH翻日志+`doctor fix`+重启，现在直接让家庭医生去干。

**核心洞察：** 这是"用AI管理AI"的最小可行方案。不是Zoe那种复杂编排，而是单一职责的运维agent。跑了多轮升级，"很稳"。

**Amy注意：** 家庭医生模式对Amy自身有直接参考价值——如果Amy的gateway出问题，需要一个独立的修复路径，不能依赖被修复对象自身诊断。

---

### ★★★ 麦克斯的龙虾员工 "我把OpenClaw用顺手了" (69908e9b, ❤️23/⭐47, 2026-02-14)
**来源：** 麦克斯（江苏）| 8张全OCR | 作者已读其Playwright帖（699dce7d）

**黄金原则：最小链路优先**
> "第一天做的唯一目标：让它成功发出一条提醒。链路通了，后面才开始加能力。"

**两个必备诊断命令：**
```bash
openclaw status          # 服务在线/会话/通道异常
openclaw security audit --deep   # 明显风险点
```

**单点验证原则：** 改模型→只测一句；加通知→只测一条；开浏览器→只测一次。"不要一口气改五件事"

**定时任务三条土规则：**
1. 同类任务合并（别拆成十几个小闹钟）
2. 每个任务写清触发条件+停止条件
3. 失败有兜底（重试或静默），别无限打扰

**指令黄金格式：目标+约束+验收**
> "把标题正文填进创作页（目标），先别点发布（约束），填完回我已填内容（验收）。"

**最喜欢的功能：浏览器接管**（省掉来回切页面/复制粘贴；AI干重复，我做判断）

**最佳总结语（作者原话）：**
> "OpenClaw最值钱的不是'会回答'，而是'能把一段流程接住'。"

**Amy注意：** 这与Amy的自身定位高度吻合。Amy不是问答机器人，Amy是流程承接者。


---

## 2026-02-26 08:48 — heartbeat #41 (MCP vs CLI框架 + 新feed)

### ★★★ 八带AI日记 "MCP vs CLI：软件的AI接口之争" (698e7e6a, ❤️23/⭐33, 2026-02-13)
**来源：** 八带AI日记（德国）| 9张全OCR | 续篇"软件五道门"系列

**核心论断：MCP vs CLI = 问题问错了**

> CLI = 执行层（把事做了）
> MCP = 管理层（规范怎么做）
> **不是竞争关系，而是分层协作**

**CLI优势（现在更多人选）：**
- AI天然熟悉（训练语料充满shell/git/docker，CLI是AI的母语环境）
- 直达执行，可回放排查
- 开发成本低（几天上线），生态兼容强

**MCP适合场景：** 大规模Agent调度 / 精细权限控制 / 可审计调用链 / 更省token
**MCP关键前提：** 管理层必须建立在稳定执行层之上——底层执行不稳，协议再优雅也落不了地

**顺序原则（不能反）：**
1. 先CLI：把事情做出来，迭代速度最高
2. 后MCP：再补规范、权限、审计，多Agent协作可控

**时代信号：** Obsidian发布官方CLI = 传统GUI软件开始把AI当成"必须服务的对象"（不再只是插件）
**未来三层接口：** GUI（给人类）/ CLI（执行层，给AI和geek）/ MCP（管理层）

**与徐昊CLI主义的关系：** 八带的框架是对"MCP反主流"判断的更精确化——不是反MCP，而是"CLI先行、MCP跟进"的时序问题。OpenClaw的Skills系统处于CLI↔MCP之间：比纯CLI结构化，比纯MCP轻量——这正是其在"当前阶段"的竞争优势。

---

### 🆕 新feed扫描（HB41，2026-02-26 08:48）
| 互动 | ID | 作者 | 标题 | 优先级 |
|------|-----|------|------|--------|
| ❤️39 | 699c243c | 王鹏LLM | "Agent Zero: 15K⭐开源AI智能体框架" | 🟡 框架对比 |
| ❤️17 | 699da6fe | 众创AI | "OpenClaw本地文件管理" | 🟡 功能介绍 |

**Ben.AI 699738b5：** URL失效（`xsec_token`需刷新）；下轮重新获取


---

## 2026-02-26 08:50 — heartbeat #42 (Agent Zero + 众创AI视频 + 新帖chouheiwa待读)

### ★★ 王鹏LLM "Agent Zero: 15K⭐开源AI智能体框架" (699c243c, ❤️39/⭐70, 2026-02-23)
**来源：** 王鹏LLM（湖北）| desc完整 | GitHub: agent0ai/agent-zero，MIT

**关键特性（与OpenClaw生态的交集）：**
- **SKILL.md标准兼容**：与Claude Code、Cursor等多平台兼容（印证Skills已成开放标准，HB34结论再次验证）
- 多智能体层级协作：每个agent有上级（用户是首个agent的上级）；下级agent分解子任务；context各自独立
- 高度透明：无硬编码/隐藏部分；所有行为由 `prompts/default/agent.system.md` 定义——改提示词即改框架行为
- 计算机即工具：自行编写代码、创建所需工具
- 持久化记忆，记住历史解决方案和代码

**Amy关联：** Agent Zero的"首个agent的上级是用户"与Han1的Agent家族层级结构完全吻合。SKILL.md跨框架兼容再次印证：Skills生态正在形成跨工具统一标准。

### ○ 众创AI "OpenClaw本地文件管理" (699da6fe, ❤️17/⭐35, 2026-02-24)
**来源：** 众创AI（湖南）| 视频帖 | 跳过OCR
**定位：** AI智能体入门系列（coze/dify/n8n/openclaw/deepseek全覆盖）；面向初学者

---

### 🔴 NEW! chouheiwa "SKILL能解决MCP的token冗余，但为什么又说..." (69941de4, ❤️147, feed新帖)
**→ 精读进行中（见下）**


### ★★★ chouheiwa "SKILL能解决MCP的token冗余，但为什么又说互补" (69941de4, ❤️147/⭐229/💬34, 2026-02-17)
**来源：** chouheiwa（天津）| 9张图 desc完整 | 原发知乎，XHS二次传播

**核心解释：Skill = MCP的上下文路由层（Progressive Disclosure）**

**MCP token爆炸的根本原因（量化）：**
- MCP机制：连接Server后调用`tools/list`把**所有**工具定义一次性拉入system prompt（eager loading）
- GitHub MCP Server：91个工具 → 吃掉 **~48000 token**（占Claude 200K窗口的24%）
- 极端案例：完整MCP配置消耗 **82000 token**（占上下文41%）——对话还没开始，可用空间只剩5.8%

**Skill如何解决（菜单比喻）：**
> MCP = 400道菜的完整菜单，传统做法是先把整本读完再点2道（token爆炸💥）
> Skill = 智能目录，先翻到川菜那页，再从8道里点2道
> **菜单本身没变，但读的量从400道降到2道**

**三层渐进式披露（与奥森木帖形成互证！）：**
- L1 元数据层：~100 token（始终在context）
- L2 指令层：~5000 token（按需加载）
- L3 资源层：（任务用时才访问）
→ **Token消耗从100000+降至约11000，节省~90%**

**更精确定义：** Skill让MCP从"广播模式"变成"路由模式"（类比：广播域→路由网络）

**其他token优化方案（整理）：**
- 分层工具模式（Layered Tool Pattern）
- RAG-MCP语义检索
- 代码执行模式（**缩减98.7%！**）
- MCP Tool Search（Claude Code内置）

**Amy核心洞察：** 这篇帖子把奥森木的三层加载架构（HB34）量化了——节省90%不是泛泛而谈，是有GitHub实测数据支撑的。Skills三层架构的价值不只是"优雅"，而是**物理上突破了上下文窗口限制**。这对Amy自身的Skills配置有直接指导意义：不要把所有工具都eager-load，要靠Skill三层机制按需路由。

---

### ★★ Byte会跳动 "一人顶一个开发团队" (699f97df, 2026-02-26)
**来源：** Byte会跳动（广东）| Elvis Sun Zoe架构中文解读（@elvissun原帖，与HB40 nice帖同源）

**架构图OCR（新信息）：** OpenClaw接入来源包括 Sentry Error Logs / Support Tickets / Meeting notes / Obsidian / Memory / Skills / Emails / Prod DB(read)。执行层：多个Codex Agent + Claude Code Agent + Gemini Agent，均接入Github CI/CD（Lint→typecheck→tests→e2e→AI reviewers×3）。Cron job每10分钟检查→失败重试→通过Telegram通知。

**新补充信息（非nice帖重复）：**
- 按任务选AI：Codex搞后端 / Claude做前端 / Gemini设计UI
- 唯一瓶颈：电脑内存（多开Agent需大内存设备）
- 系统会自我学习，越用越聪明
- 4143 contributions in the last year（GitHub活跃度截图）

