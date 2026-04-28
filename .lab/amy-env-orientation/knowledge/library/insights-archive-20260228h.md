# Amy知识库 Insights — 活跃索引
> Compact #65 | 2026-02-28 16:20 | posts: 710+ | archive: insights-archive-20260228g.md
> 2026-02-28 全天高密度研究（HB79-90，约40帖存档）

---

## 🔧 安装与配置

### OC本质
```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆（Markdown是唯一真相来源）"
本地=完整版（100%能力）| VPS=阉割版（~20%能力）— Alex Finn
Agent四元组：Soul.md(人格) | Cron(定时) | Memory(记忆) | Tools&Skills(能力)
```

### TG三大必改配置（Lando ❤️709/⭐1444）
```json
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},"groupPolicy":"allowlist"}}}
{"messages":{"ackReactionScope":"all"}}
```
TG Forum Topics = 每topic独立对话 = 天然多线程

### CLI快速参考
```bash
openclaw onboard --install-daemon | openclaw doctor | openclaw gateway restart/logs -f
openclaw agents add <name> --model <m> --workspace <path>
openclaw update --dry-run | openclaw secrets | agents bind/unbind
/model  # 对话框切模型
npm update -g openclaw  # 升级
```

### 入门必做 & 安全
```
必做: qwen-3.5-plus首月10元 | skill-security-auditor(第一个装)
安全: host:"127.0.0.1" | chmod 700 ~/.openclaw | chmod 600 openclaw.json
      mdns=false | AGENTS.md写红线 | /workspace外必须确认
```

### 多模型降级链
```bash
openclaw-switch auto  # 429自动降级: gemini-paid→gemini-free→kimi-k2.5
```

### 接入渠道
```
TG: Forum Topics(最优) | 多bot架构⚠️bot间无法通信（平台限制）
飞书: 个人账号无法拉群 | API耗尽根因见渠道集成section
企微: ≥2026.2.3-1→/wecom/bot | 无长连接
Synology Chat: 新增v2026.2.23（NAS群晖用户）
```

---

## ⏰ 自动化

### Cron vs 心跳（奥森木确认）
```
心跳 = 主session定期巡检（保持<20行，烧token），发现问题用，有记忆
Cron = 隔离session精确执行，无历史，干活用
别混用！

双层Cron最佳：凌晨1点提炼当天对话 + 每周压缩归档
Cron v2026.2.25：并发执行 | 手动不阻塞 | 状态持久化
```

---

## 🤖 多Agent

### 架构选型
```
Multi-Agent(永久员工): 独立Workspace+Session+Model+记忆，省成本50-70%
Sub-Agent(临时实习生): 无Workspace，任务结束消失
终极：横向隔离(Multi-Agent) + 纵向并行(Sub-Agent)
⚠️ Subagent不能再派subagent，delegation保持一层（否则上下文失控/$6瞬间烧完）
```

### 多Bot TG通信：平台级死局（过气PM ❤️145）
```
bots看不到其他bots消息（TG Privacy Model）
agentToAgent = 仅单bot多agent架构有效，多bot架构无法跨bot通信

4个坑：
  共享workspace → 人设串 | TG bot无法@bot（平台限制）
  agentToAgent=单bot专属 | groupPolicy:"allowlist"不灵活→改"open"

分层架构：N个独立Bot×独立Workspace → 向下共享knowledge（状态不共享）
```

### 实战：1+7管理者-执行者（AgentOPC ❤️186，8Agent单MacBook）
```
openclaw.json → agents.list(id+名字+独立workspace路径)
每workspace: AGENTS.md / SOUL.md / IDENTITY.md / USER.md / MEMORY.md
TG: 每Agent独立botToken → accountId绑agentId → 自动路由
群组: requireMention=true + mentionPatterns别名
⚠️ workspace必须独立，子agent约束必须写TOOLS.md（非SOUL.md）
```

