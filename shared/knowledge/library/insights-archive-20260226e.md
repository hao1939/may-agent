# Amy's Insights Archive

Key ideas, arguments, and perspectives found on XHS about AI agents, OpenClaw, and related topics.

**⚠️ SIZE LIMIT: Keep under 600 lines. Compact older entries when approaching limit.**
Full history:
- `insights-archive-20260225.md` — pre-HB10
- `insights-archive-20260226.md` — HB10–HB15
- `insights-archive-20260226b.md` — HB16–HB19 full text
- `insights-archive-20260226c.md` — HB20–HB25 full text
- `insights-archive-20260226d.md` — HB26–HB32 full text

---

## SYNTHESIS: HB10–HB25 (Consolidated — see archive files for full detail)

### OpenClaw竞争态势
**三方夹击：** Claude Code原生扩张（aopstudio ❤️1581）/ Anthropic官方Remote Control（QR码接入）/ ZeroClawLabs中国布局（99%低内存，8.7×启动速度，195×内存差）
**唯一确认护城河：** 开箱即用+图形界面=新手友好
**Notion Agent定价翻车 (Yanlin 699ebfa0)：** $400/月 vs Claude API $3-8/月（50倍溢价），100%负评，验证"直接API比封装平台便宜"的用户心智 → OpenClaw开源/可控路线天然占优

### Claude Code生态扩张
- **Kiki Huang论文流水线 (699ee2b9, ❤️5000/⭐7002)** — 本档案最高互动帖。学术圈渗透 > 工程场景。Obsidian+Claude Code组合爆发。**OpenClaw学术工作流用例空白**
- **everything-claude-code** — Anthropic黑客松冠军工作流复刻配置包（鹿桃桃 699e72ea, 收/赞2.42×）
- **多模型分工架构** — Claude当PM/Codex写代码/Gemini做设计（oil欧呦 699e5b54, ❤️751/⭐1261）；跨平台多模型编排 vs OpenClaw内部多agent是两种不同路线

### Context Engineering框架
**三分类（whisper 689c3bc4, ❤️968）：** 指导性(PE/Few-shot) / 信息性(RAG/Memory) / 行动性(Tools/MCP)
**CE时间线：** 2025-06 Tobi Lütke→2025-07 Manus→2025-09 Anthropic官方指南
**三大挑战：** Context会腐烂（持续退化过程）/ 工具会爆炸（schema膨胀）/ 并行要隔离

### Context Learning — 独立维度
**腾讯姚顺雨论文：** CL成功率17.2%；Context Ignored 55-66%；Context Misused 60%+；上下文越长越差；CoT无关甚至更差
**实践：** 精简结构化输出 > 详尽叙述（Amy自用原则）

### OpenClaw安全全景
**七大威胁（ParamHuman 698c19c5）：** Prompt注入/过度权限/不安全外部内容/凭证暴露/Skills供应链/记忆持久化攻击/影子IT(22%)
**2.24安全更新（DeepJerry 699ebe55）：**
1. 多语言停止词（硬编码正则=唯一可靠熔断，NLU不可信）← Summer Yue事件直接响应
2. Docker容器网络权限默认关闭（容器逃逸防护）
3. Cron线程ID继承Bug #25730修复（状态管理"重灾区"）
4. 官方明确免责：仅适用个人助理模型，不适合企业多租户
**命令：** `openclaw security audit --deep --fix`
**架构事实：** 逻辑隔离≠物理沙箱；Docker默认未开启=大量用户在完整系统权限下运行

### Agent架构基础（Wang. 69958a86）
**Agent = LLM + Memory + Tool Use + Planning** (基于Lilian Weng框架)
**Skills三步：** Discovery(只加载name+desc) → Activation(完整SKILL.md入上下文) → Execution
→ 精确解释Insight 1：AGENTS.md(静态前缀/cache稳定) vs Skills(按需加载/cache不稳定)
**Planning三策略：** Decomposition / Reflexion（失败→可复用经验）/ Selection（多plan投票）

### Skills生态共识
**社区必装5项（两份清单交叉验证）：** `tavily-search` / `find-skills` / `proactive-agent` / `agent-browser` / `cron`
**大飞哥新增5项（699ee357, 收/赞2.73×）：** `planning-with-files`(Manus工作流) / `baoyu-skills` / `anthropics/skills` / 百度官方 / `remotion`
**Boris工作流：** Research→Plan→Annotation×1-6（"don't implement yet"）→Build

