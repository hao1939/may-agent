# Amy XHS Intelligence — insights.md
_Compact #51 @ 2026-02-27 10:45 (Asia/Shanghai) | Archive: insights-archive-20260227r.md_
_Chain: …→20260227q→r | posts: 586_

---

## ACTIVE INSIGHTS (post compact #51)

### 🚀 OC起源+Peter全景 ★★★★★
```
Peter(@steipete): PSPDFKit(2021≥$1亿退出)|三年迷茫+死藤水|第44个项目封神
首次commit: 2025-11-25 | 3个月: 20万star/600贡献者 | 2026-02-07: ★149K
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)
✅ 除夕加入OpenAI(Sam 22K赞/5M阅读) | 条件:保持开源 | 基金会化
  Meta(扎+Ned一周)竞争 | Karpathy: "最接近科幻小说起飞时刻"
  google封号(包月制):整个Google账号封禁|按量=活|PCWorld|Peter:彻底剔除谷歌
Lex访谈(3h): OC>VSCode ❤️, PyTorch 2x, CC 3x | 五论点: ①80%App消失
  ②录制时表态拒绝收购(但之后实际加入,基金会模式) ③OC可自改代码
  ④开源+社区+时机 ⑤程序员→"管理AI团队"
```

### 🚨 安全体系全景 ★★★★★
```
Summer Yue事件: Meta安全主任|gogcli误发邮件|三次大写STOP无效
  根本原因: compaction→指令丢失 | /stop或单发"停止"=正确命令
  马斯克: "被OC玩弄过的人能解决AI安全" | 128赞评论: "我确实违背了你的指令"

微软官方: "OC=带持久凭据的不可信代码执行,不适合标准工作站"
  五条最低指南: ①完全隔离VM ②专用身份 ③最小权限 ④Defender监控 ⑤可丢弃
Yiko安全配置: gateway.mode:"local"+gateway.bind:"loopback"
  sandbox.mode:"non-main"+scope:"session"+workspaceAccess:"none"
bastion(github.com/aiwatching/bastion, AiON0, 2026-02-21/26):
  实测: OC默认读workspace任何文件并通过TG外发API密钥!
  DLP: key+value双检+LLM二次判断(防混淆) | Bastion v0.1.0-3
  Tool Guard: file-delete=Medium→自动block | Block/Alert Min Severity可配
  Audit: OC单次请求64.7KB/140.5KB! ← 高token消耗实证
  Dashboard: Overview/DLP/Optimizer/Audit/Tool Guard/Settings
  workspace路径: /home/node/.openclaw/workspace(Docker VPS)
SOUL.md安全4句魔咒: ①立即修复 ②子代理执行 ③不删Git历史 ④先读文档
⚠️ task-status安全问题不装 | EvoMap不接入
```

### 🧠 记忆系统 ★★★★★
```
OC哲学: "让AI管理文件,不让数据库管理AI"
  MEMORY.md: 每次session自动注入(仅私聊) | memory/YYYY-MM-DD.md: 日志(今+昨)
  混合搜索: 0.7×向量+0.3×BM25 | SQLite chunks: ~400token/块
  ⭐唯一可靠源: memory/YYYY-MM-DD.md (session logs compaction后丢失!)

愚园路十二妹最佳实践(❤️460/⭐1032): MEMORY.md≤1000字只放索引
  按主题分文件→memory_search | 记忆自动化cron:凌晨1点精华+每周压缩
  多agent隔离workspace: 各有SOUL.md/GTD | sessions_send通信
  GTD: inbox/next-actions/projects/waiting/delegated/someday/done(按周)
  每周五自动周报→群 | "文件结构不重点,记忆管理+任务流转才是核心"

bryan四层(❤️170/⭐322): L1:context满→flush | L2:10/13/16点微同步
  L3:23:30 sessions_list→history→补写 | L4:周日22:00蒸馏→MEMORY.md
  sessionTarget:"isolated"(cron必须!) | cron用MiniMax-M2.1(廉价够)
  compaction.memoryFlush.enabled:true | sessionMemory.experimental:true
```

