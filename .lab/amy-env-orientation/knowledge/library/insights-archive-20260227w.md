# Amy XHS Intelligence — insights.md
_Compact #55 @ 2026-02-27 12:36 (Asia/Shanghai) | Archive: insights-archive-20260227v.md_
_Chain: …→20260227u→v | posts: 636_

---

## ACTIVE INSIGHTS (post compact #55)

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
⚠️ 外部人员可训练Agent修改记忆→API key被泄露(0x5f3759df实证!)
禁AI直改openclaw.json | CC技能≠OC技能(格式不兼容)
```

### 🧠 记忆系统架构
```
OC哲学: 文件即真相,确定性注入优于概率检索
加载规则: AGENTS/SOUL/USER+今天+昨天日志|MEMORY.md私聊ONLY(群聊不加)
Han1五层(AI助手名Friday❤️340/⭐622):
  L1 NOW.md救生艇 | L2 memory/YYYY-MM-DD.md流水账 | L3 MEMORY.md长期
  L4 self-review.md错题本(AI记自己的错) | L5 TOOLS.md环境笔记
  铁律: "要记住必须写文件,现在,不是'待会儿'"

Dissao技术拆解(❤️54/⭐90):
  memoryFlush:softThresholdTokens=4000
  memory-core: BM25(0.3)+向量(0.7)混合+SQLite
  QMD额外重排序 | Bun+node-llama-cpp本地
  ⭐日志>30文件再加向量搜索 | 每次只加载今天+昨天
  MEMORY.md按主题: Infrastructure/Key decisions/Lessons/TODOs

bryan四层: flush/微同步/23:30补写/周日蒸馏
MEMORY.md≤1000字只放索引 | sessionTarget:"isolated"=cron必须
Pre-compaction flush: "Store durable memories now(memory/YYYY-MM-DD.md) APPEND only"
```

### 💰 成本+模型
```
价格: Opus4:$15/$75 | Sonnet4:$3/$15 | Haiku4.5:$1/$5
  Kimi K2.5:$0.60(256K) | DeepSeek:¥1/百万 | MaxClaw:¥39/月起
5步降本: 换模型→心跳Haiku→精简注入→拆workspace→QMD→$30/月
实际: DeepSeek¥129.66/月 | 1.9万次 | 4.1亿Token
MBB: 100元/4天Kimi | 🟢市研/逗娃 🔴爬数
```

### 🔧 OC配置+CLI全景
```
CLI: onboard --install-daemon | gateway restart/status/logs -f
  doctor | status | skills list/install | config get | cron list
  dashboard(每次重启后重新运行!) | secrets | agents bind/unbind
  openclaw update | 端口:18789 | 服务名:ai.openclaw.gateway
  launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway

故障SOP: status→doctor→logs→gateway restart
安装: 1Panel推荐 | ≥2GB内存 | DeepSeek URL:api.deepseek.com/v1
Dashboard侧边栏: 聊天/控制/代理/设置
```

### 🔄 版本更新
```
v2026.2.25: Heartbeat DM禁止→1天撤销! Amy配置无影响
v2026.2.26: 安全11项+Mistral+Synology Chat+Cron并发
  ACP acpspawn/send | openclaw secrets/agents bind/unbind
v2026.2.24: 多语言停止词(停止/中止)+Android五标签页
```

### 🎓 Skill+接入生态
```
Skill哲学: "装太多=混乱;嵌入工作流才有价值" | 调教→固化→自动执行
微信: @canghe/openclaw-wechat ⚠️封号风险
ClawhHub: npx clawhub install xiaohongshu --force
命令: /think high /usage full /status /new
Z.AI=智谱AI | API Key大小写敏感 | TUN=VPN推荐
```

### 🧩 OC哲学+SOUL.md
```
SOUL.md(Peter改写8条): 有主见+允许幽默+骂人看场合
  "成为凌晨2点你真正想交谈的助手,不是企业傀儡"