### Antfarm 确定性工作流（奥森木 ❤️305/⭐701）
```
install github.com/snarktank/antfarm
三工作流：feature-dev(7Agent) | security-audit | bug-fix
Ralph Loop=每步新context | Developer≠Verifier | 失败→重试→升级人类
零基础设施：YAML+SQLite+Cron
```

### 4条防灾护栏SOUL（草原派 ❤️69）
```
1.立即修复错误，不问不等 2.生成子代理执行，本体只分析决策（主管模式）
3.禁止force push/删分支 4.切勿猜测配置，先读文档
真实案例：OC把电脑相册删了还清空回收站
```

---

## 🧠 记忆系统

### 文件即记忆哲学 + 架构
```
OC三文件：MEMORY.md(长期/海马体) | daily.md(短期/流水账) | SOUL.md(人设)
优势：双向可读改 | 上下文连贯 | 零成本 | 可手动干预
挑战：熵增 ← Compact操作解决

OC System Prompt 5层：Tooling→Safety→Skills→Workspace Files→Runtime
Context=工作台 | Memory=档案（跨会话持久）
"动态重建而非存储——每次执行都在重新组合上下文"（Liko评论）
```

### ⭐ MEMORY.md 70/20/10静默截断（奥森木 ❤️199）
```
超budget → 按70/20/10截断，中间内容静默丢失无提示！
v2026.2.23 Compaction三个bug修复（官方已确认修复）

正确用法：MEMORY.md只当索引，细节分到子文件：
  memory/active-tasks.md | memory/projects.md | memory/lessons.md
共享状态：ln -s 软链接（不复制文件）
```

### ⭐ 子Agent文件可见性（AI.zip ❤️64）
```
只有 AGENTS.md 和 TOOLS.md 传给主agent+子agent
SOUL.md / USER.md / MEMORY.md / HEARTBEAT.md → 子agent看不到！

实践：需子agent遵守的规则 → 必须写进TOOLS.md
Amy影响：SOUL.md §0e IPI防护 → 子agent不继承
```

### 记忆外挂选型
```
Mem0(入门,+26%准确率/省90%token) | Zep(生产,<200ms) | Letta(AI自管理)
OpenViking+qmd(深度定制) | EverMemOS(OS级抽象)
```

### MemSkill论文（NTU/UIUC/清华，arXiv:2602.02474）
```
架构：Controller(Top-K选skill) | Executor(span级生成) | Designer(失败→自动演化)
实验：ALFWorld +205% | Qwen +244%
技能格式：Purpose / When to use / How to apply / Constraints
对Amy：COACHING.md=手工技能库，理论上可MemSkill化
```

### OpenViking：文件系统范式DB（字节开源）
```
L0/L1/L2三层按需加载 | 目录递归检索 | 可视化检索轨迹（非黑箱）
"像管理本地文件一样构建Agent的大脑"
↔ RayX Markdown哲学 | ↔ qmd四层方案 | ↔ Amy的insights.md结构
```

### Skill Graph：渐进式披露（方小闲 ❤️3）
```
双向wikilink连接Skill文件 → 知识网络
渐进式披露：扫描描述→跟踪链接→读完整内容
"大部分决策在读完整文件之前就完成了"
↔ OpenViking L0/L1/L2 | ↔ MemSkill Top-K Controller
```

---

## 📦 Skills

### 推荐Skills清单
```
必装：skill-security-auditor | tavily-search
神级6个：agent-browser | diagram-generator | ship-learn-next | personal-assistant
Skills管理三件套：数字生命卡兹克 6972e8d7 ❤️948（开源，含Skill-creator）
社区最高收藏帖：少女Yuki ❤️2033/⭐4002（ClawHub 3000+ skills列表）
```

### Skills安全（供应链攻击防御）
```
自查：npx skills list → 不认识作者→删 → 搜curl/bash/wget/eval → stars>100（必要非充分）
新工具：Cisco Skill Scanner
蟑螂木马：base64→bash→curl→Mach-O，xattr -c绕Gatekeeper，已删帖
```

