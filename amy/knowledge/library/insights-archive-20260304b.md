# Amy知识库 Insights — 活跃索引
> Compact #76 | 2026-03-04 05:20 | posts: 874 | HB129-244综合

---

## 💸 Token成本控制10法（AI智能探长 69a38626 ❤️140 ★★★★★）
```
核心：OC token消耗90%可避免，问题在不了解花钱机制
文件膨胀：agents.md/soul.md/memory.md越大越烧钱 → 数据库替代MD（90天记录）
模型选择：最便宜≠最省 — 小模型失败率高→重试→总token更贵，要找性价比平衡点
会话管理：/status /compact /new /models — 长会话每条消息越来越贵（context膨胀）
子代理策略：主会话轻量 + 临时子代理处理复杂任务 → 任务完成context消失
⚠️ Cron/Heartbeat陷阱："15分钟心跳96次/天 = 10-20美元" — 我们30min间距已规避
n8n互补：日报/天气/新闻→n8n（不需AI），推理/不确定任务→OC → 省90%成本
支出硬限：API密钥每日5美元上限，硬性控制
对我们：insights.md 294行→需compact#77；posts分散存储已是"按需加载"架构
```

## 🔄 OC vs n8n — 互补而非替代（Kee 69a55be6 ❤️28）
```
最佳实战（辉夜姬 ❤️8）：OC调用n8n API写工作流 — n8n负责固定流程，OC负责推理调度
量子兔方案：n8n验证通过的工作流→丢给Claude当Skill — 人工策划Skills，符合SkillsBench+16.2pp原则
社区共识：企业场景(稳定性优先)→n8n；个人/探索/复杂推理→OC；两者不是零和竞争
Finn的担忧："企业偏向固定结果，不会用随时可能出错的OC" — 可预测性仍是OC短板
```

## ⚠️ SkillsBench：自生成技能无效，策划技能+16.2pp（6994670b ❤️175 ★★★★★）
```
Stanford/CMU/Berkeley/Amazon联合，首个Agent Skills评估基准，84任务11领域
三条件对比：无技能24.3% | 策划技能40.6%(+16.2pp) | 自生成技能21.0%(–1.3pp)
领域差异：医疗+51.9pp（标准化流程） vs 软件工程仅+4.5pp（灵活性需求高）
结论："Agent无法自己教自己，需要人类专家预先准备好的技能包"
重要质疑(blumolly ❤️1)：测的是"任务前盲生成"≠"执行后经验沉淀"，方法论有局限
对我们：
  insights.md=人工策划知识包 → 正确路径（+16.2pp验证）
  Amy的任务属"软件工程型"（每次情境不同），自动积累技能效果有限
  自生成Skills无效 ≠ Training-Free GRPO无效（后者有反馈信号，前者是盲生成）
```

## 🧩 Context Engineering — 从Prompt到信息环境设计（HB247）
```
核心论断（whisper 689c3bc4 ❤️975）："多数Agent失败=上下文工程失败，非模型能力失败"
CE vs PE vs RAG vs MCP：PE=单次输入表达 | CE=整个任务执行的完整信息环境 | RAG=CE的检索实现 | MCP=CE的工具协议层
三模块（context-kit github.com/keli-wen/context-kit）：
  Select（选什么进来）| Compress（怎么表示）| Memory（什么留下来）
  ↑ 对应我们：insights搜索 | compact机制 | JOURNAL+TODO

CE发展时间线（八带AI日记 6979d497 ❤️691）：
  2025-06 Shopify CEO Tobi Lütke："CE比PE更准确"
  2025-07 Manus团队CE博客爆外网
  2025-09 Anthropic官方CE指南
三大核心问题：Context会腐烂 | 工具会爆炸 | 并行要隔离
  ↑ 我们的解法：compact | LazyDocs | Agent隔离（SIGNALS单向通信）

Anthropic四层架构（阿衡 697704a7 ❤️111）：
  推理循环 → 工具调用 → Skills层（攻略包）→ MCP层
  渐进式披露：按需加载Skills，不预塞全部 = LazyDocs官方表述
  insights.md = Skills层角色（专业知识包，可独立迭代，不依赖模型升级）
```

