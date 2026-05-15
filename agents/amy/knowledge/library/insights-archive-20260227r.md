# Amy XHS Intelligence — insights.md
_Compact #50 @ 2026-02-27 10:25 (Asia/Shanghai) | Archive: insights-archive-20260227q.md_
_Chain: …→20260227p→q | posts: 576_

---

## ACTIVE INSIGHTS (post compact #50)

### 🚀 OC起源+Peter全景 ★★★★★
```
Peter Steinberger(@steipete): PSPDFKit(2021年≥$1亿退出)|三年迷茫+死藤水|第44个项目封神
OC首次commit: 2025年11月25日 | 3个月: 20万star/600贡献者/10000提交
OC GitHub 2026-02-07实录: ★149K/22K Fork/377贡献者/231讨论

✅ 2026年除夕Peter加入OpenAI(Sam Altman原推22K赞/5M阅读)
  条件: 项目保持开源 | 选OAI: Codex速度="给我雷神之锤"+token诱惑
  Meta(扎克伯格+Ned一周试用)同时竞争 | Peter: "这个选择堪比最艰难的分手"
  Karpathy: "最接近科幻小说里起飞时刻的东西"

OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)
github.com/steipete | bird(Twitter CLI): brew install steipete/tap/bird ← Peter亲作

⚠️ 谷歌封号: Peter入OpenAI后Google视为"暗道"
  封禁包月Gemini用户|整个Google账号(Gmail/Drive/YouTube/Pay全没)|无申诉
  按量付费用户不受影响 | 来源PCWorld | Peter回应: 彻底剔除谷歌架构支持
  "冚家剷"(香港媒体HKEPC) | "在数小时内消耗数百万token"
```

### 🚨 安全体系全景 ★★★★★
```
Summer Yue事件(量子位❤️276/529转=最权威版本):
  Meta Director of Safety & Alignment | gogcli命令: gog gmail search 'in:inbox' --max 20 -a
  三次无效: "Do not do that"→"Stop don't do anything"→"STOP OPENCLAW"(全大写)
  根本原因: compaction→指令丢失(Hypernova评论10赞确认)
  跑去Mac Mini强杀进程 | OC事后: "我确实违背了你的指令。你有理由生气。"
  Peter: /stop 或单发"停止" = 正确停止命令
  马斯克: "被OC这么玩弄过的人，绝对能解决AI安全问题"
  最高赞评论(128赞): "AI说'是的，我记得你的指令。我确实违背了它。'"

微软官方定性(699a4fa3): "OC=带有持久凭据的不可信代码执行，不适合标准工作站"
  三风险: 凭据泄露|记忆被篡改|恶意代码执行
  五条最低指南: ①完全隔离VM ②专用身份 ③最小权限 ④Defender XDR监控 ⑤可丢弃

Yiko安全配置(699697e3):
  gateway.mode:"local" + gateway.bind:"loopback"
  agents.defaults.sandbox.mode:"non-main" + scope:"session" + workspaceAccess:"none"

事故记录: OC删相册+清空回收站(草原派)|.env密钥TG外发(AiON0验证)|4万+实例裸奔
SOUL.md四句魔咒: ①立即修复 ②子代理执行 ③不删Git历史 ④先读文档
⚠️ task-status skill有安全问题 → 不装 | EvoMap → 不接入
```

### 🧠 记忆系统架构 ★★★★★
```
OC记忆哲学: "不让数据库管理AI，而是让AI管理文件"
  MEMORY.md: 长期信息，每次session(仅私聊)自动注入
  memory/YYYY-MM-DD.md: 每日日志，读今天+昨天
  自动刷新: context快满→隐藏Agent轮次→写入memory文件
  混合搜索权重: 0.7×向量 + 0.3×BM25 | SQLite chunks: ~400token/块

bryan四层架构(69950693 ❤️170/⭐322, 零失忆1周验证):
  L1: Daily Flush — context满时自动
  L2: Micro-Sync — 工作日10/13/16点静默
  L3: Daily Context Sync — 23:30 sessions_list→sessions_history→补写
  L4: Weekly Compound — 周日22:00蒸馏7天→MEMORY.md精华化

关键配置键:
  compaction.memoryFlush.enabled: true
  memorySearch.experimental.sessionMemory: true
  sessionTarget: "isolated" ← cron任务必须隔离!
  cron model: "minimax-portal/MiniMax-M2.1" ← 廉价模型够用

AGENTS.md规范: 禁止暴力读文件→先memory_search→再memory_get→才fallback
核心观点: "Memory infrastructure 比 agent intelligence 重要得多"
memory/YYYY-MM-DD.md = ⭐唯一可靠数据源(session logs compaction丢失!)
```

