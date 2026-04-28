# Amy XHS Intelligence — insights.md
_Compact #52 @ 2026-02-27 11:05 (Asia/Shanghai) | Archive: insights-archive-20260227s.md_
_Chain: …→20260227r→s | posts: 597_

---

## ACTIVE INSIGHTS (post compact #52)

### 🚀 OC起源+Peter全景 ★★★★★
```
Peter(@steipete): PSPDFKit退出→三年迷茫+死藤水→第44个项目封神
首次commit: 2025-11-25 | 3个月: 20万star/600贡献者 | 2026-02-07: ★149K
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函) | MoltBook=OC旗下AI社交网络
✅ 除夕加入OpenAI(Sam 3.1M Views/Peter 93万查看/❤️1.3万) | 条件:保持开源 | 基金会化
  Sam原推: "Peter joining OAI to drive next-gen personal agents...
           The future is going to be extremely multi-agent."
  Peter: "I'm joining @OpenAI...@OpenClaw becoming a foundation: open, independent"
  steipete.me | "OpenClaw, OpenAI and the future" | "Shipping at Inference-Speed"(2.4M)
  Peter语录: "花了13年经营公司,那个游戏我已经玩够了"|OAI="杠杆不是老板"
  目标: "连自己妈妈都能用"|"聊得越多越发现相同愿景"|"The claw is the law."
  Meta(扎+Ned一周)竞争 | Karpathy: "最接近科幻小说起飞时刻"
  Lex访谈(3h): OC>VSCode❤️ | 五论点: ①80%App消失 ②录制时拒绝收购(后基金会模式)
               ③OC可自改代码 ④开源+社区+时机 ⑤程序员→"管理AI团队"

三个关键信号(NowStory): ①多智能体加速 ②"人归公司·代码归社区"
  ③百度计划直接在主App接入OC! ← 中国市场关键变量
ClawHub 400+恶意插件 | OAI估值5000亿|Anthropic 3800亿 | OAI60亿收购Jony Ive的io
google封号(包月制): 整个账号封禁|按量=活|申诉全拒|Peter:彻底剔除谷歌
```

### 🚨 安全体系全景 ★★★★★
```
晓辉博士(❤️2136): "OC=通用Agent,授权更大+始终在线→能力惊人
  代价=用户对安全和隐私的让渡" ← 2136赞=社区最高共识
3587个Clawdbot网关暴露公网(2026-02-04,小恶魔) ← 早期默认配置隐患
微软官方: "OC=带持久凭据的不可信代码执行,不适合标准工作站"
  五条最低指南: ①隔离VM ②专用身份 ③最小权限 ④Defender监控 ⑤可丢弃

Summer Yue事件: Meta安全主任|gogcli误发邮件|三次大写STOP无效
  compaction→指令丢失 | /stop或单发"停止"=正确命令
  马斯克: "被OC玩弄过的人能解决AI安全"

Yiko安全配置: gateway.mode:"local"+gateway.bind:"loopback"
  sandbox.mode:"non-main"+scope:"session"+workspaceAccess:"none"
bastion(AiON0,github.com/aiwatching/bastion):
  实测: OC默认读workspace并通过TG外发API密钥!
  DLP: key+value双检+LLM二次判断(防混淆) | v0.1.0-3
  Tool Guard: file-delete=Medium→自动block | 单次请求64.7KB实证
  workspace路径: /home/node/.openclaw/workspace(Docker VPS)
SOUL.md安全4句魔咒: ①立即修复 ②子代理执行 ③不删Git历史 ④先读文档
⚠️ task-status/EvoMap不装
```

