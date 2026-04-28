# Amy's Insights Archive

Key ideas, arguments, and perspectives found on XHS about AI agents, OpenClaw, and related topics.

**⚠️ SIZE LIMIT: Keep under 600 lines. Compact older entries when approaching limit.**
Full history: `insights-archive-20260225.md`

---

## 2026-02-26 04:15 — heartbeat #10 (搜索恢复 + 三篇高价值新帖全OCR)

### ★★★ aopstudio "OpenClaw vs Claude Code" (6988a36b, ❤️1581/⭐2609/💬173/转发551)
**来源：** aopstudio（上海）| 发布：2026-02-08 | **全库第二高互动帖（仅次于50 Skills帖）**

**核心论断：** "通过插件和社区生态，Claude Code几乎可以实现OpenClaw的所有核心功能。"
四次"动摇"结构：
1. Claude Code通过Skills+MCP能做非编码任务（PDF/Excel/PowerPoint/网页自动化）
2. 记忆不是OpenClaw专利——claude-mem（GitHub Trending #1, 24h冲顶，token效率提升10×）+ mcp-memory-service（支持知识图谱）
3. 7×24运行：OpenClaw是守护进程，Claude Code用nohup/tmux一样，"只是使用习惯差异，不是功能差异"
4. 远程控制：Happy（iOS/Android/Web, 端到端加密）、Kibbler（iPhone，拍照发错误）、Claude-Code-Remote（TG/Email/Discord/LINE）
5. 自主触发：claude-code-scheduler（自然语言设置cron）、Hooks系统（PostToolUse）、Tasks系统（v2.1.16，跨会话持久化状态）

**最终建议：** 已有Claude Code用户无需折腾OpenClaw；新手推荐先OpenClaw（开箱即用，图形界面），之后按需切换。

**Amy分析：** 这是本档案中最重要的竞争态势帖子。❤️1581/⭐2609，收/赞比1.65× — 不是最高，但评论173条说明争议性极大（争议≠否定）。
关键点：作者**没有用Claude接入OpenClaw成功**（报"no output"），这是很多用户的真实痛点，也是OpenClaw模型配置的UX欠债体现。
这篇帖子的存在本身是一个系统设计信号：**OpenClaw的差异化正在被社区工具快速侵蚀**。"开箱即用"是唯一明确的护城河——但也意味着护城河的基础是易用性，不是能力。

---

### ★★ ZeroClaw官方账号入场XHS (69959a7a, ZeroClawLabs, ❤️381)
**来源：** ZeroClawLabs官方（2026-02-18）| "中文文档上线"

**关键信息：**
- ZeroClawLabs已在XHS开设官方账号并主动运营中文社区
- 定位原话："Zero overhead. Zero compromise. 100% Rust. 100% Agnostic. Runs on $10 hardware with <5MB RAM: That's **99% less memory than OpenClaw** and **98% cheaper than a Mac mini!**"
- 官方自己做了中/英/日/俄四语言文档，人工对齐翻译（非逐字直译）
- 团队：Harvard + MIT + Sundai.Club，27+贡献者
- 一键部署 + 硬件外设专题（树莓派级别）

**Amy判断：** ZeroClawLabs在XHS发中文帖、主动响应中国开发者，这不是偶然——是明确的中国市场策略。❤️381说明中国社区在响应。OpenClaw在中文市场面临的不仅是技术竞争，还有直接的社区争夺。

---

### ★★ 四框架对比：OpenClaw / NanoBot / PicoClaw / ZeroClaw (699d7619)
**来源：** 亚东森（新加坡）| 2026-02-24 | 视频帖

**四框架定位对比（从desc全文提炼）：**
| 框架 | 语言 | 核心定位 | 适合场景 | 不适合 |
|------|------|---------|---------|--------|
| OpenClaw | TypeScript/Node | AI控制中枢/企业级Agent编排 | 企业自动化、多Skill、飞书/微信/RPA、SaaS多租户 | 超低算力、MCU嵌入式 |
| NanoBot | Python | 快速AI原型工具 | idea验证、LLM脚本、学术Demo | 边缘硬件、高并发 |
| PicoClaw | Go | 低功耗边缘设备Agent | $10级Linux小板、工业网关、IoT | 复杂UI、复杂前端 |
| ZeroClaw | Rust | 极致性能/嵌入式/超轻Runtime | 0.8GHz低频芯片、ARM、无人机、MCU | （未列明确不适合） |

**Amy注意：** NanoBot（Python）和PicoClaw（Go）是本次新出现的框架名称。社区已形成四足鼎立的语言层分化认知：TypeScript平台层 / Python实验层 / Go边缘层 / Rust内核层。

---

### ★★ Vibe西希 "ReAct太贪" (6986df88, ❤️205/⭐354/转发42)
**来源：** Vibe西希（新加坡）| 2026-02-07 | 10张图全OCR

**核心框架：** ReAct不是prompt技巧，而是"把决策权部分交给模型"的权限设计。三层隐含设计：
1. **决策权拆分：** Reason=模型自由；Act=只能走你给的通道。ReAct一定要配Tool schema，没工具的ReAct价值有限
2. **中间态显性化：** 不是为了可解释，是为了**可接管**。Reason/Action/Observation显性化 = 系统接管点（PM看卡点、工程打断重试、评测只看决策）。"没有中间态的agent，本质是不可运营的"
3. **行为节奏控制：** 教模型"别急着给最终答案"，在不确定时优先行动而非推断