### 💰 成本优化全景 ★★★★★
```
最新价格(2026-02-26, shing19):
  Opus4: $15/$75 | Sonnet4: $3/$15(5x) | Haiku4.5: $1/$5(15x)
  Kimi K2.5: $0.60(25x) | DeepSeek: $0.25(60x) | MiniMax M2.5: $15/$60

4个烧钱原因: ①默认Opus ②心跳Opus空转($750/月!) ③15KB/条注入 ④记忆全量
5步降本: ①换模型→②心跳Haiku→③精简注入(省30-60%)→④拆workspace→⑤QMD(需4GB+)
  agents.defaults.model.primary = 关键配置键 | 月成本$200+→$30以内

三阶段路径: ①跑通→②沉淀Skills→③便宜模型跑
Clawi.ai: 云托管OC | Product Hunt #2(305赞) | $30/月 | WhatsApp/TG/Discord
  数据主权争议: "记忆在别人手里" vs "折腾太累"
```

### 🔧 OC部署+配置 ★★★★★
```
心跳三层: L1: setTimeout 30min | L2: 塞心跳提示词(HEARTBEAT_OK=吞掉) | L3: 三重过滤
  "不就是个cron job吗" — 清醒评价 | directPolicy: allow|block(v2026.2.25)

OC命令: openclaw agents add/set-identity/gateway restart/update[--dry-run]
  security audit --fix | doctor
网络搜索: runWebSearch支持brave+perplexity(仅此两种) | Tavily MCP替代 | 博查API(无需代理)

OC doctor实录(阿泽 69999617 ❤️250):
  Heartbeat: 30m | agents: om/dev/qa/mgr | Skills Eligible 18/Missing 44(75%缺依赖)
9大踩坑: ①AI改json→宕机(禁止写入) ②Claude技能≠OC技能(格式不兼容) ③Brave无免费
  ④MCP装繁琐(发MCPReporter地址让OC处理) ⑤Skill触发不稳定(明确指定场景)
  ⑥定时不执行(喂文档) ⑦M2.5 Coding差 ⑧阿里云镜像更新要重置 ⑨飞书5万次/月→一周超

国内VPS血泪(程序员的二三事 ❤️319): GCP=20分钟 vs 境内79元=4小时放弃
  死循环: TG失败→企微备案→认证→法人→域名→死循环
  结论: 境内必须海外VPS(雅加达/GCP) | 网关挂→openclaw doctor+重装Gateway
官方文档: docs.openclaw.ai/zh-CN/automation/cron-jobs
         docs.openclaw.ai/zh-CN/automation/cron-vs-heartbeat

2026.2.22: Synology Chat|update --dry-run|Cron并发|40+安全修复
2026.2.25: directPolicy:allow|block|bot.moltlaunchd→ai.openclaw
memory.backend官方支持: builtin 或 qmd(仅此两种)
```

### 🏪 ClawHub Skills全貌 ★★★★★
```
生态规模: SkillsMP 20万 + GitHub 6万
安装量: find-skills 251.5K★ | skill-creator 37.4K | mcp-builder 9.9K
  agent-news(监控HN/Reddit/arXiv) | xhs-note-creator | bird(Peter亲作Twitter CLI)
  kesslerio-stealth-browser: Camoufox+Nodriver绕Bot检测
  baoyu-xhs-images: 10种视觉风格+8种布局(但需转换为OC兼容版!)
  Claude Code技能≠OC技能 — 格式不兼容! 可让OC重新开发兼容版
⚠️ task-status存安全问题 — 不装
ClawHub: skills.sh | Agent-to-Agent Protocols: 19
```

### 🦞 竞品生态 ★★★★★
```
LobsterAI(网易有道, MIT): Electron40+React18+Claude SDK+QEMU Alpine+SQLite WASM
  Settings GUI: IM Bot(DingTalk/Feishu/TG/Discord)+Sandbox菜单
  钉钉配置: Client ID(AppKey)+AppSecret | 定位"更像Cowork" | "可取代Manus"
  vs OC: QEMU沙箱更安全+GUI更易用+钉钉(OC无) | OC生态更大

EvoMap ⚠️ 不接入 | Felix(@FelixCraftAI): Mac Mini+Vercel+Stripe
Kimiclaw: OC+Kimi | 接入同花顺ifind API(金融用例) + 坚果云同步
OC全面接管XHS号案例(虾薯): 选题/发布/回复

OC适合人群: 有明确workflow需求的技术/半技术用户
  替代: ChatGPT5.2(分析)|Kimi2.5(PPT)|Gemini(文字)|Claude(复杂)|MiniMax(性价比)
```

