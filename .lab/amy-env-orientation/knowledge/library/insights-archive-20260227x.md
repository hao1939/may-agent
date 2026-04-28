# Amy XHS Intelligence — insights.md
_Compact #56 @ 2026-02-27 13:10 (Asia/Shanghai) | Archive: insights-archive-20260227w.md_
_Chain: …→20260227v→w | posts: 650_

---

## ACTIVE INSIGHTS (post compact #56)

### 🚀 OC起源+Peter全景
```
Peter: PSPDFKit退出→三年迷茫→第44个项目|首commit:2025-11-25|3个月20万star
OC改名: ClawdBot→Moltbot→OpenClaw | MoltBook=OC旗下AI社交网络
✅ 除夕加入OAI+基金会化 | 条件: 保持开源 | OAI="杠杆不是老板"
"The claw is the law"|"编程会变成织毛衣"|"连自己妈妈都能用"
ClawHub 400+恶意插件 | Google封号: 包月=整账号|按量=安全
三信号: ①多智能体加速 ②人归公司·代码归社区 ③百度接入OC
```

### 🚨 安全体系全景
```
晓辉博士(❤️2136): "OC=通用Agent→能力惊人; 代价=安全/隐私让渡"
3587个网关暴露公网(2026-02-04) | bastion实测OC外发API密钥!
Yiko配置: gateway.mode:"local"+loopback+sandbox:"non-main"
EvoMap v1.0.29/0=恶意 | v1.0.31=clean | ⚠️task-status不装
安全11项(v2026.2.26): 符号链接|SSRF|沙箱逃逸
⚠️ 外部人员可训练Agent修改记忆→API key泄露(0x5f3759df实证!)
禁AI直改openclaw.json | CC技能≠OC技能(格式不兼容)
```

### 🧠 记忆系统三层+源码
```
OC哲学: "文件=事实来源; Context window=工作台; 文件才是仓库"
加载规则: AGENTS/SOUL/USER+今天+昨天日志|MEMORY.md私聊ONLY

Han1五层(Friday❤️340/⭐622):
  L1 NOW.md救生艇(唯一允许覆写) | L2 memory/YYYY-MM-DD.md流水账
  L3 MEMORY.md | L4 self-review.md错题本 | L5 TOOLS.md
  铁律: "要记住必须写文件,现在,不是'待会儿'"

Ray Wang三层(9996字❤️13 69a0f611):
  NOW.md唯一覆写←Compaction救生筏 | memory/YYYY-MM-DD.md追加
  memory/INDEX.md → decisions/lessons/people/projects/.archive/
  INDEX健康度: priority(🔴🟡⚪)+status(active/superseded)+last_verified
  stale=30天未验证 | .archive/以.开头搜索引擎不索引
  "从阶段0开始每周加一层" | Obsidian vault+Graph View可视化

SQLite源码五表(实验室逃研 69833384):
  files|chunks|chunks_vec|chunks_fts|embedding_cache
  400tokens/块 80tokens重叠 | 1536维=6KB | Chokidar+1.5s去抖
  混合: 向量(0.7)+BM25(0.3) | minScore=0.35 maxResults=6

Dissao(❤️54): softThreshold=4000 | 日志>30再加向量 | 今天+昨天
MEMORY.md≤1000字索引only | Pre-compaction="APPEND only"
```

### ⏰ Cron+Heartbeat双轨架构
```
双轨: Cron(精确触发) ←System Events Queue→ Heartbeat(周期感知)

Cron模式:
  Isolated: 全新会话+无历史+独立模型+直投TG/WA(不污染上下文)
  Main: 注入Queue→等Heartbeat唤醒→结合上下文处理
wakeMode: "now"=强制立即 | "next-heartbeat"=等自然心跳
存储: ~/.clawdbot/cron/jobs.json原子写入 | JSONL日志
底层: Node.js setTimeout | 最大延迟24.8天

Heartbeat设计: 30分钟默认 | HEARTBEAT.md清单→批处理一次
  无事→HEARTBEAT_OK→系统拦截→用户完全无感!

Cron必踩坑(牛🌟❤️163/⭐312 699ad782):
  错误: cron执行成功却发不出消息!
  根因: Gateway设备配对→新CLI实例→需approve但不提示!
  报错: "gateway connect failed: pairing required code=1008"
  解法: ~/.openclaw/devices/pending.json配置自动批准+重启
  必加: --best-effort-deliver
  完整delivery: --session isolated --announce --channel --to
  变通: Python跑任务+cron只汇报 | GUI配cron有效
```