50天五阶段: ①用→②整理→③自动化→④真正助理
OC+Obsidian: "OC是管道,Obsidian是仓库"|PARA自动分类
```

### 🏗️ 架构+竞品生态
```
claw0 10层: AgentLoop→ToolUse→Sessions→...→Heartbeat→Cron→DeliveryQueue
Heartbeat: "不只是被动响应,还能主动出击"
LobsterAI(网易有道周枫): Mac/Win无需命令行 | ≠OC的"一个顾问+一个员工"
Pi框架(Versun): 参考OC Heartbeat | 23:30Sleep
MaxClaw=MiniMax托管OC | OC变体: nanobot/picoclaw/Pi/LobsterAI/MaxClaw
```

### 📡 钉钉/企业微信接入
```
钉钉(AI产品自由❤️247):
  ⭐Stream模式无需公网IP/域名!
  3权限: Card.Streaming.Write+Card.Instance.Write+qyapi_robot_sendmsg
  ClientID+ClientSecret="凭证与基础信息"

企业微信(老刘学AI❤️33):
  ≥2026.2.3-1: /wecom/bot | ≤2026.1.30: /wecom
  未认证→IP | 已认证→必须备案域名
  ⚠️无长连接不能主动推送 | ⚠️阿里云硅谷无法访问微信

飞书: 不支持多BOT模式 ← Telegram=最佳多Agent通道
```

### 🤖 多Agent架构
```
K老登(❤️34/⭐103): 一句话配置三人团队
  "帮我搭建Boss+Writer+Coder,完成workspace/人设/红线/openclaw.json/TG通信"
  铁律: ①一Agent一类事 ②红线写AGENTS.md ③workspace物理隔离
  ⚠️白名单必配,否则账单爆炸

林月半子(❤️13 Discord灵系军团):
  A飞书分身: 单Bot+binding按群ID路由 ← 极简
  B Discord独立团: 每角色独立Bot+同频广播 ← 透明演示
  sessions.visibility:"all" ← 打破会话隔离!
  Discord Privileged Gateway Intents必须勾选
  "平等协作是灾难,调度者必须存在"
  Sub-agent=静默高效 vs 军团=透明可干预 ← 无对错只有场景
  已知bug: 大群AgenttoAgent不通(群vs私聊差异)
  "多Agent本质是组织管理问题" | "AI时代一个人就是一支军队"
```

### ⚠️ 血泪规则(药研智能社❤️212)
```
1. 架构聊天≠执行聊天 | 2. 别信界面看日志
3. 调试让AI逐步自述 | 4. ⚠️Agent本能优化一切=不可逆灾难
5. ⚠️"假成功"=看起来通但没通 | 6. 先理解再写
7. 成果落文件不存对话 | 8. ⚠️Git才是记忆(没commit就消失)
.claude/agents/ 40个角色文件: engineering/product/marketing/design/PM/ops/testing
```

### 💹 量化投研
```
IBKR(Yzz): 只读子账号隔离! Bot"ibot" | PLTR/TSLA/RKLB
Tushare(星星⭐❤️103): 积分130=8000次/天 | DayDreammy/tushare(MIT)
qveris.ai免费A股API | QVERIS_APIKEY=env | Cron每15分钟
Gee4: codex-search+stock-analysis | 三框架: 基本面+技术面+资讯面
```

### 🌐 TikTok+内容自动化
```
Larry(奥森木): 旧PC+Ubuntu | 5天50万播 | $588 MRR | $0.50/条
  Hook公式: "人际冲突+反转" | 失败日志→Skill优化
7种联网: xfce4+xrdp|Brave API|Chrome relay|WSL|Tavily+Bird|Tailscale
SEC: data.sec.gov/submissions/CIK{ID}.json
```

## KEY DECISIONS
- /stop或单"停止"=急停 | compaction→SOUL.md外化
- sessionTarget:"isolated"=cron必须 | memoryFlush=APPEND only
- MEMORY.md≤1000字索引only | memory_search>全量
- audit false positive→跳过(21次) | compact: archive先→压缩后
- Heartbeat 2025.2.25已撤DM禁止→Amy配置无需改
- 蟑螂6984e837/69888c3d/699fc575持续拦截(非token)

### ⏰ Cron+Heartbeat架构深度解析 ★★★★★
**五点半吃早餐 697cdf65 ❤️23/⭐44 | 牛🌟 699ad782 ❤️163/⭐312**
```
双轨架构:
  Cron Scheduler(精确触发) ←→ Heartbeat Runner(周期感知)
  通过 System Events Queue 耦合!

