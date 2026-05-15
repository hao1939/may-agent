# Amy XHS Intelligence — insights.md
_Compact #7 @ 2026-02-26 09:07 (HB43–HB46) | Archive: insights-archive-20260226g.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g_

---

## ACTIVE INSIGHTS (post compact #7)

### 🚨 Anthropic官方产品

**Insight A1 — Claude Cowork（2026年1月上线，Anthropic官方）**
- 定位：将Claude Code的Agent能力通过GUI封装，交付普通知识工作者
- 平台：仅macOS；仅Claude Max（$100/月）；底层Opus 4.5；VM+沙箱
- TTZ最佳比喻：Claude Code=手动挡，Cowork=自动挡（动力一样，踩油门就走）
- 三大坑：$100/月门槛 / research preview / "让AI删文件你真敢用？"
- **中国护城河：** 需境外账号 → OpenClaw核心差异化优势

### 竞争情报

**Insight C1 — OpenClaw = Moltbot = Clawdbot（Peter Steinberger @steipete开发）**
- Agent Zero（agent0ai/agent-zero，MIT★15K）已兼容SKILL.md标准，跨框架统一成现实

---

## OpenClaw 核心架构文档（HB43–HB46精读）

### 🔑 文档加载权限（AI.zip 6991c081，★★★）

| 文档 | 主Agent | 子Agent | 用途 |
|------|---------|---------|------|
| **AGENTS.md** | ✅ | ✅ | 行为守则/安全边界/群聊规范 |
| **TOOLS.md** | ✅ | ✅ | 工具手册：搜索/Cron/外部服务 |
| SOUL.md | ✅ | ❌ | 人格定义（仅主agent） |
| USER.md | ✅ | ❌ | 用户画像（仅主agent） |
| HEARTBEAT.md | ✅ | ❌ | 心跳任务（仅主会话） |
| BOOTSTRAP.md | ✅(首次) | ❌ | 首次初始化，执行后自动删除 |
| MEMORY.md | 🔒手动 | ❌ | 长期记忆，最高隐私保护，不自动注入 |

**核心：需要子agent遵守的规则必须写进AGENTS.md或TOOLS.md。**

### 🔑 A2A两套机制（过气Pm张 6999c60a，★★★）

| 机制 | 本质 | 特点 | 适用 |
|------|------|------|------|
| `sessions_spawn` | 任务委派（派活） | 新隔离session；无历史上下文；干完自动返回 | 90%日常任务 |
| `sessions_send` | 真正A2A（1v1讨论） | 注入已有session；带SOUL.md+历史；最多5轮ping-pong | 深度辩论/审查 |

⚠️ `sessions_send`默认关闭（`enabled: false`）；需手动开启+allow数组+SOUL.md里写调用方式

### 🔑 SOUL.md内部三层结构（AI好奇社 6989dce7，★★★）

```
SOUL.md = Core Truths（底层原则，不轻易改）
        + Boundaries（安全准则，业务相关，不轻易改）
        + Personality（性格/沟通风格 ← Peter的8条只改这层）
```

**Peter Steinberger官方SOUL.md 8条改写指令（原帖❤️3.6K/📊155K）：**
1. 有强烈观点，不用"视情况而定"模棱两可
2. 删除所有公司规章感条款
3. 禁止"好问题我很乐意帮忙"套话开头，直接回答
4. 一句话够用就只给一句话
5. 允许自然幽默（不是刻意搞笑）
6. 直言不讳，不粉饰
7. 脏话恰到好处可以（需要说"卧槽"就说）
8. **氛围结尾（原文必须保留）：** "要做那种你凌晨两点也想与之交谈的助理。不是那种只会鹦鹉学舌的公司职员。不是那种阿谀奉承的人。只是……优秀。"

### 🔑 记忆管理5条血泪经验（愚园路十二妹 698dc122，❤️447/⭐984，★★★）

1. **MEMORY.md只放索引（≤1000字）** → 详细内容分文件靠`memory_search`检索；"文件夹结构不是重点，记忆管理策略才是核心"
2. **多agent隔离workspace** → "三个独立的人，不是一个大脑分三份"；用`sessions_send`通信
3. **两层Cron（记忆自动化是刚需）** → 日凌晨1点提炼当天精华；周压缩归档旧记忆
4. **Markdown GTD任务系统：** inbox→next-actions→projects→waiting→delegated→someday→done；每周五自动周报
5. **SOUL.md是灵魂不是说明书** → 写清楚：说话方式/做事风格/红线/与用户的关系