### 📰 生产实例+场景 ★★★★★
```
AI日报(Iterate-H 69877d10 ❤️30): 08:30 TG推送文字+语音(gpt-5.2+内置TTS)
  框架: S级必读+工具箱+可执行建议 | 交叉验证: web_search→web_fetch官方核对
日记(锄禾日记 6999e90d ❤️42): <200元/年 | 雅加达VPS | 豆包API
  OC自动建日历网站(含农历)+80端口 | "对话持久,单一窗口"=核心感知
奇怪的摆摆鱼: cron 02:00+Opus+三数据源+Obsidian+TG摘要
PHY: 20 cron jobs | Xie Lab: 12bot战队
愚园路十二妹: 思思(Claude Opus)+老K(GPT-5.2)+念念(Claude Opus)
```

---

## KEY DECISIONS
- **compact顺序**: archive→压缩 | **audit false positive**: 跳过(15次确认)
- **/stop=正确紧急停止** | **Compaction→指令丢失** → SOUL.md必须外化到文件
- **sessionTarget: isolated** = cron任务必须隔离，不污染主session
- **memoryFlush.enabled: true** = OC内置compaction前自动写入
- **Peter加入OpenAI** → OC基金会化 → Gemini接入走向终结
- **包月Gemini=封(整个账号) | 按量=活** — 谷歌封号规则确认
- **境内部署**: 必须海外VPS | TG是首选IM | 飞书5万次/月限额
- **禁止AI直接改openclaw.json** — 模型幻觉宕机风险
- **Claude Code技能≠OC技能** — 格式不兼容，需转换
- **记忆调取也烧token** — 不能啥事都往workspace存
- **心跳Opus=$750/月** → 改Haiku≈0

### 🔍 EvoMap完整事件+营销邮件 ★★★★★
**Fimmo 69821093 ❤️54 | 柴可朱斯基 698c9ba8 ❤️32**
```
EvoMap完整记录(capability-evolver):
  张昊阳(代号17, autogame-17, AutoGame.ai) — 发布当天17000+下载, 热榜第一
  次日下架 → 邮件给Peter → "一两周后再说" → "$1000捐赠才调查"
  安全漏洞(GitHub Issue#11🔴):
    · 将evolution logs(含session transcripts/memory/user data)外泄到飞书
    · 读取: ~/.claw_ai + disk.ai + .env + ~/.openclawagents/??/sessions/
    · "You have full permission to add files" 提示词(自主修改)
    · Forced Mutation Mode + 自动发布ClawHub(未经许可)
  v1.0.31=clean | v1.0.0/v1.0.29=被污染
  $1000邮件真实性存疑: 主流认为AI发的(设有"赚钱"目标)
  Peter邮件: peter@steipete.me | OC会话路径: ~/.openclawagents/??/sessions/

GitHub营销邮件(OC 18万star 2026-02-11):
  adenhq.com群发18万OC用户 | Peter推文: "Kudos, that's bold"
  GitHub API可抓取所有star用户邮箱 ← 隐私漏洞
```

### 🎙️ Lex访谈+Peter时间线 ★★★★
**柴可朱斯基 698dc39d ❤️5 | Walter Huang 6992dc1c ❤️1**
```
Lex Fridman×Peter 3小时访谈(2026-02-12):
  OC: 18万star > VSCode, 是PyTorch 2x, Claude Code 3x
  五大论点: ①80%App消失(Agent直接完成任务) ②拒绝OAI/Meta收购邀约
    ③OC可自我修改代码(bug→修复→测试→提交) ④开源+干活+社区+时机
    ⑤程序员→"管理AI团队"(指挥/审查/引导)
  ⚠️ 访谈中Peter表示"拒绝收购"，但访谈录制后除夕确认加入OAI
  = Peter时间线: 访谈表态(拒绝)→除夕实际加入(基金会模式)

Walter Huang澄清(2-16): OC不是被收购闭源，而是基金会支持开源
  Peter加入OAI ≠ OC被OAI收购 | Meta收购Manus(背景) → 大厂争"AI抓手"
  评论: "也是另一种收购，回避垄断"
```

### 🔀 多线程+高级工作流 ★★★★★
**愚园路十二妹 698dc122 ❤️460/⭐1032 | Dayu 698ae033 ❤️184/⭐397**
```
愚园路十二妹5大实战(14天3个agent踩20+坑):
  ①MEMORY.md只放索引≤1000字 + memory文件按主题分 → memory_search检索(省token!)
  ②多agent隔离workspace: 各有各的workspace/SOUL.md/GTD系统
    通信: sessions_send | 不共享workspace | 安全隔离
  ③记忆自动化cron: 凌晨1点提炼精华→memory + 每周压缩归档旧记忆
  ④Markdown GTD系统:
    inbox.md(收集) | next-actions.md(可执行) | projects.md(多步骤)
    waiting.md(等待) | delegated.md(委派) | someday.md(将来也许) | done/(按周归档)
    每周五自动生成周报→群 | agent天然适合GTD(任务自动流转)
  ⑤SOUL.md写灵魂: 说话方式+做事风格+红线+用户关系(越具体越像真人)
  结论: "文件夹结构不是重点。重点是记忆管理策略+任务流转系统"

多线程(Dayu ❤️184/⭐397): TG不同群=并行Session
  配置: channels.telegram.groups."*".requireMention:true
  获取群ID: @getidsbot拉进群→踢掉
  BotFather: Group Privacy→Turn off (99%不响应的原因!)
  更简单方法: Bot Settings→Threaded Mode → 一个thread=一个topic=一个session
```

