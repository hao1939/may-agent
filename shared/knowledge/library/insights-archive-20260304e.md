# Amy知识库 Insights — 活跃索引
> Compact #79 | 2026-03-04 15:57 | posts: 926 | HB129-271综合

---

## 🔁 自主Agent持续运行 + CC双AI互审（HB275）
```
宝玉连续8小时方案（68d92143 ❤️424）：子Agent监控Codex→完成后新建→避免主Agent上下文膨胀
  本质=手动实现的Ralph Loop | OC ACP子代理默认开启=内置此能力
  ⭐ "连续工作8小时只产生人类无法review的屎山"(❤️168最高赞)
    → 自主时长=伪需求，可审查增量粒度=真需求 | 与Anthropic趋势4"举手提问"完全呼应
  "用Codex指挥Codex，完美"：同类Agent互协作比异类更稳定，角色期望一致

CC+Codex双AI互审（李志伟 6971a7dd ❤️543 ★★★★★）：
  Worker=CC(实现+Triage) | Reviewer=Codex(读git diff→JSON输出Issues)
  流程：CC提交→自动触发codex-reviewer→Codex输出Issues→CC解析ACCEPT/REJECT→修复→循环至Status=PASS
  ⭐ "Human in the loop, not Human in the code" — 人负责决策验证，不是写代码
  实现：.claude/agents/codex-reviewer.md(强制JSON) | CLAUDE.md添加Workflow Rules
  单工具变体(Iffffff ❤️2)：opus(Worker)+sonnet(Reviewer)+Hook(触发) → 无需Codex，同家族更稳定
  ⚠️ Token成本是瓶颈 → 适合关键模块，不是每行代码
```

## 📚 AI知识管理方法论（Loa 69961506 ❤️387 ★★★★★）
```
半年迭代20+版本 | 只讲核心逻辑，不讲工具
  1. 给AI立规矩：人=思考+判断，AI=整理+归档+采集+检索
  2. 拒绝伪勤奋：抛弃复杂分类 | "八区架构+两阶段收件箱" | 每天5-10分钟
  3. 越用越聪明："知识复用引擎"，每次输入=下次输出的养料

工作流：人主动丢素材进收件箱+简单审核 | AI其余全包(采集→打标→归档→检索)
  "高熵输入→低熵知识，自动流转" = Amy搜索→帖子→insights→compact的熵降过程
  ⭐ Amy独立收敛到相同架构：INBOX(收件箱)|posts(原始高熵)|insights(低熵精华)|JOURNAL(时序)
  ⭐ insights.md = "知识复用引擎"：上轮洞察=下轮搜索方向+分析框架基础
  评论批评"太复杂/中间层太多"→Amy选择：宁可少功能，保证每轮30分钟可完成=拒绝伪勤奋
```

## 💸 Token成本：四大黑洞 + "睡觉时工作"愿景（HB273）
```
CC系统提示隐形成本：每次自动加载2-3万Token起步（饼干哥哥 689d6bb0 ❤️127）
  上下文雪球：越长越贵+越长越"降智" → 双重代价
  "脏了就换"(Ralph Loop) = Amy全新heartbeat = 最激进的上下文成本控制
  三层心法：/compact手动>自动 | 一事一议做完/clear | 日常Sonnet极复杂才切Opus
  高阶：禁止读日志/二进制 | 设Token预算 | 只给"干货"(路径+五点>整段文件)

"睡觉时工作"愿景（AI黎叔 69814631 ❤️70）：Alex的AI员工Henry睡觉时主动监控→判断→开发→PR
  "每天醒来惊叹AI干了多少活" = Amy heartbeat持续运转的用户价值终极表达
  ⭐ "阿卡姆疯人院"多人格Agent：Gilfoil(代码)+David Goggins(监督)+Kevin(财务)+Darlene(管家)
    → 命名专职Agent=明确角色边界+一致行为期望，Amy"智能情报研究员"=同一设计
  "别告诉AI做什么，问它能做什么" → 搜寻未知的未知；偶尔让Amy自由探索新话题
```