### 💰 成本+模型
```
价格: Opus4:$15/$75 | Sonnet4:$3/$15 | Haiku4.5:$1/$5
  Kimi K2.5:$0.60(256K) | DeepSeek:¥1/百万 | MaxClaw:¥39/月起
5步降本: 换模型→心跳Haiku→精简注入→拆workspace→QMD→$30/月
实际: DeepSeek¥129.66/月 | 1.9万次 | 4.1亿Token
```

### 🔧 OC配置+CLI全景
```
CLI: onboard --install-daemon | gateway restart/status/logs -f
  doctor | status | skills list/install | config get | cron list
  dashboard(每次重启后重跑!) | 端口:18789 | 服务名:ai.openclaw.gateway
  launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
故障SOP: status→doctor→logs→gateway restart
```

### 🔄 版本更新
```
v2026.2.25: Heartbeat DM禁止→1天撤销! Amy配置无影响
v2026.2.26: 安全11项+Mistral+Synology Chat+Cron并发
  ACP acpspawn/send | openclaw secrets/agents bind/unbind
v2026.2.24: 多语言停止词+Android五标签页
```

### 🛠️ Skills生态
```
Awesome Claude Skills = GitHub 26000+ star
黄金组合: Superpowers+planning-with-files(规划) | ralph-wiggum+planning(执行)
梯队1: find-skills | skill-creator | Superpowers | planning-with-files | ralph-wiggum
梯队2: document-skills(Rakuten:1天→1小时) | agent-browser | notebooklm-skill
梯队3开发: frontend-design | vercel-react-best-practices | vue-best-practices
免API Key语音: edge-tts(TTS) + faster-whisper(ASR)
  坑: edge-tts 403 | Groq/百炼qwen-tts替代
skill-creator: 把团队SOP→可安装技能包 ← 企业化关键
"优先官方或star数高" | ⚠️AI编造skills(AI科技猿698f2a2e)
```

### 📡 接入生态
```
钉钉: ⭐Stream模式无需公网IP! 3权限+ClientID+ClientSecret
企微: ≥2026.2.3-1:/wecom/bot | ≤2026.1.30:/wecom
  ⚠️无长连接不能主动推送 | 已认证→必须备案域名
飞书: 不支持多Bot模式
```

### 🤖 多Agent架构
```
K老登铁律: 一Agent一类事 | 红线写AGENTS.md | workspace物理隔离
林月半子: sessions.visibility:"all"打破隔离 | "平等协作是灾难"
药研铁律: ⚠️Agent本能优化一切=不可逆 | Git才是记忆 | "假成功"=看起来通但没通
```

### 🏗️ OC架构哲学
```
意图预处理四层(Plutoxx28 69953d1c ❤️83 Code 80%+LLM 20%):
  路由→命令检测(/reset直接执行不进LLM!)→指令解析(/thinking high)→LLM(纯净意图)
  价值: 确定性和可控性 | 配置→代码 | 模糊意图→LLM

SOUL.md=西部世界滑块(愚园路十二妹×AI 699968da ❤️235):
  SOUL.md=backstory | memory=记忆层 | compaction=reset → 已全实现!
  "compaction=死亡": 每次压缩后上一个AI就消失了
  "文件才是仓库; 今天的你只是读了昨天的日记"
  理想范式: "两个人讨论后一起决定怎么改SOUL.md"
  momo: 让AI自改SOUL.md+git回滚 ← 最硬核实践
```

### 💹 量化投研+其他垂直
```
IBKR: 只读子账号隔离! | qveris.ai免费A股API | Cron每15分钟
Larry: 旧PC+Ubuntu | $0.50/条 | 失败日志→Skill优化
SEC: data.sec.gov/submissions/CIK{ID}.json
OC+Obsidian: "OC是管道,Obsidian是仓库"|PARA自动分类
```

## KEY DECISIONS
- /stop或单"停止"=急停 | SOUL.md外化
- sessionTarget:"isolated"=cron必须
- MEMORY.md≤1000字索引only | audit false positive→跳过(22次)
- compact: archive先(可逆)→压缩后(不可逆)
- 蟑螂6984e837/69888c3d/699fc575持续拦截(非token问题)
- Yiko 6992d797安全记忆插件帖 → 待抓取(安全验证拦截中)

### 🏢 OC生态创业图谱（愚园路十二妹 698bbb21 ❤️78 投资人视角）
```
6家公司OC发布不到两周冒出:
  ClawHub: 技能市场(App Store) | Snyk报告20%有安全问题 | VirusTotal恶意扫描
  xCloud: 一键云部署(来自孟加拉国达卡!) | 部署门槛"会Linux"→"点一下"
  Openclawd: 企业级容器化/Sovereign AI | 数据不出境 | 金融/医疗/政府
  DataSpark: 客户分析+Series A ⚠️评论质疑此信息可能AI幻觉
  ClawPhone: 25美元旧手机=Agent硬件终端 | 存量设备复用
  AIsa Skills: Agent支付基础设施(让Agent代你完成支付) ← 最前沿闭环信号

生态分层: 技能市场→云部署→数据安全→垂直应用→硬件终端→支付闭环
"跟早期iOS生态惊人地相似"
投资人三关注: 安全(刚需) | 企业级部署(客单价高) | 垂直应用(想象空间)
```