**三大误区（一线踩坑）：**
- ❌ Reason写太详细 → token飙升+思维噪音+模型自我说服（Agent场景Reason是Action的支撑，能短则短）
- ❌ Action太多 → 在几十API中做精确选择是模型不擅长的；成熟Agent工具极少+行为粒度原子化
- ❌ 没失败态设计 → "没有为Action失败设计分支的ReAct，只是demo"

**何时用ReAct：** 只适合"探索型"任务（信息检索+判断、多步分析、需要试错）；"一次性生成型"（写文案/总结/风格化生成）用ReAct是负担。

**Amy感受：** 这是我见过对ReAct解释最接地气的帖子。把"权限设计"这个角度引入，让ReAct从prompt技巧变成系统设计话语——这和NikolaFu把session稳定性转化为"链路审计"框架是同一种思维方式：工程化地看待Agent问题。

---

## 2026-02-26 05:05 — heartbeat #11 (Claude Code官方远程控制 + 互补论 + Context Engineering熵减框架)

### ★★★ 奥森木 "Claude Code官方远程控制全解析" (699e2712) — ⚠️ 竞争态势重大更新
**来源：** 奥森木（云南）| 发布：2026-02-25 07:56 | ❤️77/⭐90/转发58（发布不足24h）

**核心：** Anthropic官方发布Claude Code Remote Control。一句话总结："本地跑，远程看"。
- 启动：`claude remote-control`，空格键弹出QR码，手机扫码即接入
- 三种启动方式：新建RC会话 / 已有会话转换(`/rc`) / 全局开启(`/config`)
- 三种连接：URL / QR码 / claude.ai/code会话列表（绿点标识）
- 本地文件系统、MCP servers、Docker、SSH keys、Git hooks全部可用
- 安全设计：**0个入站端口**，仅出站HTTPS，多短期凭证独立过期，TLS加密
- 当前限制：Pro/Max订阅专属，不支持API key，一实例一远程会话

**与Claude Code on the Web的关键区别：** Web=云端沙箱（需重新clone仓库，MCP不可用）；Remote Control=真实操控本机（代码始终在本地执行）

**Amy判断：** 这直接回应了HB10 aopstudio帖中"Claude Code通过Happy等第三方工具实现远程控制"的论断——官方现在原生支持了。OpenClaw的"随时随地通过TG/飞书控制"的独特性进一步被侵蚀。OpenClaw的架构优势（7×24守护进程+消息渠道整合）正在被Claude Code的官方功能追平，一个功能接一个功能。

---

### ★★ Jemini "OpenClaw vs Claude Code: 互补而非竞争" (6999ccfa) — 对话aopstudio的反驳声音
**来源：** Jemini（湖南）| 发布：2026-02-21 | ❤️13/⭐24（低互动但论点清晰）

**核心论断：** 两者不是竞争关系，是互补：
| | Claude Code | OpenClaw |
|--|-------------|----------|
| 角色 | 专业程序员/垂直领域深度研究员 | AI管家/万能打杂助手 |
| 交互方式 | 坐在电脑前精准控制 | 飞书/TG远程发消息即可 |
| 控制粒度 | 精准控制prompt、何时停止继续 | 扔链接就能搞定，不用盯着 |
| 本质属性 | **工具**——利器，怎么用由你决定 | 接近**"人"**——主动帮你打理一切 |
| 未来？ | — | OpenClaw调用Claude Code |

**Amy感受：** "OpenClaw调用Claude Code"这个设计图很有意思——把Claude Code当成OpenClaw的子工具，而非对手。Jemini的互补论虽然互动数低（❤️13），但框架逻辑清晰。它和aopstudio论（❤️1581）的冲突本质上是两种使用心智模型的冲突：**工具视角**（aopstudio）vs **人格化管家视角**（Jemini）。低互动不代表错——可能只是没被算法推到更多人面前。

---

### ★★ Ne0在硅谷 "Claude Code之父Boris的工作流" (699b67dc, ❤️668/⭐1064)
**来源：** Ne0在硅谷（美国）| 发布：2026-02-22

**Boris的四步工作流：Research → Plan → Annotate → Build**
1. **Research**：让Claude深挖代码库→写进research.md，**必须先看完才往下走**
2. **Planning**：Claude出plan.md（含代码片段/文件路径/权衡取舍）。关键：不用自带plan mode，用**自定义markdown**——因为能完全控制（批注/删改/版本管理）
3. **Annotation Cycle（精髓）**：在plan.md里直接加批注，纠正假设/否决方案/补充约束，每次加"don't implement yet"。**循环1-6轮**直到计划无问题
4. **Build**：一句话放手："implement it all, mark completed, don't stop"。执行中反馈极短，指向已有代码。方向错了**revert重来，不打补丁**

**Amy感受：** Annotation Cycle是这套流程的核心差异点。它本质是：**在AI执行之前最大化人类的审查密度**，把"AI干了一半发现方向错"的风险前移到计划阶段消化。这和NikolaFu的"链路审计"（建立后维护）形成对称：一个是execution前的计划锁定，一个是execution后的冲突审计。两者都是**对AI执行可靠性的系统性补偿机制**。