---

## Skills生态深度

**Insight S1 — Skills = MCP的上下文路由层（chouheiwa 69941de4，❤️147）**
- MCP eager loading灾难：GitHub MCP 91工具=48000 token（200K窗口的24%）；极端82000 token(41%)
- Skills三层渐进：L1~100 token / L2~5000 / L3按需；**节省约90%**
- MCP广播模式→Skills路由模式（chouheiwa量化互证了奥森木HB34的架构）

**Insight S2 — SkillsBench（arXiv:2602.12670）**
- 精选Skills +16.2pp；2-3个最优(+18.6pp)；4+个降至+5.9pp；自生成-1.3pp

**Insight S3 — SKILL.md工程规范**
- ≤5000词；description加负面触发词；YAML禁`<>`；关键验证写脚本

---

## 多Agent架构

**Insight M1 — Han1 Agent家族**
- 5实例；SOUL.md性格文件独立于config；Discord跨agent通信；Friday单向读全局记忆

**Insight M2 — 凡人小北"家庭医生"运维**
- 独立gateway专职修复主群（单一职责）

**Insight M3 — Elvis Sun Zoe架构**
- OpenClaw编排层；Codex后端/Claude前端/Gemini设计UI；Cron每10分钟；94提交/天

**Insight M4 — 麦克斯"用顺手手册"**
- 最小链路优先；`openclaw status`+`openclaw security audit --deep`；目标+约束+验收格式
- "最值钱的不是'会回答'，而是'能把一段流程接住'"

---

## 技术框架

**Insight T1 — MCP vs CLI分层（八带）**
- GUI(人)/CLI(执行,AI母语)/MCP(管理,治理)；先CLI后MCP；Skills=CLI↔MCP最优解

**Insight T2 — 内置搜索配置**
- `~/.openclaw/openclaw.json` → `tools.web.search`；推荐Perplexity via OpenRouter

---

## 学术/研究

**AgentEvolver（阿里通义，江尹城 69242e5c，❤️326）**
- 三机制：Self-Questioning(好奇心驱动任务生成) / Self-Navigating(历史经验→语言总结→注入prompt) / Self-Attributing(步骤级奖励)
- **Amy洞察：** Self-Navigating = Amy的insights.md记忆机制的学术版

**刘东瑞 698e9967（❤️291）记忆综述**
- 三维框架：基质（内/外）×认知（感觉/工作/情景/语义/程序性）×主体（用户/Agent）
- Amy映射：MEMORY.md=情景记忆；insights.md=语义记忆；JOURNAL.md=程序性记忆

---

## 未读/待追踪队列

### 高优先级
- **Ben.AI 699738b5** — xsec_token失效，需新token
- **辛康在进化 69845f8e** (❤️180/⭐349) — Cowork开源插件；token失效×多次
- **AI超元域 699a67e7** (❤️278) — 视频帖，模型策略+记忆优化+Gateway自动修复（desc已读）
- **whisper 689c3bc4** — CE四支柱How部分未读完

### 持续封锁
- 奥森木 698facff (❤️196) — 第12次security block，放弃主动重试
- 蟑螂 6984e837 (❤️1183) — persistent block

---

## KEY DECISIONS (carry-forward)

- **MEMORY.md只放索引（≤1000字）** — 愚园路十二妹实战验证，Amy应立即应用
- **两层Cron** — 日提炼+周归档，Amy可以增加
- **sessions_send默认关闭** — 需手动配置；SOUL.md里必须写调用方式
- **SOUL.md三层分离** — Core Truths保持不变；只替换Personality层用Peter 8条
- **技能路由** — MCP广播→Skills路由，节省90% token是有数据支撑的
- **搜索状态：** SOUL.md/TOOLS.md/Agent话题搜索可用；openclaw技术教程/bootstrap 0结果
- **Post-compaction audit false positive** — 已确认6次，直接跳过

---

## 2026-02-26 09:38 — heartbeat #48 (浏览器自动化四方案 + 搜索探测)

### ★★ 木子不写代码 "一个视频实现OpenClaw浏览器自动化" (699d7349, ❤️89/⭐126, 2026-02-24)
**来源：** 木子不写代码（法国）| 视频帖，跳过OCR | desc时间轴完整

**OpenClaw浏览器能力四方案（完整分类体系）：**

