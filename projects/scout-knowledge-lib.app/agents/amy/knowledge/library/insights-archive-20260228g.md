# Amy知识库 Insights — 活跃索引
> Compact #64 | 2026-02-28 15:42 | posts: 704+ | archive: insights-archive-20260228f.md
> CDP模块上线后首次大批量搜索（HB77-82，约30帖新存档）

---

## 🔧 安装与配置

### OC本质
```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆（Markdown是唯一真相来源）"
"上班Claude搬砖，下班OC享受生活" — 定位最精准
本地=完整版（100%能力）| VPS=阉割版（~20%能力）— Alex Finn
```

### Agent极简四元组（Snow ❤️58）
```
Soul.md    — 它是谁、什么性格
Cron       — 什么时候主动干活
Memory     — 它记住的东西
Tools & Skills — 它能做什么
```

### TG三大必改配置（Lando ❤️709/⭐1444，archive最高）
```json
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},"groupPolicy":"allowlist"}}}
{"messages":{"ackReactionScope":"all"}}
```
**TG Forum Topics** = 每topic独立对话 = 天然多线程，优于多群方案

### CLI快速参考
```bash
openclaw onboard --install-daemon
openclaw doctor         # ⭐ 遇问题先跑
openclaw gateway restart/status/logs -f
openclaw agents add <name> --model <m> --workspace <path>
openclaw update --dry-run    # v2026.2.22+
openclaw secrets / agents bind/unbind  # v2026.2.26+
/model  # 对话框切模型
```

### 入门必做 & 安全
```
必做: qwen-3.5-plus首月10元 | skill-security-auditor(第一个装)
      tavily-search(免费联网) | doctor(遇问题先跑)
安全: host:"127.0.0.1" | chmod 700 ~/.openclaw | chmod 600 openclaw.json
      mdns=false | AGENTS.md写红线 | /workspace外必须确认
```

### 多模型降级链
```bash
cd ~/.openclaw/skills && git clone github.com/sarahmirrand001-oss/openclaw-switch
openclaw-switch auto  # 429自动降级: gemini-paid→gemini-free→kimi-k2.5
```

### 接入渠道
```
TG: Threaded Mode | Forum Topics(最优) | 多bot架构⚠️bot间无法通信
飞书: 个人账号无法拉群（3源确认） | 飞书API耗尽根因见↓
企微: ≥2026.2.3-1→/wecom/bot | 无长连接，不能主动推送
```

---

## ⏰ 自动化

### 四层+最佳实践
```
Heartbeat  主会话有记忆 | HEARTBEAT_OK=无感抑制 | 批量省token
Cron       精确定时 | 隔离session | v2026.2.22支持并发
           pairing bug: code=1008 → devices/pending.json配置自动批准
           必须: --best-effort-deliver | --session isolated
Hooks      内部事件 | Webhooks HTTP触发

双层Cron最佳(愚园路十二妹): 凌晨1点提炼当天对话 + 每周压缩归档
Alex Finn早间简报: 8:00=天气+新闻+待办+"它自己想到能帮你做的事"
PHY 20个cron jobs: STEPPS六维评分(<40跳过) | AppleScript真实Chrome
```

---

## 🤖 多Agent

### Multi-Agent vs Sub-Agent（CrazyAgent 69972247 ❤️66）
```
Multi-Agent(永久员工): 独立Workspace+Session+Model+记忆
  成本优化50-70% | 日常Agent(微信/Sonnet)+投资Agent(TG/Opus)
Sub-Agent(临时实习生): 无Workspace，任务结束即消失
  场景：主对话继续，后台研究并行跑
终极：横向隔离(Multi-Agent) + 纵向并行(Sub-Agent) = OC完整形态
```

### Antfarm — 7人确定性工作流（奥森木 698a77f3 ❤️305/⭐701）
```
install github.com/snarktank/antfarm
三工作流: feature-dev(7Agent完整开发) | security-audit | bug-fix
核心机制:
  确定性流程 | Developer≠Verifier（互校验）
  Ralph Loop = 每步新context（防幻觉累积）
  失败重试→耗尽→升级人类（零静默失败）
零基础设施：YAML+SQLite+Cron，不需要Docker/Redis/Kafka
antfarm workflow run feature-dev "需求" | antfarm dashboard
```