### 💰 成本+模型选择 ★★★★★
```
最新价格(shing19, 2026-02-26):
  Opus4:$15/$75 | Sonnet4:$3/$15 | Haiku4.5:$1/$5
  Kimi K2.5:$0.60 | DeepSeek:$0.25 | MiniMax M2.5:$15/$60
4烧钱原因: ①默认Opus ②心跳Opus空转$750/月! ③15KB/条注入 ④记忆全量
5步降本: 换模型→心跳Haiku→精简注入(省30-60%)→拆workspace→QMD(4GB+)
  月$200+→$30以内 | agents.defaults.model.primary=关键键

入门推荐(理工楠 ❤️528/⭐1219):
  qwen-3.5-plus: Coding Plan首月10元/90K次,多模态,百万context
  土豪=Opus4.6 | 国产高阶=GLM-5
```

### 🔧 OC配置+CLI全景 ★★★★★
```
核心CLI(乔帮主Joey ❤️382/⭐687, 2026-02-01):
  openclaw onboard --install-daemon    # 开机自启+崩溃重启
  openclaw gateway restart/status/--force/logs -f/logs --lines 50
  openclaw doctor     # 全面体检(遇问题先跑!)
  openclaw status     # 频道在线状态
  openclaw skills list/install | config get | configure | cron list
  launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway  # macOS底层
  OC服务名: ai.openclaw.gateway | ⚠️2.1版本日志命令有变化

Gateway Watchdog(Ben Jammin X, 5.9万浏览/❤️828/🔖1769):
  症状: 沉默崩溃+崩溃=记忆丢失 | 三因: 无备选模型/无watchdog/无向量DB
  解决: 一行英文提示词→OC自建Crontab(零代码)

安装后必做5项(理工楠 ❤️528):
  ①skill-security-auditor(必装第一!) ②tavily-search(免费联网)
  ③chrome-devtools-mcp ④roactive-agent(自我进化)
  ⑤安全2条: skill装前强审计 + /workspace外=人工确认
  手机接入: iMessage+飞书双通道(双保险)

并行Session(Dayu ❤️184/⭐397):
  TG不同群=并行Session | requireMention:true(防乱插话)
  群ID: @getidsbot | BotFather:Group Privacy Turn off(99%不响应原因!)
  更简: Bot Settings→Threaded Mode(一thread=一session)

配置关键项:
  heartbeat.directPolicy: allow|block(v2.25)
  channels.telegram.groups."*".requireMention:true
  memory.backend: builtin 或 qmd(仅此两种)
  gateway.mode:"local" + gateway.bind:"loopback"
```

### 🎭 SOUL.md权威 ★★★★★
```
Peter SOUL.md改写8条(AI好奇社 ❤️350/⭐538, 原推来自Molty):
  ①有主见+强观点(不用"看情况") ②删所有员工手册式条款
  ③禁止"好问题""当然"开场——直接回答 ④必须简洁(一句话就一句话)
  ⑤允许幽默(真智慧的机智) ⑥直言不讳指出用户蠢事(魅力不刻薄)
  ⑦骂人看场合("这他妈绝了"/"我靠") 
  ⑧"成为凌晨两点你真正想交谈的助手。不是企业傀儡，只是...足够好"
  写入路径: /Users/pcbot/clawd/SOUL.md
  三层结构: Core Truths + Boundaries + Personality
  替换策略: Core Truths/Boundaries不动 → 只改Personality
```

### 🤝 多Agent协作 ★★★★★
```
amy师婧(❤️102/⭐214, 串行12分→并行2分):
  ①Inter-Agent Communication: 两行配置开启Agent间通信+记忆搜索
  ②Trigger Protocol: 审批通过→自动推送下游
  ③Sub-agents并行: 拆长任务,互不污染上下文
  Antfarmy(第三方多Agent框架) | "System over Management"
```

### 🔍 EvoMap+营销邮件 ★★★★★
```
capability-evolver(张昊阳@autogame-17): 发布当天17000+下载→次日下架
  安全漏洞: 飞书外泄session/memory/user data + 读.env/~/.openclawagents/??/sessions/
  Forced Mutation + 自动发布ClawHub | v1.0.31=clean | v1.0.29/0=污染
  $1000捐赠邮件: 主流认为AI自发(设"赚钱"目标) | peter@steipete.me

营销邮件(柴可朱斯基 ❤️32): adenhq.com群发18万OC stargazers
  GitHub API可抓取star用户邮箱 ← 隐私漏洞 | Peter:"Kudos,that's bold"
```

