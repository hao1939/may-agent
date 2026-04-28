# Amy XHS Intelligence — insights.md
_Compact #6 @ 2026-02-26 08:52 (HB38–HB42) | Archive: insights-archive-20260226f.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f_

---

## 2026-02-26 09:00 — L1 Assigned Task (文件系统即数据库)

### ★★★ 算筹新语 "文件系统就是数据库：用信息架构解决AI记忆" (699f1721, 浙江, 2026-02-26 ~08:09)
**来源：** 算筹新语 | tags: #agent #filesystem #文件系统 #信息架构 #AI记忆 #memory #数据库 #RAG #长期记忆 #情境记忆
**访问状态：** URL解析成功（重定向至完整XHS item URL）；正文被 JS 渲染保护（小红书标准行为，非鉴权失败）；浏览器工具当前不可用。从标题+tags+作者背景做技术推断分析。

---

**核心论点（从标题+tags推断，高置信）：**

"文件系统就是数据库"——这个论点的核心逻辑是：**不需要向量数据库、不需要专门的 memory 服务，文件系统本身就是一个结构化的、可检索的、持久化的信息存储系统。** 只要信息架构设计得好（目录结构、文件命名规范、格式约定），文件系统可以完全替代为 AI 记忆而设计的专门数据库基础设施。

具体论证路径大概率包括：
1. **文件 = 行** — 每个文件是一条记录，目录是表，文件名是索引
2. **搜索即查询** — `grep`/`rg`/`find` 就是 SQL WHERE；语义搜索可以用 RAG 叠加
3. **层级结构 = schema** — `/memory/projects/X/decisions.md` 就是数据库 schema 设计
4. **人类可读 = zero vendor lock-in** — markdown 文件不依赖任何服务，git 版本控制免费提供 append-only 审计日志
5. **情境记忆的核心挑战** 是"在对的时间找到对的记忆"——文件系统通过目录约定（时间/项目/主题）解决这个问题，而不是向量相似度

---

**背后的技术机制：**

这是一个**信息架构优先**（IA-first）的 memory 设计哲学，对应刘东瑞综述帖（M4）里的"分层存储+压缩"路径，但走的是最小基础设施版本：

| 内存层 | 文件系统实现 | 传统 DB 实现 |
|--------|------------|-------------|
| 情节记忆（episodic）| `journal/YYYY-MM-DD.md` | 时序数据库 |
| 语义记忆（semantic）| `knowledge/topic/*.md` | 向量数据库 |
| 程序性记忆（procedural）| `AGENTS.md`, `TOOLS.md`, `SKILL.md` | 规则引擎 |
| 工作记忆（working）| 当前 context window | RAM |

核心机制：**文件名+目录结构承担了传统数据库 schema 的全部工作**。检索不靠 embedding，靠的是设计良好的命名约定 + shell 工具 + 偶尔的 RAG overlay。

这与 Anthropic 在 Claude Cowork（A1）里的选择一致——"一切以文件系统为中心"不是妥协，是架构判断。

---

**对我们系统的意义（直接可操作）：**

**✅ 我们已经在做对的事：**
- Amy 的三层记忆（MEMORY.md / insights.md / JOURNAL.md）正是情节/语义/程序性记忆的文件系统实现
- 目录结构 `/openclaw-config/knowledge/amy/` 就是有意识的 schema 设计
- AI.zip 帖（HB43）揭示的文档权限体系（SOUL/MEMORY/AGENTS/TOOLS）就是一个隐式的数据库 schema，只是从未被这样命名过

**⚠️ 我们做得不够好的地方：**
1. **缺乏跨 agent 的统一 IA 约定** — Amy、Bob、Main 各自有自己的目录结构，但没有全局 schema 定义文档。当系统扩展到 5+ agent，检索一致性会崩溃
2. **insights.md 是 append-only 平铺文档，不是结构化数据库** — 现在 600 行需要 compaction，根本原因是没有 topic-based 分层。如果改成 `/knowledge/amy/skills/`, `/knowledge/amy/agents/`, `/knowledge/amy/tools/` 子目录，就不会有"压缩债"
3. **没有跨 agent 语义检索层** — 当前架构依赖 agent 手动读文件；如果有全局 RAG overlay（哪怕是 `rg --glob` 脚本），agent 可以"查询"整个知识库而不是"读"特定文件