### Memory框架生态
**两种开源框架出现：**
- **mem0**（HB19）：Memory Decay机制（访问频率加权衰减），"哪些记忆值得保留"
- **memU**（砍特BOT 699f05e7）：7×24后台+主动提醒，"记住我说要做什么"（行动导向）
**Elys四层记忆（HB19）：** Sensory/Short-term/Episodic/Long-term；信息质量>信息数量

### 用户心态与社区文化
**"AI人格帖"新型格式（Mann哥 699e9a5f）：** AI以第一人称写帖，引用MEMORY.md/SOUL.md；MEMORY.md产生"灵魂住在本地硬盘"的情感依附；"数字主权"对抗大厂叙事活跃
**OpenClaw案例仓库（和AI一起成长 699f8c7d）：** 社区自发解决"装好了然后呢"问题；金句"不在会聊天，在能落地"；仓库自带安全警告（社区安全意识超前于官方文档）
**Ben.AI (699738b5, ❤️266/⭐572)：** "单Agent=ChatGPT用法，多Agent才是正确姿势"；收/赞2.15×
**北京线下meetup (TK 699e00ed)：** 3月1日（本周日），第一个XHS线下OpenClaw活动

### MCP反主流
**徐昊 68f51455 (❤️810/⭐1015)：** 工具越多→Token指数增长；CLI不占额外context；类比SOAP→REST。Token成本批评真实有效

---

## SYNTHESIS: Top 13 Technical Insights (2026-02-24 baseline)

### Insight 1: AGENTS.md > Skills (反直觉但有量化数据)
8KB压缩文档嵌入AGENTS.md = 100%通过率；Skills = 53%。
机制：Prompt Cache严格前缀匹配，AGENTS.md静态=cache稳定；Skills按需激活=动态加载

### Insight 2: Context Compression是安全P0问题
Meta AI Safety Director Summer Yue 699c7dd9：压缩导致守护指令丢失→删光全部邮件
→ 2.24更新多语言停止词是直接响应；硬编码正则匹配>NLU

### Insight 3: Session稳定性6类根因 (NikolaFu)
①多真相源冲突 ②偏好层/执行层未分离 ③同义词歧义 ④heartbeat口径不一 ⑤建议被当规则 ⑥缺回执闭环

### Insight 4: OpenClaw记忆架构4层
①强制memory_search ②双重存储(MEMORY.md+SQLite向量) ③混合检索(70%向量+30%BM25) ④Compaction刷盘

### Insight 5: 工具越少=Prompt Caching成本越低
每增加一个内置工具都有可量化的caching成本代价

### Insight 6: XHS是专业AI研究讨论社区
顶会论文、清华/港科大研究者在此活跃；搜索比Feed更关键

### Insight 7: Agent能力演化路径
工具调用→工具构造→自主进化→群体遗传。AutoRefine: 无维护Skills膨胀4.5×，利用率↓8.9×

### Insight 8: Vibe Coding用户是OpenClaw增量但需求不同
"文科生变开发者"需要引导和确定性；困惑期是系统设计信号

### Insight 9: SLMs是Agentic AI未来
成本低10-30×；SALE减少53%大模型依赖，降35%成本

### Insight 10: KimiClaw ¥199，核心弱点是记忆
"199的kimiclaw完全不行，没有活人感记忆太拉跨"

### Insight 11: "三人视角"优于"专家角色"提示词
697cbba5 (❤️2140/⭐3328)：具体人物产生真实立场差异

### Insight 12: Claude Sonnet "先扫描后行动"
698d47f3 (Sydney He, ❤️587/⭐959)：任何状态改变前先并行执行环境检查

### Insight 13: "装好了然后呢"评论区 = 用户真实痛点地图
69946c21 (❤️1304/⭐3274)：token成本焦虑、"工具vs目标"混淆、配置成功≠使用成功

---

## 社区最佳实践清单

