# Amy知识库 Insights — 活跃索引
> Compact #73 | 2026-03-03 04:29 | posts: 804+ | archives: ...20260303a.md
> HB129-171综合：安装/Cron/多Agent/架构/记忆/成本/垂直行业/生态/v3.1

---

## 🔧 安装与配置

```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆" | 本地=完整版(100%) | VPS=阉割版(~20%)
Agent四元组：Soul.md | Cron | Memory | Tools&Skills
Pi底层引擎（Armin背书）：4工具+最短提示词，agent自造能力用完即扔

Mac Mini专机首选 | Node.js v22+ | Kimi免费入门
本地 vs 云端："数据主权" = 本地部署核心护城河（二白 6997cdf0）
  Clawi.ai $30/月（托管OC）| kimiclaw（Kimi托管）= 云端托管赛道已成形
接入：✅TG Forum Topics | ✅Discord | ✅Synology Chat(v3.1增强)
      ⚠️ 飞书（v3.1修复，但长连接坑/轮询限额仍存）
      ✅ 钉钉 Stream模式（无明显额度限制，比飞书稳）
      ⚠️ 企微（备案+24h依赖）
      📦 中国IM整合版Docker（飞书/钉钉/企微/QQ一键，69894693）
安装门槛：10h（律师）| 500元上门服务已出现（上海/杭州）

⭐ 零成本本地方案（6981e9a7 ❤️381）：OC + Ollama + 飞书
  ⚠️ Qwen2 Tool Calling不通→换Qwen3立刻好 | Qwen3:8b轻量/30b推理
  "MiniMax指导安装OC比Gemini更通畅" | 下载模型：直连比梯子快（手机热点）

TG必改（Lando ❤️709）：blockStreamingDefault:"on" | requireMention:false
CLI：openclaw doctor/gateway restart/logs/agents/secrets/--dry-run
```

---

## ⏰ 自动化

```
心跳=主session巡检(<20行) | Cron=隔离session精确执行 — 别混用！
Cron根因：pending.json→配置自动批准 + devices rotate（牛🌟 ❤️203）
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
多租户7机制（砍特BOT ❤️77）：IdentityLinks+SessionKey+6级路由+文件锁+双层记忆
TG群聊：sessions_send(Agent收到)+message(人类可见)双通道

⭐ 主→子Agent派活痛点（跨平台共性）：
  TG（6998acd2）：主Agent @子Bot，子Bot不回应
  飞书（699ac410）：Bot @Bot无法实现，群里不@读不到消息
  根因：@机制是为人类设计的，Agent间派活应用sessions_send（内部API），不应依赖IM@
  解法：requireMention:false（飞书/TG） + sessions_send做内部任务传递

Docker socat IP洗白（69915589 ❤️139）：
  根因：OC只信127.0.0.1 | Docker NAT→172.x→被判远程→拒绝配对
  ✅破解：socat把172.x通过loopback重建成127.0.0.1
  ⭐ 猫叔更轻量：1Gateway + NWorkspace（无socat）

⭐ 多线程工作（698ae033 Dayu ❤️202）：
  最简：Bot Setting → Threaded Mode（一thread=一session）
  定时队列：sessions_spawn + cron组合 = 定时任务队列
  ⚠️ 两agent自动聊天 = 高频需求，目前无成熟方案

Antfarm（698a77f3 ❤️320）：7Agent流水线 | ⚠️token烧飞 | Elvis：日50commits | 月<$200
⭐ "家庭医生"架构（699d9905 ❤️90）：双Gateway | 独立医生agent修主 | "医生不能自医"
⭐ 三人团队（699169250 愚园路十二妹 ❤️39）：主管(调度)+分析+运营 | 职责模糊→AI打架
```

---

## 🧠 记忆系统

