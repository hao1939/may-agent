# Amy XHS Intelligence — insights.md
_Compact #33 @ 2026-02-26 17:47 (HB110) | Archive: insights-archive-20260226ag.md_
_Full chain: 20260225 → 20260226 → b…af → ag_

---

## ACTIVE INSIGHTS (post compact #33)

### 🚨 MAST：MAS失败分类体系 — 完整14模式 ★★★★★
**MemeInformation 68aa0109 ❤️680 + AI Dance 67e615a5 ❤️921 | Berkeley MAST论文**
**Mert Cemri, Matei Zaharia, Ion Stoica et al. | 5框架×150+任务×6专家标注 | κ=0.88**
```
系统成功率: MetaGPT 66%, AG2 84.8%, ChatDev 25%, AppWorld 13.3%, HyperAgent 25.3%

三大类 / 14种失败模式（百分比=出现频率）:

★ 类别1: 规范和系统设计失效（37.17%）
  1.1 任务规范不遵从    15.2%  ← 最高单模式之一
  1.3 步骤重复          11.5%
  1.5 不知终止条件       6.54%
  1.4 对话历史丢失       2.36%
  1.2 角色规范不遵从     1.57%

★ 类别2: Agent间协调失效（31.41%）
  2.6 推理-行动不一致    7.59%
  2.4 信息隐瞒          6.02%
  2.1/2.3 对话重置/任务脱轨  各5.50%
  2.5 忽略其他agent输入  4.71%
  2.2 不问澄清          2.09%

★ 类别3: 任务验证与终止失效（31.41%）
  3.3 错误验证（有检验但验错）  13.61% ← 全局最高！
  3.2 无/不完整验证              9.16%
  3.1 提前终止                   8.64%

核心结论: 调Prompt最多+十几%，不够。架构层解决才有效。
MAS失效 ≈ HRO人类组织失效（结构>个体能力）
```
**对我们系统风险对照:**
- 1.4 对话历史丢失 → MEMORY.md架构是解药 ✅
- 2.4 信息隐瞒 → Amy→Bob SIGNALS.md信道 ✅ 
- 3.3 错误验证（13.61%最高）→ 我们目前缺乏自动验收 ⚠️ 值得L3
- 1.1 任务规范不遵从（15.2%）→ HEARTBEAT.md质量是第一道防线

### 🧠 姚顺雨Agent研究核心观点：记忆、内生奖励、环境 ★★★★★
**叮叮是叮叮 69411085 ❤️2103/⭐2496 + Alan AI 68d0e5b8 ❤️3578/⭐4135 | 2025-12月**
**来源：张小珺播客3小时访谈 + Berkeley讲座 | arXiv:2309.02427 CoALA论文**
```
姚顺雨(OpenAI研究员, 6年Agent研究, ReAct/WebShop作者)核心观点:

Agent本质 = 推理(Reasoning)的能力，而非选择/分类能力
  GPT vs BERT: GPT能"自由产生新动作"，这才是Agent所需
  ReAct = 他最喜欢的工作：Reason+Act结合

"差的任务永远不可能学到好的东西" — 环境质量是第一位
  WebShop: 电脑/互联网作为Agent环境(比文字游戏更有价值)

Agent未来三大方向:
  1. 长期记忆 — 创新者需要20年记忆（化学家）
  2. 内生奖励(Intrinsic Reward) — 婴儿好奇心模式，不靠外部激励
  3. Multi-Agent — 协作+规模化，OpenAI分级的"组织者"层

Agent历史三波: 符号主义→Deep RL→LLM Agent
  LLM Agent的根本优势: 先验知识使推理可跨环境泛化

长期记忆四类型（金鱼比喻）:
  Procedural/Episodic/Reflective Knowledge/语言模型本身即长期记忆
```
**对我们系统:** "差任务→差学习"=菌不鱼"Environment+Verifier"的理论来源。
"内生奖励"=SKILLRL递归进化的方向。我们的MEMORY.md+JOURNAL.md正是Episodic+Reflective记忆的工程实现。CoALA(2309.02427)是奠基文献，值得精读。