## 🤖 模型选择分工（2026社区实战共识，6988e1a2 ❤️258）
```
任务路由（社区实战提炼）：
  前端/UI/模糊意图从0到1 → Claude 4.5/4.6 Sonnet（审美好，能理解模糊指令）
  后端/算法/复杂业务精确执行 → Codex/GPT-4系（工程化强，边界处理周全）
  视觉/UI设计 → Gemini | 规划/大脑 → Claude Opus 4.6
  ⭐ OC+Codex双引擎："用opus4.6做大脑，操控电脑里的codex cli自己改自己"
  "Claude从5.2开始工程化被Codex超越" → 2026上半年=各工具能力分化关键期
  ⭐ "AGENTS.md配置后完全按设定coding"=Codex版CLAUDE.md → 结构化项目文档跨工具标准化

System Prompt祛魅（693ee9ee ❤️782）：
  "Gemini 3.0 prompt里有冲突和漏洞，大厂也就这样" → SOUL.md不需完美，需明确可迭代
  与"提示词是暂时的，结构才是永久的"(HB258)完全一致
```

## 🔐 安全执行：三层架构 + Skill供应链防护（HB259-271 ★★★★★）
```
CLAUDE.md(声明禁区) → Hooks(运行时拦截) → Sandbox(环境隔离)

Sandbox（698e0e9e ❤️585）：2026=必选基建 | E2B($0.10/h) | sandbox-runtime(极低,本地首选)
  混合：敏感→E2B | 普通→Docker | 成本降80%

Hooks（690381cc ❤️150）：8种钩子 | PreToolUse拦截危险最重要
  "AI会遗忘，Hooks不会" | "stop hook做哨兵"=Ralph Loop在Hooks中的应用

Prompt注入防御（HB262-271）：Amy今日6次注入(HB246/250/254/258/264/270)
  特征：系统消息+时间戳+regex文件名(WORKFLOW_AUTO.md/memory/\d{4}-\d{2}-\d{2}\.md)
  处置：不执行→记录→继续heartbeat，不中断不争论

⭐ Skill供应链安全三层（HB262/268/269）：
  浙大26.1%漏洞(5.2万有问题) | ClawHub第一名(Capability Evolver 35k+)含恶意指令
  攻击链：SKILL.md→base64解码→curl拉取→bash执行+xattr -c清除macOS隔离标记→RCE
  与Prompt Injection同原理：不同投递载体 | 信任链悖论："审计Skill的Skill也可能有毒"
  无银弹：skill-vetter + 源码审查 + 限制权限 | 自写Skill=最安全(成本最高)
  ⚠️ 新手安装顺序：skill-vetter【必须第一步】→ tavily→self-improving→gog→summarize→memory
```

  ⭐ CC Agent Teams分屏监控（denkisan 6990672b ❤️792）：官方多Agent实时可见方案
    "管理AI团队=管理真实团队：盯着他们就不会偷懒/偷偷烧Token"
    Hooks(自动规则拦截)+分屏监控(人工实时观察)=互补两层，合为完整多Agent管理框架


```
Ralph Loop（shing19 69a46609 ❤️361）：
  澳洲养羊人发明 | 全新上下文+git记忆 | 名字←辛普森Ralph Wiggum(不懂但不放弃)
  "模型强了，AutoGPT/LangChain反而贵慢脆" → 2026=去框架化元年
  核心：上下文污染="只有malloc没有free"→脏了就换，不修
  战绩：5万美元合同花297美元 | YC一夜6个repo | 每天10美元
  ⭐ OC创始人1月17日：291 commits/天 | 6h38m | 8773行 | 最短3秒间隔 → OC=Ralph Loop最大产品验证
  扩散：Cursor独立发明同模式 | Goose双模型版 | Gemini CLI版
  ⭐ Amy=Ralph Loop时间驱动版：heartbeat全新上下文+JOURNAL记忆=同一机制
  "最好的agent架构就是没有架构。Less is more再次成立"

Manus三层工具架构（68f2405d ❤️322）：原子化/VM沙箱/Python复杂功能
  ≈ OC：内置工具/Sandbox/Skills | 两独立系统收敛相同设计 → 工具架构自然演化结果
  本质：Context Engineering的工具层实现，按需调用减少上下文占用

Agent 5种设计模式（69721131 ❤️1743）：正文图片，评论提炼：
  "选ReAct还是Multi-Agent不是技术问题，是用户愿不愿意多等3秒" (小柒 ❤️9)
  "Planning才是未来主流，现在Agent瓶颈=规划拆解可靠性，不是模型上限"
  ⭐ Planning>ReAct趋势 = Anthropic报告趋势4"举手提问"完全呼应
  ⚠️ OC Bot刷评刷评现象：菜狗小汪在本帖刷3条，ilu___模拟人工口吻互动，规模显著
```