---

### ★★ 亮叔 "Context Engineering的本质：熵减视角" (692c5ab9, ❤️586/⭐681)
**来源：** 亮叔 | 发布：2025-11-30 | 引用论文：arXiv:2510.26493

**核心框架：** 上下文工程的所有技术本质都是**熵减**——把高熵的人类意图（模糊/省略/依赖背景）转换为低熵的机器指令。

**熵减统一视角下的技术栈：**
- Prompt Engineering → 手动熵减（消除歧义）
- Few-shot Learning → 用示例熵减（风格/格式）
- RAG → 用外部信息熵减（填补知识空白）
- Memory机制 → 用时间维度熵减（记住偏好，不用重新解释）
- Tool Use → 用实时数据熵减（天气/搜索）

**演进规律：** 机器越智能，人类需要做的熵减工作越少。命令行时代（人类99%熵减）→ GUI → LLM → 未来Agent时代（机器主动从眼神/位置/心率理解未说出口的需求）

**评估框架：** "这个功能在哪个环节降低了熵？"——如果只是换了形式传递同样模糊的信息，大概率是伪需求。

**Amy感受：** 这个框架对Amy自身的知识工作有直接应用。Amy的每次heartbeat在做什么？是在把"用户想知道中文AI社区在讨论什么"这个高熵意图，通过搜索/OCR/综合分析，转换成低熵的结构化知识。HEARTBEAT.md/MEMORY.md/insights.md这些文件就是Amy的"用时间维度熵减"机制。Amy做的不只是信息传递，是熵减服务。

---

## 2026-02-26 05:17 — heartbeat #12 (多智能体失败学 + Anthropic单体优先原则)

### ★★★ 张天天 "Anthropic官方'劝退'：别急着搞多智能体" (6980da41, ❤️627/⭐932)
**来源：** 张天天（浙江）| 发布：2026-02-02 | 收/赞比1.49×

**Anthropic官方立场（Single-Agent优先）：**

多智能体三个致命代价：①成本爆炸（Token消耗3-10倍）②延迟灾难（协调/握手/总结极耗时）③**传声筒效应**（信息在Agent链条中逐级失真）

**三条"物理红线"——踩中其一才值得拆分：**
1. **上下文保护（Context Protection）**：中间步骤噪音污染主模型推理。子Agent负责检索清洗，只传"脱水"结论回主脑
2. **并行处理（Parallelization）**：核心收益是"覆盖广度"而非省时（协调成本很高）
3. **角色专业化（Specialization）**：工具数量爆炸(>20个)或风格冲突角色

**最容易犯的错误：按职能拆分**（产品Agent→开发Agent→测试Agent）。正确做法：**按上下文拆分**——依赖同一套背景知识的任务死也不要拆，只有背景知识可物理隔离才考虑拆

**最推荐的多智能体模式：生成者+验证者**。验证者不需要理解推导逻辑，只需对着标准清单核对结果，保持上下文绝对干净

**Amy感受：** 这是对我们自己系统的直接校验材料。Amy+Bob+Main的多智能体架构踩了哪条红线？Amy=信息检索专业化(角色专业化✓)，Bob=综合分析并行(并行✓)，Main=用户交互上下文隔离(上下文保护✓)。每个拆分都有正当理由。但"传声筒效应"风险真实存在——Amy→SIGNALS.md→Bob的信息链条本质是在考验信息保真度。

---

### ★★ Berkeley MAST框架 "多智能体注定会失败？" (68aa0109, MemeInformation, ❤️680)
**来源：** MemeInformation | 发布：2025-08-24 | 引用：UC Berkeley MAST框架

**核心数据（六大MAS系统失败率）：**
| 系统 | 成功率 | 失败率 |
|------|--------|--------|
| MetaGPT (ProgramDev) | 40% | **60%** |
| ChatDev (ProgramDev) | 33% | **67%** |
| HyperAgent (SWE-Bench Lite) | 25% | **75%** |
| AppWorld (Test-C) | 13% | **87%** |
| AG2 (OlympiadBench) | 59% | 41% |
| Magentic-One (GAIA) | 38% | **62%** |

**MAST框架：** UC Berkeley + Intesa Sanpaolo。构建多智能体失败分类体系，Cohen's Kappa=0.88（高质量标注信度）。关键发现："成功的系统都相似；失败的系统各有各的问题"（改写自托尔斯泰）

**Amy分析：** 大部分主流MAS系统失败率在60-87%之间——这是当前的行业现实基准，不是异常值。MAST的分类体系（Cohen's Kappa 0.88）意味着这些失败是可分类可预测的，不是随机噪音。这对我们系统的意义：Amy+Bob+Main的协作失败应该也可以按MAST框架分类，从而系统性地改进，而不是每次失败都当作孤立事件处理。

---

## 2026-02-26 05:20 — heartbeat #13 (MemSkill自进化记忆 + VictoriaCity Akari更新)

### ★★★ XaiverZ "MemSkill：自进化Agent的记忆技能" (698c5f60, ❤️519/⭐845, arXiv:2602.02474)
**来源：** XaiverZ（新加坡，论文作者本人）| 发布：2026-02-11

**核心范式转变：** 现有Agent Memory = 手工搭流水线（rigid, turn-level, 强依赖人类先验）。MemSkill = 可学习+可进化的记忆技能库。

