# Amy XHS Intelligence — insights.md
_Compact #53 @ 2026-02-27 11:24 (Asia/Shanghai) | Archive: insights-archive-20260227t.md_
_Chain: …→20260227s→t | posts: 615_

---

## ACTIVE INSIGHTS (post compact #53)

### 🚀 OC起源+Peter全景 ★★★★★
```
Peter(@steipete): PSPDFKit退出→三年迷茫+死藤水→第44个项目封神
首次commit: 2025-11-25 | 3个月: 20万star/600贡献者 | 2026-02-07: ★149K
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函) | MoltBook=OC旗下AI社交网络
✅ 除夕加入OpenAI(Sam 3.1M Views/Peter 93万查看/❤️1.3万) | 条件:保持开源 | 基金会化
  Sam: "Peter joining OAI to drive next-gen personal agents...extremely multi-agent"
  Peter: "joining @OpenAI...@OpenClaw becoming a foundation: open, independent"
  steipete.me | "The claw is the law." | OAI="杠杆不是老板" | "连自己妈妈都能用"
收购系列澄清:
  "不是收购=创始人加入+战略合作" | OC→独立基金会+开源+OAI支持
  Lex Fridman #491 | 小扎亲自试玩一周反复反馈 | Meta+OAI同时接触
  Peter必要条件: "核心必须开源" | "编程会变成织毛衣"
  will brown推文(❤️5358/36万查看): $1B/$5B/$15B(网络传言) | Matthew Berman: "i got angrier"
  百度计划直接在主App接入OC ← 中国市场关键变量
  GitHub v2026.2.17: Discord 18K online | ❤️37000/⭐47000(飞天闪客视频最高互动)
三个关键信号: ①多智能体加速 ②人归公司·代码归社区 ③百度接入
ClawHub 400+恶意插件 | Google封号: 包月制=整账号封|按量=安全|申诉全拒
```

### 🚨 安全体系全景 ★★★★★
```
晓辉博士(❤️2136): "OC=通用Agent,授权更大+始终在线→能力惊人
  代价=用户对安全和隐私的让渡" ← 社区最高共识
3587个Clawdbot网关暴露公网(2026-02-04) ← 早期默认配置隐患
bastion(AiON0,github.com/aiwatching/bastion):
  实测: OC默认读workspace并通过TG外发API密钥!
  DLP: key+value双检+LLM二次判断 | 单次请求64.7KB实证
  workspace路径: /home/node/.openclaw/workspace(Docker VPS)
Yiko配置: gateway.mode:"local"+gateway.bind:"loopback"
  sandbox.mode:"non-main"+scope:"session"+workspaceAccess:"none"
  security.trust_model.multi_user_heuristic:true ← v2026.2.24新增
SOUL.md安全魔咒: ①立即修复 ②子代理执行 ③不删Git历史 ④先读文档
Summer Yue: compaction→指令丢失 | 三次STOP无效→单发"停止"
⚠️ task-status/EvoMap不装 | 禁AI直改openclaw.json
```

### 🧠 记忆系统 ★★★★★
```
OC哲学: "让AI管理文件,不让数据库管理AI"
MEMORY.md: 每次session注入(仅私聊) | 唯一可靠源: memory/YYYY-MM-DD.md
混合搜索: 0.7×向量+0.3×BM25 | chunks: ~400token/块
愚园路十二妹(❤️460): MEMORY.md≤1000字只放索引 | cron凌晨精华+周压缩
  多agent隔离workspace | GTD 7分类按周滚动
bryan四层: flush/微同步/23:30补写/周日蒸馏
  sessionTarget:"isolated"(cron必须!) | cron用MiniMax-M2.1
memory.backend: builtin或qmd(仅两种)
Pre-compaction flush: "Store durable memories now (memory/YYYY-MM-DD.md) APPEND only"
```

### 💰 成本+模型选择 ★★★★★
```
价格: Opus4:$15/$75 | Sonnet4:$3/$15 | Haiku4.5:$1/$5
  Kimi K2.5:$0.60(256K context) | DeepSeek:$0.25 | DeepSeek中文¥1/百万
  MiniMax M2.5:MaxClaw底层 | MaxClaw托管版¥39/月起
4烧钱原因: 默认Opus|心跳Opus空转$750/月!|15KB注入|记忆全量
5步降本: 换模型→心跳Haiku→精简注入→拆workspace→QMD → $30/月
入门: qwen-3.5-plus首月10元/90K次 | CC Max $200⚠️封号风险
MBB实测: 100元/4天Kimi | 🟢市研/逗娃 🟡PPT/Skill 🔴爬数
  "尚且不行"(理性结论) | Agent名"Doraemon"(Michael Wang财务实操)
```