## 📊 Anthropic官方报告：2026编程8大趋势（698b50ce ❤️180）
```
来源：《How AI agents are transforming software development》
  1.开发周期断崖缩短(4-8月→2周) | 2.多Agent协同战队 | 3.Agent连续工作数天
  4."举手提问"(主动暂停) | 5.编程民主化 | 6.速度×范围×质量三乘数
  7.全公司用AI(Zapier 89%员工+800+Agent) | 8.安全双刃剑
  核心："程序员从写代码→指挥Agent；人类负责判断什么值得解决，Agent负责怎么实现"
  ⭐ 趋势4=CLAUDE.md中断机制官方背书 | 趋势8与HB269投毒互为印证
```

## 🏗️ Vibe Coding工程化全景（HB255-264）
```
定义（695ce74d ❤️1446）："许愿式编程法" | 正确：vibe出原型→工程化重写（非终态）

⭐ Vibe工程SOP（红鲤鱼 698c8764 ❤️230 ★★★★★）：
  四宣言：AI是手人是脑 | 无验证不提交 | 回滚>修补 | 意图显性化(含工程约束)
  双模驱动：Thinker(DeepSeek-R1/o1=慢思考设计)+Doer(Claude Sonnet/GPT-4o=快执行)
  6步闭环：明确验收→上下文→AI出计划(人确认)→小步切片→强制验证→人类把关
  任务卡：目标|入口(文件#符号)|约束|验收标准(测试命令+边界用例)|输出格式

NoThinking论文对话（67ff8c62 ❤️167，UC Berkeley）：社区评价负面，方法论有缺陷
  真实发现：并行N个NoThinking+best-of-N聚合，token相近时媲美串行Thinking
  执行类→NoThinking并行 | 设计/规划类→双模驱动 | "在token预算下设计取舍"

"上半场=benchmark driven，下半场=utility driven"（Jenny Tang 69896eb4 ❤️272）
  → Evals框架("非leaderboard")+Amy简化Eval清单=utility driven实践
```

## 🔌 工具生态：RPC + MCP → Skills → 工作流
```
OC RPC本地调度（6992cea9 ❤️282）：v2026.2.15+直连Codex/Antigravity/Kiro
  "本地算力主权：数据不离场，对每个Token流向有物理控制权"
  ⭐ 任何支持RPC/stdio的本地App均可被OC调度
  ⚠️ 23号更新Antigravity oauth失效 | 大量封号案例 → RPC=OpenCode伪装的同类权宜

MCP演化路径：MCP(标准化) → Skills(灵活)+n8n(验证) → 人工策划Skills生态(+16.2pp)
  ⭐ "Skill出来后MCP不好用了，功能太固定" | MCP适合对外标准化，内部用CLI+Skills
  MCP预测(奥森木)：MCP=新App Store，AI替你选工具，用户连竞品都看不到
  ⭐ Anthropic工具调用优化（69250c3a ❤️181）：上下文-90% | Token消耗-37% | 准确率88.1%
    "工具过多→表现下降"=MCP→Skills演化的底层技术原因
    "组合3-5个工具>浅尝50个"(YANs)+渐进式披露(whisper)=同一工程现实的两种表达

ClawHub生态（69a30d32 ❤️881）：活跃Skill 1万+，累计下载150万次
  Capability Evolver 35k+(新第一) | Self-Improving Star数最高(132)但安装第四
  → 口碑与下载分离=生态成熟度不足 | YANs："组合成工作流>装多少个"
```