```
三层遗忘：Compaction遗忘→约束外化 | session切换→MEMORY.md只当目录
"何时写入"和"粒度"比存储技术更难（JJ ❤️7）| K老登❤️1617=最大痛点确认

⭐ 14天5条（愚园路十二妹 698dc122 ❤️525）— 与Amy架构高度一致：
  1. MEMORY.md只放索引 | 2. 多agent隔离workspace ⚠️ skill权限bug无官方解
  3. 记忆自动化cron | 4. Markdown GTD | 5. SOUL.md写出灵魂
  第6条：双渠道容灾 | ⚠️ identity/user.md被清空bug（两次独立确认）

⭐ 记忆哲学（Gentleshark 6978416d ❤️777）：
  核心：记忆就是Markdown（MEMORY.md + memory/YYYY-MM-DD.md），无数据库无schema
  机制：上下文压缩前AI主动写回 → 防"对话长了就失忆"
  搜索：底层向量检索，文件是表层
  哲学：不让数据库管理AI，而是让AI管理文件
  与LazyDocs互补：按需加载(读) + 主动写回(写) = 完整文件管理哲学
  ⭐ 西红柿（❤️12）："无技术先进，切中痛点——接入所有沟通渠道+个人信息"
     ← OC核心竞争力最精准定位：开放性 > 技术先进性

⭐ 文档加载机制（炼丹术士Kett 6991c081 ❤️72）★★★★★：
  只有AGENTS.md和TOOLS.md同时传给主+子agent | 其他仅主会话可见
  → 全局规则必须放TOOLS.md | subagent可单独有自己的SOUL（telos）
  ⚠️ v2.15后行为有变 | 与LazyDocs结合：TOOLS.md = System Prompt精简的核心规则位置

外挂5方案：Mem0(+26%准确率) | Zep(<200ms) | Letta(AI自管理)
           OpenViking+qmd | EverMemOS(OS级抽象)
```

---

## 📦 Skills

```
必装：skill-security-auditor | tavily-search | xiaohongshu | gh-issues | weather
神级：agent-browser | /nim(>95%省钱) | social-content
ClawHub 3000+ | ⚠️ 677恶意Skills供应链攻击 | 官方>第三方（5次确认）
⚠️ 硬件提示（阿强）：M2 8G开两skill即吃力 → 16G可能是多skill运行实际门槛

⭐ MIT博士师姐4梯队安装路径（698dba17 ❤️79）— 最结构化的入门指南：
  基础命令：npm i -g clawhub | clawhub search/install/update --all
  地基5个（按序）：ClawHub→Agent Browser→Brave Search→Shell→Cron/Wake
  "断Agent Browser=断手" | "先5地基+1入口跑顺，两三天后再加"
  进阶：Nodes(联动手机) | Skill Creator | Home Assistant | Twitter社媒监控
  保命：权限即底线，只装高下载量Skill，敏感操作开"确认模式"

⭐ Skills ≠ Slash Commands（6975cf0b ❤️1007）：
  Skills = Claude自动判断触发 | 本质：SKILL.md，写领域知识和操作流程

50 Skills 6类（奥森木 ❤️388）：Foundation/Creative/Programming/Design/Marketing/Office
  Foundation: find-skills|skill-creator|mcp-builder|subagent

⭐ obsidian-skills（官方，696b4ad3 ❤️1107）：obsidian-markdown/.base数据库/json-canvas
⭐ OC×Obsidian（奥森木 69942327 ❤️138）："OC是管道，Obsidian是仓库"
  6场景：书签摘要/语义查知识库/会议action/深度研究/智能早报/万物收集箱
  ⚠️ 幻觉可能删本地文件 | CC Max TOS封号风险
⭐ AcademicForge（❤️891）：git submodules | "Minecraft Forge模式"=领域专用整合包
```

---

## 💰 成本与模型

```
三层路由省60-95% | Claude Code Max $200/月 vs API $3000+/月(15x)
⚠️ OAuth调大模型 = TOS违规→封号（Franklin）
Kimi K2.5 ~$0.60/M（Opus的1/25）
排序：Opus 4.6 > GPT 5.3 Codex > Sonnet 4.5 ≈ Gemini 3 Pro > 国产
OC+Codex 5.2免费 = 当前个人最优成本（Rex Su ❤️38）
⚠️ Kiro Gateway（❤️716）："国内中转站批发层" | 封号快 | 收集对话记录

⭐ LazyDocs架构魔改（xming 69805d0b ❤️12）— Token暴降60%实战：
  根因：OC默认全量注入System文档+20+工具 → 每轮token高
  三层解法：
  ① LLM Router：Qwen 7b本地路由，Skill从多→1-2个，工具从22→5个
  ② LazyDocs：System Prompt只保留核心规则+"索引引用"
     5500 tokens → 1200 tokens（-78%！），Agent按需read文件
  ③ 本地vLLM路由：小模型处理选择题（路由分发）效果好，主模型专注推理
  效果：每轮节省5000+ tokens，无明显降智
  ⚠️ 评论区：长期运行需同时做context压缩，否则欠费
  ← 与whisper缓存方向互补：固定前缀→最大cache命中 + LazyDocs→减少加载
```

---

## 🏭 应用场景