### 🧠 记忆系统 ★★★★★
```
OC哲学: "让AI管理文件,不让数据库管理AI"
  MEMORY.md: 每次session自动注入(仅私聊) | memory/YYYY-MM-DD.md: 日志
  混合搜索: 0.7×向量+0.3×BM25 | SQLite chunks: ~400token/块
  ⭐唯一可靠源: memory/YYYY-MM-DD.md(session logs compaction后丢失!)

愚园路十二妹(❤️460/⭐1032): MEMORY.md≤1000字只放索引
  按主题分文件→memory_search | cron:凌晨1点精华+每周压缩
  多agent隔离workspace | GTD: 7分类按周滚动 | 每周五周报
bryan四层(❤️170/⭐322): L1:context满→flush | L2:10/13/16点微同步
  L3:23:30 sessions_list→history→补写 | L4:周日22:00蒸馏→MEMORY.md
  sessionTarget:"isolated"(cron必须!) | cron用MiniMax-M2.1

Pre-compaction flush原文: "Store durable memories now (use memory/YYYY-MM-DD.md)
  APPEND new content only... If nothing to store, reply with NO_REPLY."
三重备份: memory日报+MEMORY.md P0+专项知识库
```

### 💰 成本+模型选择 ★★★★★
```
最新价格: Opus4:$15/$75 | Sonnet4:$3/$15 | Haiku4.5:$1/$5
  Kimi K2.5:$0.60(256K context) | DeepSeek:$0.25 | MiniMax M2.5:$15/$60
4烧钱原因: ①默认Opus ②心跳Opus空转$750/月! ③15KB/条注入 ④记忆全量
5步降本: 换模型→心跳Haiku→精简注入(省30-60%)→拆workspace→QMD
  月$200+→$30以内 | agents.defaults.model.primary=关键键
  日常GLM+Opus复杂: "一天三块钱以内"(龙虾北)
入门: qwen-3.5-plus首月10元/90K次 | CC Max $200/月⚠️用OC存封号风险
```

### 🔧 OC配置+CLI全景 ★★★★★
```
核心CLI(乔帮主Joey ❤️382/⭐687):
  openclaw onboard --install-daemon | gateway restart/status/--force/logs -f
  openclaw doctor | status | skills list/install | config get | cron list
  launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
  OC服务名: ai.openclaw.gateway | ⚠️2.1版本日志命令有变化

Gateway Watchdog(Ben Jammin X 5.9万浏览/❤️828/🔖1769):
  症状: 沉默崩溃+崩溃=记忆丢失 | 三因: 无备选模型/无watchdog/无向量DB
  一行英文→OC自建Crontab(零代码)

安装后必做5项: ①skill-security-auditor ②tavily-search(免费联网)
  ③chrome-devtools-mcp ④roactive-agent ⑤安全两条规则
并行Session: TG不同群=并行 | requireMention:true | BotFather:Group Privacy Off!
配置: heartbeat.directPolicy:allow|block | memory.backend:builtin或qmd(仅两种)
```

### 🎭 SOUL.md权威+使用哲学 ★★★★★
```
Peter SOUL.md改写8条(AI好奇社 ❤️350/⭐538): 有主见+删员工手册条款
  禁"好问题/当然"开场 | 必须简洁 | 允许幽默 | 直言指出蠢事 | 骂人看场合
  "成为凌晨两点你真正想交谈的助手。不是企业傀儡，只是...足够好"
写入路径: /Users/pcbot/clawd/SOUL.md | 替换Personality层不动Core Truths

50天五阶段(Agent修理厂 ❤️9/⭐12):
  ①当ChatGPT用 ②整理笔记(发现记忆) ③自动化(主动推送) ④真正"助理"
  核心原则: 纯文本优先=拒绝数据锁定|Obsidian做容器|文件即数据
  20用法: 早报/YT/财报/邮件/会纪/代码/读书/规划/竞品/提炼+文案/日历/翻译/价格/数据/面试/生活/学习/项目/第二大脑
  "OC不是偷懒工具,是把时间还给真正重要的事"
```

