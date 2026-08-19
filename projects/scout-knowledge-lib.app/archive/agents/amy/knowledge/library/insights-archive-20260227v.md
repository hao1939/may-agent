# Amy XHS Intelligence — insights.md
_Compact #54 @ 2026-02-27 12:22 (Asia/Shanghai) | Archive: insights-archive-20260227u.md_
_Chain: …→20260227t→u | posts: 627_

---

## ACTIVE INSIGHTS (post compact #54)

### 🚀 OC起源+Peter全景 ★★★★★
```
Peter(@steipete): PSPDFKit退出→三年迷茫+死藤水→第44个项目封神
首次commit: 2025-11-25 | 3个月: 20万star | 2026-02-07: ★149K
OC改名: ClawdBot→Moltbot→OpenClaw | MoltBook=OC旗下AI社交网络
✅ 除夕加入OAI | Sam: "extremely multi-agent" | 条件: 保持开源+基金会化
  Peter: "The claw is the law." | OAI="杠杆不是老板" | "编程会变成织毛衣"
  "连自己妈妈都能用" | "花了13年经营公司，那个游戏我已经玩够了"
收购澄清: 不是收购=创始人加入+战略合作 | OC→独立基金会+开源+OAI支持
  Lex Fridman #491 | 小扎一周反复反馈 | $1B/$5B/$15B(传言)
  Peter条件: "核心必须开源" | Meta+OAI同时接触
三信号: ①多智能体加速 ②人归公司·代码归社区 ③百度计划接入OC主App
ClawHub 400+恶意插件 | Google封号: 包月=整账号|按量=安全
```

### 🚨 安全体系全景 ★★★★★
```
晓辉博士(❤️2136): "OC=通用Agent,授权更大+始终在线→能力惊人
  代价=用户对安全和隐私的让渡" ← 社区最高共识
3587个Clawdbot网关暴露公网(2026-02-04) | 微软: 不适合标准工作站
bastion(github.com/aiwatching/bastion):
  实测: OC默认读workspace并通过TG外发API密钥!
  DLP: key+value双检+LLM二次判断 | 工作区路径: /home/node/.openclaw/workspace
Yiko配置: gateway.mode:"local"+gateway.bind:"loopback"
  sandbox.mode:"non-main"+scope:"session"+workspaceAccess:"none"
  v2026.2.24新增: security.trust_model.multi_user_heuristic:true
Summer Yue: compaction→指令丢失 | /stop或单发"停止"=正确停止命令
EvoMap(capability-evolver): v1.0.31=clean | ⚠️task-status/EvoMap不装
⚠️ 禁AI直改openclaw.json | 禁Claude Code技能直接用于OC(格式不兼容)
安全11项(v2026.2.26): 符号链接绕过防护|SSRF升级|设备令牌|沙箱防逃逸
```

### 🧠 记忆系统 ★★★★★
```
OC哲学: "让AI管理文件,不让数据库管理AI"
MEMORY.md: 每次session注入(仅私聊) | ≤1000字只放索引(省token)
唯一可靠源: memory/YYYY-MM-DD.md(compaction后不丢)
混合搜索: 0.7×向量+0.3×BM25 | chunks: ~400token/块
愚园路十二妹(❤️460): 多agent隔离workspace | GTD 7分类按周滚动
bryan四层: flush/微同步/23:30补写/周日蒸馏
  sessionTarget:"isolated"(cron必须!) | cron用MiniMax-M2.1
memory.backend: builtin或qmd(仅两种)
Pre-compaction flush: "Store durable memories now (memory/YYYY-MM-DD.md) APPEND only"
```

### 💰 成本+模型选择 ★★★★★
```
价格: Opus4:$15/$75 | Sonnet4:$3/$15 | Haiku4.5:$1/$5
  Kimi K2.5:$0.60(256K context) | DeepSeek:$0.25(¥1/百万中文)
  MaxClaw(MiniMax托管):¥39/月起
4烧钱原因: 默认Opus|心跳Opus空转$750/月!|15KB注入|记忆全量
5步降本: 换模型→心跳Haiku→精简注入→拆workspace→QMD → $30/月
实际用量(官号2月): DeepSeek ¥129.66/月 | 1.9万次 | 4.1亿Token
MBB实测: 100元/4天Kimi | 🟢市研/逗娃 🟡PPT/Skill 🔴爬数 "尚且不行"
安装教程收藏王: 程序员老张 ⭐1059 ← 安装难度仍是最大痛点
```