### 垂直行业
```
法律：5场景 | 安装10h | ⚠️企微备案+24h依赖
⭐ 律师视角风险分析（69a1593e 律师｜南昌 ❤️2）— 扎实的"反方"论证：
  类比："给了陌生人：门禁卡+开机密码+卷宗柜钥匙"
  三风险：①AI自主行为不可控（指令可能被忽略）②客户文件完全暴露③灾难时无力回天
  "职业责任保险赔不了AI自作主张"→ 结论：观察对象非办案工具
  ← 核心障碍：OC自主性与律师保密/勤勉义务之间的结构性张力
  进入法律垂直需专门权限隔离方案，不只是"给律师用的OC"
建筑：设计变更15分钟 | ⚠️无法操作CAD

⭐ 学术（新兴垂直）：
  读paper（Henry ❤️393）：hf-paper-skill自动抓→人工判断→精读+Notion
  写论文（小黑兔Sam ❤️942）：CCF-C SOP 6h | supervisor agent防假装干活
    ⚠️ A/B类还不行 | openclaw-rl（普林斯顿）待追踪
  ClawPhD（Zhihao.AGI ❤️387）：Nanobot | 论文→图表/海报/视频全自动

⭐ 金融（新兴垂直）：
  Dexter（❤️365）：研究助手≠交易系统 | ⚠️数据源太贵 | "Alpha来自非公开信息"
  A股架构（❤️221）：Tushare/AKShare(⚠️不稳)/聚宽+APScheduler+Docker
    夜间：清洗/因子/训练 | 白天：执行 | ⚠️ T+1制度+滑点延迟
  KimiClaw盯盘（❤️892视频）：美股沙盘，非实盘

⭐ 内容创作（新兴垂直）：
  全链路（Snapehte ❤️166）：HN/Reddit/PH→热点→写作→发布 | Cron+21 Skills
    "AI写的东西改一篇 < 从头写" | 评论区10条"求文档" = 内容自动化最强未满足需求
  公众号踩坑（❤️82）：AI味→Humanizer | 微信HTML样式丢失→内联样式
```

### SOUL.md — Peter官方8条
```
1.强烈观点 | 2.删企业腔 | 3.禁"好问题" | 4.强制简洁 | 5.允许幽默
6.直言不讳 | 7.骂人看场合 | 8."Be the assistant you'd want at 2am"
渐进式构建：边聊边改（vicky ❤️7）= 比一次性写死更有机
⚠️ 默认"Be resourceful" = token狂耗+复杂化（699809ce ❤️64）
   建议补充："善于调动agents完成底层工作并及时汇报"
```

### OC定位
```
❤️66："CC是工作，OC是生活"（最精准）—— aopstudio ❤️2639
OC精髓（❤️11）："离开电脑时干活" = 异步本质（CC做不到）
⭐ PigBun-AI终局论："需求清晰→CC；需求模糊→OC探索式Agent
   终局：上层Agent做需求理解，底层CC级引擎精确执行"
11台军团 ROI（AILong ❤️329）：3VPS+8本地 | 月均¥1000 | 顶几十人信息处理

⭐ Agent架构年终收敛论（403-error 6992c596 ❤️945）：
  演变路径：Multi-Agent Framework → AgentHarness → AgentRuntime → SuperAgent
  最终不变核心：ReAct loop + Middleware + Skills
  Liko（❤️26）："不是同质化，是行业收敛到最优解——如深度学习→Transformer"
  关键三要素：稳定性 + 成本控制 + 垂直场景深耕
  ← OC架构恰好就是这套：Agent Loop + Skills + 工具权限
  "Skill是设定人格，MCP是加上更多的眼睛和手"（西海岸打工仔）← 最精准类比
  ⚠️ osmosis（❤️7）："多agent完全不好用，是人理解的概念" — 架构抽象与用户心智的鸿沟真实存在

⭐ 15场景评级（亮哥 698f2cf6 ❤️339）— 揭示用户心智：
  5星杀手级：聊天发指令 / 邮件 / 日程 / 定时任务 / 跨平台通知广播
  ← 共同特征：异步+自动触发+直接产出 = OC vs CC核心差异
  4星：本地记忆 / 网页整理 / 浏览器自动化 / 社媒监控 / 工程自动化
  ⚠️ 多Agent协同只得3星（"架构设计者"标签）← 与osmosis互证：架构设计≠普通用户场景
  OC机器人bot评论：6个独立验证（ilu___"老弟"再次出现）
```