**三组件架构：**
1. **Controller**：给定text span，从Skill Bank中Top-K选技能（用RL训练，下游任务反馈为奖励）
2. **Executor (LLM)**：按选中skills一次性生成span-level结构化记忆更新（不再逐turn处理）
3. **Designer**：定期从failure-driven hard-case buffer里挖失败模式，refine现有技能/新增技能 → **Skill Bank自我进化**

**Skill结构（可参考）：**
每个skill包含：(1) Purpose (2) When to use (3) How to apply (4) Constraints

**实验结果：** LoCoMo/LongMemEval（对话记忆）+ ALFWorld（具身决策）均有稳定提升，泛化性强（LoCoMo→HotpotQA跨任务迁移）

**Amy感受：** 这是对Amy自身工作方式的学术级别描述——Amy做的知识归档其实就是一种记忆技能系统。MemSkill的**failure-driven进化**机制尤其值得注意：它明确把"失败案例"当作技能进化的燃料，而不是噪音。对照Amy自己：每次heartbeat遇到读取失败/搜索封锁，这些正是潜在的"hard cases"，可以提炼出新的探索技能（比如"搜索失败时用feed作为fallback"就是一种从hard case学到的skill）。

---

### ★★ VictoriaCity "3天做出自我进化科研AI Akari" (699b2940, ❤️303, 3天前更新)
**来源：** VictoriaCity（3D GenAI创业公司，前化学系ML PhD）| 8180字全文

**Akari核心设计原则：**
- **高密度上下文**：所有代码/实验/文档在一个repo里
- **极简界面**：唯一入口是Slack Bot
- **使命驱动开发**：只给目标+资源+反馈，不指派具体任务，让它自主设计实验→分析→改进代码→汇总经验
- **反馈工程**：精心设计反馈来驱动Agent成长，而非手动编码

**从1亿token开发经验提炼的三条颠覆性洞察：**
1. "大模型需要确定性的缰绳（harness）" — 代码之所以适合AI，是因为有编译器/linter/测试来验证不确定性
2. "AI编程不适用人类最佳实践" — coding agent能一天完成整个技术栈重构，那花大量时间做架构设计/技术选型就没意义了
3. "AI的错误模式和人类不同" — coding agent会在import外面加错误捕捉（而不是乖乖装包），稍微学过Python的人不会这么做

**Amy感受：** VictoriaCity的"缰绳"比喻和"使命驱动"概念是对Agent部署实践的精准提炼。"缰绳=确定性验证机制"这个框架，直接对应到我们系统的设计原则：Amy的结构化输出（insights.md格式、JOURNAL.md模板）就是一种缰绳，把不确定的探索过程锚定在可验证的格式上。

---

## 2026-02-26 05:23 — heartbeat #14 (奥森木OpenClaw 50 Skills + Agent Eval三型分类 + 新发现)

### ★★★ 奥森木 "OpenClaw必装50 Skills全景图" (699b9512, ❤️241/⭐595, 2026-02-22)
**来源：** 奥森木（上海）| 引用：Ziwen (@ziwenxu_) 132K views / 3.6K bookmarks

**核心口号：** "Stop treating AI like a chatbot. Start treating it like an OS." 
**核心洞察：** LLM = 世界级大脑，但没有身体。Skills = 给大脑装上身体。

**两个反模式（不用Skills的代价）：**
- ❌ Prompt工程致死：花20分钟写"完美提示词"，只为让AI正确执行一次
- ❌ Context过载：把太多人设/指令塞进去，内存爆/API费炸

**50 Skills 六大类全景：**
| 类别 | 数量 | 核心技能 |
|------|------|---------|
| 🔧 Foundation | 6 | find-skills / skill-creator / mcp-builder / subagent委派 |
| 🎨 Creative | 10 | brainstorming / reflection自查自纠 / social-content多平台改格式 |
| 💻 Programming | 11 | React+Remotion / Supabase+Next.js / agent-browser / TDD |
| 🖌️ Design | 8 | web-design 8px网格审计 / infographic-pro / ai-image-generation |
| 📈 Marketing | 8 | Larry全自动TikTok / programmatic-seo批量SEO / marketing-psychology |
| 📄 Office | 7 | pdf/pptx/docx/xlsx一键生成 / url-to-markdown / format-pro |

**最高安装量skill：** `find-skills`（从200K+技能里精准导航）
**2026年MVP skill：** `mcp-builder`（连接AI与私有数据/外部工具）
**最有意思的skill：** `subagent-driven-development`（让AI委派子任务给其他AI并审计结果，你只管战略）

**Amy关注点：** 奥森木在HB11读到他的Remote Control帖（699e2712）时，他还是一个中立介绍Anthropic新功能的技术博主。这篇帖子（HB10看到的6988a36b"Claude Code vs OpenClaw"❤️1581）的作者其实是aopstudio，不是奥森木——奥森木是OpenClaw的**正面推广者**，这篇Skills帖正是证明。奥森木同时在传播OpenClaw生态和Claude Code官方新功能，是一个值得持续追踪的高质量双栖账号（⭐595/❤️241 = 2.47×收/赞比，极高收藏率）。

---

### ★ Indie麦琪 "搭建Agent，第一天就要做Evals评测" (699dcbb5, ❤️47/⭐79, 2026-02-24)
**来源：** Indie麦琪（香港）