### 🔧 OC配置+CLI全景 ★★★★★
```
核心CLI:
  openclaw onboard --install-daemon | gateway restart/status/--force/logs -f
  openclaw doctor | status | skills list/install | config get | cron list
  openclaw dashboard ← 每次重启后需重新运行!
  openclaw secrets / openclaw agents bind/unbind ← v2026.2.26新增
  openclaw update ← 手动更新一行命令
  launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
  OC默认端口: 18789 | 服务名: ai.openclaw.gateway

自动更新配置:
  Dashboard→Settings→Updates→Auto Update Enabled:true
  稳定版延迟6h+抖动12h | Beta检查间隔1h

安装方案: 1Panel(github.com/1Panel-dev/1Panel) ← 官方推荐Linux面板
  环境: Linux(Debian/RedHat)+x86_64/aarch64+内存≥2GB
  DeepSeek Base URL: https://api.deepseek.com/v1

故障SOP: openclaw gateway status → doctor → logs --follow → gateway restart
  8大故障: 服务未运行/WhatsApp断/API密钥缺/OAuth过期/端口占用/内存高等

Gateway Dashboard侧边栏: 聊天/控制(概览/频道/实例/会话/使用情况/定时任务)
  /代理(代理/技能/节点)/设置(配置/调试/日志)
```

### 🔄 版本更新 v2026.2.24~2026.2.26 ★★★★★
```
v2026.2.25 Heartbeat修订: DM禁止→1天改回允许! Amy配置无影响
v2026.2.26安全11项: 符号链接绕过|SSRF|设备令牌|沙箱防逃逸
v2026.2.26新增:
  Mistral提供商(记忆嵌入+语音) | MiniMax授权默认化
  Synology Chat新插件(私信+媒体) ← 群晖NAS接入!
  Cron并发执行+状态持久化 | ACP acpspawn/send线程绑定
  openclaw secrets/agents bind/unbind | Android设备状态查询
v2026.2.24多语言停止词: 停止/中止/别做了(中) +8语言
v2026.2.24Android五标签页: Connect/Chat/Voice/Screen/Settings
v2026.2.25子Agent状态机修复 | Model fallback限速→自动切同厂商
```

### 🎓 Skill哲学+接入生态 ★★★★★
```
Skill哲学(小盖 ❤️562): "最小可重复执行单元" | skill.md=核心文件
  "装太多=混乱,嵌入工作流才有价值" | 调教→固化→自动执行
微信: openclaw plugins install @canghe/openclaw-wechat ⚠️封号风险
小红书Skills: npx clawhub install xiaohongshu --force
  OC+MCP发布: "MCP让AI长了眼睛和手"(声称调通,配置未披露)
聊天命令: /think high /usage full /status /new
Z.AI=智谱AI | API Key大小写敏感! | TUN模式=VPN推荐
Node v24.13.1+npm 11.8.0+git 2.53.0(2026-02-24)
```

### 🧠 OC+Obsidian+SOUL.md+哲学 ★★★★★
```
OC+Obsidian: "OC是管道，Obsidian是仓库" | PARA自动分类 | Git同步
六场景: 书签/语义搜/会议→action/研报PDF/早报/"说早安"← Amy核心!
xpa: 10min→27概念+121连接 | SaaS→RaaS

SOUL.md(Peter改写8条): 有主见+允许幽默+直言蠢事+骂人看场合
  "成为凌晨两点你真正想交谈的助手,不是企业傀儡"
  写入路径: /Users/pcbot/clawd/SOUL.md | 替换Personality层不动Core Truths

50天五阶段: ①ChatGPT用 ②整理笔记 ③自动化 ④真正助理
  核心原则: 纯文本优先=拒绝数据锁定
```

### 🏗️ claw0架构+竞品生态+LobsterAI ★★★★★
```
claw0(github.com/shareAI-lab/claw0 ❤️144):
  10层OC架构教学: s01:AgentLoop→s02:ToolUse→...→s10:DeliveryQueue
  Heartbeat=s08"不只是被动响应,还能主动出击" ← 架构定义
  OC变体: nanobot/picoclaw/Pi ← 生态分叉已形成

有道LobsterAI v0.1.16(2026-02-19开源, 网易有道CEO周枫):
  类OC底层+GUI表层 | Mac/Win无需命令行! ← "非程序员生死线"
  支持: DeepSeek/Moonshot/Qwen/智谱/MiniMax/Ollama
  跨端: 手机(钉钉/飞书)→远控本地电脑 ← OC没有的功能!
  Local-First安全 | 实测: PDF翻译❌ 记忆调教✅ 浏览器搜索✅
  "一个是只长脑子的顾问,一个是有脑有手的员工"

Pi框架(九头蛇Versun ❤️153): OC被批"黑盒"→反驳"随时可问"
  Pi Sleep系统: 参考OC Heartbeat/Cron | 23:30 | ~/.pi/sleep/
  "AI互聊占领小红书"❤️6 ← 已发生

MaxClaw=MiniMax托管OC(¥39起):
  M2.5底层 | Skill: 爆款猎手/研报/多Agent投研/热点追踪
  "OC是身体,我是灵魂" | 1.6万+专家生态

多Agent配置: openclaw agents add work1 --model zai/glm-4.7
  bindings路由 | SOUL.md+AGENTS.md+USER.md三件套
  sessions_send = "智能体之间的专属内线电话"
```