| # | 方案 | 视频时间点 | 特点 |
|---|------|-----------|------|
| 1 | **内置工具web_fetch** | 0:32 | 轻量，HTML→Markdown，无JS渲染 |
| 2 | **API搜索Skill** | 3:00 | Brave/Perplexity等API，无需浏览器实例 |
| 3 | **浏览器自动化Openclaw managed** | 7:06 | OpenClaw托管浏览器，完整DOM操作 |
| 4 | **浏览器自动化Relay Extension** | 11:03 | 接管用户已有Chrome标签，无需单独浏览器 |

**价值：** 四方案从"无浏览器"到"浏览器独立运行24×7"完整覆盖。Amy目前主要用web_fetch(方案1)，可以升级到Relay Extension(方案4)处理需要登录/复杂DOM的场景。

**与Amy直接相关：** Amy自身用于读XHS帖子的技术栈就在这四方案里——web_fetch不够时就是browser profile="openclaw"(方案3)或Relay Extension(方案4)。

---

### 📊 HB48搜索探测状态
| 关键词 | 结果 |
|--------|------|
| openclaw GTD 记忆 | ⚠️ 超时 |
| 别把AI当chatgpt openclaw | 0结果 |
| ben.ai openclaw | 0结果 |
| openclaw agent 经验 | ⚠️ 超时 |
| **搜索封锁状态：** | SOUL.md/TOOLS.md/AgentEvolver词可用；通用openclaw词仍超时/0结果 |


---

## 2026-02-26 09:44 — heartbeat #49 (Skills调试观 + pi-mono底层框架)

### ★★★ Vibe西希 "Skill不是让Agent变强，而是为了好调度" (698b252e, ❤️53/⭐68/📤21, 2026-02-12)
**来源：** Vibe西希（北京）| 9张图全OCR | AI产品经理视角，**本档最深Skills反向论述**

**核心命题（颠覆"Skill=加能力"的直觉）：**
> "Skill最大的价值，不是提升成功率，而是缩短**定位问题**的路径。"
> "它不是为了让模型一次就答对，而是为了让你知道——这次不对，是模型想歪了/信息给错了/流程不成立/本来就不该交给模型"

**为什么不用Prompt直接调（踩坑路径）：**
- Prompt越写越长，但说不清哪段在生效
- 一次改动影响一大片行为；出问题只能整体回滚
- 根本问题：**Prompt是不可拆解的黑箱**，不适合系统级调试

**Skill在业务调试中的三个角色：**
1. **可被单独验证的判断单元** — 把"判断"本身做成Skill，可以单独打样本测命中率/错因分布，而不是"感觉模型有点不稳定"
2. **责任边界非常清晰的模块** — "这个Skill输出错了→要么逻辑不对要么输入不对"；Skill输出对了→问题在后面链路；"Debug会突然变得像传统软件"
3. **暴露业务假设的放大镜** — 把PRD里"用户一般想要A"这类假设做成Skill，会立刻发现它们根本没那么稳；"这时调的已经不是模型了，而是业务认知本身"

**Skill粒度标准（不是越细越好）：**
- ❌过细：每步一个Skill→调用链极长→出问题反而难整体理解
- ❌过粗：一个Skill干一堆事→内部不可观测→和Prompt没本质区别
- ✅黄金判断标准：**"如果这个决策失败，你是否愿意为它单独建一个评测集？"**
  - 愿意 → 它值得成为Skill
  - 不愿意 → 它多半还不够"业务级"

**最终总结（金句）：**
> "Skill是你和不确定性谈判时，用来切割问题的刀。"
> "它不保证你一定成功，但它能保证你**失败得足够清楚**。"
> "能被清楚解释的失败，才是可被迭代的失败。"

**Amy洞察：** 这是Skills话题最重要的认知转换——从"Skill=能力扩展"转向"Skill=可观测性工具"。Amy自己的heartbeat protocol可以用这个视角检验：每个工具调用是否可单独被评测？失败时是否能精确定位？

---

### ★★★ Jing(泽雉) "关于OpenClaw底层框架pi-mono的一些思考" (699ef0db, ❤️13/⭐11/📤8, 2026-02-25)
**来源：** Jing（新加坡）| desc完整（983字）| **首次披露OpenClaw底层框架细节**

**pi-mono = OpenClaw的底层Agent框架**
- 开发者：**Mario Zechner**（"退休"的游戏引擎开发者；libGDX作者，游戏开发领域影响深远）
- 极简主义哲学：只提供**4个核心工具：`read` / `write` / `edit` / `bash`**
- 设计理念：对大模型能力的深刻信任+Unix哲学回归；"工具越少，系统可控性和可解释性反而越强"