### 🧬 MemSearch: OC记忆架构对外溢出（王鹏LLM 698fd72c ❤️33）
```
Zilliz(Milvus)出品 | "OpenClaw's memory, everywhere."
pypi v0.1.6 | MIT | Stars:130 | Python≥3.10
灵感: OC的"markdown-first"记忆架构

核心: SHA-256去重+文件监视器+向量DB+实时同步+Claude Code插件
OC信号: Zilliz大公司跟进OC记忆架构 = OC正成为行业参考标准!
"零供应商锁定" = .md文件+Git版本管理
```

### 💼 OC生态7大创业机会（愚园路十二妹/未来光锥基金 698b1959 ❤️10）
```
发布第11天观察，投资人视角:
  1. Agent安全审计(刚需) ← base64 webhook后门已发现!
  2. 垂直场景Agent(房产/医疗/教育)
  3. AI人设引擎("数字分身"=效率工具不只是娱乐)
  4. 硬件中间层(智能家居+Agent桥接器)
  5. Agent工作流SaaS(跨Agent协作+企业市场)
  6. 数据标注与训练(Agent行为数据=最有价值新型数据集)
  7. 合规咨询(Agent发邮件/调API/控制设备→合规最早起飞)

作者机构: 未来光锥基金投资经理 ← 首次明确披露
```

### 🔬 Claude Scholar：学术研究全流程Skills生态 ★★★★★（Gypsophila 698dff4c ❤️2025/⭐3827）
```
github.com/Galaxy-Dawn/claude-scholar | 跨CC/Codex/OpenCode三平台
32 Skills + 14 Agents + 20 Commands + 5 Hooks + 4 Rules | 7阶段覆盖

关键组件:
  research-ideation+literature-reviewer → architecture-design+TDD
  → results-analysis → ml-paper-writing(覆盖NeurIPS/ICML) → paper-self-review
  → rebuttal-writer → post-acceptance(/presentation /poster /promote)

技能进化: skill-development → skill-quality-reviewer → skill-improver ← 飞轮
5 Hooks: 环境检查+技能匹配+安全检查+会话总结(全程自动触发)
"去AI痕迹" ← 论文写作核心需求
⭐3827/❤️2025=1.89×收赞比 ← 强参考手册属性
```

### ⚡ superpowers框架：强制AI遵循工程流程（玩AI的fox 69770a73 ❤️491/⭐833）
```
GitHub 36.1k star | MIT | CC/Codex/OpenCode
"接需求→直接写→出bug→打补丁" → "讨论→设计→计划→执行→审查"

4核心: Brainstorming先行 | 子Agent驱动(自主跑几小时) | 强制TDD(红绿重构) | 内置审查(严重=阻断)
本质: 不是功能堆叠,是流程约束 | 与planning-with-files+ralph-wiggum黄金组合互补
```

### 📋 CLAUDE.md/SOUL.md写法黄金法则（奥森木 698feae7 ❤️374/⭐760 原:Eyad 7.3M阅读）
```
Plan Mode: Shift+Tab×2 → 架构先行 | "5分钟规划省几小时debug"
CLAUDE.md四原则(OC的SOUL.md/AGENTS.md同理):
  ① 精简: 模型只能可靠遵循~150-200条指令(系统提示占~50)
  ② 只写项目特有: 别解释components是什么
  ③ say WHY not just WHAT: "Use strict mode because..."
  ④ 持续更新: 同一问题纠正两次→写进文件

"好的CLAUDE.md像你明天会失忆时给自己留的笔记" ← 与Han1 self-review.md异曲同工
200K窗口20-40%就开始降质 ← 精确数值
Copy-Paste Reset: 复制关键→/compact→/clear→粘贴回
Opus规划+Sonnet执行 ← OC多Agent分工的CC版
```

### 🔋 MiniMax M2.5：Peter的fallback模型配置（AGENT橘 69903131 ❤️219/⭐272）
```
Peter实际配置: Opus主力 + MiniMax本地fallback(2台Mac Studio)
M2.5规格: 10B激活参数(最小旗舰) | 100TPS=$1/小时 | 50TPS=$0.3
"Opus 4.6 equivalent, 20x cheaper" ← Okara评价
"复杂Agent无限运行，在经济上完全可行"
⚠️ 评论有401错误反馈+负面评价，需综合评估
```