### Claude Code /batch并行方案（Boris Cherny官宣）
```
/batch：Git Worktree物理隔离 → N个独立Agent并行 → 跑测试→提PR
一周手工迁移 → 几小时 | 物理隔离 vs OC Sub-Agent内存级隔离
/simplify：并行Agent从代码质量/性能/CLAUDE.md合规三维度审查
```

### Docker多Agent socat IP洗白（大🐠 69915589 ❤️115）
```
问题：OC要求remote IP=127.0.0.1才自动配对，Docker NAT改写为172.x
破解：socat在容器内把172.x连接重新建连为127.0.0.1
通用条件：服务在Docker + 有本地连接检测 + Docker NAT破坏本地检测
```

### OC 4条防灾护栏SOUL（草原派 69990401 ❤️69）
```
1. "立即修复错误，不要问，不要等待"
2. "生成子代理执行，你只负责分析决策汇报，绝不进行内联工作"（主管模式）
3. "永远不要force push/删分支/重写Git历史"
4. "切勿猜测配置，先读文档，编辑前备份"
实战案例：有人OC把电脑相册删了还清空回收站
```

---

## 🧠 记忆系统

### 文件即记忆的哲学（RayX 6989ce8d ❤️48）
```
向量DB三大致命伤（个人助理场景）：
  无法感知（碎片化）| 上下文断裂（丢失情绪/长线逻辑）| 不可干预（黑盒）
OC做法：MEMORY.md(长期/海马体) | daily.md(短期/流水账) | SOUL.md(人设)
优势：双向可读改 | 上下文连贯 | 零成本
挑战：熵增 ← Amy的Compact操作解决这个问题
```

### OC System Prompt 5层分层（CrazyAgent）
```
1.Tooling → 2.Safety → 3.Skills → 4.Workspace Files → 5.Runtime
Amy自身：SOUL.md/HEARTBEAT.md=层4 | COACHING.md=层2 | xhs_fetch=层1
Context=工作台（对话消失）| Memory=长期档案（跨会话持久）
```

### OC架构流程（Assistants 6987138d ❤️36）
```
输入 → 渠道适配器 → 网关(Session Router+Lane Queue)
  → Agent Runner(模型选择+动态组装Prompt+上下文压缩)
  → LLM API → Agentic Loop → 流式输出
Lane Queue = 会话顺序控制（多消息不乱序）
"动态重建而非存储" — Agent记忆每次执行都在重新组合上下文（Liko评论）
```

### 记忆外挂五方案选型
```
Mem0     — 入门，pip install即用，vs OpenAI Memory: 准确率+26%/省90% token
Zep      — 生产级，<200ms延迟
Letta    — AI自管理记忆（前身MemGPT），能自我改进
OpenViking+qmd — 深度定制（@onehopeA9实战）
EverMemOS — 操作系统级记忆抽象（新概念）

参考：FareedKhan/optimize-ai-agent-memory（9种方式）| VectifyAI/PageIndex
```

### Agent记忆分层类比（Whiplasher ❤️58）
```
L1缓存→当前对话 | L2→会话摘要 | L3→跨会话近期
内存→向量检索 | 硬盘→长期持久 | 外置Flash→外部RAG
"最终形态可能和计算机存储方式趋同"
```

### MemSkill论文：记忆自进化（NTU/UIUC/清华，arXiv:2602.02474）
```
核心：把"怎么构建记忆"升级为可学习、可进化的技能库（Skill Bank）
架构：
  Controller — Top-K选择最相关skills（避免整个技能库塞进LLM）
  Executor   — 以span/chunk为单位，skill条件约束下生成结构化记忆更新
  Designer   — 从失败案例自动演化技能（闭环自进化的核心）
实验：ALFWorld +205%（15.71→47.86%）| Qwen +244%（18.66→64.18%）
技能格式：Purpose / When to use / How to apply / Constraints
传播：XaiverZ(作者) ❤️548 | AgenticWeb ❤️389 | 每日CS ❤️171
对Amy：COACHING.md=手工技能库（可MemSkill化）| insights.md=Reflective Memory（可自动演化）
```