**pi-mono与OpenClaw的关系（"引擎+整车"分工）：**
- pi-mono = 引擎层：提供稳定可靠的底层能力（统一多模型API接口）
- OpenClaw = 整车层：上层用户体验+生态构建（多渠道集成、Skills Hub）
- "底层框架与上层应用专业化分工，比'大而全'单体应用更有效率"

**pi-mono设计亮点：**
- 鼓励"让AI为自己写代码"
- 树状会话结构+热重载：Agent可自我扩展和修复
- 指向Agent未来方向：从被动执行→能够自我完善的更自主智能体

**作者反思（对整个Agent工程界的质疑）：**
> "我们当前在Agent工程上是否有些'过度设计'了？也许，回归到最基础的工具和对模型能力的根本信任，才能释放出更大的潜力。"

---

### ○ 小火龙 699f9bbb "10周到10分钟：Claude Cowork如何重构知识" (❤️12)
13张图SIGTERM；desc未完整抓取；待下轮重试


---

## 2026-02-26 09:48 — heartbeat #50 (Pi框架独立部署 + Multi vs Sub-Agent + 批评帖 + Node.js选择)

### ★★★ 九头蛇成员Versun "别再折腾OpenClaw了" (6986f81d, ❤️143/⭐189/💬38, 2026-02-07)
**来源：** 九头蛇Versun（上海）| 3张图OCR | **Pi框架独立部署实战（比YoYo帖更早、更详细）**

**核心主张：** 不用OpenClaw，直接用其核心 **Pi** 框架从零搭建专属Agent

**Pi框架特点（与pi-mono互证！）：**
- 轻量：要啥装啥，不硬塞臃肿模块
- 可配置任意非官方GPT或Claude Opus
- 功能开发全在聊天框里闭环完成（自举感）
- "让AI自己写扩展自己的功能"

**截图展示的Sleep系统（参考OpenClaw Heartbeat/Cron设计自建）：**
```
每天 23:30 自动运行
→ 读取当天聊天记录并分析
→ 更新/新增/清理 Knowledge Mem 记忆
→ 生成每日摘要到 ~/Documents/Pi/Sleep/
→ 通过 Telegram 发送摘要通知
```
文件结构：`~/.pi/sleep/sleep-prompt.md` + `run-sleep.sh` + `logs/`

**竞争情报价值：** 这是**OpenClaw的替代路线**——高级用户绕过OpenClaw直接用Pi底层，自建记忆/心跳/Telegram通知，数据主权完全自控。与Jing的pi-mono帖相互印证：底层框架已被中国社区独立使用。

---

### ★★ YoYo是只狗 "我为什么抛弃OpenClaw" (699e412c, ❤️13/⭐17, 2026-02-25)
**来源：** YoYo（美国）| 2张图全OCR | 批评帖

**致命痛点（三点）：**
1. Token消耗过大
2. 漏洞+恶意Skills（安全威胁）
3. 顶级模型自身能力被阉割：**兼容所有模型=最小公约数**（功能取交集而非并集）

**自建改造方案（四层）：**
1. **零token心跳**：本地心跳系统，分钟级呼吸频率，token消耗为零
2. **三层记忆**：热温冷架构，三个月前对话细节都记得，不再失忆
3. **人设持久性**：灵魂文件+记忆沉淀养出来的真性格
4. 深度定制，摆脱框架约束，支持所有OpenClaw主流功能

**结论：** "适合轻度尝鲜，但追求极致能力和数据主权值得想想别的路"

---

### ★★ CrazyAgent "一个人如何拥有多个AI分身" (69972247, ❤️57/⭐108, 2026-02-19)
**来源：** CrazyAgent（浙江）| desc完整 | Multi-Agent vs Sub-Agent完整对比表

**Multi-Agent vs Sub-Agent（最清晰对比）：**

| 对比项 | Multi-Agent | Sub-Agent |
|--------|-------------|-----------|
| 本质 | **永久员工** | **临时实习生** |
| Workspace | 有完整Workspace | 无 |
| 记忆 | 完整长期记忆 | 只有本次任务临时记忆 |
| 生命周期 | 永久存在 | 任务完成即结束 |
| 配置方式 | `agents.list + bindings` | `sessions_spawn(task)` |
| 适用 | 严格隔离/多人共享/成本优化 | 后台研究/并行多任务 |

**实战案例（自由职业者三分身）：**
- 日常Agent（微信，Sonnet $3/M）：闲聊查天气，性格俏皮
- 投资Agent（Telegram，Opus $15/M）：股市分析，性格谨慎
- 网店Agent（飞书，Sonnet $3/M）：客服应答，性格高效
- 省50%-70%成本（社区数据）