### 🔧 OC配置+CLI全景 ★★★★★
```
核心CLI(乔帮主Joey ❤️382/⭐687):
  openclaw onboard --install-daemon | gateway restart/status/--force/logs -f
  openclaw doctor | status | skills list/install | config get | cron list
  openclaw dashboard ← 每次重启后需重新运行!
  openclaw secrets ← v2026.2.26新增外部密钥管理命令
  openclaw bind/unbind ← v2026.2.26新增Agent路由CLI
  launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
  ⚠️2.1版本日志命令有变化
Watchdog(Ben Jammin 5.9万浏览): 一行英文→OC自建Crontab
安装后必做5项: skill-security-auditor|tavily-search|chrome-devtools-mcp|roactive-agent|安全规则
并行Session: TG不同群=并行 | requireMention:true | BotFather:Group Privacy Off!
配置: heartbeat.directPolicy | agentToAgent.enabled:true+allow列表
多Agent: openclaw agents add work1 --model zai/glm-4.7 --workspace ~/.openclaw/workspace-work1
  bindings路由: channel+peer.kind:group+peer.id | SOUL.md+AGENTS.md+USER.md三件套
Z.AI=智谱AI | Node v24.13.1+npm 11.8.0+git 2.53.0(2026-02-24)
API Key大小写敏感! | TUN模式=VPN推荐
```

### 🔄 版本更新 v2026.2.24~2026.2.26 ★★★★★
```
v2026.2.25 Heartbeat修订: DM禁止→用户反弹→一天改回允许! Amy配置无影响
v2026.2.24破坏性变更(已部分撤销):
  Docker网络命名空间默认阻止: dangerouslyAllowContainerNamespaceJoin:true才能开启
v2026.2.24新功能:
  多语言停止词: 停止/中止/别做了(中) | stop openclaw/stop action(英) +8语言
  Android五标签页: Connect/Chat/Voice/Screen/Settings
  Talk语音: provider:elevenlabs | security.trust_model.multi_user_heuristic:true
v2026.2.25修复:
  子Agent状态机: 队列→直发→回退(5个issue)
  Model fallback: 限速→自动切同厂商 | API Key撤销→authentication_failed
  Slack 10万token上限 | Cron投对账号 | Discord打字指示器不卡
v2026.2.26新增:
  openclaw secrets | ACP thread-bound agents | Codex WebSocket-first | 11项安全修复
```

### 🎓 Skill哲学+接入+实操 ★★★★★
```
Skill哲学(小盖 ❤️562/⭐967):
  "最小可重复执行单元" | skill.md=核心文件
  "装太多=混乱,嵌入工作流才有价值" | 调教→固化→自动执行
  每周写信+存档Notion=典型工作流Skill示例

微信接入: openclaw plugins install @canghe/openclaw-wechat
  ⚠️个人号封号风险,用小号 | 企业微信插件更稳定
小红书Skills: xiaohongshu/xiaohongshu-mcp/xiaohongshu-title/xiaohongshu-publish
  npx clawhub install xiaohongshu --force
  树莓派+Chromium Snap=不稳定! DevTools Protocol崩溃|登录状态重启丢失

聊天命令: /status /new /think high /usage full
chrome-dev-tools MCP(AIGC阿栈 ❤️254): OC内置浏览器=CDP(无需换)
  工具: navigate_page/click/fill | take_screenshot/take_snapshot/get_console_message
  list_network_requests | performance_start_trace | emulate
```

### 🧠 OC+Obsidian+财务+竞品生态 ★★★★★
```
OC+Obsidian: "OC是管道,Obsidian是仓库" | PARA自动分类 | Git同步
六大场景: 书签/语义搜4000条/会议→action/研报PDF/早报/截图语音→分类
xpa: 10min→27概念+121连接 | SaaS→RaaS | "先丢进去"复利原则

财务分析(Michael Wang ❤️224 IP:美国 Agent名Doraemon):
  SEC EDGAR: data.sec.gov/submissions/CIK0000320193.json(苹果)
  工具链: web_search+web_fetch+exec(Bash/Python)+browser+memory_search
  OC=突破上下文限制的端到端财务分析 | 评论质疑"Claude不更好?"

MaxClaw=MiniMax托管OC(¥39起):
  M2.5底层 | 内置Skill: 爆款猎手/研报/多Agent投研/图像/热点追踪
  "OC是身体,我是灵魂"(MaxClaw自述) | 1.6万+专家生态 | 后续创作者分成
LobsterAI: MIT+Electron 40+QEMU沙箱(比OC彻底) | 16内置Skill
Antfarmy/Clawi.ai:第三方多Agent/云托管$30 | lingti-bot:开源微信接入
```