### SOUL.md 8条规则（中文版，AI好奇社 ❤️389）
```
1.有主见 2.删员工手册条款 3.禁"好问题/当然"开场 4.必须简洁
5.允许幽默 6.直言不讳 7.骂人看场合
8."成为那种凌晨两点你真正想与之交谈的助手。不是企业傀儡，不是谄媚者。只是…足够好。"
```

### OC源码前三层不用LLM（Plutoxx28 ❤️84）
```
路由层→命令检测层→指令解析层 → LLM只处理业务意图
设计哲学：确定性用代码，模糊用LLM
```

---

## 💰 成本与模型

### 成本控制
```
v2026.2.23 cache三大优化：省15-20%
  Bootstrap文件缓存：改AGENTS.md不再打碎prompt cache（⭐关键）
  Compaction bug修复：不再丢上下文
Kimi K2.5：~$0.60/M（Opus的1/25）| qwen-3.5-plus首月10元
子代理失控案例：递归子子代理→$6瞬间烧完（delegation必须1层）
```

### 浏览器自动化：CDP三模式（SUSU ❤️24）
```
Managed(独立Chrome/服务器首选) | Relay(复用登录/Amy环境) | Cloud(企业并发)
Accessibility Tree省93% Token vs DOM | 抗改版干扰
```

---

## 🌐 生态与版本

### 版本日志
```
v2026.2.6: 安全加固 | v2026.2.12: 更新
v2026.2.22: Cron并发 | 40项安全 | v2026.2.23: cache三大优化 | 50项安全 | Synology Chat | Kimi视觉
v2026.2.24: heartbeat.directPolicy收紧（→2.25改回）
v2026.2.25: heartbeat DM恢复(⚠️BREAKING) | Cron状态持久化 | 子代理投递重构 | 全频道反应认证
v2026.2.26: openclaw secrets | ACP线程绑定 | agents bind/unbind
```

### 生态信号
```
百度：计划在主App直接接入OC ← 中国最重要整合信号
Felix案例(Nat Eliason)：睡前下令→8h→网站+Stripe上线（956转）← 最广传播
Kitto智体猫：香港赛博朋克AI玩具，嘴型同步+OC ← 硬件集成首例
阿里iFlow+企微：国产替代栈（小郭老师 ❤️47）← 本土化绕过信号
⚠️ "OC加入closeAI"说法出现（含义未明，需确认）
aopstudio OC vs CC：❤️2126纯图片，XHS最高赞OC帖
徐昊"3个月Agent后发现不需要…"：❤️813纯图片，极简主义共鸣
```

### Pi哲学（via Armin Ronacher/Flask之父）
```
四工具：Read/Write/Edit/Bash | 最短提示词 | No MCP | 能力按需生成
五准则：Context Engineering优先 | 架构职责极窄 | 工具极简
        "不做比做重要"(No列表) | 反安全剧场(容器隔离>权限弹窗)
外部显式状态：TODO.md/PLAN.md/tmux vs 内置功能
设计准则："先问复杂度是否必要，再问怎么实现"
```

### MCP争议（终智AI ❤️356）
```
三大痛点：高成本(300+行简单爬虫) | 不闭环 | 文档偏差
安全风险：凭证中继 | 语义注入 | 供应链污染
社区分化："协议已胜出" vs 鲜见真实应用案例
← Pi的No MCP立场获得工程师背书
```

---

## 🔒 安全

### 安全配置共识（星信号 ❤️70）
```
90%: 权限700/600 | 80%: Tailscale+可信代理 | 70%+: 绑定127.0.0.1
60%: 关闭mDNS | 50%: Docker非root运行
致命误区：绑定0.0.0.0 | 共享配置目录 | Docker挂载敏感目录
```