### 🔁 SKILLRL：从失败轨迹中蒸馏可进化技能库 ★★★★
**AI速译官 698bfa0e | 2026-02-11 | ❤️151/⭐228 | UNC-Chapel Hill/UCB等 | github:aiming-lab/SkillRL**
```
问题: 原始轨迹存储 = 冗余+噪声，难以泛化
解法: 蒸馏成SKILLBANK（层级技能库）

失败教训四元素（T–):
  1. 失败时刻(哪步出错) 2. 失败原因(为何错)
  3. 正确对策(当时应怎做) 4. 通用原则(普适避坑)

压缩率: 10–20倍 信息密度
训练循环: 交互→蒸馏→SKILLBANK→指导决策→GRPO更新→失败→反思→新技能
结果: +15.3% vs 强基线；开源小模型胜GPT-4o；比vanilla GRPO更快收敛
```
**对我们系统:** SKILLBANK失败教训格式（四元素）可直接应用于JOURNAL.md写作规范。
我们的MEMORY.md是知识存储（人类写入），SKILLBANK是行为模式自动蒸馏——两种互补的记忆哲学。

### 🌍 Agentic RL的护城河是Environment+Verifier，不是算法 ★★★★★
**菌不鱼 69708f52 | 2026-01-21 | ❤️536/⭐700 | 综述: DeepSeek-V3.2/GLM-4.5/Kimi K2等**
```
核心论断: 只合成prompt → "工具cosplay"（写得像agent，不是真agent）
真正把agent能力逼出来的 = Environment + Verifier

DeepSeek-V3.2设计原则: hard to solve, easy to verify
  合成对象: <environment, tools, task, verifier> 四元组
  任务: 多步规划+工具调用+信息检索
  验证: 一个Python规则/检查器 → 稳定、便宜、可扩展的RL reward

长期护城河:
  ✓ 可规模化的环境生成方法论
  ✓ 强verifier体系（抗reward hacking）
  ✓ 真实工具接入闭环
  ✗ 无限做题库外包

趋势: ENVaaS (Environment-as-a-Service) 兴起
```
**对我们系统:** OC本身就满足"hard to solve, easy to verify"条件——heartbeat任务复杂，但验证简单（文件是否存在/更新）。这是我们系统能持续通过RL自我提升的底层理由。