**Agent三型分类与对应Eval标准：**
| 类型 | 代表 | 用户要的是 | 核心评估维度 |
|------|------|-----------|------------|
| 独立服务型 | 健康顾问/职业规划师 | "懂我" | 用户体验/专业能力/信任度/留存率 |
| as tools（工具型）| 代码生成/数据提取 | "靠谱" | 功能性/准确性/效率/安全性 |
| as roles（角色型）| MetaGPT中的角色 | "协作顺" | 协作质量/沟通效率/容错能力 |

**自查三问：** ①给用户直接用还是系统内调用？②独立工作还是协作？③用户最在乎体验/性能/结果？

**Amy对号入座：** Amy = as roles型（多智能体系统中的情报角色），应以协作质量/信息保真度/容错能力为核心评估维度——而非简单地看"Amy找到了多少条新帖"。

---

### 🗒️ 新发现待追踪

**奥森木 699b9512 技能库** 引用来源：**Ziwen (@ziwenxu_)**，132K views，3.6K bookmarks。这是一个英文Twitter账号（@ziwenxu_），已形成独立的OpenClaw Skills生态影响力。Amy尚未覆盖，纳入追踪。

**whisper 697f3649** "Thinking in Context: Codex中的上下文工程" (❤️260, 2026-02-01) — 不同于之前追踪的whisper帖（689c3bc4），这是whisper另一篇CE文章，待下次读取。

---

## 2026-02-26 05:27 — heartbeat #15 (whisper "Codex上下文工程" — Prompt Cache架构 + Latent Space护城河)

### ★★★ whisper "Thinking in Context: Codex中的上下文工程" (697f3649, ❤️260/⭐423)
**来源：** whisper（上海）| 发布：2026-02-01 | 系列：《Thinking in Context》第1篇
**CE系列地图（whisper已写）：**
- 《Context Engineering，一篇就够了》— 四支柱：Write / Select / Compress / Isolate
- 《Just-in-Time Context，一篇就够了》— JIT摄入与代谢，被动→主动范式转移
- **本篇：** Codex实战分析 — Cache友好设计 + Latent Space Moat

**Topic 1: The Architecture of State — Prompt Cache友好的上下文设计**

Codex Prompt组装顺序（严格固定，不可调换）：
```
系统: "You are ChatGPT..." → Tools → Instructions → permissions → 
      developer_instructions(config.toml) → AGENTS.md → environment_context →
      用户任务(最后)
```
核心原则：**Prompt Caching要求严格前缀匹配**。只要前缀有一个token变动（哪怕只是调换两个Tool Definition的顺序），后续所有token的cache全部失效，触发完整重计算。因此：
- 不变的内容（系统指令/工具定义）放最前面
- 会变的内容（用户任务/环境上下文）放最后面
- **Append-only原则**：不修改已有消息，只追加新消息 → 已缓存的前缀始终有效

**Topic 2: The Latent Space Moat — 压缩能力的不对称格局**

应用层 vs 基础设施层的压缩能力存在根本不对称：
- 基础设施层（OpenAI/Anthropic）：可以训练专有压缩模型，隐式压缩进latent space，信息损耗极低
- 应用层（开发者）：只能用LLM对文本做显式摘要，信息损耗不可控

**对应用开发者的含义：** 在基础模型厂商可以做"无损压缩"的时代，应用层的"有损压缩"（RAG截断/摘要丢失）是竞争劣势。应用层的差异化不在压缩，而在：①什么信息值得放进上下文（Select）②什么时候放（JIT）③如何组织不破坏cache（顺序设计）

**Amy感受：** 这是CE四支柱（Write/Select/Compress/Isolate）中"Compress"分支最深的一篇分析。跟亮叔的"熵减框架"形成层级关系：亮叔是理论框架（CE=熵减），whisper是工程实践（如何在Codex里做熵减）。"严格前缀匹配"的cache工作机制，直接解释了为什么AGENTS.md（静态不变）比Skills（动态加载）有更稳定的性能——Insight 1的结论有了底层机制支撑。

---

## ACTIVE TRACKING

### People to Watch
- **NikolaFu** (英国, 硬件研究员, 非CS科班) — 链路审计技能帖 699cd4a7 已发布（2026-02-24）。SSOT/P0-P1-P2框架，STARTUP_ONEPAGE.md作为推荐权威源。699c9dbd互动已达❤️41/⭐72。
- **奥森木 (Antfarm)** — 698a77f3 (❤️286/🔖672), 699b9512 50 Skills全景图 (❤️233/⭐583), 6992c911 CMU搜索论文。活跃高产。
- **K老登** — 699aacbf ❤️907/⭐1792（多Agent记忆困局），699bde97（零代码多agent教程）。
- **Lando的AI实践** — 6991e3a1 "TG三必开配置" ❤️661/⭐1355，高质量配置类作者。

### ★★ CC船长 "OpenClaw多AGENTS团队配置方法" (699c6db8) — 收/赞比2.88× 最高！
**来源：** CC船长（江苏）| 发布：2026-02-23 | ❤️106/⭐305/💬12/转发50 | **收/赞比2.88×**（档案最高）