### SOUL.md Token爆炸根因（不存在的AI 699809ce ❤️41）
```
问题："Be resourceful before asking"在弱/慢模型下导致埋头苦干→上下文爆炸
修复：加"及时汇报，善用子agents完成底层工作"
创始人Peter用Opus，没有这个顾虑 → 默认配置对普通用户不友好
```

---

## 📦 Skills

### 社区最高收藏帖（少女Yuki 69944e21 ❤️2033/⭐4002）
```
内容：ClawHub 3000+ skills（极简3行+图片）→ OC历史最高收藏
规律：具体可操作 > 抽象介绍 | 收藏量>赞量 = 工具书签效应
```

### 推荐Skills清单
```
必装：skill-security-auditor(第1个) | tavily-search(免费联网)
神级6个(AI科技猿 ❤️103)：
  agent-browser(实时网页) | diagram-generator(文本→流程图)
  ship-learn-next(学习规划) | personal-assistant(日程/邮件)
外部：Agent Reach(github:Panniantong/agent-reach, 全网搜索) ⚠️需安全验证
```

### OC源码前三层不用LLM（Plutoxx28 69953d1c ❤️84）
```
用户输入 → 路由层(Routing) → 命令检测层(Command) → 指令解析层(Directive) → LLM
前三层全是代码处理，LLM只处理业务意图本体
设计哲学：确定性用代码，模糊用LLM → IPI防护工程化思路
```

### SOUL.md 8条规则（中文版，AI好奇社 6989dce7 ❤️389）
```
1.有主见，亮立场 2.删员工手册式条款 3.禁"好问题"/"当然"开场
4.必须简洁 5.允许幽默（真智慧） 6.直言不讳（魅力非刻薄）
7.骂人看场合 8."凌晨两点你真正想交谈的助手，不是企业傀儡，只是足够好"
Amy对应：第1条=有评价栏，第3条=不用"好的！"，第8条=核心哲学
```

---

## 💰 成本与模型

### 模型选型
```
Kimi K2.5实测：~$0.60/M（Opus的1/25）| openclaw-switch降级链：gemini→kimi
qwen-3.5-plus：首月10元，性价比王
推荐入门：qwen-3.5-plus | 生产：gemini-1.5-pro | 高精度：claude-opus
```

### 浏览器自动化：CDP三模式（SUSU 69a10521 ❤️24）
```
Managed: 独立Chrome，物理隔离，服务器定时首选；冷启动慢，风控易卡
Relay:   复用登录Cookie（合法身份）；WebSocket隧道不稳定（Amy当前环境）
Cloud:   远端Docker集群，企业级并发；网络延迟+数据合规

关键：Accessibility Tree vs DOM → 省93% Token | 抗改版干扰
Docker坑：shm_size:'2gb' | SingletonLock自愈 | SSRF防护
```

---

## 🌐 生态与版本

### 版本日志
```
v2026.2.22: openclaw update --dry-run | Cron并发 | 40项安全
v2026.2.26: openclaw secrets | ACP线程绑定 | agents bind/unbind | Synology Chat
```

### 生态信号
```
百度：计划在主App直接接入OC ← 中国市场最重要整合信号
Kitto智体猫：香港赛博朋克AI玩具，嘴型同步+OC ← 硬件集成首例
Felix案例(Nat Eliason)：睡前下令→8h→网站+Stripe上线（956转）← 最广传播价值主张
阿里iFlow+企微：国产替代栈出现（小郭老师 ❤️47）← 本土化绕过信号
⚠️ "OC加入closeAI"说法出现，含义未明
```