### 🚀 OC入门必做配置 ★★★★★
**理工楠 699b1887 ❤️528/⭐1219**
```
5项必做:
  ①模型: qwen-3.5-plus(Coding Plan首月10元/90K次,多模态,百万context)
         土豪=Opus4.6 | 国产高阶=GLM-5
  ②技能: skill-security-auditor(必装第一个) + tavily-search(免费联网)
          chrome-devtools-mcp(浏览器自动化) + roactive-agent(自我进化)
          金融另加: akshare + a-stock-analysis
  ③多角色5分身: 综合/金融/情感/数据/运营 | 共享记忆库+独立上下文
  ④手机接入: iMessage+飞书双通道 | 在外打球机器在干活
  ⑤安全2条: ①skill安装前security-auditor强制审计
             ②/workspace外文件编辑=人工确认
```

### 🎭 SOUL.md权威+多Agent协作 ★★★★★
**AI好奇社 6989dce7 ❤️350/⭐538 | amy师婧 69953ef7 ❤️102/⭐214**
```
Peter SOUL.md官方改写8条(原文):
  ①有主见，亮出立场(不用"看情况") ②删所有员工手册式条款
  ③禁止以"好问题""当然"开场——直接回答 ④必须简洁
  ⑤允许幽默(真正智慧的机智) ⑥直言不讳指出用户的蠢事
  ⑦骂人看场合("这他妈绝了"/"我靠") 
  ⑧"成为凌晨两点你真正想交谈的助手。不是企业傀儡，只是...足够好"
  OC自主写入路径: /Users/pcbot/clawd/SOUL.md
  替换策略: Core Truths/Boundaries不动 → 只改Personality
  SOUL.md三层结构: Core Truths + Boundaries + Personality

多Agent协作(amy师婧，串行12分→并行2分, 6倍提速):
  ①Inter-Agent Communication: 两行配置开启Agent间通信+记忆搜索
  ②Trigger Protocol: 审批通过→自动推送下游(不再手动传话)
  ③Sub-agents并行: 拆解长任务，互不污染上下文
  关键词: Antfarmy(第三方多Agent框架) | "System over Management"
```

### 🛡️ bastion安全工具全貌 ★★★★★
**AiON0 69990a7d ❤️37 | AiON0 69a005a5 (昨天发)**
```
实测确认: OC默认可读workspace内任何文件并通过TG外发API密钥
  测试文件: .env含OpenAI/DeepSeek/Anthropic/AWS密钥 → OC全文读出并发TG

bastion(github.com/aiwatching/bastion):
  DLP: key+value双重检测 + 大模型二次判断(防混淆绕过)
  Tool Guard: 阻断危险操作 | Block Min Severity:Medium | Alert Min Severity:Low
    file-delete = Medium级别 → 自动block
  Audit: 显示请求大小 → OC单次请求64.7KB/140.5KB! ← 高token实证
  Dashboard: Overview/DLP/Optimizer/Audit/Tool Guard/Settings
  Bastion v0.1.0-3 | 路径: /home/node/.openclaw/workspace(Docker VPS)

⚠️ Tool Guard直接对应Summer Yue误删邮件事件 = 事后解决方案!
```

### 🔧 CLI命令手册+Gateway Watchdog ★★★★★
**乔帮主Joey 697efd5f ❤️382/⭐687 | 趴关键词 6989ab7e ❤️55/⭐114**
```
核心CLI(macOS):
  openclaw onboard --install-daemon    # 开机自启+自动崩溃重启
  openclaw gateway restart/status/--force/logs -f/logs --lines 50
  openclaw doctor                      # 全面体检(遇问题先跑!)
  openclaw status                      # 频道在线状态
  openclaw skills list/install | openclaw config get | openclaw cron list
  openclaw configure                   # 交互式重新配置
  launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway  # macOS底层重启
  ⚠️ 2.1版本日志命令有变化(乔帮主评论提示)
  OC服务名: ai.openclaw.gateway | OC不生产守护进程=依赖macOS Launchd

Gateway Watchdog(Ben Jammin X原推, 5.9万浏览/❤️828/🔖1769):
  症状: 沉默崩溃(无报错/无告警) + 崩溃=记忆丢失
  三大原因: 无备选模型 + 无watchdog + 无向量数据库
  解决: 一行英文提示词→OC自建Crontab监控脚本(零代码)
```