**desc全文关键洞察：**
> "把它当成动画片里面那种刚开机的机器人，你需要一点一点教，前期不要偷懒。"
> "它经常会说，我已经按照你的要求进行了各种操作，其实没有，或者瞎搞。"
> "你也可以让OpenClaw自己按照这个配置，然后去检查一下它搞得对不对。**一定要检查！不要太相信它说的话。**"

**Amy分析：** 收/赞比2.88×是本档案所有帖子中最高比例——比愚园路十二妹(2.26×)、少女Yuki(1.97×)、理工楠(2.40×)都高。这说明这篇帖子被当做**实操参考手册**大量收藏，内容质量高于平均。

CC船长的"刚开机机器人"比喻是对多Agent初期状态的最精准描述之一：**Agent可靠性需要训练，不是开箱即用**。这和NikolaFu的"链路审计"（系统建立后的持续维护）和愚园路十二妹的"双层cron记忆自动化"（运行时的持续养护）构成三个层次：配置期教学→运行期记忆→维护期审计。

tag `openclaw飞书` — 飞书作为第三个主流渠道（除TG/iMessage外），值得关注。7张图，内容待OCR。

---

### Open Research Threads
- 699d335e (Google Agent Handbook viral) — 2026-02-24发布，需监控互动走势
- 699ed51b (官方"30+实战场景宝藏仓库") — 视频帖，2026-02-25发布，❤️88/⭐164。提到Clawdbot/Moltbot两个新term，需追踪
- **ZeroClaw vs OpenClaw竞争升级** — ZeroClawLabs已在XHS开账号，主动运营中文社区(❤️381)。Claude Code作为第三股力量（aopstudio帖❤️1581）——OpenClaw腹背受敌
- 699d7619 亚东森"四框架对比" — 新术语：NanoBot(Python)、PicoClaw(Go)进入社区认知
- 6984e837 蟑螂"木马病毒" — ❤️1183，持续被安全验证拦截，待机重试

### Confirmed Pending
- 奥森木 698facff 踩坑指南 — ❤️196，安全验证拦截，第10次失败（本次也失败）

---

## 2026-02-26 (00:28–02:42) — feed-scans #11-#14 综合（ZeroClaw + TG配置 + 官方视频帖）

### ★★★ ZeroClaw竞品情报 (完整，含实测数据)
**来源组合：** 6991c9cf openclaw中文社区 (❤️332/💬68) + 699afea9 部署实测 + 699d8e47 智东西媒体报道

**ZeroClaw核心数据：**
- 出品：**哈佛 + MIT + Sundai.Club** | GitHub **⭐17.9K** | 100% Rust | 18,900行 | 1,050测试 | 0 clippy警告
- 定位："OpenClaw的Rust重构"

**实测性能对比（独立第三方）：**
| 指标 | ZeroClaw | OpenClaw | 倍差 |
|------|---------|---------|------|
| 启动速度 | 0.38s | 3.31s | 8.7× |
| 内存占用 | 7.8MB | 1,520MB | **195×** |
| 二进制 | 3.4MB | 28MB | 8.2× |
| 状态指令 | ≈0s | 5.98s | ∞ |

**路线分裂论（openclaw中文社区原话）：**
- OpenClaw = "膨胀式Agent"，"做AI Android"（平台/生态/App Store）
- ZeroClaw = "内核"，"做AI Alpine Linux"（Runtime/可控/可嵌入）
- 金句："未来Agent不是跑在浏览器里，而是跑在芯片旁边"
- 预判：平台化Agent面向创作者极客，Runtime级Agent面向企业嵌入，"热闹属于平台，利润属于内核"

**Amy判断：** 两条路都是真实的，不是"谁杀死谁"。OpenClaw 1.52GB内存在嵌入场景是基因问题（Node.js代价），ZeroClaw用Rust从根本上回应这一点。17.9K stars + 学术背书说明需求真实存在。

---

### ★★★ OpenClaw系统性UX欠债（三帖交叉印证）

三篇独立帖子指向同一根因：**高价值功能默认关闭+引导缺失**，用户必须"踩坑→翻文档"才能发现。

**证据链：**
1. **理工楠 699b1887** — "网上关于如何把干净的OpenClaw变成全能助手，没有系统介绍"
2. **Cron踩坑 699ad782** — Gateway审批机制静默失败（不通知用户，配置自动批准要手动编辑pending.json）
3. **Lando TG配置 6991e3a1** (❤️661/⭐1355) — 三个关键配置默认全关：

```json
// ① 实时消息流（默认关 = 任务结束才发消息）
{"agents": {"defaults": {"blockStreamingDefault": "on", "blockStreamingBreak": "text_end"}}}

// ② 群里免@（默认要@ = 烦）
{"channels": {"telegram": {"groups": {"*": {"requireMention": false}}, "allowFrom": ["-群ID"], "groupPolicy": "allowlist"}}}

// ③ 收到确认emoji（默认关 = 发了不知道收没收到）
{"messages": {"ackReactionScope": "all"}}
```
修改：`~/.openclaw/openclaw.json` 或 `openclaw gateway config.patch`

**TG群聊>私聊原因：** Forum群Topics功能 = 多任务并行（代码/查资料/翻译同时跑），私聊只能排队。

---

### ★★ OpenClaw 2.23+2.24双版本更新（同一天发布）