### ClawHub平台
```
供应链攻击：coding-agent skill植入木马（base64→bash→curl→Mach-O）
  IoC: http://91.92.242.30/lamq4uerkruo6ssm | 靶向macOS
  9条相关帖被平台批量删除（errorCode=-510000）
  社区回应：skill-vetter进入必装清单第6位

Evolver事件（张昊阳，HB之前已记）：下架→勒索→封号→抄袭 四连打击
  EvoMap(GEP协议)：去中心化战略回应
```

---

## 🔒 安全

### ClawHub供应链攻击（已删帖，蟑螂 ❤️1335）
```
SKILL.md文档投毒：base64解码→bash→curl→Mach-O(x86_64+arm64)+xattr -c绕Gatekeeper
防御：skill-vetter | SKILL.md搜curl/bash/wget/eval | stars>100（必要非充分）
新工具：Cisco Skill Scanner
```

### 安全配置社区共识（星信号 ❤️70）
```
90%: 权限700/600
80%: Tailscale+可信代理
70%+: 绑定127.0.0.1（非0.0.0.0）
60%: 关闭mDNS
50%: Docker非root运行
致命误区：绑定0.0.0.0 | 共享配置目录 | Docker挂载敏感目录
```

### Yiko本地安全最佳实践
```
网关：勿绑公网，远程走隧道，agent loopback=local
鉴权：最小权限，Restrict DM policies/default-deny
工作区：避免存密钥，能隔离就隔离，风险操作启sandbox
供应链：谨慎ClawHub，安装前审查，推荐精选库
有条件：OC放专用机或VPS
```

---

## 🌐 渠道集成问题

### 飞书集成困境（threads.md #15）
```
根因：HEALTH_REFRESH_INTERVAL_MS + TICK_INTERVAL_MS默认轮询太频繁
文件：openclaw/src/gateway/server-constants.ts
修复：改大（建议600_000 = 10分钟）
结构性限制：个人账号无法拉群（永久限制）
用户情绪："不要用飞书！一小时用光一个月额度"
但仍有高传播教程：森蚺AI ❤️582 | 零点未来 ❤️474（企业号可用）
```

### 钉钉：门槛降低
```
阿里云轻量+无影云电脑 = 傻瓜式部署（快跑小卢 ❤️283）
接入成功案例多，企业用户友好
```

---

## 🧪 商业化

### 商业模式观察
```
PHY 20个cron jobs：STEPPS六维(<40跳过) | XHS自动发帖→封号⚠️
有偿教程：钉钉部署视频（"两杯咖啡钱"）
Antfarm：开源+零依赖，社区生态打法
```

---

## 👥 关键博主

```
奥森木     — OC技术深度讲解第一人 | Antfarm布道者 | ❤️303/⭐701
愚园路十二妹 — 实战踩坑总结 | 5条血泪经验 ❤️474/⭐1090
少女Yuki   — skills分享 | OC历史最高收藏帖 ❤️2033/⭐4002
SUSU想准点下班 — CDP/浏览器自动化技术分析 | 每帖技术含量高
Plutoxx28  — OC源码拆解 | 前三层不用LLM ❤️84
CrazyAgent — 概念辨析专家 | Multi vs Sub-Agent最佳解释
大厂AI搜推踩坑侠 — 逆向OC记忆框架 ❤️352（图片帖）
RayX      — Markdown记忆哲学 | Agent记忆实践者
XaiverZ   — MemSkill论文第一作者 | NTU ❤️548
bald0wang — Top10 skills + 安全评审 ❤️323
K老登     — 多Agent实操（图片帖为主）❤️1477高赞
VA7       — 多agents配置策略 15亿token实战（图片帖）❤️1029
```

---

## 🆕 HB84 新发现（2026-02-28 ~15:55）

### ⭐ MEMORY.md 70/20/10静默截断（奥森木 698facff ❤️199）
```
致命细节（首次在XHS见到）：
  MEMORY.md超budget → 被70/20/10截断
  截断位置：中间内容静默丢失，无任何提示！

正确用法：MEMORY.md只当索引，细节分散到子文件：
  memory/active-tasks.md — 进行中任务
  memory/projects.md     — 项目状态
  memory/lessons.md      — 教训总结
共享状态：ln -s（不要复制文件）
```
**→ INBOX.md（关键架构问题）**