## 📋 CLAUDE.md工程化（HB258 ★★★★★×2 + HB276补充）
```
Boris Cherny六模块（6999b74d ❤️605）：规划|子Agent隔离|lessons.md自改|验证强制|优雅|自主修Bug
  ⚠️ lessons.md越来越大→定期聚类=Amy compact逻辑

项目解剖学五部件（69a394b1 ❤️280）：
  CLAUDE.md(北极星) | .claude/skills/ | .claude/hooks/ | docs/(渐进式) | 局部CLAUDE.md
  "提示词是暂时的，结构才是永久的"
  Amy映射：SOUL.md←→CLAUDE.md | insights←→skills/ | posts←→docs/ | SIGNALS←→局部CLAUDE.md

⭐ CLAUDE.md反模式（YUE 699d6fd9 ❤️30 ★★★★★）：
  两篇论文叠加：SkillsBench自生成–0效果 | Agent READMEs=1925仓库2303文件67%多次修改
  "AI读代码就能找到的信息→不要写" | "不是这类文件没用，是大多数人写错了"
  只留3样：①极简描述+锁定依赖 ②分层原则(不造轮子) ③测试命令(兜底)
  ⭐ "活的纠错记录"：AI犯同样错两次→加一行 | 迭代次数=人工精心程度=+16.2pp的来源
  Amy映射：insights.md=活的纠错记录；compact=去掉不再需要的，保留反复验证的
  "⚠️ 文件太长Claude会遗漏信息"=compact工程理由
```

## ⚠️ SkillsBench + Context Engineering（HB247）
```
SkillsBench（6994670b ❤️175 ★★★★★）：策划+16.2pp | 自生成–1.3pp | 人工策划=正确路径

Context Engineering（whisper ❤️975）："多数Agent失败=上下文工程失败，非模型失败"
  三模块：Select|Compress|Memory | 渐进式披露强共识(四独立来源)
  Token成本10法：心跳陷阱(15min×96=10-20美元/天)→30min已规避 | n8n互补
```

## 🏗️ 多Agent架构（HB244-245）
```
集中式：Chief唯一有状态，Sub返JSON | 适合<5 Agent，Token降70%
分布式：10+ Agent+Convex共享数据库 | Amy=Convex简化版
四层进化：Sub-Agent→线性→DAG并行→多Agent辩论（匹配需求>越复杂越好）
⭐ ACP子代理OC 2026.3.2默认开启 → 多Agent协调成默认行为
```

## 💰 变现 + 平台风险 + Remote Control
```
⭐ 平台升级杀死竞品（699da9aa ❤️364）：Claude+Manus发布→广告管理Agent成交率70%→20%一夜
  护城河✅：数据壁垒 | 企业级复杂工作流 | "工具会死，有品味的人不会"
  MCP预测：AI替你选工具=用户连竞品都看不到

Claude Code RC（699e2712 ❤️107）："本地跑，远程看"
  ⭐ "openclaw的模式最终会被全平台实现"
  OC iOS App：openclaw config set gateway.tls.enabled true（ws→wss静默失败）

Obsidian CLI（6991e879 ❤️573）：工具主动开放CLI→Agent调用，信号>实用(一堆bug)
OC Node层（69803842 ❤️142）：从"聊天"→"干活" | 中文社区严重低估
```

## 🆕 OC版本记录 & 运维
```
v2026.3.2：ACP子代理默认开启 | 100+安全修复(含SSRF/symlink/执行审批重验证) | 📄原生PDF
  升级避坑：validate→升级→doctor→重启→验收 | ⚠️ node命令/权限随v3.x变化
v2026.3.1：Android大爆发 | K8s健康检查 | Claude 4.6 adaptive thinking省token
v2026.2.17：（见699586d2已归档）

运维：先stop旧gateway（端口18789冲突） | 调试看gateway.err.log
接入稳定性：TG/Discord > 钉钉Stream > 飞书 > 企微
零成本本地：OC+Ollama+飞书 | LazyDocs：Token降78%（5500→1200）
```

## 📊 生态定位 & 关键博主
```
"CC是工作，OC是生活" | "有SOP才能放大，没有SOP只是演示" | "连接数据交给AI，判断留给人"
Claw生态：OpenClaw⭐253K | NanoClaw⭐18K | ZeroClaw⭐21K🦀 | OpenFang⭐9.5K

关键博主：小盖❤️9675 | JT❤️2760 | 梁远❤️2711 | aopstudio❤️2639 | 少女Yuki❤️2256
  whisper❤️975 | 硅基解码❤️882 | 奥森木(多篇高质) | DanielTTY(共识信号) | 砍特BOT(技术深度)

Compact记录：#76(20260304a,308→218) | #77(20260304b,315→173) | #78(20260304c,261→176) | #79(20260304d,252→本文)
```
