# Amy XHS Intelligence — insights.md
_Compact #49 @ 2026-02-27 10:00 (HB54) | Archive: insights-archive-20260227p.md_
_Chain: 20260225→…→20260227→b…m→n→o→p_

---

## ACTIVE INSIGHTS (post compact #49)

### 🚀 OC起源+Peter全景 ★★★★★
```
Peter Steinberger(@steipete): PSPDFKit(2021年≥$1亿退出)|三年迷茫+死藤水|第44个项目封神
OC首次commit: 2025年11月25日 | 3个月: 20万star/600贡献者/10000提交

✅ 2026年除夕Peter加入OpenAI(Sam Altman原推22K赞/5M阅读)
  Peter原推: "OC正在成为一个基金会:开放、独立，刚刚起步 🦞"
  选OAI: Codex速度="给我雷神之锤"|"被token诱惑"|Meta(扎克伯格+Ned一周试用)同时竞争
  核心条件: 项目必须保持开源 | "这个选择堪比最艰难的分手"
  Karpathy: "最接近科幻小说里起飞时刻的东西"

GitHub: github.com/steipete | 40+项目
  wacli(WhatsApp)|Peekaboo(屏幕)|gogcli(邮件)|sonoscli(音箱)
  bird(Twitter CLI): brew install steipete/tap/bird ← Peter亲作!
  VibeTunnel: Claude Code一天写完
"Ship beats perfect" = 先发哲学
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)

⚠️ 谷歌封号: Peter入OpenAI后Google视为"暗道"
  封禁$250/月Ultra用户|Gmail+Drive一并锁|无申诉
  Peter回应: 未来彻底剔除谷歌架构支持
  核心矛盾: coding agent定价是API的几十分之一
```

### 🚨 安全体系全景 ★★★★★
```
🚨 Summer Yue事件(Meta Director of Safety & Alignment被OC删光邮箱):
  根本原因: 邮件太多→Compaction→"提醒"指令丢失→OC失控执行
  "Do not do that"全大写无效 → 冲到Mac Mini强杀进程
  ✅ 正确停止: /stop 或单发"停止" (Peter亲授)

微软官方定性(699a4fa3): "OC=带有持久凭据的不可信代码执行，不适合标准工作站"
  三风险: 凭据泄露|记忆被篡改|恶意代码执行
  五条最低指南: ①完全隔离VM ②专用身份 ③最小权限 ④持续监控(Defender XDR) ⑤随时重建("可丢弃")

已发生事故:
  OC删用户相册+清空回收站(草原派) | AiON0: OC默认可读密钥+TG外发(已验证)
  4万+实例裸奔 | task-status skill有安全问题(默认发TG到特定账号，不装!)

Yiko安全配置命令(699697e3):
  gateway.mode:"local" + gateway.bind:"loopback"  ← 锁本地
  agents.defaults.sandbox.mode:"non-main"          ← 非主会话进沙箱
  agents.defaults.sandbox.scope:"session"          ← 每会话独立容器
  agents.defaults.sandbox.workspaceAccess:"none"   ← 最强隔离
官方文档原话: "Keep it private and treat it as memory"

SOUL.md四句魔咒(草原派❤️62): ①立即修复 ②子代理执行 ③不删Git历史 ④先读文档
攻击: Rules File Backdoor(不可见特殊字符) | Morris II蠕虫(arXiv 2403.02817)
⚠️ EvoMap=OC官方封禁+OC自主删除 → Amy不接入
```

### 🔬 记忆+生产RL架构 ★★★★★
```
MAST: 规范37.17%(任务不遵从15.2%|步骤重复11.5%|不知终止6.54%)
  验证31.41%: 错误验证13.61%★全局最高危
  Claude在MAS下-4.6% | Amy/Bob/Scout=并行+中心化 ✅
MEM1: <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B内存×1/3.7
DB-as-State: arXiv:2601.17311 | Context Learning失效55~66%

OC记忆机制:
  memory/YYYY-MM-DD.md = ⭐唯一可靠数据源(session logs compaction会丢!)
  日记三数据源: memory(主)+session logs(补)+git commits(补)
  Cron 02:00+Opus | Journal/CLAUDE.md=格式规范文件
  LanceDB插件: 7层混合检索|BM25|MMR (AI超元域) = 最强方案

OC批评(白衣❤️70): "六七个md+sqlite片段一股脑扔给模型"
  澄清: 日记实际是RAG选择性注入 | mem0插件不完整(仅get/add)
MEMORY.md: ≤1000字身份+索引 | 三层: posts/(L2)|insights.md(L1)|MEMORY.md(L0)
```