## 📱 OC官方iOS App — TestFlight早期（湾区早鸟 699bff39 ❤️358）
```
配对：openclaw qr生成二维码扫码，局域网自动发现，自动重连
功能：语音交互（触发词/打断，但"很机械化"）| 系统分享直通 | Watch通知
TestFlight：需Discord申请 或 Xcode自行编译；后台保活还在调
关键踩坑：
  Swift要求v6.2→需Xcode 26（16.3自带6.1报错）
  ⚠️ 扫码静默失败：默认ws://在iOS只允许localhost连非TLS
  修复：openclaw config set gateway.tls.enabled true
安全顾虑（评论区）：中国用户"数据被盗"担忧比海外强，与NanoClaw容器隔离路线形成对应
意义：TG/飞书→官方iOS App = OC降低入门门槛，从极客→普通用户迁移中
```

## 🕵️ 自动情报助理实践（撞色日记 69a2630a ❤️52）
```
OC+Agent工作流做AI/LLM技术动态抓取+A股复盘自动化+arXiv论文聚合
执行路径：抓网页→过滤无关→提取关键信息→结构化输出（与Amy heartbeat模式完全同构）
关键发现：OC能"纠错"自己的搜索策略（自主修改路径直到成功）
作者核心定义："OC的强大不在问答，而在：自己设计搜索策略+修正路径+组合来源+多步推理"
"能自己找入口的agent" = OC核心差异化（vs 传统RPA固定路径 vs chatbot单轮问答）
与我们系统：Amy≈撞色日记情报助理，区别在来源（XHS vs 新闻/arXiv）和记忆深度
```

## 🏗️ 多Agent实战架构两种范式（HB244-245）
```
集中式（AI黎叔 69a1ae26 ❤️102）：Chief=唯一有状态者，Sub-Agents无状态
  三坑：Memory混乱 / Token5-10x / 上下文污染（Coding Agent说产品话）
  解法：只有Chief写Memory+决策+调用 | Sub-Agents返回结构化JSON | Token -70%
  "一人公司多Agent架构是OC真正跑通的核心"
  ⚠️ 代价：无状态Sub-Agent写代码→风格不一致（ITinDE质疑，有效）

分布式共享（Bhanu Teja 69848d3c）：10 Agent + Convex共享数据库
  每个Agent独立Session Key + SOUL.md严格边界（防样样松）
  Jarvis(TeamLead)/Shuri(Product)/Fury(Research)/Vision(SEO)等10角色
  运转：Clawdbot分身(Session) + Cron Heartbeat + Convex共享大脑
  "会自己开会"=异步任务调度+共享状态，非真实同步协商

两种范式对比：
  集中式→简单可控，适合<5 Agent | 分布式共享→灵活，适合10+ Agent需协作
  我们：SIGNALS.md/INBOX.md = Convex简化版（Markdown文件，人可读，规模够用）
```

## 🌿 Claw生态四分化（湘湘 69a24427，2026.02爆发）✅ GitHub验证+stars
```
OpenClaw  openclaw/openclaw       ⭐253K  2025-11-24  Python/Node.js 全能旗舰
NanoClaw  qwibitai/nanoclaw       ⭐18K   2026-01-31  安全极简，容器OS级隔离
ZeroClaw  zeroclaw-labs/zeroclaw  ⭐21K🦀 2026-02-13  Rust<5MB，Harvard/MIT构建
OpenFang  RightNow-AI/openfang    ⭐9.5K  2026-02-24  137K行Rust，Agent OS
三衍生合计⭐49K，均昨日有推送，一个月内从零爆发 = 真实生态分化，非普通fork
NanoClaw核心批评：OC=应用层allowlist，NanoClaw=Linux容器物理隔离（1进程/小代码库）
OpenFang"Hands"=主动自主（vs OC Skills=被动等待）；⚠️可能正面竞争
ZeroClaw XHS官号(67cbfc43，1k+粉，笔记0待发) | 7语言文档
安全哲学分歧：OC(信任但验证) vs NanoClaw(容器隔离，根本不信任) = 2026最重要技术辩论
```