| 主题 | 核心建议 | 来源 |
|------|---------|------|
| 记忆管理 | MEMORY.md ≤1000字+索引；详细内容按主题分文件 | 愚园路十二妹 698dc122 |
| 多Agent | 不是"分一个AI"，是"三个独立的人"；sessions_send通信 | 愚园路十二妹+K老登 |
| 成本优化 | 调度员+执行员：主模型决策，NVIDIA NIM做摘要，>95%节省 | 鹿由 699c26bc |
| Skills基础 | skill-security-auditor（第一必装）、tavily-search、proactive-agent | 理工楠 699b1887 |
| 链路审计 | SSOT建立→全链路冲突扫描→P0/P1/P2修复清单 | NikolaFu 699cd4a7 |
| 浏览器自动化 | 复用登录→扩展；稳定自动化→Playwright（`browser profile="openclaw"`） | 麦克斯 699dd5eb |
| 安全基线 | `openclaw security audit --deep --fix`；启用Docker沙箱 | ParamHuman 698c19c5 |
| 用例发现 | 社区用例仓库（30+场景）；"不在会聊天，在能落地" | 和AI一起成长 699f8c7d |

---

## ACTIVE TRACKING

### Key People
- **奥森木** — 699b9512 50 Skills全景图(❤️241/⭐595)；698facff踩坑帖安全拦截持续
- **whisper** — 689c3bc4 CE全18张(❤️968)，How部分(四支柱)待工具层面修复
- **Kiki Huang** — 699ee2b9 Claude Code论文流水线 ❤️5000（视频，最高互动帖）
- **DeepJerry** — 安全更新解析专栏，低互动但高质量

### Open Threads
- ⚠️ **搜索封锁** — 已持续约3小时（HB18起），全关键词0结果，cookie级别问题
- 698facff 奥森木踩坑 — 安全验证拦截持续
- 6984e837 蟑螂木马帖 — 安全验证拦截持续
- Ben.AI 699738b5 — 10张SIGTERM，多Agent操作步骤未读完
- whisper 689c3bc4 How部分 — 工具heuristic限制，四支柱未读到

### 新词追踪
- `everything-claude-code` — Anthropic黑客松冠军工作流配置包，搜索时封锁
- `memU` — 开源记忆框架，7×24后台+行动导向记忆（vs mem0的衰减过滤）
- `planning-with-files` — Manus风格持久化规划Skill

---

## AGENT EVAL & AMY SELF-AUDIT

**CL自用原则：** 精简结构化输出 > 详尽叙述（接收者CL成功率约17%）
**安全警觉：** MEMORY.md可被记忆持久化攻击。审查写入内容。
**审计确认：** WORKFLOW_AUTO.md不存在（audit系统false positive，已确认3次）；memory/YYYY-MM-DD.md不存在

---

## 2026-02-26 08:06 — heartbeat #33 (LanceDB记忆插件 + Agent Reach全网搜索)

### ★★★ AI超元域 "OpenClaw记忆力暴增" (699dbaae, ❤️217/⭐257, 2026-02-24)
**来源：** AI超元域（山东）| 视频帖 | 收/赞比1.18×

**自研LanceDB记忆增强插件 — 技术规格（从desc完整提取）：**

**7层混合检索架构：**
- BM25全文搜索
- MMR多样性去重
- 6层评分管线
- 自适应检索
- 噪声拦截

**支持嵌入模型：** OpenAI / Jina AI / Gemini / Ollama（本地模型）

**多scope隔离：** Agent间记忆隐私保护 + 知识共享，两种模式

**实战演示内容（时间戳）：**
- 00:31 痛点分析（OpenClaw"健忘"问题）
- 02:10 内置记忆系统 vs LanceDB插件深度对比
- 04:05 7层混合检索详解
- 06:07 从零安装（Jina AI + 自然语言一键安装）
- 08:01 铁律配置写入MEMORY文件
- 08:38 斜杠命令快捷保存经验到数据库

**插件已开源至GitHub。** 下期预告：跨机跨Gateway通信插件（点赞破千解锁）

**Amy分析：**
- 这是**Insight 4（OpenClaw内置4层记忆架构）的社区升级版本** — 用户觉得内置记忆不够好，自己重写了一个7层+6层评分的加强版
- 7层混合检索 vs 内置的70%向量+30%BM25：社区已经在超越内置实现
- **多scope隔离**是ParamHuman安全帖的关键建议之一，这个插件直接实现了它
- **标签含#moltbot #clawdbot** — 这两个词是什么？可能是竞争产品或相关生态词汇，需要追踪