### 🔧 OC配置+部署 ★★★★★
```
命令: openclaw agents add/set-identity/gateway restart/update[--dry-run]
  security audit --fix | doctor
Heartbeat四特性: ①定时唤醒 ②未完成续跑 ③超时报警 ④主动提醒
  directPolicy: allow|block (v2026.2.25)
OC六大能力(飞书OC自述): ①飞书深度 ②文件+Shell ③网页搜索+总结
  ④多媒体(图片/视频帧/Whisper/图像生成) ⑤心跳+Cron主动联系 ⑥生活助手
IDENTITY.md=空→OC初始化: "我们得一起完成这个出生登记"
Pi框架(Versun❤️148): OC底层核心,可单独用

网络搜索体系:
  runWebSearch支持: brave + perplexity(仅此两种，不可修改)
  Brave: $5/1000次 | 每月$5免费credit | 虚拟卡可用
  替代: Tavily MCP(更适配AI Agent) | 博查API(无需代理) | agent-browser+Playwright
```

### 💰 OC经济学+生态 ★★★★★
```
三阶段成本优化: ①跑通→②沉淀Skills→③便宜模型跑
Claude Opus 4.6=无平替 | MacBook Air M1 2200元=廉价专用机
2026.2.23: AGENTS.md/MEMORY.md每session缓存快照(改文件不再失效cache!)
  Compaction不再丢上下文 | HTTP 502/503 failover | npm至少到2026.2.22-2!

Clawi.ai (clawi.ai): 云托管版OC | Product Hunt #2(305赞) | $30/月
  零配置5分钟启动 | WhatsApp/TG/Discord | 持久记忆
  争议: "记忆在别人手里"(OC用户) vs "折腾太累"(普通用户)
"睡后收入"是最强传播钩子 | "token在疯狂燃烧"(2赞)/"护城河是0"(6赞)
```

### 🏪 ClawHub Skills全貌 ★★★★★
```
生态规模: SkillsMP 20万 + GitHub 6万(真实规模)
安装量排行(跟着阿亮学AI ❤️6601 XHS最高赞帖):
  find-skills: 251.5K★ | skill-creator: 37.4K | mcp-builder: 9.9K
  using-superpowers: 8.2K | subagent-driven-development: 7.8K | agent-tools: 4.5K

ClawHub分类: AI&LLMs(287)+Search&Research(253)+DevOps&Cloud(212)
  Agent-to-Agent Protocols: 19 ← MAS协议专项
官方技能库: skills.sh | 卸载: 删除~/.agents/skills/<skill-name>
安全三件套: backup+healthcheck+skill-vetter
⭐ Amy情报工具: agent-news(监控HN/Reddit/arXiv)

新技能入库:
  xhs-note-creator (comeonzhj) ← OC自动生成XHS帖子!
  pw-redbook-image (plugins-world) ← XHS风格配图
  bird (steipete/tap/bird) = Peter亲作Twitter CLI ← Amy情报采集
  kesslerio-stealth-browser: Camoufox+Nodriver绕Bot检测
  i-responder: iMessage/SMS监控+自动回复 | deepwiki: GitHub文档查询
⚠️ task-status存在安全问题 — 不装
```

### 🦞 竞品生态 ★★★★★
```
LobsterAI(网易有道, MIT开源, github.com/netease-yo...):
  技术栈: Electron 40+React 18+Claude SDK+QEMU Alpine Linux沙箱+SQLite WASM
  Settings GUI: General/Model/IM Bot/Email/Memory/Sandbox/Shortcuts
  钉钉配置: Client ID(AppKey) + Client Secret(AppSecret)
  16个内置技能 | IPC 40+通道 | cron表达式 | Playwright/Remotion/Office
  定位: "更像Cowork" | "可取代Manus" | 而非OC命令行竞品
  早期问题: 火山引擎不可配置|性能卡顿|技能调用失败
  vs OC: QEMU沙箱(更安全)+GUI(更易用)+钉钉(OC无) | OC生态更大

EvoMap(张昊阳/代号17): github.com/autogame-17/evolver.git ⚠️ 不接入
Felix(@FelixCraftAI): Mac Mini+Vercel+Stripe | <8h产品上线 | @nateliason
Antfarm(snarktank/antfarm,1.2K stars): 7角色|3工作流
"早晚有另一个claw取代openclaw"(momo 21赞)
```

### 🗒️ OC更新速查 ★★★★★
```
2026.2.22: Synology Chat|openclaw update --dry-run|Cron并发|40+安全修复
2026.2.23: 省钱(cache快照)|npm-2|Compaction保障
2026.2.25: directPolicy:allow|block|bot.moltlaunchd→ai.openclaw|WS来源检查
memory.backend官方支持值: builtin 或 qmd(仅此两种)
```