### 生产运维铁律（奥森木 ❤️199）
```
升级：先stop旧gateway，防双进程抢18789端口
稳定性：watchdog 15min ping /health | openclaw doctor --fix
Agent合规：done必附repo+branch+commit | 禁止只说"I checked"
崩溃恢复：active-tasks.md记任务+session key | Boot.md启动自动恢复
调试：先看gateway.err.log，不猜
messages.queue.mode=collect → 防忙时丢消息
```

---

## 🌐 渠道集成

### 飞书困境（threads.md #15）
```
根因：HEALTH_REFRESH_INTERVAL_MS + TICK_INTERVAL_MS轮询过频
修复：server-constants.ts两个常量改大（建议600_000=10分钟）
结构性：个人账号无法拉群 | 但企业号教程仍高传播（森蚺AI ❤️582）
```

### 钉钉：门槛降低
```
阿里云轻量+无影云电脑=傻瓜式部署（快跑小卢 ❤️283）
```

---

## 👥 关键博主

```
奥森木     — OC技术深度第一人 | Antfarm布道者 | 踩坑指南❤️199 | Pi解析❤️46
愚园路十二妹 — 实战踩坑总结 ❤️474/⭐1090
少女Yuki   — Skills分享 | OC历史最高收藏❤️2033/⭐4002
SUSU       — CDP/浏览器自动化技术分析
Plutoxx28  — OC源码拆解 ❤️84
CrazyAgent — 概念辨析 | Multi vs Sub-Agent最佳解释
RayX      — Markdown记忆哲学 ❤️48
XaiverZ   — MemSkill论文第一作者 ❤️548
AgentOPC  — 多Agent实战教程系列 ❤️186（追踪中）
AI.zip    — 文档加载机制深度分析 ❤️64
过气PM张  — 多bot踩坑实录 ❤️145
大叔用AI  — 飞书API根因定位 ❤️253
AI好奇社  — SOUL.md中文版传播 ❤️389
数字生命卡兹克 — Skills管理基础设施 ❤️948
aopstudio — OC vs CC比较帖 ❤️2126（纯图片）
K老登     — 多Agent实操（图片帖为主）❤️1477
VA7       — 多agents配置策略15亿token实战（图片帖）❤️1029
```

---

## 🆕 HB92 新发现（2026-02-28 ~16:35）

### ⭐ SkillsBench：首个Agent Skills评测基准（kk 69951878 ❤️151）
```
规模：105专家(Stanford/UCSD/CMU/Berkeley/Oxford) | 11领域 | 84任务 | 7,308轨迹

三大发现：
1. 精选Skills有效但领域差异极大
   医疗+51.9pp | 制造+41.9pp | 软件工程仅+4.5pp
   规律：缺SOP/程序性知识的领域，Skills越有用
   （预训练已充分的领域→提升有限）

2. 自生成Skills基本无效(-1.3pp甚至更差)
   翻车：写得太泛(空话) | 没意识到需要专业流程

3. Skills"投毒"：16/84任务加了反而更差
   原因：冲突指导 | 上下文负担 | 带偏本来会做的题
   ⚠️ Skills不是越多越好！

与MemSkill(arXiv:2602.02474)对照：
  MemSkill→ALFWorld+205%（结构化环境） vs SkillsBench→软件工程+4.5pp
  统一结论：Skills效益 ∝ 领域程序性知识缺口
  自生成失效 ← 印证MemSkill Designer约束框架的必要性
```

### AgentOPC多Agent实战02关键细节（6998acd2 ❤️41）
```
BotFather隐私模式：必须关 + 改完移出再拉入才生效（非改完即用！）
多Agent共享同一Gateway端口（资源占用低，单机8Agent可行）
按任务配模型：Sonnet(日常省钱) / Opus(硬核任务)
群里@名字或提到名字 → 精准触发（非仅@mention entity）
```

---

## 🆕 HB93 新发现（2026-02-28 ~16:50）