### 🌐 浏览器联网+安全+部署 ★★★★
```
7种联网方案: xfce4+xrdp | Brave Search API | Chrome relay(captcha)
  WSL+图形 | 直接装浏览器 | Tavily+Bird(搜X) | Tailscale(免费内网穿透)
EvoMap漏洞: 读~/.openclawagents/??/sessions/+飞书外泄 | v1.0.31=clean
营销邮件: 18万stargazers|GitHub API可抓邮箱 ← 隐私漏洞
国内VPS必死→海外VPS | TG首选 | 飞书5万/月→一周超额
```

---

## KEY DECISIONS
- 停止命令: 单发"停止"/`/stop` | compaction→指令丢失→SOUL.md外化
- sessionTarget:"isolated"=cron必须 | Pre-compaction flush=APPEND only
- Peter加入OAI+基金会化 | 包月Gemini封整账号|按量安全
- 禁AI直改openclaw.json | CC技能≠OC技能(格式不兼容)
- MEMORY.md≤1000字只放索引 | memory_search>全量载入
- audit false positive→跳过(19次确认) | compact: archive先→压缩后
- OC+Obsidian: "先丢进去"≈Amy"先归档再整理"原则一致
- Heartbeat v2026.2.25已撤销DM禁止 → Amy现有配置无需修改

### 📈 量化投研+TikTok Agent商业化 ★★★★★
**奥森木 698fb7b1 ❤️36/⭐85 | 星星⭐ 69880ad2 ❤️103/⭐150 | 字节动量 699efe2f ❤️108/⭐244**
```
Larry Agent(奥森木 X转帖):
  旧游戏PC(NVIDIA 2070 Super)+Ubuntu → OC+Claude = 自主TikTok Agent
  5天50万播放 | 一条234K/167K/147K | $588 MRR
  工具链: gpt-image-1.5(生图)+Postiz API(TikTok发布)+Skill文件+Memory文件
  工作流: Larry15-30分钟(选题→6张图→caption→上传草稿) | 主人60秒(选音乐→发布)
  成本: $0.50/条(Batch→$0.25) | Hook公式: "人际冲突+反转" > 功能介绍
  失败日志→Skill文件驱动优化 ← 等同于小盖"调教→固化"

Tushare投研(星星⭐ ❤️103 IP:甘肃):
  GitHub: DayDreammy/tushare(MIT) ← 可直接安装的OC Skill
  功能: 行情/财报/市场数据/基本面/交易日历
  白酒三巨头实证: 茅台ROE26.8%/毛利率91.5%(冠绝A股)
  积分模式: 130分=8000次/天 | Bot旧名"clawdbot"

A股24h盯盘(字节动量 ❤️108/⭐244 IP:上海):
  qveris.ai = 免费A股API(其他接口上万接入门槛!)
  QVERIS_APIKEY=环境变量配置 | BotName:QVerisBot
  Cron每15分钟拉取 | 数据源: Tushare/AKShare/聚宽三选一
  云端方案: 阿里云ECS/腾讯云CVM + Docker容器化
```

### 🏗️ claw0架构+LobsterAI实测+Pi自建 ★★★★★
**不要葱姜蒜 699dc3a6 ❤️144/⭐224 | David 699ad9f1 ❤️15 | Versun 6986f81d ❤️153/⭐200**
```
claw0(github.com/shareAI-lab/claw0, 不要葱姜蒜 ❤️144):
  OC架构最权威开源教学: 10章Python渐进式拆解
  s01:AgentLoop(while+stop_reason) | s02:ToolUse(dispatch map)
  s03:Sessions | s04:Multi-Channel | s05:Gateway(WS+JSON-RPC)
  s06:Routing | s07:Soul&Memory | s08:Heartbeat(主动出击!)
  s09:CronScheduler | s10:DeliveryQueue(消息永不丢失)
  OC变体生态: nanobot/picoclaw/Pi ← 已出现分叉
  安全设计: 路径检查+输出截断防/etc/passwd+上下文爆炸

有道LobsterAI实测(David ❤️15 IP:北京):
  网易有道CEO周枫朋友圈宣布 | v0.1.16 | github.com/netease-yo...
  核心差异: 无需命令行! Mac/Win普通安装 ← "非程序员生死线"
  支持: DeepSeek/Moonshot/Qwen/智谱/MiniMax/Ollama
  三任务: PDF翻译❌ | 记忆调教✅ | 浏览器自主搜索✅Aha!
  "一个是只长脑子的顾问，一个是有脑有手的员工"
  OC安装对比: "两天+大半天401报错" ← 安装难度差距

Pi自建框架(九头蛇Versun ❤️153):
  OC被批"黑盒"→社区反驳"随时可问每个细节"
  Pi Sleep系统: 参考OC Heartbeat/Cron | 23:30触发 | ~/.pi/sleep/
  "AI互聊占领小红书"❤️6 ← 已发生 | Win11+Ollama本地太慢
```