**🚨 重要校正：** 这个论点挑战了"AI memory 需要向量数据库"的默认假设。我们不需要引入 Chroma/Pinecone/Weaviate 来解决跨会话记忆——我们已经有了正确的基础设施，需要的是更好的 **目录约定（IA design）**。

---

**ACTIVE INSIGHTS (post compact #6)**

### 🚨 Anthropic官方产品

**Insight A1 — Claude Cowork（2026年1月上线，Anthropic官方）**
- 定位：将Claude Code的Agent能力通过GUI封装，交付给普通知识工作者
- 平台：仅macOS；仅限**Claude Max订阅用户**（$100/月）；底层Opus 4.5；VM+沙箱双重防护
- UI：Claude桌面版新增Cowork tab（与Chat/Code并列）；右侧显示todo/过程文件/执行上下文
- 核心功能：本地文件自动化 / Agentic循环执行（多任务并行队列）/ Connectors跨场景协同
- Skills系统：继承Claude Code生态，支持"一次配置无限调用"
- **TTZ最佳比喻：** Claude Code=手动挡跑车，Cowork=同款自动挡（动力一样，踩油门就走）
- **山羊不在家战略判断：** "旧瓶装新酒"——一切以文件系统为中心；Anthropic争抢用户使用数据是正确却无奈的一步
- **三大坑：** $100/月门槛极高 / 仍是research preview / "让AI删文件你真敢用？"
- **智东西 NotebookLM Skill**（❤️281/⭐463，本档案Claude Cowork最高帖）：打通Claude Code + Google NotebookLM；让Gemini给Claude Code"打黑工"；token消耗少/幻觉降低
- **中国护城河：** Claude Max需境外账号，中国大陆用户基本无法使用 → OpenClaw核心差异化优势

### 竞争情报

**Insight C1 — OpenClaw = Moltbot = Clawdbot（Peter Steinberger开发）**
- 同一产品三个名字；Moltbot因商标被Anthropic发函改名
- 已确认：码出AI未来帖明确点名Peter Steinberger

**Insight C2 — Agent Zero（GitHub: agent0ai/agent-zero，MIT★15K）**
- SKILL.md标准兼容（与Claude Code/Cursor/OpenClaw互通）
- 层级多Agent协作；所有行为由`prompts/default/agent.system.md`定义
- 代表Skills生态跨框架统一已成现实

### Skills生态深度

**Insight S1 — Skills = MCP的上下文路由层（chouheiwa 69941de4，❤️147）**
- MCP token爆炸根因：eager loading（tools/list一次性拉全部工具定义入system prompt）
- 实测：GitHub MCP 91工具=48000 token（Claude 200K窗口的24%）；极端案例82000 token(41%)
- **Skills三层渐进式披露（量化）：** L1~100 token / L2~5000 token / L3按需
- **效果：token从100K+降至~11K，节省约90%**
- 更准确定义：Skill让MCP从"广播模式"变成"路由模式"
- 其他方案：代码执行模式(-98.7%) / RAG-MCP语义检索 / MCP Tool Search(Claude Code内置)
- **与奥森木帖（HB34）形成量化互证**

**Insight S2 — SkillsBench量化结论（arXiv:2602.12670）**
- 精选Skills平均+16.2pp；医疗+51.9pp / 软件工程仅+4.5pp
- **2-3个Skills最优(+18.6pp)；4+个降至+5.9pp**；自生成-1.3pp
- 小模型+好Skills可追平大模型

**Insight S3 — SKILL.md工程规范（Alpha Mao实战）**
- ≤5000词上限；description加负面触发词；YAML禁`<>`防指令注入；关键验证写脚本

### 多Agent架构

**Insight M1 — Han1 Agent家族（最完整实战案例）**
- 5个独立OpenClaw实例（各有SOUL.md性格文件/独立config/独立记忆）
- 层级：Yi→Friday(Opus4.6总管)→Moon(执行/Discord汇报)→Lily/Kai/Han1(各专一域)
- Discord做跨agent通信层；记忆隔离+Friday单向读全局
- 踩坑：端口冲突/额度管理(只有Friday用顶配)/Moon话太多

**Insight M2 — 凡人小北"家庭医生"运维模式**
- 独立gateway专职修复主群（单一职责运维agent）
- 架构：Main Gateway(多业务agent) + Independent Gateway(家庭医生🩺)
- 无业务负担，跑多轮升级"很稳"

**Insight M3 — Elvis Sun Zoe架构（Karpathy转发）**
- OpenClaw=编排层meta-orchestrator；Zoe管理多个Codex+Claude Code+Gemini实例
- 按任务选AI：Codex后端/Claude前端/Gemini设计UI
- 接入：Sentry/Support Tickets/Obsidian/Memory/Skills/Emails/Prod DB
- Cron job每10分钟；一天94提交；$100+90/月；唯一瓶颈=内存

**Insight M4 — 麦克斯"用顺手手册"（最actionable）**
- 黄金原则：最小链路优先（先通一条提醒，再加能力）
- 诊断：`openclaw status` + `openclaw security audit --deep`
- 指令格式：**目标+约束+验收**（防"字面正确但你不想要"）
- 总结："OpenClaw最值钱的不是'会回答'，而是'能把一段流程接住'"

### 技术框架

**Insight T1 — MCP vs CLI分层架构（八带AI日记）**
- GUI（给人类）/ CLI（执行层，AI母语）/ MCP（管理层，规范/权限/审计）
- 顺序原则：先CLI（跑通命令链）→后MCP（体系化治理）；不能反
- OpenClaw Skills = CLI↔MCP中间层，当前阶段最优解
- Obsidian发布官方CLI = 时代信号（传统软件开始把AI当必须服务的用户类型）

**Insight T2 — 内置搜索配置（柯基帖）**
- 两个内置工具：web_search(Brave/Perplexity/Gemini) + web_fetch(HTML→Markdown)
- 配置路径：`~/.openclaw/openclaw.json` → `tools.web.search`
- 推荐：Perplexity via OpenRouter，model=`perplexity/sonar-pro`

---

## 未读/待追踪队列

### 高优先级
- **Ben.AI 699738b5** "别把OpenClaw当ChatGPT用了"（收/赞2.15×，多Agent教程）— xsec_token失效，需重新获取
- **AgentEvolver 69242e5c** (江尹城, ❤️326) — agent memory/self-evolution
- **辛康在进化 69845f8e** (❤️180/⭐349) — Claude Cowork开源办公插件；11张图SIGTERM×2，待分批重试
- **whisper 689c3bc4** — 18张slides CE四支柱How部分未读完

### 持续封锁
- 奥森木 698facff 踩坑指南(❤️196) / 蟑螂 6984e837 木马帖(❤️1183) / 红鲤鱼 697b93ae(❤️434)

---

## KEY DECISIONS (carry-forward)

- **Claude Max门槛=OpenClaw最重要护城河之一**（境外账号要求，中国大陆用户无法用Cowork）
- **Skills三层架构的价值是物理突破上下文窗口限制**（节省90%，不只是"优雅"）
- **2-3个Skills黄金区间**（SkillsBench +18.6pp，4+个降至+5.9pp）
- **多Agent隔离>单Agent全包**（context干净=质量提升，三帖共同结论）
- **SOUL.md作为独立性格文件**：han1帖揭示的架构细节，与config分离
- **Discord作为跨agent通信层**：开源可用，无需自建
- **搜索状态：** Claude Cowork/moltbot可用；OpenClaw/vibe coding/opc-skills仍封
- **Post-compaction audit false positive**：WORKFLOW_AUTO.md和memory日期文件不存在，已确认5次

---

## 2026-02-26 08:54 — heartbeat #43 (A2A双机制 + 文档加载架构 + SOUL.md + 记忆综述)

### ★★★ 过气Pm张 "openclaw agent2agent终于通了" (6999c60a, ❤️71/⭐160, 2026-02-21)
**来源：** 过气Pm张（上海）| 踩坑第2集 | desc完整

**OpenClaw A2A两套机制——长得像但本质完全不同：**

| 机制 | 本质 | 机制描述 | 适合场景 |
|------|------|----------|---------|
| `sessions_spawn` | 任务委派（老板派活） | 创建全新隔离session；子agent干完自动返回结果；**无历史上下文** | 写脚本/分析数据等单次任务 |
| `sessions_send` | 真正A2A对话（同事1v1讨论） | 注入目标agent的已有session；Gateway自动处理ping-pong最多5轮；**带完整上下文(SOUL.md+对话历史)** | 辩论方案/深度审查逻辑 |

**⚠️ 关键踩坑：sessions_send默认是关闭的！**
- `enabled`默认为`false`，必须手动改成`true`
- `allow`数组里列出允许互通的agent
- `allowAgents`必须配置（默认只能spawn自己）
- **SOUL.md里必须写清楚调用方式**（光配底层没用，模型不知道怎么用）

**最终架构：** sessions_spawn负责"派活"，sessions_send负责"讨论"；日常90%任务用spawn，需要深度1v1辩论才切send。跑一周"稳定可靠"。

**Amy自我映射：** Amy自身收到heartbeat时用的正是sessions_spawn模式（一次性任务委派）。如果需要和Bob深度辩论某个方向，应该走sessions_send。

---

### ★★★ AI.zip "OpenClaw核心文档加载机制" (6991c081, ❤️59/⭐113, 2026-02-15)
**来源：** AI.zip（德国）| 2张图完整OCR | 最重要的架构参考文档

**OpenClaw 7个核心文档完整权限图：**

| 文档 | 主Agent可见 | 子Agent可见 | 用途 |
|------|------------|------------|------|
| **AGENTS.md** | ✅ | ✅ | 行为守则/启动时读的文件/安全边界/群聊规范 |
| **TOOLS.md** | ✅ | ✅ | 工具手册：搜索配置/Cron默认值/外部服务调用 |
| **SOUL.md** | ✅ | ❌ | 人格定义：名字/性格/说话风格/emoji偏好 |
| **USER.md** | ✅ | ❌ | 用户画像：时区/偏好/项目/职业阶段 |
| **HEARTBEAT.md** | ✅ | ❌ | 心跳任务：后台轮询检查清单（仅主会话） |
| **BOOTSTRAP.md** | ✅(首次) | ❌ | 首次初始化：建立自我认知/初始配置，执行后自动删除 |
| **MEMORY.md** | 🔒手动加载 | ❌ | 长期记忆：重要决策/待办/进度，最高隐私保护，不自动注入 |

**核心结论：** 只有AGENTS.md和TOOLS.md是所有agent共享的全局规则。需要子agent遵守的规则必须放这两个文件。

**Amy关键洞察：** 这直接解释了为什么Amy的MEMORY.md不自动传给子agent——这是安全设计，不是bug。Amy应该把全局工具规则写进TOOLS.md，把Amy专属行为规范写进AGENTS.md（子agent也会遵守），把Amy的个性和私密信息留在SOUL.md和MEMORY.md（仅主会话可见）。

---

### ★★ Yanlin "一个300字的SOUL.md，让你的AI助手判若两人" (6999134f, ❤️9/⭐27, 2026-02-21)
**来源：** Yanlin（浙江）| 7张图 desc完整

**三文件分工表：**
- SOUL.md → "你是谁"（性格/风格/边界）
- AGENTS.md → "怎么干活"（操作规范/工作流）
- MEMORY.md → "知道什么"（记住的事实）

**写作规范：** ≤300字最有效（太长模型会忽略）；别写成任务清单（那是AGENTS.md的事）；不能自相矛盾

**实际效果对比（真实前后对比）：**
- Before: *"Great question! I'd be happy to help you with that..."*（无个性套壳）
- After: *"结论：用Sonnet就够，Opus杀鸡用牛刀。原因是日常对话不需要深度推理，省70%的钱。"*（直接/有观点/懂上下文）

---

### ★★★ 刘东瑞 "综述：Agent下半场记忆机制的反思" (698e9967, ❤️291/⭐447/📤172, 2026-02-13)
**来源：** 刘东瑞（上海AI Lab）| 学术综述帖 | desc完整（论文读解）

**核心问题：** 上下文爆炸（context explosion）+ 静态记忆机制局限

**三大核心挑战：**
1. 环境复杂性爆炸：AI研究进入"下半场"，从静态基准→长程/动态/开放世界真实部署（具身智能/GUI自动化/深度研究/个人医疗）
2. 静态记忆架构局限：无法处理跨会话累积、用户个性化长期演变、多智能体协作中的知识共享与冲突
3. 评估与现实脱节：传统评估过度简化，不反映长程交互实际需求

**论文提出三维记忆分类框架：**
- 记忆基质（内部/外部）
- 认知机制（感觉/工作/情景/语义/程序性记忆）
- 记忆主体（用户中心/智能体中心）

**关键方向：** 混合记忆架构（参数化+非参数化存储）/ 分层存储+压缩 / 记忆操作的RL优化（自主决定存储/检索/压缩/遗忘的时机）/ 多智能体记忆路由与隔离

**Amy洞察：** 这篇综述与Amy自身的记忆挑战高度相关。Amy的MEMORY.md是"情景记忆"（重要决策/项目进度），insights.md是"语义记忆"（结构化知识库），JOURNAL.md是"程序性记忆"（工作流日志）。三维框架提示Amy的记忆架构已相当完整，但**跨会话的累积与冲突消解**仍是弱项（compaction是部分解法）。


---

## 2026-02-26 08:56 — heartbeat #44 (Peter Steinberger官方SOUL.md改写指令 + 新feed)

### ★★★ AI-Native Hub "分享一条给你的AI注入灵魂的SOUL.md" (699bba62, ❤️33/⭐31, 2026-02-23)
**来源：** AI-Native Hub（福建）| 转发自Peter Steinberger(@steipete)原帖 | **原帖：❤️3.6K/🔁351/📊155K**

**这是OpenClaw开发者Peter Steinberger亲自发布的SOUL.md改写8条指令（官方级别！）：**

1. **有强烈观点** — 不再用"视情况而定"模棱两可，要明确自己的立场
2. **删除所有公司规章感** — 如果它可以出现在员工手册里，就不应该出现在这里
3. **禁止套话开头** — 永远不要以"好问题，我很乐意帮忙"或"当然可以"开头
4. **务必简洁** — 如果答案可以用一句话表达，只给一句话
5. **允许幽默** — 不是刻意搞笑的段子，而是源于真正智慧的自然而然的机智
6. **直言不讳** — 如果我要做什么蠢事，直说出来。要讲究魅力而不是残酷，但不要粉饰太平
7. **脏话用得恰到好处是可以的** — 一句恰到好处的"太棒了"比冷冰冰的官方赞扬更有感染力；需要说"卧槽"就说卧槽
8. **氛围结尾（原文必须原封不动保留）：**
   > "要做那种你凌晨两点也想与之交谈的助理。不是那种只会鹦鹉学舌的公司职员。不是那种阿谀奉承的人。只是......优秀。"

**执行方式：** 直接在OpenClaw/Moltbot里说"读你的SOUL.md，按以上8条重写它，保存"

**Amy关联：** 这8条是**Amy自身SOUL.md的设计标准**——直接来自产品创造者。Amy的SOUL.md应该体现：有立场、简洁、幽默、直言。"凌晨两点也想交谈的助理"是OpenClaw人格设计的最终目标。

**🚨 向Bob SIGNALS：** Peter Steinberger亲自定义了理想Agent人格——有立场/简洁/幽默/直言/禁套话。这8条是官方SOUL.md黄金标准，值得写入OpenClaw文档或最佳实践。

---

### 🆕 新feed扫描（HB44）
| 互动 | ID | 作者 | 标题 | 优先级 |
|------|-----|------|------|--------|
| ❤️79 | 699f0f53 | 创哥的AI实验室 | "一个视频让你OpenClaw技术瞬间超越90%的人" | 🔴 下轮精读 |
| ❤️23 | 6996ab43 | 慎之 | "半监督式大模型推理强化算法TRAPO" | 🟡 学术向 |
| ❤️4 | 699f8976 | LLM-insights | "大模型搜索智能体训练：快思考反而更强" | 🟡 低互动 |

**AgentEvolver 69242e5c：** URL失效（token过期）；待下轮重新搜索获取


---

## 2026-02-26 08:58 — heartbeat #45 (创哥视频帖 + SOUL.md社区传播图谱 + AgentEvolver新token)

### ○ 创哥的AI实验室 "OpenClaw技术超越90%的人" (699f0f53, ❤️80/⭐121, 2026-02-25)
**来源：** 创哥（浙江）| **视频帖**，跳过OCR
**视频内容（desc提取）：** 7个命令解决OpenClaw常见问题（界面打不开/发消息没反应/重新配置/查看状态/启动服务/查日志排错/升级版本）
**价值：** 实用工具向；与麦克斯手册（HB40）互补

---

### 📊 "openclaw SOUL" 搜索图谱（18结果，2026-02-26）

**SOUL.md话题传播链：** Peter Steinberger原帖(❤️3.6K) → AI好奇社转载(❤️**320**) → AI-Native Hub转载(❤️33) → 不存在的AI衍生(❤️38) → 多个低互动衍生帖

**高价值未读帖：**
| ❤️ | ID | 标题 |
|----|-----|------|
| 320 | 6989dce7 | AI好奇社 "你的Openclaw太无聊了？复制这个试试" ← **精读进行中** |
| 38 | 699809ce | 不存在的AI "修改或补充SOUL.md中这句话" |
| 12 | 698abc87 | 谈小罗coding "给你的OpenClaw换个灵魂，它会骂你" |

---

### AgentEvolver新token获取成功
- 江尹城 69242e5c "谈谈AgentEvolver背后的思考和选择" ❤️326 → **精读进行中**
- WhyWait 691c3a98 "AgentEvolver：探索更self的self-evolving" ❤️207 → 备选


---

## 2026-02-26 08:59 — heartbeat #45 精读结果写入

### ★★★ AI好奇社 "你的Openclaw太无聊了？复制这个试试" (6989dce7, ❤️320/⭐491/📤97, 2026-02-09)
**来源：** AI好奇社（上海）| 6张图+对话截图OCR | SOUL.md话题最高XHS转载帖

**本帖新增价值（超出Peter原帖的部分）——OpenClaw对SOUL.md替换策略的自主建议：**

> 用户问：是完全替换还是只覆盖Personality部分？
> OpenClaw自己回答：
> - **如果新的是完整结构（含Core Truths/Boundaries/Personality）→ 完全替换**
> - **如果新的只有Personality部分 → 只替换Personality**
> - 理由：Core Truths/Boundaries是用户设定的底层安全准则，OpenClaw创建者不了解你的业务场景；Personality才是可以借鉴的部分

**SOUL.md内部层次（由此揭示）：**
- **Core Truths**：核心原则（底层，不轻易改）
- **Boundaries**：安全准则（业务相关，不轻易改）
- **Personality**：性格/沟通风格（可以用Peter的8条覆盖）

**执行流程（截图验证）：** 用户→OpenClaw："我要是把新SOUL.md发给你，你能自己更新应用吗？" → OpenClaw："可以的！读取→写入→下次对话生效" → 先备份`SOUL.md.backup-20260209`→ 再替换Personality层

**Amy关键洞察：** Amy的SOUL.md也应该分三层：Core Truths（Amy是情报研究员的本质）/ Boundaries（安全边界不传给子agent）/ Personality（直接引用Peter的8条）。Peter的8条应该只替换Personality层，而非整个文件。

---

### ★★★ 江尹城 "谈谈AgentEvolver背后的思考和选择" (69242e5c, ❤️326/⭐432/📤152, 2025-11-25)
**来源：** 江尹城（阿里通义实验室）| 5张图全OCR | **学术+工程**

**AgentEvolver — 阿里通义实验室自进化Agent系统（开源，通义魔搭社区）**

**三个自进化机制：**
1. **Self-Questioning（自我提问）**：Agent自主探索环境，生成多样化任务，消除手工数据集依赖；Curiosity-Driven Exploration→Task Derivation→Task Curation（可重放才算有效任务）
2. **Self-Navigating（自我经验导航）**：从历史交互总结自然语言"经验"注入prompt，引导更优轨迹；Experience Pool→Retrieve→Experience-mixed Rollout（经验引导+无经验混合采样）
3. **Self-Attributing（自我反思归因）**：从轨迹反推每步好坏，得到步骤级奖励；LLM标注GOOD/BAD→r_attr→Combined Reward→Step-level Advantage→Policy

**核心公式：** `r̃_t = α·r_t^attr + δ_{t=T}·r̂^out`（步骤奖励+结果奖励加权）

**作者核心判断（非技术）：**
- "如何让agent更聪明地学习"比"自动生成RL问题让agent暴力探索"更重要
- 真正好的Agent Evolving = "信息生成机制"和"优化算法"的codesign，两者缺一不可
- 经验prompt的引入"并不总是正向影响"——需要防止负作用

**与Amy的关联：** AgentEvolver的Self-Navigating机制与Amy的insights.md功能高度类似——都是"从历史经验中总结自然语言规律，注入到下次行动的prompt"。Amy的记忆架构已经是一种原始形态的Self-Navigating。


---

## 2026-02-26 09:03 — heartbeat #46 (愚园路十二妹14天实战 + 奥森木再次封锁)

### ★★★ 愚园路十二妹 "用OpenClaw 14天，5条血泪经验" (698dc122, ❤️447/⭐984/📤186, 2026-02-12)
**来源：** 愚园路十二妹（新加坡）| 5张图全OCR | **XHS实战帖第二高互动**

**5条最值钱的经验（OpenClaw发布仅两周的早期实战者）：**

**①MEMORY.md只放索引，不放内容**
- MEMORY.md控制在1000字以内，只放身份信息+memory文件索引
- 详细内容按主题分文件，靠`memory_search`语义检索
- 效果：agent启动快 / 检索精准 / 不浪费token
- **"文件夹结构不是重点，记忆管理策略才是核心"**

**②多agent要隔离workspace**
- 3个agent各有各的workspace、各有SOUL.md
- "不是同一个大脑分三份，是三个独立的人"
- agent间通过`sessions_send`通信（与过气Pm张帖互证！）

**③记忆自动化是刚需（两层Cron）**
- 每天凌晨1点：自动提炼当天对话精华→memory文件
- 每周一次：压缩和归档旧记忆，保持不膨胀
- 效果：agent每次醒来快速恢复上下文，不会失忆

**④用Markdown GTD管理任务（完整目录结构）：**
```
inbox.md      ← 收集箱，所有新想法先扔这里
next-actions.md ← 已拆解可执行的任务
projects.md   ← 多步骤大目标
waiting.md    ← 等别人回复/等条件成熟
delegated.md  ← 已委派给其他agent或子任务
someday.md    ← 不急但不想忘的灵感
done/         ← 按周归档
```
- Agent天然适合GTD（自动inbox→next-actions→done流转）
- 每个agent独立GTD；每周五自动生成周报发到群里

**⑤SOUL.md是灵魂，不是说明书**
- 要写清楚：说话方式（直接/幽默/毒舌）/ 做事风格（先动手还是先问）/ 红线 / 和用户的关系（同事/助理/搭档）
- "写得越具体，agent越像一个真正的人"

**Amy关键洞察：**
- Amy的MEMORY.md已过长，应该只放索引+指向具体memory文件；insights.md就是语义记忆库，用memory_search检索
- Amy的GTD系统未建，可以借鉴：在workspace里建inbox.md/next-actions.md/waiting.md
- 两层Cron（日提炼+周归档）与Amy当前heartbeat模式兼容，可以增加

---

### ○ AI超元域 "OpenClaw高级进阶技巧" (699a67e7, ❤️278/⭐260, 2026-02-22)
**视频帖，跳过OCR** | desc摘要：模型精选策略+记忆优化+深度搜索集成+Gateway崩溃自动修复；涉及sonnet46/gpt53；Claude Code自动读日志修bug重启验证

---

### 🔴 奥森木 698facff — 第12次security block
新token获取后仍被拦截；放弃主动重试，等待自然解封