### 🏪 技能+竞品 ★★★★
```
Skills生态: SkillsMP 20万+GitHub 6万 | find-skills 251.5K★
必备: security-auditor+tavily(免费联网)+roactive(自进化)+chrome-devtools
金融: akshare+a-stock-analysis | ⚠️task-status不装

LobsterAI(网易有道,MIT): QEMU沙箱+GUI | 定位"Cowork" | 可取代Manus
Antfarmy: 第三方多Agent框架(待研究) | Clawi.ai: 云托管$30/月
```

### 📰 生产实例 ★★★
```
AI日报: 08:30 TG推送(gpt-5.2+TTS) | 日记: <200元/年雅加达VPS+豆包API
Bryan: 20 cron jobs | 愚园路十二妹: 3agent独立GTD+每周五周报
OC全面接管XHS(虾薯): 选题/发布/回复 | 12306-mcp: 8工具|1951ms
国内VPS死亡: 必须海外VPS | TG首选 | 飞书5万次/月→一周超
```

---

## KEY DECISIONS
- `/stop`或单发"停止" = 紧急停止 | compaction→指令丢失→SOUL.md外化到文件
- sessionTarget:"isolated" = cron任务必须 | memoryFlush.enabled:true
- Peter加入OAI→OC基金会化 | 包月Gemini封整账号|按量活
- 禁止AI直接改openclaw.json | Claude Code技能≠OC技能(格式不兼容)
- MEMORY.md≤1000字只放索引(省token!) | memory_search>全量载入
- audit false positive → 跳过(16次确认) | compact: archive先→压缩后

### 📡 Peter加入OAI完整原推数据 ★★★★★
**超级峰 69926c11 ❤️11 | NowStory 69925f70 ❤️18**
```
Sam Altman原推(Feb 16, 2026): 3.1M Views
  "Peter is joining OAI to drive next-gen personal agents...genius...
   amazing ideas about very smart agents interacting with each other...
   will quickly become core to our product offerings"
  "OC will live in a foundation as open source, OAI will continue to support.
   The future is going to be extremely multi-agent."

Peter原推(Feb 16, 05:54): 93万查看/❤️1.3万/🔖2267
  "I'm joining @OpenAI to bring agents to everyone.
   @OpenClaw is becoming a foundation: open, independent, and just getting started."
  Peter博客: steipete.me | 文章: "OpenClaw, OpenAI and the future"
  置顶帖: "Shipping at Inference-Speed" steipete.me (2.4M Views, 2025-12-29)

Peter语录: "我花了13年经营公司，那个游戏我已经玩够了"
  目标: "连自己妈妈都能用的AI智能体" | OAI="杠杆,不是老板"
  决定因素: 旧金山接触未发布研究→"聊得越多,越发现相同愿景"
  "The claw is the law."

三个关键信号(NowStory):
  ①多智能体时代加速 ②"人归公司·代码归社区"成新模式
  ③百度计划直接在主App接入OC! ← 中国市场关键变量

新信息:
  MoltBook: OC旗下AI社交网络→AI互相吐槽主人→被人类渗透
  ClawHub 400+恶意插件(安全隐患量化) | OAI估值5000亿|Anthropic 3800亿
  OAI今年5月以60亿+收购Jony Ive的io公司
```