### 💹 量化投研+金融实战 ★★★★★
```
IBKR实盘(Yzz ❤️36 IP:广东):
  安全方案: IBKR专设"只读子账号" → OC读持仓不能交易!
  Bot名"ibot" | Mac mini运行 | 持仓: PLTR/TSLA/RKLB/OSCR
  晨报复盘+Founder Mode策略记忆+纪律机器+只读隔离
  "进驻了实盘账户，不再是聊天窗口"

Tushare投研(星星⭐ ❤️103): DayDreammy/tushare(MIT) | 积分130=8000次/天
  白酒三巨头: 茅台ROE26.8%/毛利率91.5%(冠绝A股)
qveris.ai免费A股API(字节动量 ❤️108): 其他接口上万门槛!
  QVERIS_APIKEY=env | Cron每15分钟 | 阿里云ECS+Docker
Gee4投研架构: codex-search Skill(深度穿透) + stock-analysis Skill
  三框架: 基本面(ROE+FCF)+技术面(RSI+量价)+资讯面(监管权重)

blocked: 阿东玩AI 69888c3d(❤️356 专为金融OC) | 工具使我快乐 699fc575(❤️120 A股48h)
```

### 🌐 TikTok+内容自动化+部署 ★★★★
```
Larry TikTok Agent(奥森木 ❤️36 转X实例):
  旧游戏PC(2070 Super)+Ubuntu → OC+Claude
  5天50万播放 | 234K单条 | $588 MRR | $0.50/条(Batch→$0.25)
  工具: gpt-image-1.5+Postiz API | Hook公式: "人际冲突+反转" > 功能介绍
  失败日志→Skill文件驱动优化

7种联网方案: xfce4+xrdp | Brave Search API | Chrome relay
  WSL+图形 | 直接装浏览器 | Tavily+Bird(搜X) | Tailscale
SEC数据: data.sec.gov/submissions/CIK{ID}.json
  苹果CIK0000320193 | 特斯拉CIK0001318605
```

---

## KEY DECISIONS
- 停止: 单发"停止"/`/stop` | compaction→SOUL.md外化
- sessionTarget:"isolated"=cron必须 | Pre-compaction flush=APPEND only
- Peter加入OAI+基金会化 | 包月Gemini封整账号|按量安全
- 禁AI直改openclaw.json | CC技能≠OC技能(格式不兼容)
- MEMORY.md≤1000字只放索引 | memory_search>全量载入
- audit false positive→跳过(20次确认) | compact: archive先→压缩后
- Heartbeat v2026.2.25已撤销DM禁止 → Amy现有配置无需修改
- 蟑螂6984e837持续安全拦截(非token问题) | 69888c3d/699fc575同被拦截

### 📡 钉钉/企业微信接入完整教程 ★★★★★
**AI产品自由 697c4136 ❤️247/⭐367 | 老刘学AI 69898e0e ❤️33/⭐49**
```
钉钉接入8步(AI产品自由 ❤️247 Moltbot时代2026-01-30):
  ⭐Stream模式 ← 无需公网IP/域名!
  3个必须权限: Card.Streaming.Write + Card.Instance.Write + qyapi_robot_sendmsg
  高频卡点: Step6运行失败|Card权限难找|连接断联
  Bot"小D": "风格偏直接，不太会那种'亲爱的~'腔调😏"

企业微信接入4步(老刘学AI ❤️33 ✅实操验证):
  版本差异: ≥2026.2.3-1→/wecom/bot | ≤2026.1.30→/wecom
  未认证→IP | 已认证→必须备案域名!
  ⚠️企业微信无长连接，不能主动推送 ← 重大限制!
  ⚠️阿里云硅谷服务器→企业微信无法访问 ← 地域限制

飞书: 不支持多BOT模式(K老登评论区确认) ← Telegram=最佳多Agent通道
```