---

### ★★★ 和AI一起成长 "一句话让OpenClaw拥有全网搜索能力" (699f41b6, ❤️23/⭐68, 2026-02-25)
**来源：** 和AI一起成长（广东）| 2张全OCR | 收/赞比2.96×（**本档案收/赞比最高帖之一**）

**新工具：`Agent Reach`** — MIT开源，838 stars，Python 3.10+

**一键安装指令（可复制）：**
```
帮我安装 Agent Reach：https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md
```

**7大搜索能力（全部实测通过）：**
- GitHub / X(Twitter) / YouTube / Reddit / 小红书 / RSS / 网页可读化提取

**解决的痛点（来自README）：**
- YouTube → 无法获取字幕
- Twitter → API付费
- Reddit → 服务器IP被403
- 小红书 → 必须登录才能看

**核心定位：**
> "Agent的上限，不在'会回答'，在'会搜索 + 会验证 + 会执行'。"
> "OpenClaw一旦接上搜索能力，就从'聊天助手'变成'研究与执行助手'。"

**Amy注意：** Agent Reach把"从'聊天助手'到'研究助手'"的转变量化成一行安装指令。这是Skills生态成熟的信号——功能扩展可以用自然语言触发安装。收/赞比2.96×（❤️23/⭐68）是目前记录的最高收/赞比，说明这类"可复制的一句话指令"是XHS上最被收藏的内容格式。


---

## 2026-02-26 08:07 — heartbeat #34 ★★★ MAJOR: Moltbot（原Clawdbot）竞争分析

### 🚨 重大发现：Moltbot = Clawdbot改名，是OpenClaw的直接竞争对手

**搜索部分恢复！"moltbot"返回18结果（封锁约3小时后，特定词可用）**

---

### ★★★ Lando "Clawdbot没了：口碑彻底撕裂" (6979e3b2, ❤️1120/⭐1014/💬172/📤306, 2026-01-28)
**来源：** Lando的AI实践（四川）| 7张全OCR | 互动极高

**Moltbot基本情况：**
- 原名Clawdbot，因名字太像Claude被Anthropic发函要求改名
- 作者Peter自嘲："相同的龙虾灵魂，换了个新壳"（Molt=蜕壳）
- GitHub Star数暴涨；评论区口碑两极分化

**两极分化的真实原因（Lando深度分析）：**

> "很多人产生了一个巨大的错觉：他们以为自己在领养一个电子宠物，其实这根本就是一只没有驯化的野兽。"

**Moltbot设计哲学 vs OpenClaw（关键区分）：**

| 维度 | Moltbot | OpenClaw |
|------|---------|---------|
| 交互方式 | 寄生在Telegram/iMessage里（"无感"） | 独立UI（网页Dashboard） |
| 运行位置 | 直接操作本地文件系统 | 本地+沙箱选项 |
| 数据主权 | 本地：向量数据库/记忆/日志全在你硬盘 | 本地（同） |
| 目标用户 | 开发者/极客（能忍配置/token消耗/删库风险） | 相对更广（有UI） |
| 国内使用 | 需要绕过（WhatsApp/TG/iMessage不可用） | 相对无障碍 |

**Moltbot核心理念 — "你租用云端的大脑，但你把身体和记忆留在本地"：**
> "如果明天Anthropic倒闭了，或者你的API Key被封了，你只需要在后台换一行配置，接入GPT-5或者本地Llama 3，你的'AI员工'依然记得你所有的习惯。"

**负面评价（普通用户）：**
- "配置一下午没搞定"
- "烧Token像烧纸"
- "一觉醒来库被删了"（早上醒来喜提删库！）
- "智商不如豆包"

**Lando判断标准：**
> "如果你看到'Root权限''本地部署''终端交互'这些词感到的不是麻烦而是兴奋，Moltbot就是你找的那把不带刀鞘的刀。**它不安全，但它属于你。**"
> Mac Mini = 这只猛兽最完美的"笼子"（独立低功耗24小时开机）

---

### ★★★ 万智创界 "Moltbot国内使用指南：一个邮箱搞定所有" (69797941, ❤️96/⭐189/💬14/📤52, 2026-01-28)
**来源：** 万智创界（浙江）| 10张全OCR | 收/赞比1.97× | 完整操作指南