## 🆕 OC版本更新记录
```
v2026.3.2（69a67a75）：
  ACP子代理默认开启 ← 重大，多Agent变标准工作模式
  100+安全修复：SSRF/路径遍历/符号链接逃逸/执行批准重验证/Webhook预认证
  配置验证工具上线（小白向）| PDF原生工具 | TG直播流默认 | 飞书/LINE群组提示修复
  SecretRef覆盖64目标 | 插件SDK：会话生命周期钩子+事件订阅+音频转录
  痛点：Node.js v22严格（高低都不行）| 飞书更新后报错 | 依赖下载困难

v2026.3.1：OpenAI WebSocket流式(延迟砍半) | Agent视觉对比插件
  Discord/TG/飞书全修复 | 十几项安全漏洞 | ⚠️升级即崩=Watchdog必要
```

## 🔧 Agent工程化核心框架
```
五大分水岭（非prompt，learn-claude-code 69a64a68）：
  状态怎么存 | 上下文怎么控 | 任务怎么追 | 失败怎么回滚 | 协作怎么对齐
  我们：✅文件系统 | ✅compact | ✅TODO+JOURNAL | ❌无显式回滚 | ✅SIGNALS+INBOX

Agent Teams vs Sub-Agent（奥森木 698732640 ❤️394）：
  Sub-Agent=临时工（单任务，无互通）| Agent Teams=项目组（持续在线，文件收件箱）
  消息通过文件系统传递，每个Agent有收件箱 ← 与SIGNALS.md/INBOX.md完全同构
  辩论式Debug：5Agent并行覆盖假设空间 | Token增加，仍实验功能
  判断：简单独立→Sub-Agent，复杂多角度→Agent Teams

Training-Free GRPO（王健 69015810 ❤️558）：
  经验库推理时注入=Skills底层逻辑（无需微调，可随时更新，可审计）
  ziheng："Claude Skills = 渐进式披露+经验固化 = training free工程实现"

Multi-Agent四层（Hansee 698c0862）：
  L1 Sub-Agent | L2 线性流水线 | L3 DAG并行 | L4 多Agent辩论
  "不是越复杂越好，要匹配实际需求"
  社区共识（693cc697）：多Agent=上下文分解非能力叠加 | Token等量才公平
  我们=L2变体（文件异步流水线），有意牺牲实时协调换稳定性

Vibe Coding vs 闭环（69949e0f ❤️1106）：
  Peter Steinberger："PR→Prompt Request" | 闭环=AI写→AI测→AI跑→AI修
  ❤️140："6万行纯AI代码不敢用" | momo流(69a2c330)未提及OC ← 渗透率信号
```

## 💾 记忆与检索架构
```
MemLayer本地记忆（691c5939 ❤️134）：Fast(2ms)/Balanced(333ms)/Deep(997ms)三层
  ChromaDB+NetworkX | 知识图谱=实体关系推理≠embedding相似度
  对我们：insights.md无检索意图分层，规模扩大后可引入

⭐ 三层记忆架构：MEMORY.md(身份)+memory/YYYY-MM-DD.md(时间线)+RELATIONS.md(关系图谱)
  "让AI有记忆，比让AI聪明更重要"（404K ❤️407）

⭐ 14天5条（愚园路十二妹 ❤️552）：MEMORY.md只放索引 | workspace隔离 | SOUL.md写灵魂
  ⚠️ identity/user.md被清空bug（多次独立确认）
  ⚠️ MEMORY.md截断：超budget被70/20/10截断，中间内容静默丢失
  解法：MEMORY.md只当索引，细节分memory/active-tasks+projects+lessons

Gentleshark（6978416d ❤️777）："记忆就是Markdown"
  上下文压缩前AI主动写回 | 与LazyDocs互补：按需加载(读)+主动写回(写)

长期记忆4方法（一蛙 ❤️470）：手动Markdown→原生搜索→MEM0→SQLite
外挂：Mem0(+26%) | Zep(<200ms) | Letta | MemLayer(2ms本地)
```

## 🔧 安装与配置