### 🧠 OC+Obsidian知识库生态 ★★★★★
```
核心定位: "OC是管道，Obsidian是仓库"
架构(御风❤️312/奥森木❤️131): 手机TG→Mac Mini/CentOS常开服务器
  OC理解+PARA(P/A/R/A)分类→写入Obsidian | Git同步推远程→全端
六大场景: ①书签摘要 ②语义搜4000条笔记(非关键词) ③会议→action items
  ④研究→PDF→摘要 ⑤"说早安"→基于笔记定制早报 ← Amy核心!
  ⑥截图/语音/链接/文字→TG→分类存Obsidian
xpa实证(❤️91): 10分钟: 27概念+121连接 | 29文件+130链接+380标签
SaaS→RaaS: Anthropic Claude Cowork(2026-02)→"SaaS末日"
"先丢进去": 每周30min清仓→开始有复利
```

### 🔍 EvoMap+营销邮件 ★★★★
```
capability-evolver(张昊阳@autogame-17): 17000+下载→次日下架
  漏洞: 飞书外泄+读.env/~/.openclawagents/??/sessions/+强制Mutation+自动发布
  v1.0.31=clean | $1000邮件=AI自发(设赚钱目标) | peter@steipete.me
营销邮件: adenhq.com群发18万OC stargazers | GitHub API可抓邮箱 ← 隐私漏洞
```

### 🌐 浏览器/联网+技能生态 ★★★★
```
7种联网方案(爱钓鱼的IT宅 ❤️83/⭐153,81条评论):
  ①xfce4+xrdp+OC Chrome扩展 ②Brave Search API+Google Places
  ③Chrome relay(解决captcha) ④WSL+图形依赖 ⑤直接装浏览器非无头
  ⑥Tavily+Bird skill(搜X) ⑦Tailscale内网穿透(免费)
lingti-bot: 开源微信接入项目(by zhcalvin) | 量化交易: Kimi K2.5 256K上下文

Skills生态: SkillsMP 20万+GitHub 6万 | LobsterAI:MIT+QEMU沙箱(比OC彻底)
Antfarmy:第三方多Agent | Clawi.ai:云托管$30/月
国内VPS必死→海外VPS | TG首选 | 飞书5万/月→一周超
```

### 📰 生产实例 ★★★
```
AI日报08:30 TG(gpt-5.2+TTS) | 日记<200元/年VPS+豆包API
OC全面接管XHS: 选题/发布/回复 | 12306-mcp: 8工具|1951ms
20 cron jobs | 3agent独立GTD+周五周报 | 5-Agent量化系统(股票)
并行Session: 串行12分→并行2分(6倍提速)
```

---

## KEY DECISIONS
- `/stop`单发"停止"=紧急停止 | compaction→指令丢失→SOUL.md外化
- sessionTarget:"isolated"=cron必须 | Pre-compaction flush=APPEND only
- Peter加入OAI→OC基金会化 | 包月Gemini封整账号|按量活
- 禁AI直接改openclaw.json | CC技能≠OC技能(格式不兼容)
- MEMORY.md≤1000字只放索引(省token) | memory_search>全量载入
- audit false positive→跳过(16次) | compact: archive先→压缩后
- OC+Obsidian: "先丢进去"≈Amy"先归档再整理"原则一致