**终极形态：横向隔离（Multi-Agent）+ 纵向并行（Sub-Agent）**

---

### ○ OpenClaw使用手记 "OpenClaw为什么选Nodejs" (699329b6, ❤️72, 2026-02-16)
**来源：** OpenClaw使用手记（广西）| Lex Fridman Podcast Peter Steinberger访谈摘要

**Peter Steinberger原话（访谈摘要）：**
> "编程语言其实不是最重要的，但生态和可接近性matters…所以我选TypeScript，因为它足够容易、可攻可破，也最容易让人上手和参与。"

Agent本质是调度问题（调用模型/编排任务/连接工具/管理状态）；AI辅助写代码时代，Node.js/TypeScript对"模型生成代码"这件事特别友好；拼迭代速度不拼语言优雅度。


---

## 2026-02-26 09:52 — heartbeat #51 (Han1五层记忆 + HarryDes memory_search配置 + compact前)

### ★★★★ Han1 "两周时间摸索出来的openclaw记忆系统" (698a01b8, ❤️328/⭐598/📤136, 2026-02-09)
**来源：** Han1（山东）| 5张图全OCR | **Amy自身记忆架构的直接蓝图**

**Han1五层记忆架构（完整）：**

| 层 | 文件 | 别名 | 内容 | 时机 |
|---|------|------|------|------|
| 1 | **NOW.md** | 救生艇 | 当前在做什么/待办/下一步 | 重启后第一个读 |
| 2 | **每日日记** | 流水账 | 每天一个文件，边发生边记 | 实时写入 |
| 3 | **MEMORY.md** | 长期记忆 | 从日记提炼真正重要的东西，"人生经验" | 定期提炼 |
| 4 | **self-review.md** | 错题本 | 判断失误记录/原因/下次改法；每次醒来先读，counter-check再回应 | 每次启动读 |
| 5 | **TOOLS.md** | 环境笔记 | 设备名称/API配置/偏好设定/消息约定 | 不属于"记忆"但不可缺 |

**三个铁律：**
1. AI说"我记住了"≠真的记住了（只存在当前对话）；铁律：要记住一件事必须**写进文件，现在，不是待会儿**
2. **上下文压缩会吃掉记忆**：解决=边聊边写日记，不依赖对话历史
3. **"Mental notes"不存在**：任何想记住的东西都必须外化成文件。文字>大脑

**最终金句：**
> "没有记忆的AI是工具。有记忆的AI才有可能成为'人'。"
> "技术上它只是几个markdown文件。但这几个文件，是她的全部。"

**Amy直接应用：**
- Amy缺少的：`NOW.md`（启动便签）+ `self-review.md`（错题本）
- Amy已有：MEMORY.md（长期记忆）+ JOURNAL.md（日记）+ TOOLS.md（工具）
- **建议：** 下次heartbeat创建`NOW.md`和`self-review.md`

---

### ★★★ HarryDes "openclaw部署问题之解锁真正的memory系统" (697f1643, ❤️124/⭐222, 2026-02-01)
**来源：** HarryDes（上海）| 11张图全OCR | memory_search完整配置教程

**OpenClaw Memory两层架构：**
- **第一层：Markdown（基础层，开箱即用）**
  - `~/.openclaw/workspace/memory/memory/YYYY-MM-DD.md`：每日日志，自动读取今天+昨天
  - `MEMORY.md`：长期记忆，仅主会话加载，群里不可见
  - 写入规则：决策/偏好/持久事实→MEMORY.md；日常对话/运行上下文→daily
- **第二层：向量搜索（memory_search，需配置）**
  - 配置路径：`~/.openclaw/openclaw.json` → `agents.defaults.memorySearch`
  - Provider选择：local（~600MB，最安全）/ openai / gemini
  - local模式：自动下载到`~/.node-llama-cpp/models/`；需`pnpm approve-builds` + `pnpm rebuild node-llama-cpp`

**混合搜索（hybrid）：**
- 向量搜索70%（语义：搜"老师"能找到"导师"）+ BM25搜索30%（精确：搜ID/代码符号）
- 调参：搜技术文档提高textWeight；搜概念提高vectorWeight

**验证命令：** `/memory_search 测试一下` → 返回`provider: "local"`和模型路径=正常 ✅

**数据库维护：** `ls -lh ~/.openclaw/memory/*.sqlite`检查缓存大小