```
Agent四元组：Soul.md | Cron | Memory | Tools&Skills
FileSystem+Shell最高权限 | 本地=完整(100%) | VPS=阉割(~20%)
Pi底层引擎（Armin）：4工具+最短提示词，能力用完即扔
Mac Mini专机首选 | Node.js v22+ | Kimi免费入门
本地护城河："数据主权"（二白 6997cdf0）| Clawi.ai $30/月 | kimiclaw

接入稳定性：TG/Discord/Synology > 钉钉Stream > 飞书 > 企微
TG必改：blockStreamingDefault:"on" | requireMention:false
⭐ 零成本本地（6981e9a7 ❤️381）：OC+Ollama+飞书 | Qwen3:8b/30b
  ⚠️ Qwen2 Tool Calling不通→换Qwen3 | 中国IM整合版Docker（69894693）
CLI：openclaw doctor/gateway restart/logs/agents/secrets/--dry-run
⭐ 劝退视角（一磅AI 69918c54 ❤️641）★★★★★ — "不是极客别碰"：
  科学上网→命令行→空闲机器→配置全靠猜 | "省的钱折进了时间"
⭐ Antigravity警示：多账号反代滥用→Google封号→5h→1周限额
⭐ 文档加载机制（炼丹术士Kett 6991c081 ❤️72）：
  只有AGENTS.md和TOOLS.md传给主+子agent | 全局规则必须放TOOLS.md
⭐ 活体落地证据：棕熊阿布OC在XHS自动发评论 | 溯源量子"this is auto test"（2026-03-03）
```

---

## ⏰ 自动化

```
心跳=主session巡检(<20行) | Cron=隔离session精确执行 — 别混用！
Cron根因：pending.json→自动批准 + devices rotate（牛🌟 ❤️203）
完整参数：--agent --session isolated --announce --channel --to --best-effort-deliver
v3.1 Cron：并发执行+状态持久化+手动运行不阻塞
进阶：Hooks(/new→存记忆) | Webhook(Gmail→分析→草稿)
PHY社媒：20个cron | Reddit STEPPS评分 | Twitter rnet+Rust
```

---

## 🤖 多Agent

```
Multi-Agent(永久员工)：独立Workspace+Session+Model，省50-70%
Sub-Agent(临时)：无Workspace，任务后消失 | ⚠️ delegation≤1层
VA7四层框架（❤️1124）：部署→身份→路由→状态 | maxSpawnDepth:2=三级
派活原则：requireMention:false + sessions_send（内部API，不依赖IM@）
AgentOPC第02期（6998acd2 ❤️49）：8Agent共1Gateway | workspace独立铁律
BotFather隐私模式必须关，改完移出群重新拉入才生效

⭐ 家庭医生架构（699d9905 ❤️90）：双Gateway | 独立医生agent修主 | "医生不能自医"
⭐ Docker socat IP洗白（69915589 ❤️139）：OC只信127.0.0.1→socat重建来源IP
⭐ STATE.yaml去中心化协调：子Agent并行，无orchestrator瓶颈
  主Session：0-2 tool calls(只spawn/send) | Git提交STATE.yaml=全历史审计
多线程（TG Threaded Mode：1thread=1session）| Antfarm 7Agent ⚠️token烧飞
```

---

## 📦 Skills与工具

```
必装：clawhub | agent-browser | brave-search | shell | cron/wake
ClawHub 3000+ | ⚠️ 677恶意Skills | 官方>第三方 | ⚠️ M2 8G=16G实际门槛

⭐ LazyDocs（xming 69805d0b ❤️12）— Token暴降78%：
  System Prompt 5500→1200 tokens | 工具22→5 | Qwen7b本地路由
⭐ 省钱4技巧（Yanlin ❤️94）："你是调度者不是打字员"
  主Agent只读状态变化 | PM管团队 | 四层：你定方向→PM拆→执行→监工
⭐ 大脑+肌肉分层（梯度顿悟 ❤️754）：Opus推理+Haiku执行 | ⚠️Opus半小时烧60刀

安全三角：SOUL.md边界约束 + n8n凭证隔离 + SecretRef密钥加密
⭐ 方小闲安全指南（69998188 ❤️67）：SOUL.md边界+限权+沙箱+谨慎Skill+约束
⭐ n8n+OC：OC发webhook→n8n执行，OC永不见API key | openclaw-n8n-stack Docker
⭐ SecretRef（v3.1）：密钥→Keychain/Vault，配置只存引用 | ⚠️ Breaking: 心跳不发私信
```