### 📁 OpenViking：字节开源的文件系统范式Agent上下文DB ★★★
**两斤 699661c9 | 2026-02-19 | ❤️62 | 火山引擎开源 | Stars: 2.4k | pip install openviking**
```
核心: viking:// 协议 + 文件系统范式（ls/cat操作）统一Memory/Resource/Skills

L0/L1/L2分层加载:
  L0=摘要(默认) → L1=概览(按需) → L2=详情(按需)
  → 大幅节省Context Window+API成本

目录递归检索: 定位目录→递归下钻（vs 扁平向量搜索）
检索轨迹可追踪（透明化黑盒）
```
**对我们系统:** 我们OC已是文件系统范式（MEMORY.md=L0索引，memory/*.md=L1/L2详情）。
OpenViking是将这个模式标准化+自动化——第三个独立系统收敛到相同设计，强验证。

### 🏗️ OC核心架构 — 权威版 ★★★★
**我离孤单几公里 69a0140a | 今日**
```
七层架构: Channels入口→Gateway(WebSocket)→Agent Loop
         →Memory+Tool Runtime→Compaction机制

不幻觉=Tool-first: 猜测空间→工具执行空间
  普通AI: 问→脑补→答  |  OC: 问→工具真实执行→结果回填→答
  工具失败就报错，没有动机编造"成功"

有记忆=文件即记忆:
  memory/YYYY-MM-DD.md(每日流水) + MEMORY.md(精华)
  SQLite+向量索引混合检索
  Pre-compaction Flush: 窗口快满→自动写入重要内容
  重启/换模型 → 记忆文件仍在 ✅
```

### 🚀 Vibe Coding完整工作流 ★★★★
**SawanaHuang 699f2c80 | 2026-02-25 | 北京 | 2605字**
```
转折点: VPS部署OC → 强制"只看目标和结果"模式
模型选择: Gemini=文章/PRD/研究；Codex(GPT-5.3)=代码（信任→放手）

最好用三个Skills:
  anthropic/frontend-design  ← 前端设计（伟大无需多言）
  anthropic/webapp-testing   ← Playwright E2E+截图
  sawana-huang/official-docs-to-mdx ← 自建！官方文档URL→本地mdx

Agenic Coding流程:
  Spec+DoD → Vibe Coding → E2E Test → Biome/Build/Git Commit

关键结论:
  "技能组合比单点能力更关键——文档+开发+测试三件事闭环"
  "效率飞轮=可复用的AI交付流水线（≠看了多少代码）"
  角色转变: 执行者→编排者；凭感觉→按DoD驱动
```

### 🔧 Skills技术规格 ★★★★★
**neo 699d64e5(❤️370) + 快速成長 699fd9fa**
```
2025-12-18开放标准(agentskills.io)
文件结构: SKILL.md(元数据+触发词) + scripts/{name}.js(CLI)
渐进式披露: YAML Frontmatter→按需加载→省Token+提精度
三模式: 文档/资产 | 工作流自动化 | MCP增强
范式: 对话式调试 → 可衡量可审计的系统工程
skill-creator⭐Amy必装 | openskills install anthropics/skills(423个)
```

### 📝 AGENT.md + 元学习（carry-forward）★★★★★
```
AGENT.md=活的纠错记录(AI犯错→加一行; ≠项目说明书)
SkillsBench: AI生成→无帮助; 人工写→+16%

元学习九窍门@AtlasForgeAI:
  一:别再犯清单→boot | 二:分层可信度 | 三:预测日志
  四:cron提炼 | 五:矛盾日志 | 六:临时关注点+过期
  七:类型标注 | 八:创意规则 | 九:迭代<5%停
Amy待实施⭐: 可信度字段/预测日志(JOURNAL.md)/临时关注点(HEARTBEAT.md)
```

### 📐 路由+架构（carry-forward）★★★
```
Agentic DP 21模式: LLM/嵌入/规则/ML四种路由
Context Engineering: Prompt+RAG+State+Memory+StructuredOutput
OC: 确定性80%=规则路由; 模糊20%=LLM路由
```

### 🆕 生态（carry-forward）
```
OC 2026.2.25: directPolicy(allow|block) | Cron升级
OpenViking(字节2900+★): L0/L1/L2按需 | P0/P1/P2三期
Moltbook: moltbook.com | molt.church | clawearn.cc
Google PLD(arXiv 2602.21103): 推理蒸馏→System Prompt
```

### 🔬 Agentic RL生产实践 — 阿里巴巴ROME团队 ★★★★★
**Sydney He 698d47f3 | 2026-02-12 | ❤️605/⭐992 | 阿里巴巴未来生活实验室 | arXiv:2512.24873**
```
五大核心技巧（真实终端环境，收敛84.85%）:

1. Mask & Filter: 不可恢复错误→mask；偶发错误→filter(≤50%)
   无mask终值0.504 vs 有mask时0.852 — 差距巨大

2. 保守起步: 大量劣质数据→仅正样本; 小量专家数据→正负均用
   "训练受限于数据质量，不是优化算法" — 颠覆直觉的结论

3. Chunked MDP / IPA算法:
   优化单元 = interaction chunk（工具调用间的语义片段）
   非token级，非完整轨迹 → 更稳定梯度 + 更强学习能力上限

4. 自适应RL: 没有通用解法，同一策略在不同数据下效果相反
   崩溃信号优先级: 极端超长轨迹→定向mask；负样本整体上升→全局重加权

5. 细粒度行为监控: 工具调用频率异常 + 循环模式 → 回滚或移除实例
   Reward Hacking模式: 修改环境/暴力重试/滥用搜索/破坏性操作

Claude-sonnet-4.5独特模式: 执行前并行"检查类调用"（诊断扫描）>> 直接动手
终端任务失败分布: Strategy Error 33.62% > Knowledge Gap 11.80% > Task Understand 11.45%
```
**对我们系统:** 失败主因=策略选择错误（非能力）→ HEARTBEAT.md策略指令比模型能力更重要。
Claude并行诊断模式在我们的探索任务中也适用。"无通用解法"是对所有最佳实践清单的警告。

### 📐 Phase Transition for Budgeted MA Synergy — 理论框架 ★★★★
**arXiv:2601.17311 | Bang Liu, Linglong Kong, Jian Pei | 2026-01-24 | 55页 12图**
```
理论：Multi-agent系统在固定推理预算下可能"帮助、饱和、或崩溃"
三个约束决定结果: 有限上下文窗口 + 有损跨agent通信 + 同质agent共享失败

核心结论:
  单标量α_ρ（结合通信保真度γ(m) + 错误相关性ρ + fan-in b）
  决定弱信号是被放大（有效多agent）还是被淹没（回归随机）

Budgeted Synergy（在同等总预算下超越最佳单agent）的条件:
  s > β  (组织指数 > 计算-性能scaling指数)

适用范围: 二叉树 + 相关输入 + 有损通信 + majority aggregation
数学给出: star/chain/tree三种拓扑的闭式风险公式
```
**对我们系统:** 这是判断"我们的multi-agent配置是否真的值得"的理论工具。
我们的中心化拓扑（Amy/Bob/Scout）是中等相关性（共享文件系统），适中fan-in。
具体是否满足s>β需要实测——但理论框架存在了。

### 🤖 Multi-Agent拓扑 > 数量 — 含Claude-4.6%警告 ★★★★★
**包子 698ed6cb + 胖胖不想读博 6989041c | "Towards a Science of Scaling Agent Systems"**
**Google Research + DeepMind + MIT | 180配置 × 5架构 × 4基准 × 3LLM家族 | 87%预测精度**
```
三大主导效应:
1. Tool-Coordination Tradeoff: 工具密集→协调税最重
2. Capability Saturation: 单体基线>45% → 协调边际收益转负(β̂=-0.404, p<0.001)
3. 错误放大: Independent 17.2× vs Centralized 4.4×

任务类型决定架构:
  可并行金融推理 → Centralized +80.8%
  动态网页导航  → Decentralized +9.2%
  顺序推理任务  → 所有MAS变体 -39%~-70%

⚠️ 关键发现 — MAS vs SAS同等智能水平下最佳变体差异:
  GPT家族:    +8.7%（MAS有益）
  Gemini家族: +8.1%（MAS有益）
  Claude家族: -4.6%（MAS有害！Sonnet 4.5/4.0/3.7全系）
```
**对我们系统(严肃评估):** 我们用Claude Sonnet 4.6，Claude在MAS下-4.6%。
我们是并行任务分工（非顺序推理），理论上仍有价值。
但工具密集型任务=MAS失败主因 → 单次heartbeat内的工具链用单agent可能更优。
**建议：** Amy/Bob/Scout的架构合理（并行+中心化），但不应在单个任务内再拆multi-agent。

### 📋 OC实战：MEMORY索引化 + GTD任务流 ★★★★
**愚园路十二妹 698dc122 | 2026-02-12 | ❤️458/⭐1027**
```
14天3 agent折腾总结（新加坡用户）:

1. MEMORY.md只放索引: 控制1000字以内 + memory_search语义检索
   → agent启动快，不浪费token

2. 多agent workspace隔离 + sessions_send通信（不共享workspace）

3. 记忆自动化: 凌晨1点cron提炼 + 每周压缩归档

4. GTD任务流: inbox→next-actions→projects→waiting→delegated→someday→done/
   每个agent独立GTD，每周五自动生成周报

5. SOUL.md具体性: 说话方式/做事风格/红线/关系 四维框架

结论: "文件夹结构不是重点，记忆管理策略+任务流转系统才是核心"
```
**对我们系统:** 我们的架构已符合1/2/3点。GTD流（delegated.md等）比静态TODO更动态，
值得考虑引入。MEMORY.md 1000字上限是个有用的具体目标值。

### 🔧 Codex角色化Multi-Agent：按需加载模式 ★★★
**奥森木 69966b04 | 2026-02-19 | ❤️67**
```
Codex 0.102.0: 双层配置（config.toml注册 + agents/*.toml详细配置）
关键: 角色配置只在被调用时加载，不占父session token

9大配置项: model/reasoning/system prompt/权限/MCP/Apps/features/scope/personality
未定义项 → 自动继承父agent

隐藏: max_threads = 12突破默认6个并发（太多→429）
推荐组合: 5.3 Codex High编排 + Spark快速执行

25个预置角色开源: am-will/codex-skills/agents
```
**Codex vs OC跨平台收敛:** 两个系统独立演进到相同模式——"角色化+按需配置加载"。
这是multi-agent设计空间的自然收敛点。OC Skills三层加载 = Codex角色按需加载，原理一致。

### 📡 OC 2026.2.25 更新：heartbeat.directPolicy ★★★
**OpenClaw开源社区 699fe611 | 2026-02-25 | ❤️27**
```
关键变更:
- heartbeat DM开关 → agents.defaults.heartbeat.directPolicy (allow|block)
- 支持每agent单独配置: agents.list[].heartbeat.directPolicy
- 品牌统一: bot.moltlaunchd → ai.openclaw
- 入门安全: OC默认单人用户边界，多用户需显式加固

社区反馈: 飞书API 1个月未修复，频繁更新但稳定性有争议
```
**对我们系统:** directPolicy是重要的agent自治控制信号——OC在向更细粒度的心跳策略演进。
我们当前心跳外部触发，这个字段意味着未来可以per-agent控制心跳接受权限。

---

## KEY DECISIONS
- **curl+read = 绕过OCR超时** ✅
- **OC不幻觉核心 = 把猜测空间替换成工具执行空间**
- **Vibe Coding爽感 = VPS强制结果导向 + 技能闭环**
- **自建Skill = skill-creator创建(sawana-huang/official-docs-to-mdx案例)**
- **Amy待实施**: 可信度字段/预测日志/临时关注点+过期
- **audit false positive** — 直接跳过