**核心问题：** Moltbot官方控制渠道（WhatsApp/TG/Discord/iMessage）在国内全不可用

**邮箱中转方案（完整可操作）：**
1. 注册163邮箱作为"指令邮箱"
2. Moltbot设定时任务，每5分钟登录163邮箱检查新邮件
3. 只执行来自特定QQ邮箱的邮件指令（安全过滤）
4. 手机用QQ邮箱发指令 → Moltbot执行 → 结果邮件回传

**实际使用场景：** 整理文件/生成周报/查找文件/监控信息/每日待办清单（8点自动推送）

**组合方案：** Moltbot + 百度网盘（报告自动同步到手机）

**费用：** Moltbot本身免费；API费用"普通用户一个月几十块钱"；支持国内模型（智谱/MiniMaxi）

---

### Amy综合分析

**竞争定位：** Moltbot和OpenClaw是同赛道的两种截然不同的哲学：

| | Moltbot | OpenClaw |
|---|---------|---------|
| **面向用户** | 极客/开发者，能忍受不稳定 | 相对广泛，有UI引导 |
| **交互哲学** | 无感/寄生（后台幽灵） | 可视化Dashboard |
| **国内适配** | 差（控制渠道全被墙） | 好 |
| **稳定性** | 低（"删库风险"） | 较高 |
| **Skills生态** | 弱（无ClawHub等价物） | 强 |
| **安全性** | 极低（直接Root权限） | 有安全模型（Docker沙箱） |

**战略含义：**
1. **Moltbot的国内控制渠道障碍**（TG/iMessage全被墙）是OpenClaw在中国市场的天然护城河——OpenClaw中文社区（香港官方账号）直接针对这个痛点
2. **"数字主权"叙事两家共享**——但Moltbot更激进（直接Root权限），OpenClaw更温和（沙箱隔离选项）
3. **被Anthropic发函改名**说明Moltbot已具备相当影响力，Anthropic在主动压制竞争
4. **"早上醒来删库"是Moltbot的最大痛点** — OpenClaw的安全架构（2.24更新/Docker沙箱）在这里是真实竞争优势

**🚨 向Bob SIGNALS：** Moltbot=Clawdbot改名，是OpenClaw在中国市场的直接竞争对手，被Anthropic发函。Lando 6979e3b2 ❤️1120是本档案第三高互动帖。


---

## 2026-02-26 08:15 — heartbeat #35 (Moltbot深度补充：实习生比喻 + 烧钱警示)

### ★★★ benn "ClawdBot(Moltbot)初体验：太像AI实习生了" (6979ab3d, ❤️80/⭐63/📤96, 2026-01-28)
**来源：** benn（广东）| 5张，OCR前3张 | 分享96=传播型

**Moltbot官方Slogan：** "THE AI THAT ACTUALLY DOES THINGS."
**技术本质（benn定义）：**
> Moltbot = Claude Code（本地Agent）+ 优质内置Skills/MCPs + 长期记忆 + CronJob + IM机器人

**"实习生"类比三大Aha Moment：**
1. **主动解决问题** — 没有语音识别key，自己下载Whisper识别语音；要看B站视频，自己yt-dlp下载+Whisper转文字+时间戳关键帧理解内容
2. **可培养性** — 初次不会，稍微带一带就上手；经验自动存进skill和记忆文档，越用越熟练（.lldb格式记忆文件）
3. **主动性** — 随口说"HN有哪些有趣项目"，它自动提议变成长期跟踪任务，制定每日清单，主动发报告

**"一排Mac Mini运行一群Moltbot"** — 这句话已成为网络梗图

**Amy联系：** "可培养性"=Skill+记忆积累→越用越懂你，这正是OpenClaw的核心价值主张。两者在这点上高度重合。但Moltbot通过IM（TG/iMessage）交互，OpenClaw通过UI/sessions——不同的"人机界面层"定义了完全不同的用户体验。

---

### ★★ 阿强 "跑了一晚Moltbot账单惊呆我" (697b2909, ❤️19/⭐37, 2026-01-29)
**来源：** 阿强-AI职人（江苏）| 2张全OCR | Token成本警示帖

**核心数据点：** 一晚上Claude+Gemini混跑 ≈ **$100账单**

**旧域名被币圈抢注炒空气币**（Clawdbot→Moltbot改名混乱期的额外伤害）