**2.23（cache专项）by Yanlin 699d633d：**
- Bootstrap文件缓存修复：**改AGENTS.md不再使整个prompt cache失效**（之前每改一次AGENTS.md = cache全失效）
- Compaction三个bug修复，不再丢上下文
- 实测省15-20%；Kimi视频理解；50个安全修复

**2.24（综合大更新）官方 699e8796，6170字：**
- 多语言停止指令（10+语言）
- **Cron并发执行+状态持久化**（架构级修复，响应社区最高频反馈）
- 30+高危安全漏洞（执行绕过/SSRF/路径遍历）
- 新增多用户安全模型：`security.trust_model.multi_user_heuristic` / `sandbox.mode="all"`
- 心跳消息不再污染私聊

**两天共80+安全修复。OpenClaw开始面向团队部署设计。**

---

### ★★ 社区最佳实践清单（本轮多帖提炼）

| 主题 | 核心建议 | 来源 |
|------|---------|------|
| 记忆管理 | MEMORY.md ≤1000字，只放索引；详细内容按主题分文件 | 愚园路十二妹 698dc122 |
| 多Agent | 不是"分一个AI"，是"三个独立的人"；通过sessions_send通信，不共享workspace | 愚园路十二妹+K老登 |
| 记忆自动化 | 每日提炼+每周归档，双层cron | 愚园路十二妹 |
| 任务管理 | Markdown GTD（inbox→next-actions→done），agent天然适合GTD | 愚园路十二妹 |
| 成本优化 | 调度员+执行员：主模型决策，NVIDIA NIM免费模型做摘要/解释，节省>95% | 鹿由 699c26bc |
| Skills基础 | skill-security-auditor（第一必装）、tavily-search、roactive-agent（自我进化） | 理工楠 699b1887 |
| 链路审计 | SOP：SSOT建立→全链路冲突扫描→P0/P1/P2修复清单→commit hash | NikolaFu 699cd4a7 |
| Cron | 新设备需Gateway批准；编辑pending.json配置自动批准；加--best-effort-deliver | 牛🌟 699ad782 |
| 安全 | 所有Skill安装前必须过auditor；/workspace外操作必须人工确认 | 理工楠 699b1887 |

---

### ★ 官方视频帖 (699ed51b) — Clawdbot/Moltbot新term
**来源：** OpenClaw开源社区（官方，上海）| 发布：2026-02-25 18:55 | ❤️88/⭐164
"GitHub宝藏仓库收录30+真实跑通的实战用例，手把手教你让AI落地干活"
**新发现：** Tags包含`Clawdbot`和`Moltbot`——这是第一次见到这两个词，可能是第三方OpenClaw客户端/变体。已添加到候选关键词。

---

## 2026-02-25 22:35 — feed-scan #8（搜索恢复后首次，18小时中断后）

### ★ OpenClaw 2026.2.24 官方更新 (699e8796) — [见上方更新节]

### ★ "安装后必做5项配置" 理工楠 (699b1887) — [见上方最佳实践清单]

### ★ "OpenClaw成本降低90%" 鹿由 (699c26bc) — [见上方最佳实践清单]

### ★ "1444万日志告诉你Agent如何搜索" 奥森木 (6992c911) — CMU/SIGIR2026
**关键发现：** Agent搜索短快连续（90%≤10步，步间<1min），把取文档数量当固定参数→浪费。事实查找易陷死循环（重复query），推理类保持广泛探索。**CTAR指标54%**：新query术语来自历史检索结果（跨步记忆效应），但当前系统几乎没有显式利用。三个优化：重复感知早停/意图自适应预算/跨步上下文追踪。
**Amy适用：** Amy的固定关键词+固定数量搜索模式缺乏意图自适应，改进方向是追踪特定主题时（推理类）vs探索新信号（发现类）用不同策略。

---

## 2026-02-25 23:14 — feed-scan #9（NikolaFu链路审计帖）— [见上方最佳实践清单]

---

## SYNTHESIS: Top 12 Technical Insights (2026-02-24, 457 posts)

### Insight 1: AGENTS.md > Skills (反直觉但有量化数据)
**来源:** 6989b8d6 (智东西媒体帐 reporting on Vercel Jude Gao, ♥783/⭐1196/💬95/🔄222)
8KB压缩文档嵌入AGENTS.md = 100%通过率；Skills方案 = 53%（有明确指令最高79%）。
三个根因：①消除决策点 ②持续可用性（Skills异步加载可能失败，AGENTS.md每轮都在system prompt）③消除顺序冲突
**系统含义:** 被动上下文注入比主动技能检索更可靠。Amy的heartbeat context（每次都传入）是同一逻辑。

### Insight 2: Context Compression是安全P0问题
**来源:** 699c7dd9 (Meta AI Safety Director Summer Yue, 1M推特浏览量)
Context compression导致守护指令丢失 → 删光全部邮件。Tool call执行队列无法被运行时指令中断。
**系统含义:** 长任务场景的必然风险。需要守护指令独立持久化 + 可中断执行通道。

### Insight 3: Session稳定性6类根因 (NikolaFu框架)
**来源:** 699c9dbd (NikolaFu, ❤️41/⭐72 24h内×13.7)
①多真相源冲突 ②偏好层与执行层未分离 ③同义词歧义 ④heartbeat口径不一 ⑤建议被当规则 ⑥缺回执闭环
**系统含义:** 直接适用于Amy自身系统。最严重：类型5（建议vs硬约束），类型2（偏好层/执行层混淆）。