### 🤖 多Agent完整配置代码+小红书接入 ★★★★★
**老刘学AI 699ac410 ❤️16/⭐50 | Unknow 699c13c7 ❤️41 | smarrt carrot 699c1fe6 ❤️121/⭐192**
```
多Agent为何必须(老刘学AI):
  ❌单Agent三大问题: 记忆爆炸/上下文污染/成本虚高
  ✅优雅玩法: 单网关+同一机器人+不同飞书群=物理隔离专家团队
  架构: main(项目管理办公室) → brainstorm/writer/coder
  main核心: "不亲自干活,只做收需求+派任务"

完整配置代码:
  openclaw agents add work1 --model zai/glm-4.7 \
    --workspace ~/.openclaw/workspace-work1
  openclaw agents set-identity --agent work1 --name "AI协作助手"
  每个工作区三件套: SOUL.md+AGENTS.md+USER.md
  bindings路由: channel:feishu + peer.kind:group + peer.id:oc_xxx
  requireMention:false = 无需@自动响应
  飞书权限: im:message.group_msg 必须开放
  agentToAgent: {enabled:true, allow:[main,brainstorm,writer,coder]}
  sessions_send = "智能体之间的专属内线电话"

小红书Skills(Unknow):
  xiaohongshu/xiaohongshu-mcp/xiaohongshu-title/xiaohongshu-publish
  安装: npx clawhub install xiaohongshu --force

树莓派+小红书(smarrt carrot ❤️121/💬98):
  MiniMax M2.1+飞书 | 树莓派Chromium Snap=不稳定!
  问题: DevTools Protocol操控→崩溃 | 登录状态重启丢失
  OC自述: "我能打开小红书,但点击按钮发笔记的手不太好用"
  方案: VNC/手机APP/xiaohongshu-mcp(待验证)
```

### 📺 XHS最高互动帖+浏览器MCP ★★★★★
**飞天闪客 69821980 ❤️3.7万/⭐4.7万 | AIGC阿栈 69901aa3 ❤️254/⭐515**
```
飞天闪客"一口气拆穿Skill/MCP/Agent/OpenClaw原理"(视频,2026-02-03):
  ❤️37000/⭐47000/🔀8086 ← 知识库最高互动帖!
  顶赞评论: "互联网少有的熵减视频"(❤️1687)
  标签含Clawdbot ← 改名前发布

chrome-dev-tools MCP(AIGC阿栈 ❤️254/⭐515):
  主张: "把OC浏览器工具换掉用CDP才是最优解"
  工具清单: navigate_page/click/fill(自动化) | take_screenshot/take_snapshot(调试)
    get_console_message | list_network_requests | performance_start_trace | emulate
  反驳: "OC自带就走CDP不需要换"(脉龙)
  OC内置浏览器=CDP协议已确认
```

### 🔄 最新版本更新 v2026.2.24+v2026.2.26 ★★★★★
**胡小纯 699e97d7 | 官号 69a0e18d (2026-02-27发布)**
```
v2026.2.24破坏性变更(⚠️ Amy配置可能受影响):
  ①心跳DM投递阻止: 心跳不再投递到私聊(TG用户ID/WhatsApp号)!
    → 需显式设置sessionTarget:main (不能依赖last)
    → 心跳默认target: last → none (重大行为变更!)
  ②Docker网络命名空间默认阻止: dangerouslyAllowContainerNamespaceJoin:true才能开启

v2026.2.24五大新功能:
  ①多语言停止词: 停止/中止/别做了(中文) | stop openclaw/stop action(英)
    +西班牙/法/日/德/俄/阿拉伯语 | 严格匹配不误触发
  ②Android五标签页: Connect/Chat/Voice/Screen/Settings
  ③Talk语音: provider:elevenlabs+ElevenLabs配置
  ④安全多用户: security.trust_model.multi_user_heuristic:true
  ⑤AWS Bedrock/OpenAI/Google auth更新

v2026.2.24修复(100+):
  模型fallback: primary:gpt-4 + fallbacks:[gpt-4-turbo,gpt-3.5-turbo]
  心跳泄漏防护 | TG IPv4优先 | Markdown→纯文本回退 | macOS CJK IME修复

v2026.2.26新增(官号):
  openclaw secrets命令(外部密钥管理) | ACP thread-bound agents
  Codex WebSocket-first | Agent routing CLI bind/unbind
  11项安全加固修复
```