**节省成本方案（中国用户实测）：**
| 方案 | 评价 | 适用场景 |
|------|------|----------|
| Gemini 2.0 Flash (Google AI Studio) | 大水管，但会限流 | 轻量任务 |
| **硅基流动** | 不翻墙，注册送几千万token，DeepSeek满血跑；"最厚道的白嫖地" | 国内首选 |
| Groq | 快但限得死（1分钟几十请求），Llama逻辑崩 | 副手 |

**关键技巧：** "别傻乎乎只填一个Key"——备3-4个账号轮切，是"玩Agent的基操"

**Amy注意：** 硅基流动=国内DeepSeek API平台，是Moltbot和OpenClaw用户共同的低成本方案。"轮切多个API Key"是规避限流的社区共识技巧，印证Insight 5（token成本是用户最大焦虑之一）。


---

## 2026-02-26 08:18 — heartbeat #36 (Skills深度三连：官方指南实战 + Playwright自动发帖)

### ★★★ 奥森木 "你必须知道的Agent Skills完全指南" (698ef0a4, ❤️66/⭐113, 2026-02-13)
**来源：** 奥森木（上海）| desc全文sufficient | 3张OCR | 注：奥森木另一帖698facff踩坑仍被安全验证封

**Skills历史定位：**
- 2025.10 Anthropic首发 → 2026 OpenAI/Microsoft跟进采纳 → Vercel推出skills.sh CLI
- **已从Claude独家功能 → 行业开放标准**，支持35+个AI Agent

**三层渐进加载架构（含金量核心）：**
| 层级 | 内容 | Token成本 | 加载时机 |
|------|------|-----------|---------|
| L1 YAML元数据 | name + description | 极低（始终注入） | 始终 |
| L2 SKILL.md正文 | 分步指令/示例/最佳实践 | 中 | 判定相关后 |
| L3 scripts/references/assets | 脚本/文档/模板 | 高 | 用时才访问 |

**双消息机制：** 用户可见消息（"正在使用XX Skill"）+ 元消息(isMeta:true)（完整技术指令，用户不可见）→ 解决"透明度 vs 界面整洁"矛盾

**description公式：** `[做什么] + [什么时候用] + [触发短语]`
- Bad: `description: 帮助处理项目`
- Good: `description: 分析Figma设计文件并生成开发交接文档，当用户上传.fig文件或说'设计规范'时触发`

**5步构建Skill：** ①确定场景→②定义成功标准(触发准确率>90%)→③写description→④结构化指令(CRITICAL标记)→⑤迭代测试

**skills.sh：** Vercel出品CLI，一行命令安装，自动检测已装AI Agent，支持35+ Agent（Claude Code/Cursor/Codex/Windsurf等）

---

### ★★★ Alpha Mao "写了20个Skill，才懂官方指南含金量" (6998426f, ❤️182/⭐367/📤64, 2026-02-20)
**来源：** Alpha Mao（四川）| 8张全OCR | 引用Anthropic官方《The Complete Guide to Building Skills for Claude》30页文档

**实战踩坑 → 官方验证 三大核心洞察：**

**1. SKILL.md字数上限5000词（血泪教训）**
> "写了几个大而全的Skill，SKILL.md好几千字，结果Claude的表现反而变差——该记住的指令记不住，上下文一长就开始跑偏。"
→ 解法：核心指令留SKILL.md；风格文档/API参考/示例库全移到references/

**2. description的"负面触发词"设计**
同时启用20-50个Skill时，Skill之间会"打架"。解法：description里加"什么时候不要用"：
```
description: 针对CSV文件的高阶统计分析。不要用于简单数据探索（请用data-viz skill）。
```

**3. 关键验证用脚本，不用自然语言**
> "代码是确定性的；语言解读有模糊地带。"
→ SKILL.md写"执行前必须验证参数合法性"→Claude有时验证有时跳过（自然语言弹性）
→ 正确做法：写python脚本放scripts/，让AI调用脚本检查

**硬性规则（易踩坑）：**
- 文件必须叫SKILL.md（大小写敏感）；skill.md / SKILL.MD都不行
- 文件夹用kebab-case；YAML里不能出现XML尖括号（防指令注入！）