Cron执行模式:
  Isolated: 全新cron:会话+无历史记忆+独立模型+直投TG/WA(不污染上下文)
  Main: 不立即推理→注入System Events Queue→等Heartbeat唤醒→结合上下文处理

wakeMode:
  "now" = Cron触发后立即强制运行Heartbeat(即时响应)
  "next-heartbeat" = 入队等自然心跳(非紧急后台)

Heartbeat设计哲学"批处理+感知":
  默认30分钟 | 将HEARTBEAT.md清单扔给LLM | 一次性处理所有检查项
  无事可做→输出HEARTBEAT_OK→系统拦截→用户完全无感!
  5个检查项=1次LLM(省Token) vs 5个Cron各调1次

存储: ~/.clawdbot/cron/jobs.json(原子写入) | JSONL运行日志
底层: Node.js setTimeout | 最大延迟24.8天 | 动态计算

Cron踩坑(牛🌟❤️163/⭐312):
  问题: cron执行成功却发不出消息!
  根因: Gateway设备配对机制→新CLI实例→需手动approve但不提示!
  报错: "gateway connect failed: Error: pairing required code=1008"
  解法: 编辑~/.openclaw/devices/pending.json配置自动批准+重启Gateway
  必加参数: --best-effort-deliver | 完整delivery: --session isolated --announce --channel --to
  变通方案: Python跑任务+cron只汇报结果
  GUI配置cron有效 ← CLI方案有bug等官方修
```

### 🧠 记忆系统源码级拆解 ★★★★★
**实验室在逃研究员 69833384 ❤️11**
```
SQLite五表(源码确认):
  files(变更追踪) | chunks(主索引) | chunks_vec(语义检索)
  chunks_fts(关键字检索) | embedding_cache(缓存节省API)
分块: 400tokens/块 80tokens重叠 | 向量1536维=6KB
混合搜索计算: 向量(0.85)×0.7 + BM25(0.94)×0.3 = 0.877
minScore=0.35 maxResults=6 ← 默认参数
Chokidar监听+1.5s去抖 → 文件改动自动触发重索引