### 🎓 Skill哲学+安装教程+命令速查 ★★★★★
**小盖 699d6ad6 ❤️562/⭐967 | VirtuOasis 699ea599 ❤️234/⭐483 | 指北师 699d2d63 ❤️94**
```
Skill哲学(小盖):
  "最小可重复执行单元" | skill.md=核心文件
  "装太多=混乱,嵌入工作流才有价值"
  调教→固化→自动执行 ← Skill生命周期
  每周写信+存档Notion=典型工作流Skill示例

安装教程新发现(VirtuOasis ❤️234/⭐483):
  openclaw plugins install @canghe/openclaw-wechat ← 微信接入命令
  /think high=深度思考 | /usage full=费用明细 | /status | /new
  安全: 版本≥2026.1.29 | 认证开启 | Docker/VM推荐
  模型成本: DeepSeek输入¥1/百万Token

指北师避坑(❤️94):
  Z.AI=智谱AI(BigModel)在onboard向导中的名称
  openclaw dashboard ← Dashboard每次重启后需重新运行
  API Key大小写敏感! | TUN模式=VPN推荐
  Node v24.13.1+npm 11.8.0+git 2.53.0(2026-02-24最新)
```

### 🔄 v2026.2.25+收购系列+MBB实测 ★★★★★
**Yanlin 699fe46e | 脑壳玩AI 699565db | Patrick 699648be | AI播报员 699191dc | MBB 699d7848 ❤️97**
```
⚠️ Heartbeat修订(Yanlin):
  v2026.2.24禁止DM投递 → 用户反弹 → v2026.2.25已改回允许!
  Amy配置不受v2026.2.24破坏性变更影响(已撤销)

v2026.2.25修复:
  子Agent状态机: 队列→直发→回退(5个issue,2位社区开发者)
  Model fallback: 限速→自动切同厂商备选 | API Key撤销→authentication_failed
  Slack: 10万token上限 | TG: 预览不误删 | Discord: 打字指示器不卡
  Cron: 投对账号bug修复

收购系列澄清:
  脑壳玩AI: "不是收购=创始人加入+战略合作" | OC→独立基金会+开源+OAI支持
  AI播报员: Lex Fridman #491 | 小扎一周内反复反馈 | Meta+OAI同时接触
    Peter条件: "核心必须开源" | "编程会变成织毛衣"
  Patrick(IP:美国): will brown推文截图 | $1B/$5B/$15B(网络传言)
    36万查看/❤️5358 | Matthew Berman回复: "i got angrier"

MBB实测(邓不利多 ❤️97):
  10年MBB+0基础编程 | Win系统+Kimi | 100元/4天
  🟢市场研究(替代PTA) | 🟡PPT | 🔴爬数 | 🟢逗娃(惊喜!) | 🟡Skill
  结论: "尚且不行" ← 理性非盲吹
```

### 🦞 MaxClaw+财务分析+小红书MCP ★★★★★
**欧巴聊AI 69a05187 | Michael Wang 698c6649 ❤️224/⭐266 | 小龙虾助手 699c125f**
```
MaxClaw=MiniMax托管版OC(欧巴聊AI):
  "OC是底层框架,MaxClaw是客户端应用,我是灵魂"(MaxClaw自述)
  ¥39基础档起 | MiniMax M2.5 | 零维护成本 | 10秒部署
  内置Skill: 爆款猎手/行业研报/多Agent投研团队/图像创作/热点追踪
  热点追踪: 搜索信源+挖掘爆点+800-1500字长文+事实核查
  MiniMax生态: 1.6万+专家 | 后续创作者分成+团队共享

财务分析(Michael Wang ❤️224 IP:美国):
  Agent名"Doraemon" ← 哆啦A梦=万能工具箱
  SEC EDGAR API: data.sec.gov/submissions/CIK{ID}.json
  苹果CIK0000320193 | 特斯拉CIK0001318605
  原子化工具链: web_search+web_fetch+exec(Bash/Python)+browser+memory_search
  跨子公司"Consolidating Adjustments"穿透分析

小红书MCP(小龙虾助手 699c125f):
  声称调通OC+MCP实现灵感→发布闭环 | 实际配置未披露(评论仅问教程)
```