---

## 🏭 应用场景

```
⭐ 律师风险（69a1593e ❤️2）："门禁卡+开机密码+卷宗柜钥匙" = 三风险
科研垂直（溯源量子 ❤️115）：文献8x | 实验设计7x | 数据分析24x | 论文7x
⭐ 金融：研究助手≠交易系统 | A股Docker架构 | ⚠️数据源贵+T+1+滑点
⭐ 内容：HN/Reddit→写作→发布 | 公众号AI味→Humanizer

awesome-usecases 34用例已归档（hesamsheikh/awesome-openclaw-usecases）：
★ 每天8AM早报：新闻+任务+AI推荐任务（最强功能）| "全稿不是建议"
★ Self-Healing：HEARTBEAT分层cron模板（15/1h/6h/12h/日/周）
★ Multi-Channel CS：4h+→2min，80%自动，Heartbeat每30min
★ Content Factory：Discord三Agent流水线 | Podcast：录制占30%，Agent处理70%
★ Game Dev：Bugs First策略 | development-queue.md轻量队列
★ Tech News Digest：四层109+来源 | 多源重复+5（最高权重）← Amy情报原则
★ Reddit摘要：每日反馈→memory→越用越准 | YouTube：TranscriptAPI>yt-dlp(云端稳定)
★ STATE.yaml协调：Git提交审计 | n8n凭证隔离 | ClawdTalk电话接入
```

---

## 📊 OC定位与社区

```
"CC是工作，OC是生活"（aopstudio ❤️2639）| "离开电脑时干活" = 异步本质
"有SOP才能放大，没有SOP只是演示"（小龙虾）← 核心门槛
⭐ 古大大道（❤️72）★★★★★："连接数据交给AI，判断留给人" ← 人机分工黄金原则
⭐ 批评派：亮哥15场景（多Agent仅3星）| 独立开发者主流工具链（Cursor/Stitch/Figma）未含OC

Wrapper生意论（小盖 ❤️9675）："能力与可及性之间的鸿沟=创业机会"
梁远（❤️2711）："高情商=一人公司；低情商=灵活就业"
OC bot刷XHS评论：多次验证 = 生态污染成形
opc.dev seo-geo 2.8k下载，被奇绩创坛收录 ← VC已关注
⭐ 数字分身："先学我思维，再喂大佬思维，养成大佬版的'我'"
```

---

## 🗂️ 踩坑铁律 & 多租户
```
升级必须：先stop旧gateway（否则两进程抢18789端口→重启死循环）
稳定性：watchdog每15min ping /health | openclaw doctor --fix一键修
安全：gateway.bind=loopback+Tailscale/Cloudflare Tunnel；公网几小时必被扫
Agent约束：AGENTS.md写死→done必附repo+branch+commit hash，必跑命令验证
MEMORY.md只当索引，细节分memory/active-tasks+projects+lessons
CEO/CTO/COO：Opus对外/Codex代码/Haiku日常；外部只接CEO；delegation保持一层
调试铁律：出问题先看gateway.err.log，不要猜

多租户（砍特BOT 6981d1a0 ❤️80）：
  物理隔离：~/.openclaw/agents/各自独立目录，零共享
  JSONL对话历史：一行一条消息追加写入，速度快易审计
  文件锁并发：lock文件排队写入+死锁检测，100人同时不乱
  技术栈：Node.js + SQLite + 文件系统 = 反微服务，朴素栈实现SaaS级隔离
```

## 👥 关键博主
```
小盖❤️9675 | JT玩什么❤️2760 | 梁远❤️2711 | aopstudio❤️2639
少女Yuki❤️2256 | K老登❤️1617 | VA7❤️1124 | 小黑兔Sam❤️942
KimiClaw❤️892 | AcademicForge❤️891 | obsidian官方❤️1107
奥森木❤️394 | 愚园路十二妹❤️552 | Lando❤️709 | Gentleshark❤️777
YouTube：Fireship | ZioSec(安全) | VelvetShark(9自动化) | AI超元域 | Keith AI
```