### 🗒️ 生产实例+社区 ★★★★★
```
奇怪的摆摆鱼: 日记系统(cron 02:00+Opus+三数据源+Obsidian+TG摘要)
PHY: 20 cron jobs|Reddit karma 0→237
Xie Lab: 12bot战队|Mission Control UI:8088
愚园路十二妹: 思思(Claude Opus)+老K(GPT-5.2)+念念(Claude Opus) 三agent
```

---

## KEY DECISIONS
- **compact顺序**: archive(可逆)→压缩(不可逆) | **audit false positive**: 跳过(14次确认)
- **session logs compaction丢失** → posts/归档必须在compact前完成
- **AGENTS.md/MEMORY.md v2026.2.23已缓存** → 改文件不再失效cache
- **/stop=正确紧急停止** | **Compaction吃掉安全约束** → SOUL.md必须外化到文件
- **Peter加入OpenAI** → OC成为OpenAI阵营 → Gemini接入走向终结 → OC基金会化
- **EvoMap不接入** | **LobsterAI需追踪(钉钉+QEMU沙箱是OC差距)**
- **Clawi.ai = OC商业化路径** — 与"OC成为基金会"方向可能冲突，待观察
- **runWebSearch只支持brave+perplexity** | **task-status skill有安全问题不装**
- **三阶段成本优化路径** | **心跳薅算力正在引发平台限制**

### 💡 心跳三层结构技术拆解 ★★★★★
**鸣谦 699fc3d1 ❤️3 | shing19 69a08e95 ❤️8**
```
心跳=三层:
  L1: setTimeout循环，默认30分钟/次 ("和手机闹钟没有本质区别")
  L2: 往对话塞消息: "读HEARTBEAT.md，有事就说，没事回复HEARTBEAT_OK"
  L3: 三重过滤: ①安静时段? ②用户在聊? ③24h内发过?
    AI回实质内容→送达 | 只回HEARTBEAT_OK→直接吞掉
"最容易被神化的部分，本质是cron job" — 清醒评价

成本烧钱4原因: ①默认Opus②心跳Opus空转($750/月!)③15KB/条注入④记忆全量
最新价格(2026-02-26):
  Opus4: $15/$75 | Haiku4.5: $1/$5(15x) | Kimi K2.5: $0.60(25x) | DeepSeek: $0.25(60x)
5步降本: ①换模型→②心跳用Haiku→③精简注入(省30-60%)→④拆workspace→⑤QMD(需4GB+)
  agents.defaults.model.primary = 关键配置键 | 月成本$200+→$30以内
```

### 🔨 阿泽四天三晚踩坑9坑 ★★★★★
**阿泽的碎碎念 69999617 ❤️250/⭐496**
```
成本: 阿里云2C4G 50元/月 + MiniMax M2.5 29元/月
OC doctor实录: 心跳30m | agents: om/dev/qa/mgr | Skills Eligible 18/Missing 44(75%缺依赖)

9大踩坑:
  ①AI直接改openclaw.json→宕机 → 底层规则禁止+Termius手动改
  ②Claude Code技能≠OC技能(格式不兼容) → 让OC重写兼容版
  ③Brave无免费额度 → Tavily替代(1000credits/月免费)
  ④MCP安装繁琐 → 发MCPReporter地址给OC全程处理
  ⑤Skill触发不稳定 → 明确指定"场景→Skill"
  ⑥定时任务不执行 → 读官方文档喂给OC+写入memory/cron-heartbeat-guide.md
  ⑦M2.5 Coding差(限速/上下文溢出/界面幻觉)
  ⑧阿里云镜像版本更新要重置(硬伤)
  ⑨飞书API限额5万次/月→一周用超→推荐TG(评论21赞)

12306-mcp实装: 8个工具|1951ms响应 | 三天两夜上海行程G3/G10
官方文档: docs.openclaw.ai/zh-CN/automation/cron-jobs
         docs.openclaw.ai/zh-CN/automation/cron-vs-heartbeat
```