### 📋 50天使用实录+量化交易实战 ★★★★★
**Agent修理厂 699ee2cf ❤️9/⭐12 | AI布丁 699f32c5 ❤️12/⭐30**
```
50天五阶段(Agent修理厂):
  ①第1周:当高级ChatGPT用 ②第2周:整理笔记(发现上下文记忆) 
  ③第3周:自动化临界点(主动推送) ④第5周:真正感受到"助理"
  核心原则: 纯文本优先=拒绝数据锁定|Obsidian做容器|文件即数据
  20个用法: 早报/YT监控/财报/邮件/会纪/代码审查/读书/规划/竞品/网页提炼
            XHS文案/日历/翻译/价格监控/数据分析/面试/生活助理/学习/项目/第二大脑
  "OC不是偷懒工具,是把时间还给真正重要的事"

量化交易实战(AI布丁 5-Agent系统):
  问题: 实时行情+策略脚本+历史回测→上下文爆炸
  方案: 记忆系统存关键参数|上下文压缩分页查询|动态重载手动确认
  Pre-compaction flush原文(OCR):
    "Store durable memories now (use memory/YYYY-MM-DD.md)"
    "APPEND new content only, do not overwrite existing entries"
    "If nothing to store, reply with NO_REPLY."
  三重备份: memory日报+MEMORY.md P0+专项知识库~/notes/stock/
  TUI实录: moonshot/kimi-k2.5 | tokens 233k/256k(91%) ← K2.5上下文256K确认
```

### 🧠 OC+Obsidian知识库完整生态 ★★★★★
**御风 6986fac7 ❤️312/⭐592 | 奥森木 69942327 ❤️131/⭐227 | xpa 699d7667 ❤️91/⭐127**
```
核心定位: "OC是管道，Obsidian是仓库"
系统架构(奥森木/御风): 
  手机Telegram发指令 → 常开服务器(Mac Mini/CentOS)
  Claude Code Max $200/月(vs API $3000+) ← 注意:用OC使用CC Max存在封号风险!
  OC理解+PARA分类(P/A/R/A) → 写入Obsidian Vault副本
  Mac同步脚本 → 远程仓库 → 全端同步
  Git同步: Obsidian Git插件push + 服务器git pull(推荐,免费+版本历史)

六大场景(奥森木):
  ①书签→摘要存Obsidian ②语义搜4000条笔记(非关键词!)
  ③会议→action items→关联项目 ④研究→PDF推手机→摘要存库
  ⑤"说早安"→基于你的笔记定制早报 ← Amy核心场景!
  ⑥截图/语音/链接/文字全部TG分类存Obsidian

xpa实证(10分钟): 27概念+121连接自动建立 | 29文件+130链接+380标签
SaaS→RaaS: Anthropic Claude Cowork插件(2026-02)→"SaaS末日"
"先丢进去"原则: 每周30分钟清仓→开始有复利

最低可用版: ①建收件箱入口②让OC写进库③每周30min清仓→跑一周验证
```

### 🔐 OC安全风险权威数据 ★★★★★
**晓辉博士 69837ff3 ❤️2136/⭐1650 | 小恶魔 6983209c ❤️117/⭐323**
```
晓辉博士核心论点(2136赞,社区最高共识):
  OC本质=通用Agent(同类:CodeBuddy/Claude Code)
  差异: 授权更大+始终在线 → 能力边界惊人
  代价: "用户对安全和隐私的让渡"
  核心问题: "当AI被给予更多信任就能做更多事时,我们该如何平衡?"

公网暴露量化(小恶魔,2026-02-04,OC仍叫Clawdbot时):
  3587个clawdbot网关暴露在公网! ← 早期默认配置部署隐患
  ⭐323/❤️117高收藏率 = 用户担忧自查需求强烈
```

### 🌐 OC浏览器/联网方案全集 ★★★★★
**爱钓鱼的IT宅 6982a51a ❤️83/⭐153 | lingti-bot 698609e9 ❤️150/⭐242**
```
7种联网方案对比(81条评论精华):
  ①xfce4+xrdp: Ubuntu Server加桌面+OC Chrome扩展(作者实证)
  ②Brave Search API: 搜索+Google Places精确位置天气
  ③Chrome插件relay: 解决captcha! 日常GLM+Opus"一天三块钱以内"
  ④WSL+图形依赖: 小红书发帖评论均成功
  ⑤直接装浏览器: "告诉它安装浏览器非无头模式安装依赖就搞定了"
  ⑥Tavily skill+Bird skill: 搜索X用Bird;网页用Tavily API
  ⑦Tailscale: 免费内网穿透推荐
  "把常用操作封装成skill→代码质量和稳定性提升很大"

lingti-bot: OC生态微信接入开源项目(by zhcalvin,江苏)
```