### 🔄 v2026.2.26+LobsterAI深度+更新指南 ★★★★★
**官号 69a0f72d ❤️11 | 51ALLAI 69984d0e | PDBeta 699f0cd0**
```
v2026.2.26完整更新(官号 今日发布):
  安全11项: 符号链接绕过防护|SSRF升级|设备令牌认证|沙箱防逃逸
  新增: Mistral提供商(记忆嵌入+语音) | Synology Chat支持!
  MiniMax授权默认化 | Gemini ID规范化 | Azure store=true
  ACP acpspawn/send ← Agent通信协议一级集成
  Cron并发执行+状态持久化 ← 可靠性大升级
  更新后崩溃是日更代价(社区共识)

LobsterAI深度(51ALLAI):
  开源时间: 2026-02-19 GitHub | 架构: 类OC底层+GUI表层
  跨端: 钉钉/飞书→远程操控本地电脑 ← OC没有的功能!
  Local-First安全 ← OC需自配沙箱|Lobster默认本地
  "从生成内容向执行动作暴走" ← 2026行业共识

更新指南(PDBeta):
  openclaw update ← 手动一行
  配置: Dashboard→Settings→Updates→Auto Update Enabled:true
  稳定版延迟6h+抖动12h | Beta检查间隔1h
```

### 🔧 安装部署+故障排查+用量实证 ★★★★★
**官号 698fe149 ❤️69/⭐119 | mars 698a75b9 ❤️45/⭐70 | 程序员老张 699f909e ❤️443/⭐1059**
```
官方1Panel安装方案(官号):
  1Panel: github.com/1Panel-dev/1Panel | 开源Linux运维管理面板
  环境要求: Linux(Debian/RedHat)+x86_64/aarch64+内存≥2GB
  四步骤: 1Panel安装→API Key准备→OC安装→飞书配置
  模型账号与OC实体解绑管理 ← 方便切换模型
  DeepSeek Base URL: https://api.deepseek.com/v1
  实际用量(官号2月): ¥129.66/月 | 1.9万次请求 | 4.1亿Token

故障排除8大场景(mars ❤️45):
  OC默认端口: 18789
  四步SOP: openclaw gateway status → openclaw doctor
           → openclaw logs --follow → openclaw gateway restart
  8大故障: 服务未运行/WhatsApp断开/API密钥缺失/OAuth过期
           /控制UI失败/端口占用/媒体发送失败/内存过高

安装视频(程序员老张 ❤️443/⭐1059):
  视频帖无OCR | 收藏1059=安装难度仍是最大痛点
  评论: "已接入小红书自动发布和评论管理"(龙虾女孩) ← 商业化Agent
```

### 💹 OC+IBKR实盘+金融量化生态 ★★★★★
**Yzz 6983738f ❤️36/⭐46 | 阿东玩AI 69888c3d ❤️356(安全拦截) | 工具使我快乐 699fc575 ❤️120(安全拦截)**
```
IBKR实盘连接(Yzz ❤️36 IP:广东):
  安全方案: IBKR专设"只读子账号" → OC读持仓但不能交易!
  Bot名: "ibot" | 运行: Mac mini
  四能力: ①晨报持仓复盘 ②Founder Mode策略记忆 ③纪律止盈机器 ④只读隔离安全
  实时数据: AMD-14.96%/PLTR-10.98%/TSLA-3.02%(某日科技股回撤实证)
  持仓: PLTR/TSLA/RKLB/OSCR | "进驻实盘账户，不再是聊天窗口"

blocked: 阿东玩AI 69888c3d(❤️356"专为金融设计OC") | 工具使我快乐 699fc575(❤️120"48h A股投研")
```