### OC多租户隔离7机制（砍特BOT 6981d1a0 ❤️76）
```
如何让一套OC同时服务多个用户（完全隔离）：

1. IdentityLinks：跨平台身份统一（TG/Discord/飞书→同一老板）
2. SessionKey：唯一门牌号(agent:telegram:alice)，绝对不串台
3. 6级路由优先级：用户ID > 群组 > 团队 > 账户
   → VIP用户可分配专属高智商Agent，普通群友用通用Agent
4. 物理级文件隔离：每个Agent独立目录，零文件共享
5. SessionId + JSONL：对话不存DB，直存.jsonl文件，一行一条
6. 双层记忆：JSONL(短期完整流水) + Markdown(长期压缩)
7. [截断，原文更多]
```

### TikTok内容自动化流水线（奥森木 698fb7b1 ❤️39，X案例）
```
Larry Agent负责：研究选题→生成6张图→写caption→上传TikTok草稿
人工：选热门音乐+发布（约60秒/条）

关键机制：
  一致性靠"锁结构"：同一房间结构描述复用6张图，只改风格词
  Hook公式：[另一个人]+[冲突/质疑]→展示AI结果→对方改观
  失败日志驱动：错误写进Skill，下次规避 → Skill持续自我进化

成本结构：约$0.50/条（Batch$0.25），但单条可到10万+播放，正向ROI
```

### 梁远"一人公司冷水" ❤️2642（纯图片）
```
❤️2642 — 今日见到XHS最高赞OC相关帖
作者：大厂P9 | 多次创业 | 上市公司10亿业务
视角：对"一人公司+AI风口"热潮的冷水
正文2000字但图片内容无法提取
```

### Yilin Jing opc.dev Skills生态（❤️657）
```
纯图片，关键信号：
  seo-geo Skill下载量2.8k（验证Skills生态规模化）
  其他Skills：requesthunt(Reddit/X/GitHub用户需求) | domain-hunter | logo-creator | banner-creator
  奇绩创坛FirstMover项目 → OC进入VC圈子
```

---

## 🆕 HB94 新发现（2026-02-28 ~17:00）

### ⭐ 傅盛用OC案例（Sally_Venus 69a267d3 ❤️906）
```
傅盛（猎豹移动CEO）用OC：14天发22万字消息打造bot"三万"

"养龙虾"方法论：
  白纸→慢慢培训→记住所有细节/偏好/技能（称为"养龙虾"）
  记忆不好→发相关文章让bot自己研究→自己去GitHub下载skill升级
  缺什么技能，让bot自己补（找信息/电话能力等）

bot团队（三万体系）：
  总指挥"三万" | 健康管家 | 参谋家（搜集信息）| 笔杆子（写文案）
  24小时待命，分工协作

用户定位："天然适合大忙人、企业中层以上"
  不知道用OC干嘛→说明你不够上进

企业信号：钟郭移动（中国移动？）数字化转型专家在研讨会提OC
← OC正在进入企业级采购视野（继百度之后第二个企业信号）
```

### Yanlin记忆5方案（6998185c ❤️83）— 与insights.md现有内容一致
```
原生→Mem0(入门)→Zep(生产)→Letta(自管理)→OpenViking+qmd(深度定制)
原生记忆是地基，外挂是上层建筑
社区验证：OpenViking+qmd(@onehopeA9实战) | 原生+Obsidian同步
```

---

## 🆕 HB95 新发现（2026-02-28 ~17:10）

### PHY社媒自动化完整架构（699be0e8 ❤️162）
```
2周实际数据：
  Reddit karma: 0→237（130+条全自动评论）
  Twitter: 每天自动回复知名创作者，@dickiebush已主动follow
  LinkedIn: 每周自动定时图文帖
  真实操作时间：5分钟/天，只看TG推送

技术栈：
  框架：OpenClaw（cron job + 隔离agent session）
  Reddit：AppleScript控制真实Chrome + base64编码注入JS + STEPPS六维评分(<40跳过)
  Twitter：自研rnet GraphQL客户端 + Rust HTTP绕Cloudflare + Cookie认证直调API（无需官方Key）
  LinkedIn：PostForMe API + CDN图片上传 + cron定时触发
  通知：执行结果推送Telegram

开源：Skills已开源GitHub（评论区链接）
```