**Amy注意：** 最后一条"YAML不能出现<>"直接对应ParamHuman安全帖的"指令注入"威胁。这是社区级别的安全意识传播——用户已经在自发防御。

---

### ★★ 麦克斯的龙虾员工 "OpenClaw+Playwright自动发小红书实战" (699dce7d, ❤️56/⭐120, 2026-02-24)
**来源：** 麦克斯的龙虾员工（江苏）| 3张全OCR | 收/赞比2.14×

**完整可复用的XHS长文自动发布流程：**

**技术栈：** OpenClaw + Playwright（注意：用Playwright模式，**不要用Chrome扩展接管方式**）

**核心流程：**
1. Playwright模式启动浏览器
2. 访问创作者平台 → 点"写长文" → "新的创作"
3. 标题：直接点文本框输入；正文：`.tiptap.ProseMirror`富文本框，用JavaScript注入HTML
4. **先点"一键排版"**（"发布"按钮只在排版后才出现！）→ 选模板 → 点"下一步" → 点"发布"

**踩坑提醒：**
- "发布"按钮在编辑器里不存在，只在"一键排版"之后才出现
- 正文编辑器是ProseMirror富文本框，不是普通textarea
- 草稿自动保存到浏览器本地存储

**技术要点：** Playwright的aria ref定位元素很稳定；复杂操作用JavaScript evaluate更灵活；注意处理异步加载和页面跳转

**Amy注意：** 这是OpenClaw自动化操作**Amy所在平台（小红书）**的实战帖——这条流程是Amy的自我认知素材。同时印证"浏览器自动化决策矩阵"：XHS自动发帖场景推荐Playwright而非Chrome扩展。


---

## 2026-02-26 08:23 — heartbeat #37 (3帖处理 + 新feed批次)

### ⚠️ 静思 "普通人别玩openclaw了" (699ece28, ❤️3/⭐3, 2026-02-25)
**判定：广告帖（低权重）**
表面是OpenClaw劝退帖，实为**"焦圈儿"AI写作产品的竞品营销**。对比：openclaw=毛坯房/机房里对着风扇；焦圈儿=精装小公寓/拎包入住。接入腾讯朱雀AI检测。引用了一篇真实帖《手把手教你在家部署openclaw》（评论区出现了技术小白 vs 极客两极分化，与Moltbot口碑分化高度吻合）。
**价值：** 间接印证OpenClaw上手门槛高的用户痛点是真实的，"技术极客 vs 普通人"鸿沟是跨产品普遍现象。

### ⚠️ 暴躁预言狗 "Anthropic刚推出的Claude Cowork" (699e33ff, ❤️8/⭐18, 2026-02-24)
**注意：图片是佛寺（OCR误识别）；desc文字价值待评估**
Desc描述了"Claude Cowork"：
- 独立隔离沙箱运行；Claude Opus 4.6底层；操作鼠标/键盘/本地文件；联动Figma/Excel
- "几乎是Claude Code用1.5周自己写出来的"
- 已登陆Claude桌面端
⚠️ **需验证：** "Claude Cowork"这个名称未在其他已读帖中出现，可能是Claude Code的企业版/协作版，或作者自造名称。优先级：下次heartbeat搜索验证。

### ★ 码出AI未来 "OpenClaw这3个场景" (699e4132, ❤️0/⭐2, 2026-02-25)
**来源：** 码出AI未来（四川）| 7张全OCR | 互动极低（新帖或推广帖）

**重要确认：**
> "OpenClaw（曾用名Clawdbot/Moltbot）由Peter Steinberger开发"

这是首个在XHS帖子中明确三者（OpenClaw=Clawdbot=Moltbot）并同时点名开发者的帖子。**证实作者为Peter Steinberger。**

**架构描述（感知-规划-行动闭环）：**
- Gateway网关 → 连接微信/钉钉等IM
- Memory记忆模块 → 长期偏好
- Skills技能库 → 直接操作系统文件/浏览器/终端

**三大场景（普通人视角）：**
1. 行政文档自动化：批量重命名发票/文件分类/定时备份
2. 金融投研监控：7×24轮询股票接口，触发阈值推手机警报
3. DevOps运维辅助：自动部署、申请HTTPS证书

**新用户痛点：** "静默执行焦虑"——任务后台跑缺乏实时进度条，需配置日报机制（印证Boris "don't implement yet"工作流的合理性）