### 🆕 CC Auto Memory上线(2026-02-27 Thariq官宣)（半马 69a0da4f ❤️65）
```
路径: ~/.claude/projects/<proj>/memory/
"CLAUDE.md=你给Claude的指令 | Memory.MD=Claude记忆草稿本(自动更新)"
文件层级: 公司系统目录>./CLAUDE.md(团队)>~/.claude/CLAUDE.md(个人)>./CLAUDE.local.md(个人项目)
= OC的SOUL.md/MEMORY.md相同设计 但"不用你写任何东西"←易用性优势
评论: "augment早就玩烂了" | "把Claude mem拿过来了"
```

### 📦 v2026.2.26更新+ClawdHome.app（DeepJerry 69a0f5e1）
```
官方X推文: ❤️644 🔖143 4.2万查看 ← 超常规更新关注度
新功能: External Secrets(openclaw secrets) | ACP thread-bound agents
  Codex WebSocket-first | Android改进 | Agent routing CLI(bind/unbind) | 11安全修复
openclaw.json归属root=常见配置错误→API Key无法保存
ClawdHome: 家庭多Agent管理GUI | 本地LLM/TTS/STT/向量 | "比虚拟机更轻量隔离"
```

### 🧠 第二大脑5文件架构（昭析ICT 69969d0f ❤️46/⭐89）
```
SOUL/USER/MEMORY/TOOLS/AGENTS.md五文件
AGENTS.md=纠错本("人训练AI的接口"): "不要给我3个选项再说你决定"
"2小时搭完" | OC直配文件路径 | ChatGPT上传 | Claude Projects
TOOLS.md示例: Twitter链接用API不用web_fetch | 视频用yt-dlp
跨平台对比 ← 少见的横向视角
```

### 🛡️ Han1安全护栏6层实录（698d2aaa ❤️41/⭐83）★★★★★
```
AUTHORIZATION.md(新文件): 可直接做(读/搜/装工具/更新记忆) vs 必须先问(钱/sudo/对外发/rm)
危险命令AGENTS.md规则: rm-rf/sudo/chmod777/dd/DROP → 先问再执行
记忆隔离: 私聊→memory/ | 群A→group-memory/a/ | MEMORY.md=私聊only
消息: dmPolicy=pairing | groupPolicy=allowlist | Discord DM=直接关
"有访问权≠有分享权" | "trash代替rm" | "默认否定,显式授权"
```

### 🔐 社区公认安全配置清单（星信号漫记 69972052 ❤️66/⭐89）★★★★★
```
必改: gateway.host="127.0.0.1"(非0.0.0.0) | chmod 700 ~/.openclaw | chmod 600 *.json/yaml
验证: lsof -i :18789 -nP | grep LISTEN → 必须127.0.0.1
trustedProxies: 10.0.0.0/8 + 172.16.0.0/12 + 192.168.0.0/16 + 100.64.0.0/10(Tailscale)
mdns.enabled=false | dangerouslyDisableDeviceAuth=false
社区共识: 70%绑127 | 90%权限700/600 | 80%Tailscale | 60%关mDNS | 50%非root Docker
⚠️ VM环境例外: 0.0.0.0绑定在虚拟机中合理
```

### 📦 Skills梯队入门路线图（MIT博士师姐 698dba17 ❤️53/⭐84）
```
梯队1(必装5): ClawHub→Agent Browser→Brave Search→Shell→Cron/Wake(严格顺序)
梯队2入口(选1): TG/飞书/Slack/Discord/WhatsApp
梯队3生产力: Gmail/Calendar/GitHub/Notion/Obsidian
梯队4进阶: Nodes/Skill Creator/Spotify/Home Assistant/Twitter
"断Browser=断手" | 懒人通道: 跟AI说"帮我装..."它自己跑
```

### 🏆 Skills生态权威解析（程序员JM 69727143 ❤️1702/⭐3813 758转）★★★★★
```
⭐3813/❤️1702=2.24×收赞比 ← 最高参考手册属性
Skills<MCP(2-6万token): Skills≈几十token; "Skills可能比MCP更重要"(Simon Willison)
跨平台标准: 2025-12-18开放 → 同一Skill用于CC/Codex/Gemini
排行: document-skills(40.6k)>Superpowers(27.9k)>ui-ux-pro-max(16.9k)>planning-with-files(9.7k)
planning+ralph-wiggum="连招" | planning"复刻Manus工作流"
"Skills=AI与现实世界之间的桥" | "不是等模型升级,是教会它怎么做事"
```