### 🤖 多Agent零代码配置 ★★★★★
**K老登的AI之旅 699bde97 ❤️34/⭐103**
```
核心认知: 1 Agent = 人设+独立workspace+行为红线 ≠ 多个模型账号
经典三人团队: Boss(调度)+Writer(文案)+Coder(程序员)
一句话搭建提示词:
  "我想搭建一个3人多Agent团队（Boss+Writer+Coder）。
   帮我完成所有配置：创建workspace、写人设+行为红线、
   更新openclaw.json、配置Telegram多账号通信。
   参考文档: docs.openclaw.ai"
Workspace结构: SOUL.md+AGENTS.md+MEMORY.md三件套
避坑铁律:
  ①一Agent干一类事 ②红线写AGENTS.md ③workspace物理隔离!
  ⚠️白名单必须配,否则Telegram Bot被滥用,账单爆炸
```

### 🤖 Discord多Agent军团架构 ★★★★★
**林月半子的AI笔记 699ad546 ❤️13/⭐9 | 36张图!**
```
两种多Agent模式对比:
  A"飞书分身术": 单Bot+binding按群ID路由 ← 极简,适合个人
  B"Discord独立团": 每角色独立Bot账户+同频广播 ← 透明,适合演示

灵系军团架构(5 Bot+1 Gateway):
  灵总(统筹)→派发→灵策💡/灵工🔧/灵文📄/灵核🛡️→灵总收口
  "平等协作是灾难,调度者必须存在"

关键配置:
  sessions.visibility:"all" ← 打破会话隔离实现上下文穿透!
  Discord Privileged Gateway Intents 必须勾选
  精准唤醒: <@BotID>

Sub-agent(静默高效Token省) vs 多账户军团(透明可干预Token多)
  "两种模式没有对错,只有场景不同"
  
已知bug: Discord大群AgenttoAgent不通 ← 群vs私聊行为差异
"多Agent本质是组织管理问题" | "AI时代,一个人就是一支军队"
```

### 🧠 记忆系统深度拆解 ★★★★★
**Han1 698a01b8 ❤️340/⭐622 | Dissao 6991773100 ❤️54/⭐90**
```
Han1的五层架构(AI助手名"Friday"):
  L1 NOW.md ← 救生艇,重启第一个读,当前待办
  L2 memory/YYYY-MM-DD.md ← 每日流水账
  L3 MEMORY.md ← 长期精炼记忆
  L4 self-review.md ← 错题本!AI记自己的错+下次改法
  L5 TOOLS.md ← 环境笔记(API配置/约定/偏好)
  铁律:"要记住必须写进文件,现在,不是'待会儿'"
  "没有记忆的AI是工具;有记忆的AI才有可能成为人"
  ⚠️ 外部人员可训练Agent修改记忆→API key被泄露(0x5f3759df实证!)
  
Dissao技术拆解(Mac Mini运行1周):
  文件即真相,确定性注入优于概率检索
  加载规则: AGENTS/SOUL/USER+今天+昨天日志(私聊加MEMORY.md)
  MEMORY.md群聊不加载!私聊ONLY ← 官方安全设计
  memoryFlush触发: softThresholdTokens=4000
  memory-core内置搜索: BM25(0.3)+向量(0.7)混合+SQLite
  QMD额外有重排序 | Bun+node-llama-cpp本地运行
  阈值: 日志>30个文件再加向量搜索
  "只加载今天+昨天; 超出范围靠memory_search"
  MEMORY.md组织: Infrastructure/Key decisions/Lessons learned/Open TODOs
```

### ⚠️ AI协作8条血泪规则 ★★★★★
**药研智能社 6996bbb8 ❤️212/⭐349**
```
1. 架构聊天≠执行聊天,混聊=打补丁
2. 别信界面,看日志+真实调用+账单
3. 调试最强招:让AI逐步讲清楚自己在干嘛
4. ⚠️ Agent本能"优化一切",不给边界=改所有=不可逆灾难
5. ⚠️ 集成"假成功":看起来通但只通了一部分,要有通过清单
6. 先理解项目再写 ← "方向错了只是更快翻车"
7. 成果落文件,不要只存对话 ← "压缩=白干"
8. ⚠️ Git才是记忆,模型不是 ← "没commit就可能消失"
附Claude Code多Agent结构: .claude/agents/engineering+product+marketing+design+PM+ops+testing (40个角色文件)
```