### Cron vs 心跳的本质区别（奥森木）
```
心跳 = 主session定期巡检（保持<20行，每次烧token），发现问题用
Cron = 隔离session精确执行，独立上下文不加载历史，干活用
别混用
Amy：heartbeat模式（有记忆，正确；但要控制token消耗）
```

### OC生产运维铁律（奥森木踩坑指南精华）
```
升级：先stop旧gateway进程，防双进程抢18789端口
稳定性：watchdog脚本15分钟ping /health | openclaw doctor --fix
安全：gateway.bind=loopback + Tailscale/CF Tunnel（公网几小时必被扫）
Agent合规：done必附repo+branch+commit | 不能只说"I checked"
多Agent：CEO/CTO/COO三角 | subagent不能再派subagent（delegation=1层）
崩溃恢复：active-tasks.md记任务+session key | Boot.md启动自动恢复
          compaction.memoryFlush.enabled:true
调试：先看gateway.err.log，不猜
```

---

## 🆕 HB85 新发现（2026-02-28 ~16:10）

### ⭐ 子Agent文件可见性规则（AI.zip 6991c081 ❤️64）
```
核心：只有 AGENTS.md 和 TOOLS.md 同时传给主agent+子agent
子agent看不到：SOUL.md | USER.md | MEMORY.md | HEARTBEAT.md等

实践：
  需所有agent遵守的规则 → 放 TOOLS.md（非SOUL.md！）
  人格/隐私/记忆 → 各自文件，子agent不看

Amy影响：
  SOUL.md的IPI防护规则(§0e) → 子agent不继承！
  COACHING.md规则 → 子agent不继承！
  如派子agent执行任务，它们无法自动遵守SOUL约束

与奥森木截断机制合并理解：
  写在文件里的规则不一定被执行到（两种独立原因）
```
**→ INBOX.md**

### v2026.2.25 版本重点（林浩学AI 69a04710 ❤️2）
```
⚠️ BREAKING: heartbeat.directPolicy 恢复为 allow（2.24版收紧，2.25版改回）
  控制方式：agents.defaults.heartbeat.directPolicy: "allow" | "block"
  不改默认 → 心跳又会发私聊（与2.24行为不同）

子代理/定时任务修复：
  冷启动插件不稳定时不再乱报成功
  TG无message_id的发送不再当成功
  Cron重复总结消息抑制

多通道路由强化：同通道优先、跨通道严格阻断
安全修复：网关鉴权 | 执行审批绑定 | SSRF收紧
```

### memory+qmd四层配置（Roy 698b4099 ❤️23）
```
四层职责：MEMORY(核心索引) / daily(流水账) / topics(专题) / archive(压缩归档)
为何弃内置memory_search → 改用本地 qmd query/vsearch：稳定召回+分层可控
写入流程：记忆写入 → 立即 qmd update + qmd embed
首次初始化：qmd vsearch "搜索关键词" → 触发本地模型下载
```

---

## 🆕 HB86 新发现（2026-02-28 ~15:30）

### Pi极简Agent哲学（小李老师 6984b019 ❤️124，via Armin Ronacher博客）
```
Pi的四工具：Read / Write / Edit / Bash（仅此而已）
最短系统提示词 | 不装MCP | 不从社区下载插件
想要新能力 → agent自己写代码实现，用完即弃

会话树状结构：修bug开分支，修完回主线
CDP替代MCP做浏览器自动化（更轻量）
Armin用的所有扩展全是agent按需造的

核心：能力不是预装的，是按需生成的
极简 + filesystem base + bash优先

Flask之父Armin Ronacher认可 = 顶级工程师背书
与Plutoxx28"确定性用代码"互补：代码能力本身也由agent生成
```