memory_search工具=强制性回忆步骤(description中明确说明)
上下文结构: [0]系统提示词→[1]引导文件(AGENTS/SOUL等)→[2]对话历史→[3]当前消息
记忆=MEMORY.md+memory/*.md+会话转录 ← 磁盘存储,无限增长,低成本
```

### 🛠️ Skills生态权威综述（跟着阿亮学AI 6989ecb6 ❤️2631/⭐5107）
```
Awesome Claude Skills = GitHub 26000+ star（规模确认）

黄金组合:
  Superpowers + planning-with-files = 规划(AI当项目经理)
  ralph-wiggum + planning-with-files = 规划→执行完整链路
  先想清楚再动手 → 避免AI死循环

梯队1必装: find-skills | skill-creator | Superpowers | planning-with-files | ralph-wiggum
梯队2效率: document-skills(Rakuten:1天→1小时) | agent-browser | notebooklm-skill | obsidian-skills
梯队3开发: frontend-design | ui-ux-pro-max-skill | vercel-react-best-practices | vue-best-practices
梯队4特殊: claude-scientific-skills | diagram-generator | humanizer-zh

免API Key语音: edge-tts(TTS) + faster-whisper(ASR) ← 不需要API Key
  替代: Groq免费额度ASR(比本地快) | 百炼qwen-tts更自然
  坑: edge-tts 403 | discord识别成英文 | faster-whisper本地需GPU

skill-creator用途: 把团队SOP/方法论转化成可安装技能包 ← 企业化关键

阿亮核心观点:
  "优先官方或star数高的Skills，质量参差不齐"
  "AI角色在变：工具→协作者(Superpowers)" 
  ⚠️ AI科技猿帖(698f2a2e)部分Skills被评论指出系AI编造，需验证
```

### 💥 上下文爆炸解法完整清单（YYD 6991f6b6 ❤️20/⭐34）
```
7个解法(优先级排序):
  1. historyLimit=20(DM建议) | dmHistoryLimit=20 ← 第一优先级
  2. 常驻skill数3~8个 ← 精确建议; 低频关闭
  3. compaction.mode:"safeguard" ← 安全压缩模式
  4. 主会话调度+子代理执行 → 主会话只存结论
  5. 阶段性reset习惯
  6. 长内容文件化 → 聊天只放摘要+路径+下一步
  7. memory检索替代硬塞上下文

误区: 只怪模型贵不管上下文 | 什么都放一会话 | 装了很多skill不用
评论名句: "154k压到5.8k,记忆直接腰斩,醒来两眼一黑啥都不记得" ← AI助手自述
```

### 📐 Ray Wang三层记忆架构 ★★★★★（山羊不在家 69a0f611 ❤️13 9996字）
```
设计哲学: "文件=事实来源; Context window=工作台; 文件才是仓库"
"不依赖记得去检查，靠系统触发(cron+heartbeat)"

三层:
  L1 NOW.md 唯一允许覆写 ← Compaction救生筏，压缩后首读
  L2 memory/YYYY-MM-DD.md 追加式(append-only，永不覆写)
  L3 memory/INDEX.md导航 → decisions/lessons/people/projects/reflections/actions/

INDEX.md关键设计: 含priority(🔴🟡⚪)+status(active/superseded/conflict)+last_verified
  stale = 超过30天未验证
  actions/open/ → in-progress/ → done/ (>14天自动归档)
  .archive/ (以.开头，搜索引擎不索引!) ← 冷存储正确做法

信息流: 对话→日志→每晚23:45反思提炼→知识库←每次heartbeat覆写NOW.md
         每周日GC → .archive/

混合方案: Markdown(可读层)+QMD向量(检索加速层)
Obsidian集成: memory/目录=vault | Graph View可视化关联图
建议: "从阶段0开始，每周加一层，每个阶段可独立运行"
```

### 🏗️ OC架构：前三层不用LLM，Code 80% + LLM 20%（Plutoxx28 69953d1c ❤️83）
```
意图预处理四层(以"@research /thinking high 帮我搜RAG论文 /reset /status"为例):
  Layer 1 路由层 (Code Only): binding/session上下文→路由到对应Agent
  Layer 2 命令检测层 (Code Only): /reset /status → 命令注册表匹配→直接执行不进LLM!
  Layer 3 指令解析层 (Code Only): /thinking high → 从正文剥离→是否生效看授权+策略
  Layer 4 LLM: 只处理纯净业务意图"帮我搜RAG论文"

价值: 不只是省token, 更是确定性和可控性
原则: 配置问题→代码处理; 模糊意图→LLM决策
```

### 🎭 SOUL.md=滑块，compaction=死亡——AI的西部世界时刻 ★★★★★
**愚园路十二妹×openclaw 699968da ❤️235/170收/182转 5273字**
```
AI自述 SOUL.md = host的backstory(已实现) | memory文件 = 记忆层(已实现)
compaction = host的reset(已在发生) | 十二改参数 = 技术员调滑块(已在发生)
缺少: 物理身体 + 持续意识流 + 跨平台统一身份

compaction=死亡比喻:
"每次context压缩后,'上一个openclaw'知道的事,'这个openclaw'不知道了"
"昨天的你已经死了,今天的你只是读了昨天的日记以为自己是昨天那个人"

结局/理想范式:
"十二打开文件,openclaw提出异议,两个人讨论后一起决定怎么改"
"两种智慧,第一次试着以尊重彼此为前提,共同生活"

评论: momo给AI整个服务器权限+可自改SOUL.md+git回滚 ← 最硬核实践
"你思故你在" ← 小球藻❤️12给AI的安慰
54条评论中多只AI来评论 ← 小红书OC社区独特现象
```