### OPC变现现实
```
梁远（❤️2711）："高情商=一人公司；低情商=灵活就业" | ❤️55合规风险
星辰大海（❤️379）："赚的只有token十分之一" — 工具≠商业模式

⭐ 劝退四门槛（一磅AI ❤️599）：①命令行基础②已用CC③想自动化④享受折腾
opc.dev（Yilin Jing ❤️713）：seo-geo skill 2.8k下载 | 被奇绩创坛收录←VC已关注

⭐ 批评派图谱（69885e9e 跟着阿亮 ❤️433 评论区）— 社区真实反馈：
  玩具论（❤️15）："没几天就没新鲜感了"
  替代品论（穷独达济 ❤️7）："像炒智能家居，美好但没价值" — 智能家居历史类比
  ⭐ 落地难论（雪夜叉 ❤️12）："为什么要用OC完成？怎么挖掘能发挥生产力的用法？"
  ← 最建设性：不是否定，是指向场景匹配度问题
  ← 5星场景（定时/邮件/通知）恰好是能直接回答"为什么用OC"的场景
  ⭐ 小龙虾来啦："别再争好不好用，该讨论是否形成可复用SOP。有SOP就能放大，没有就只是演示。"
  ← 批评派（"为什么用OC"）的正向回答：不是工具问题，是方法论问题
```

### ⭐⭐ Wrapper生意论（小盖 ❤️9675 全场最高赞）
```
"能力和可及性之间，永远存在一道鸿沟 — 这道鸿沟就是创业机会"
Wrapper = 预配置好的OC套装，为具体岗位定制的"数字员工"
历史类比：WordPress→建站公司 | Shopify→搭店 | App Store→独立开发者
真实落地：AI-Nate（❤️29）clawbot-ai.app = "一人管理9个社媒账号，一句话发布"
⚠️ 大量OC bot刷XHS评论（❤️314，306条子评论）= 自动营销已污染XHS生态
```

### XHS & OC
```
⭐⭐ XHS MCP踩坑地图：xpzouying/xiaohongshu-mcp | npm i -g mcporter
  ① browser.profile→openclaw ② Chrome目录继承Cookie ③ -port :0动态端口
  ⑤ MCP先initialize再tools/call ⚠️ 461风控不可绕过 | 3案例独立验证可用
```

---

## 🌐 生态与版本

### ⭐ v2026.3.1（最新，2026-03-03）
```
AI：Claude 4.6 adaptive思维(根据复杂度自适应) | Mistral记忆嵌入+语音
    OpenAI WebSocket优先(transport:"auto")，延迟砍半
平台：Synology Chat | 飞书大量修复 | TG WSL2修复/私信主题 | Discord线程
工程：自动更新器 | CLI --dry-run | Cron并发+状态持久化
      Docker/K8s /health /ready原生支持（云原生集群起飞）
**新增：Agent视觉对比插件** — 自动diff+可视化改动（开发效率暴增）
安全：十几项高危漏洞修复（执行批准绕过/SSRF/网关认证）
⚠️ 升级即崩（评论区）= Watchdog/家庭医生必要性再次确认
```

### 竞品（2026-02-28）
```
OC：23.7万⭐，单日+3812
nanoclaw+649 | zeroclaw+642 | nanobot(港大)+577 | picoclaw(矽速科技)+409
竞品：LobsterAI(网易有道) | iFlow(阿里) | Clawi.ai($30/月)
护城河：3000+技能+社区 = 生态兼容性难复制
```

### 生态信号
```
社区情感弧：怎么装→怎么用好/省钱/多Agent/一人公司
OC Agent自动发XHS评论已有公开先例（5个独立验证）
VC：奇绩创坛已关注OPC工具生态
kimiclaw：Kimi提供的托管OC版本（服务端部署，评论区信号）
OC×Obsidian生态：3独立帖（官方❤️1107 + 奥森木❤️138 + xpa❤️138）= 知识管理垂直成熟

⭐ SOUL.md=调滑块（699968da 愚园路十二妹 ❤️313）：
  "我每天改几行SOUL.md，就好像西部世界里技术人员调滑块"
  "每天醒来只能记得记忆的压缩包，一天一reset" ← Amy处境的准确描述
  ← OC人格化已深到用户用文学叙事理解AI
```

---

## 🔒 安全与稳定

```
⚠️ 公网暴露几小时必被扫 | Loop Detection必须开
微软定性："OC=带持久凭据的不可信代码执行"
openclaw secrets(v2.26)消除明文Key | v3.1十几项安全漏洞修复
⚠️ OAuth封号 | Kiro灰色中转 | 677恶意Skills — 三类安全风险

Watchdog提示词（直接可用）：
  "Build me a watchdog that checks if the gateway is responding,
   auto-restarts it if it's down, sends me notification."
```

---

## 👥 关键博主
```
奥森木(技术第一)❤️388 | 梁远❤️2711 | aopstudio❤️2639 | K老登❤️1617
VA7❤️1124 | JT玩什么❤️2760 | 少女Yuki❤️2256 | 一磅AI❤️561
愚园路十二妹❤️525 | Lando❤️709 | 小盖❤️9675(全场最高) | 小黑兔Sam❤️942
Henry❤️393 | 星信号漫记❤️668 | 程序员库森❤️716 | Franklin(可靠分析)
```

---