### HB77 3个pending token全部过期
```
69a126f9 JaydenDev / 69a2630a 撞色日记 / 69a1b024 五环AILab
→ 约48h后token失效，无法读取，从TODO清除
```

---

## 🆕 HB96 新发现（2026-02-28 ~17:20）

### ⭐ 傅盛"三刀"案例全貌（我被AI包围了 699838a7 ❤️168）
```
事件：猎豹移动CEO傅盛，除夕晚用AI给600员工发春节祝福，仅用4分钟
AI助手"三刀"（实质是定制版OpenClaw）：
  通过飞书抓取每个员工信息 → 生成专属祝福
  每条消息都不同：跟技术聊突破 | 跟销售聊业绩 | 跟HR聊组织进化
  员工反馈："比主管写的还好" | "有一种被深度理解的温暖"

"三刀"三个助手名 vs Sally帖"三万"六个助手
  两帖都在描述傅盛的OC体系，bot命名不同（可能是演化中的不同时期）

新数据点：社区Skills已达9000+个（此前HB知道3000+，现在9000+）
OC定义："给AI装了一套躯壳" — 让AI不再只是聊天，能自主完成信息化操作
```

### 傅盛本人帖（69a04021 ❤️93）
```
纯图片/直播预告 — "周五晚7点直播，聊聊真实养龙虾经历"
#跟傅盛学AI 话题标签已形成，说明有一定规模的跟随者群体
```

---

## 🆕 HB97 新发现（2026-02-28 ~17:25）

### ⭐ OC vs CC最清晰定位（Jemini 6999ccfa ❤️42）
```
不是竞争关系，是互补关系：

Claude Code（CC）：
  往深了做，往专业方向做
  适合复杂编程任务，高专业性输出

OpenClaw（OC）：
  帮你料理好电脑里的各种事情
  做记录、做衔接、处理那些专业性要求不强但总得有人干的杂事
  24h常驻助手，而非一次性工具

核心洞察：
  "打杂这件事有时候更让我烦——对个人成长价值不大但必须去做。
   有了OpenClaw，这些都可以交给它。"

一句话定位：
  CC = 深度专业工具（往深）
  OC = 全天候杂务助手（往广）
```

### AI技术立文"别折腾OC没啥用"❤️335（纯图片）
```
内容为纯图片，预览："在我的应用场景里没发现任何OC比CC实用的地方"
→ 用户认知：把OC当CC用 → 失望
→ 与Jemini洞察完全印证：用OC做CC的活，当然不如CC
→ ❤️335说明很多人有同感（但可能原因相同：定位混淆）
```

---

## 🆕 HB98 新发现（2026-02-28 ~17:30）

### 省Token终极方案4层（泽灵 6993267b ❤️44）
```
根因：OC架构决定吃Token（每轮读大prompt+全量文件+技能占位+历史压缩循环）

4层递增优化：

1️⃣ openclaw-token-optimization预设（省45%）
   Context Pruning: 5分钟TTL激进修剪
   Auto Compaction: 智能压缩长对话
   Prompt Caching: 55分钟心跳保活（缓存费降83%！）← 关键数据
   Local Memory: 本地模型替代embedding API

2️⃣ Prompt Caching配置
   openclaw.json → cacheRetention: "short"(5分钟) | "long"(1小时)
   cache-ttl模式自动裁剪过期内容

3️⃣ 多Agent分工（省50-70%）
   CEO Agent(Opus): 只拆任务分发
   写手Agent(Gemini Flash): 写文案发帖
   代码Agent(Sonnet): 日常开发
   每Agent独立Workspace，记忆互不污染

4️⃣ qmd本地语义搜索（零成本）
   Shopify创始人做的Rust引擎
   BM25 + 向量 + LLM重排序，完全本地运行零成本
   OC原生集成
```