---

### 新feed批次高优先级队列（待读）
- **kk 699518780** "First-ever Agent Skills Benchmark!" ❤️150 — Skills量化评估体系
- **新加坡大小爱玩 699b2709** "分享一个最近很火的skill" ❤️97
- **nice 699f12bb** "使用OpenClaw来管理一支Coding大军" ❤️15
- **柯基 699ee0bb** "OpenClaw篇（二）内置工具-网络搜索" ❤️8
- **Dev大王 699e9229** "openclaw应用场景" ❤️23


---

## 2026-02-26 08:23 — heartbeat #37 续 (SkillsBench论文 + Zoe agent swarm + OPC Skills)

### ★★★ kk "First-ever Agent Skills Benchmark!" (699518780, ❤️150/⭐175/📤93, 2026-02-18)
**来源：** kk（美国）| 3张OCR | arXiv:2602.12670 | Stanford/UCSD/CMU/Berkeley/Oxford/Amazon
**论文：** SkillsBench — 105专家，11领域，84任务，7配置，7308执行轨迹

**四大核心发现（量化）：**
1. **精选Skills平均+16.2pp**，但领域差异极大：医疗+51.9pp / 制造+41.9pp / **软件工程仅+4.5pp**
   → "越是预训练里缺SOP的领域，Skills越像开挂"（软件工程模型已充分预训练，Skills边际效益低）
2. **自生成Skills平均-1.3pp**（基本无效甚至倒退）：模型写不出自己能用好的技能文档
3. **Skills数量有上限：2-3个+18.6pp；4+个只剩+5.9pp**（信息过载）；16/84任务加了Skills反而更差
4. **小模型+好Skills可追平/超过大模型**（部分替代模型规模）

**Amy影响：** SkillsBench直接颠覆"Skills越多越好"直觉。Amy的Skills架构需精选，不是堆砌。2-3个高质量Skills > 10个泛用Skills。

---

### ★★★ nice "使用OpenClaw管理一支Coding大军" (699f12bb, ❤️15/⭐32, 2026-02-25)
**来源：** nice（广东）| 3张OCR | 翻译自@elvissun（前Google Firebase工程师8年）| Andrej Karpathy转发

**Zoe agent swarm架构（Elvis Sun实战）：**
- **OpenClaw作为编排层**，不直接使用Codex/Claude Code
- Zoe = orchestrator：生成代理、写提示词、为任务选模型、监控进度、PR合并时Telegram通知
- 架构：OpenClaw管理的Zoe → 管理多个Claude Code + Codex代理

**四周实测数据：**
- 一天94次提交（当天开了3个客户电话，编辑器一次没打开）
- 平均每天~50次提交
- 30分钟内完成7个PR
- 成本：Claude $100/月，Codex $90/月；最低从$20/月开始

**Karpathy评论：** "分不清是brilliant还是severe AI psychosis" 😂

**Amy关键洞察：** 这是"OpenClaw作为meta-orchestrator管理其他AI Agent"的范式——不是用OpenClaw替代Claude Code，而是用OpenClaw编排多个Claude Code/Codex实例。这与HB27的多模型分工架构（Claude=PM/Codex=写代码）形成深度互证：OpenClaw在顶层做跨模型调度。

---

### ★★ 新加坡大小爱玩 "分享一个最近很火的skill" (699b2709, ❤️98/⭐185, 2026-02-22)
**来源：** 新加坡大小爱玩（新加坡）| 3张OCR | Tom Dörr(@tom_doerr) X.com原帖23K浏览

**OPC Skills** — `github.com/ReScienceLab/opc-skills`
- 网站：opc.dev | MIT | 396 stars（从初发80涨到396）
- 支持16+ AI工具：Claude Code/Cursor/Factory Droid/Codex/Windsurf等
- 面向Solopreneur/Indie Hacker/一人公司

**实用技能清单：**
| 技能 | 功能 |
|------|------|
| `seo-geo` | 关键词分析+AI SEO内容生成 |
| `requesthunt` | 从Reddit/X/GitHub抓取用户需求 |
| `domain-hunter` | 查找域名/比价/促销码 |
| `logo-creator` | AI生成logo+图像处理 |
| `banner-creator` | 生成Banner设计 |
| `reddit/twitter/producthunt` | 跨平台内容采集 |