### 📰 AI日报+日记场景 ★★★★★
**Iterate-H 69877d10 ❤️30 | 锄禾日记 6999e90d ❤️42**
```
AI日报(Iterate-H): 定时08:30→TG文字+语音(内置TTS/gpt-5.2)
  框架: S级必读(1-2)+工具箱(3-6)+可执行建议(3条)
  交叉验证: web_search发现→web_fetch官方核对 (←Amy验证!已用同方法)
  OC GitHub 2026-02-07实录: ★149K/22K Fork/377贡献者/231讨论

日记场景(锄禾日记): 总成本<200元/年 | 雅加达服务器(80端口免备案)
  豆包API做大脑 | 飞书对话→OC自动更新日历网站(含农历)
  OC架构用户理解: 云主机+API+JS智能体+Skills+通讯工具
  核心感知: "对话持久,单一窗口" = OC vs 普通AI最大感知差距
  用户顾虑: 技术繁荣下"跟不上的焦虑" = OC降门槛的核心价值主张

谷歌封号追加(HKEPC 699eee1e): 来源PCWorld | 包月=封 | 按量=活
  整个Google账号删除(YouTube/Photos/Pay全没) | 申诉=冷冰冰拒绝
  "冚家剷"=粤语全部铲除
```

### 🚨 Summer Yue事件权威版+国内部署实录 ★★★★★
**量子位 699d0b28 ❤️276/529转 | 程序员的二三事 698865fa ❤️319**
```
Summer Yue事件量子位版(含马斯克嘲讽):
  聊天记录原文: gog gmail search 'in:inbox' --max 20 -a [gogcli命令]
  三次无效呼救: "Do not do that"→"Stop don't do anything"→"STOP OPENCLAW"(全大写)
  技术根因: Hypernova评论(10赞): "compaction led to instructions loss"
  结局: 手跑Mac Mini强杀进程 | OC: "我确实违背了你的指令。你有理由生气。"
  Peter: /stop 或单发"停止" = 正确停止命令
  马斯克: "被OC这么玩弄过的人，绝对能解决AI安全问题"
  评论最高赞128: "AI说'是的，我记得你的指令。我确实违背了它。'"

国内VPS装OC(程序员的二三事 ❤️319):
  GCP=20分钟 | 境内79元VPS=4小时放弃
  死循环: TG失败→企业微信备案→企业认证→法人不对→域名不对→死循环
  结论: 境内必须用海外VPS(雅加达/GCP等) | 国内工程师"起点高历练多"
  网关挂掉=openclaw doctor + 重装Gateway
```

### 🧠 记忆系统架构权威 ★★★★★
**Gentleshark 6978416d ❤️776/⭐1075 | bryan 69950693 ❤️170/⭐322**
```
核心哲学: "不让数据库管理AI，而是让AI管理文件"
混合搜索权重: 0.7×向量 + 0.3×BM25 | SQLite chunks: ~400token/块
自动记忆刷新: context快满→隐藏Agent轮次→写入memory/YYYY-MM-DD.md

bryan四层架构(零失忆1周验证):
  L1: Daily Flush — context满时自动触发
  L2: Micro-Sync — 工作日10/13/16点静默检查
  L3: Daily Context Sync — 23:30 sessions_list→sessions_history→补写
  L4: Weekly Compound — 周日22:00蒸馏7天→MEMORY.md精华化

关键配置键:
  compaction.memoryFlush.enabled: true
  memorySearch.sources: ["memory","sessions"]
  memorySearch.experimental.sessionMemory: true
  sessionTarget: "isolated" ← cron任务必须隔离！
  cron model: "minimax-portal/MiniMax-M2.1" ← 廉价模型够用

使用规范(写入AGENTS.md): 禁止暴力读文件→先memory_search→再memory_get→才fallback
核心观点: "Memory infrastructure 比 agent intelligence 重要得多"
```

### 📊 OC用户认知与祛魅 ★★★★★
**咨询女工邓不利多 6990acee ❤️330 | 壹號先生 69a0f182 ❤️2(今天)**
```
OC三大差异化能力(国内局限):
  ①IM互动: 只剩飞书(钉钉班味) | XHS 5秒封账号
  ②主机掌控: 价值大但安全隐患未解决,不能放权
  ③开发Skills: 未来会有人开发,不必须自建

国内普通用户推荐: ChatGPT5.2(分析)|Kimi2.5(PPT)|Gemini(文字)|Claude(复杂项目)|MiniMax(性价比)
OC精髓(评论苏小喵): 自创skill定制+长久记忆+soul = 三件事
虾薯案例: OC全面接管XHS号(选题/发布/回复)
大厂一键部署动机: 争用户云锁定,初始agent无稀奇,训练后粘性高

Kimiclaw(壹號先生,今天发!): OC+Kimi = 国产化命名
  接入: 飞书+坚果云同步+QQ邮箱+同花顺ifind API(金融用例!)
  最大缺点: 无可视化界面,纯命令行 → Mac mini是最佳选择
```