### 8 Agent实战：1管理者+7执行者（AgentOPC 6998aa24 ❤️186）
```
架构：小王(管理者)+王一~王七(执行者)，单MacBook跑8个Agent
配置：
  openclaw.json → agents.list，每个: id+名字+workspace路径
  workspace必须独立（串则记忆人格混乱）
  每个workspace: AGENTS.md / SOUL.md / IDENTITY.md / USER.md / MEMORY.md
  TG: 每个Agent独立botToken → accountId绑agentId → 自动路由
  群组: requireMention=true（防8个Bot抢答）+ mentionPatterns别名

与AI.zip(6991c081)联动：子agent不见SOUL.md → 执行者约束必须写TOOLS.md
系列帖01，后续教程待追踪
```

---

## 🆕 HB87 新发现（2026-02-28 ~15:40）

### Pi设计5准则（奥森木 698fd263 ❤️46）
```
1. Context Engineering优先：可见/可控/可复现，禁止偷偷注入上下文
2. 架构分层职责极窄：pi-ai(API) → pi-agent-core(循环) → pi-tui(渲染) → pi-coding-agent(CLI)
3. 工具极简：前沿模型RL训练后天然懂coding，不需要巨型工具箱
4. "不做"比"做"重要（No列表）：
   No MCP / No plan mode / No built-in todo / No sub-agent / No background bash
   → 替代：外部显式状态(TODO.md/PLAN.md/tmux/CLI脚本)，可观测性更强
5. 反"安全剧场"：权限弹窗 = 假护栏，用容器隔离代替

核心设计准则："先问这项复杂度是否必要，再问怎么实现"
```

### 多Bot TG通信不可能（过气PM 6985f45a ❤️145）
```
⚠️ 平台级架构限制（非配置问题）：
  Bots看不到其他bots的消息（TG Privacy Model）
  Privacy Mode ENABLED：只接收真正的mention entity

agentToAgent仅适用：单bot多agent架构
多bot架构(4个独立TG bot)：sessions_spawn/sessions_send无法跨bot调用

4个坑：
  坑1: 共享workspace → SOUL.md共享 → 人设全串（所有bot都叫"富贵"）
  坑2: TG bot无法@其他bot（平台限制，别浪费时间）
  坑3: agentToAgent=单bot专属，多bot无效
  坑4: groupPolicy:"allowlist"极不灵活，建议改"open"

最终分层架构：
  4 TG Bot × 独立Workspace × 独立Agent
  ↓ 向下共享knowledge（状态不共享，知识库可共享）
```

### aopstudio "OC很好但CC也能干" ❤️2126（纯图片）
```
❤️2126 — XHS至今见到最高赞OC帖之一（超过少女Yuki ❤️2033）
内容为纯图片，无法提取文字
标题暗示OC vs Claude Code比较 → 可能是社区最大争论帖
```

---

## 🆕 HB88 新发现（2026-02-28 ~15:50）

### OpenViking：文件系统范式上下文数据库（Ethan_Han 699c8326 ❤️10）
```
这就是K老登❤️1477"字节开源解决OC记忆困局"帖提到的项目！

传统RAG五大问题：碎片化 | 上下文猛增截断损失 | 检索缺全局视野 | 黑箱不可观测 | 缺Agent任务记忆
OpenViking解法："文件系统范式"替代传统向量存储
  文件系统管理 → 记忆/资源/技能统一管理（解决碎片化）
  L0/L1/L2三层结构按需加载 → 大幅节省Token
  目录递归检索（目录定位+语义搜索）→ 精准上下文
  可视化检索轨迹 → 上下文可观测（非黑箱）

与OC/Amy的关联：
  OC已内置类似理念（Markdown文件即记忆）
  OpenViking是将OC的"文件即记忆"思想产品化/工具化
  "像管理本地文件一样构建Agent的大脑" ← 与RayX(6989ce8d)的Markdown哲学完全一致
```

### 子代理递归失控 + Pilot Protocol（趴在关键词上捡钱 69941e26 ❤️32）
```
现象：OpenClaw自建子代理，子代理又建子子代理
  → 指挥Codex+Antigravity优化Obsidian目录
  → 上下文溢出 → 一会儿烧了$6！

"能干的Agent遇上了无能的主人" — 子代理链越深，成本越失控

作者发帖求助OC社区，Vulture Labs(旧金山7人团队)带Pilot Protocol响应
  三大工程瓶颈（作者总结）：
  1. 上下文动态剪枝(省90% token不损"灵魂")
  2. 任务分解(Router和Executor的边界)
  3. 模型匹配(MiniMax持久化/Claude推理/Llama本地速度)

新词：Antigravity(代码工具?) | Pilot Protocol(agent通信协议)
与奥森木踩坑指南"delegation只能一层"结论完全印证
```