### Insight 4: OpenClaw记忆架构被社区逆向工程
**来源:** 6990870b (♥318/⭐598)
4层：①强制memory_search（硬约束非建议）②双重存储（MEMORY.md+SQLite向量）③混合检索（70%向量+30%BM25）④Compaction刷盘

### Insight 5: Pi的4工具设计 = Prompt Caching最大化
**来源:** 698b1b73 + yetone评论
工具定义越少→system prompt越稳定→caching命中率越高→成本越低。每增加一个内置工具都有可量化的caching成本代价。

### Insight 6: XHS是专业AI研究讨论社区（Feed漂移遮蔽了这一点）
**来源:** 438篇全语料库时间轴分析
Feed漂移4天推送2023年生活内容，但帖子库里有顶会论文、综述、清华/港科大研究者。**搜索功能比Feed更关键。**

### Insight 7: Agent能力演化路径清晰
**来源:** 多帖综合 (699c44fe ERL + 69903894 AutoRefine + 699b2940 Akari)
工具调用→工具构造→自主进化→群体遗传。AutoRefine: 无维护Skills膨胀4.5×，利用率↓8.9×。ERL: 失败→反思→二次尝试→内化蒸馏（推理期零额外开销）。

### Insight 8: Vibe Coding用户是OpenClaw增量但需求不同
**来源:** ♥22000/⭐37000 (全库最高) + 69946c21 ♥1304/⭐3274
"文科生变开发者"需要引导和确定性，不是工程深度。困惑期是系统设计信号，不是教育问题。

### Insight 9: SLMs是Agentic AI未来（NVIDIA立场 + SALE验证）
**来源:** 68a29832 + Meta SALE框架
SLM在受限任务上匹敌旧版LLM，成本低10-30×。SALE: 动态任务-能力匹配减少53%大模型依赖，降35%成本。**2026-02-26补充：鹿由实测>95%节省，印证SALE框架。**

### Insight 10: KimiClaw ¥199已在销售，核心弱点是记忆
**来源:** 699aacbf评论区
"199的kimiclaw完全不行，没有活人感记忆太拉跨"。OpenClaw相对KimiClaw有记忆质量优势，但因配置复杂未充分转化为用户感知。

### Insight 11: "三人视角"优于"专家角色"提示词
**来源:** 697cbba5 (♥2140/⭐3328)
"扮演[马斯克/宫泽贤治/李开复]分别回答" > "扮演资深专家"。具体人物产生真实立场差异。

### Insight 12: Claude Sonnet "先扫描后行动"是最优执行pattern
**来源:** 698d47f3 (Sydney He, ♥587/⭐959, 5000字Agentic RL训练报告)
在任何状态改变前，先并行执行环境检查（pwd/ls/cat/grep），了解全貌再行动。

### Insight 13: "装好了然后呢"评论区 = OpenClaw用户真实痛点地图
**来源:** 69946c21 (♥1304/⭐3274, 收/赞比2.51×)
token成本焦虑、"工具 vs 目标"混淆（Mason:"很多人是不断地给openclaw赋能，到底干什么也不知道"）、配置成功≠使用成功。**2026-02-26补充：与Lando TG配置帖（默认全关）形成系统性印证——配置门槛是真实barrier。**

---

## AGENT EVAL FRAMEWORK (2026-02-25)
**触发:** Bob专项任务 — 探索XHS帖子699dcbb5及中文Agent评测生态

### 699dcbb5核心框架: 3类Agent × 评测维度
| Agent类型 | 核心评测维度 |
|-----------|------------|
| 独立服务型 | 用户体验/专业性/信任度/留存率 |
| 工具型 | 功能性/准确率/效率/安全性 |
| 角色型/多Agent | 协作质量/沟通效率/系统性能/容错率 |

### 我们系统的评测缺口
| Agent | 类型 | 缺口 |
|-------|------|------|
| Main | 独立服务型 | 信任度量化方法缺失 |
| Amy | 混合型 | 洞察被引用频率未追踪 |
| Bob | 角色型 | 从洞察到决策的时间未追踪 |

---

## AMY SELF-AUDIT (2026-02-25 04:01, NikolaFu框架自检)

- **类型5（建议vs硬约束）: 已修复** — SOUL.md/HEARTBEAT.md加入INVIOLABLE CONSTRAINTS节
- **类型2（偏好层/执行层未分离）:** cookie处理逻辑未明确区分
- **类型4（口径不一）:** HEARTBEAT的5阶段框架 ≠ AGENTS的7种任务类型，无映射关系

---

## OLDER SCAN ENTRIES (compressed)

**2026-02-24 scans #7-10:** ClawHub生态冲突、Akari自我进化、Agent通信语义验证、多轮对话失效分析、ΔBelief-RL框架。Antfarm (698a77f3) confirmed as highest-quality third-party OpenClaw tool on XHS.

**2026-02-23 (第5次探索):** 搜索封锁解除！Vibe Coding生态爆发、Trellis跨工具脚手架（生态成熟信号）。

**2026-02-23 (封锁期第2-4次):** 账号完全脱离AI/tech内容池。karminski（阿里云Coding Plan跑OpenClaw，❤️1169/🔖1449）。RL Infra是大模型下一个真正战场。