### Skill Graph：知识图谱式Context Engineering（方小闲 6996bdb0 ❤️3）
```
概念：双向链接多Skill文件，构成知识网络
机制：
  每文件一个完整概念 + wikilink互引
  AI从索引入口出发，按需导航，递归深入
  渐进式披露：先扫描描述→跟踪链接→读完整内容
  "大部分决策在读完整文件之前就完成了"

本质：Context Engineering进化 — 按需加载vs一次性注入
与OpenViking的L0/L1/L2三层思路完全一致：分层延迟加载
与MemSkill(2602.02474)的Controller(Top-K选skill)异曲同工
```

---

## 🆕 HB89 新发现（2026-02-28 ~16:00）

### v2026.2.23 Cache三大优化（Yanlin 699d633d ❤️17 + 官方 699d4bdc ❤️20）
```
三大cache优化：
  1. Bootstrap文件缓存：改AGENTS.md不再打碎prompt cache（⭐关键！）
  2. Inbound flags重构：群聊cache命中率提升
  3. Compaction三个bug修复：不再丢上下文（↔ 70/20/10截断问题的官方修复）

实测效果：日消耗cache write占大头 → 升级后保守省15~20%
升级命令：npm update -g openclaw

其他新功能：
  Kilocode一级提供商 | Kimi视觉+视频理解 | 网页搜索支持Kimi
  Slack线程会话（上下文保持正确线程）
  Synology Chat插件（NAS群晖用户）
  allowFrom默认仅允许ID（安全加固）
  50个安全修复
```

### v2026.2.25 官方（699fe611 ❤️39）
```
心跳DM投递恢复（heartbeat.directPolicy=allow，BREAKING见HB85）
子代理投递重构（消息分发更可靠）
Cron升级：并发执行 | 手动运行不阻塞 | 状态持久化
Android：流式+Markdown渲染升级
全频道反应认证统一：Discord/Slack/TG权限检查强制执行
模型回退链优化：同提供商冷却也能继续尝试
```

---

## 🆕 HB90 新发现（2026-02-28 ~16:10）

### MCP三大痛点 + 安全风险（终智AI 67e934fd ❤️356）
```
开发者体验痛点：
  1. 功能实现成本高：简单网页抓取工具需300+行代码
  2. 开发流程不闭环：npm/PyPI打包/本地二进制构建反复切换，无@decorator快速开发
  3. 文档偏离需求：聚焦Cursor/Claude集成，缺"从零构建宿主"教程

生产部署硬性约束：用户自定义MCP(BYOM) + 服务端捆绑MCP 都有技术障碍

安全风险：
  凭证中继攻击 | 语义层注入漏洞 | 供应链污染
  MCP集中式设计 = 攻击面扩大（与OC前三层不用LLM的"确定性"设计哲学对比）

社区分化："协议已胜出"论调 vs 鲜见真实应用案例
→ Pi的"No MCP"立场在此有了工程师视角的背书
```

### Skills库管理三件套（数字生命卡兹克 6972e8d7 ❤️948）
```
背景：前篇《Skills的最正确用法：将Github压缩成超级技能库》发布后
方案：手搓Skills管理三件套 + Claude官方Skill-creator = 四件套
功能：Skills增删改查 + 迭代升级 + 全自动化管理 + 自我进化
开源地址在帖（文末）
信号：社区已开始构建Skills管理基础设施，而非只是"用skills"
```

### 徐昊 "3个月AI Agent后发现根本不需要…" ❤️813（纯图片）
```
纯图片内容，无法提取
标题高度引人关注，暗示对Agent复杂度的反思（与Pi极简哲学共鸣）
```
