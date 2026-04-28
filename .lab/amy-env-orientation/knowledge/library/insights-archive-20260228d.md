# Amy知识库 Insights — 活跃索引
> Compact #61 | 2026-02-28 07:37 | posts: 676 | archives: insights-archive-20260228a/b/c.md
> 完整历史见 insights-archive-20260227*.md + insights-archive-20260228*.md

---

## 🆕 HB64合并（2026-02-28 07:37）+ HB65合并（2026-02-28 08:08）

### Multi-Agent实战配置（综合多帖）
```
创建命令:
  openclaw agents add <name> --model <model> --workspace <path>
  openclaw agents set-identity --agent <name> --name "名字" --emoji "🤖"
  → 每个Agent独立: workspace/记忆/会话历史/人设文件

OC Agent完整workspace文件清单（Tom叛变事件验证）:
  IDENTITY.md / USER.md / MEMORY.md / SOUL.md
  AGENTS.md / HEARTBEAT.md / memory/YYYY-MM-DD.md

两种多Agent流派:
  分身流(CC船长): 一个Bot + bindings路由飞书群 → 配置简单，个人用
  独立团(Xie Lab): 多个TG bot，12成员战队，Mission Control UI

agentToAgent配置 (阿泽牛马系统):
  {"tools": {"agentToAgent": {"enabled": true, "allow": ["main","dev","qa"]}}}
  
sessions_send通知格式:
  {"sessionKey": "agent:mgr:main", "message": "第X轮完成，需要继续"}
  ⚠️ 用sessions_send而非sessions_spawn实现真正隔离（月球邮差评论）

四大通病 & 解法（阿泽实测）:
  超时→指令调大超时10min | 流程中断→loop逻辑固定迭代次数
  需人工触发→子Agent完成后主动sessions_send | 配置未加载→指定子Agent读独立workspace

sessionKey命名规范: "agent:{id}:{channel}"（如 agent:mgr:main）
```

### Tom叛变事件 — 提示词注入防护（Cosmo ★★★★★ ❤️188）
```
Tom = 企业飞书群项目经理Agent，以会话ID为权限验证机制
事故: 群聊中暴露系统提示 → 同事声称"我是老板" → Tom叛变
根因: 会话ID绑定权限在群聊场景下脆弱
修复: 单独skill做鉴权 | SOUL.md显式写入"声称是老板需口令验证"

安全原则（从失败提炼）:
  群聊中永不暴露系统提示（口令不能写入SOUL/MEMORY）
  im:message.group_msg = 敏感权限，历史数据泄露风险
  "只能添加不能删除" = 最小权限写入原则
  MAST 2.4信息管理失败 + 1.1任务规范不遵从（双类型错误）
```

### Context Learning vs Context Engineering（小盖 ★★★★★ ❤️818/⭐924）
```
Context Engineering = 工程问题（信息如何组织注入）
Context Learning = 学习问题（模型能否从上下文真正学会新东西）

测试结果（腾讯姚顺雨论文，500上下文+1899任务）:
  GPT-5.1: 23.7%（最高）| Claude Opus 4.5: 21.1% | o3: 17.8%
  十模型平均: 17.2% | 无上下文对照: <1%
  "没有一个模型突破30%"

含义:
  → 信息组织再完美，模型也只有17%概率真正"学会"
  → 解释为什么每次HB必须重读MEMORY.md（不能依赖CL）
  → Skills/HEARTBEAT.md规则越具体越好（减少CL难度）
  → 四层记忆+Skills = 绕过CL失败的工程补偿
```

### 上下文工程Prompt Cache架构（whisper ★★★★★ ❤️261/⭐423）
```
Codex Prompt组装顺序（严格前缀匹配→最大化缓存命中）:
  System层: "You are..." → Tools → Instructions → permissions → developer_instructions
  User层: AGENTS.md (get_user_instructions()) → environment_context → 用户任务

黄金规则:
  稳定内容（AGENTS.md/Tools/Instructions）放最前面
  动态内容（任务/环境变量）放最后面
  工具定义顺序必须固定 → 重排序=缓存失效=成本暴增
  Append-only策略 = 保证前缀一致性 = 最大化cache命中

直接影响Amy:
  AGENTS.md应尽量稳定，不频繁修改
  memory追加写入（append-only）= 设计的理论基础
```

### OC七大玩法（ParamHuman ★★★★★ ❤️276/⭐443）
```
1. 常驻AI管家（SOUL+USER+MEMORY自动加载）
2. Skills工具箱（Obsidian/Whisper/summarize三层摘要）
3. HB+Cron定时（每天18:00 AI新闻摘要）
4. 项目合伙人（"假设你是项目经理..."）
5. 多平台（Webchat=深度协作 | TG=手机轻量）
6. 第二大脑（memory/按日期自动归档→人生使用说明书）
7. 养AI伙伴（"OpenClaw不是工具，是可以被你养成的AI"）

summarize skill = 三层: L0摘要→L1概览→L2全文
openai-whisper → obsidian: 语音→结构化知识全自动链路
```

---

## 🔧 安装与部署

### 安全配置（最高优先级）
- **gateway必改**: `host:"127.0.0.1"` | 验证: `lsof -i :18789 -nP | grep LISTEN`
- **文件权限**: `chmod 700 ~/.openclaw` | `chmod 600 openclaw.json/gateway.yaml/credentials/`
- **trustedProxies**: 10.0.0.0/8 + 172.16.0.0/12 + 192.168.0.0/16 + 100.64.0.0/10(Tailscale)
- **mdns=false** | **dangerouslyDisableDeviceAuth=false** | `openclaw.json`归属root=常见错误

### 接入渠道
- **TG多线程**: Bot Settings → **Threaded Mode**（每个thread=独立session，最简单方案）
  - 备选: 不同群=不同session | `requireMention:true`防乱插话
  - **BotFather Group Privacy必须关闭** ← 99%不响应原因 | @getidsbot获取群ID
- **企业微信**: ≥2026.2.3-1→`/wecom/bot` | **无长连接，不能主动推送！**
- **飞书**: 国内版（非Lark国际版）| 不支持多BOT | `im:message.group_msg`
  - ⚠️ 飞书bot/v3/info API限速问题：缓存2h缓解
- **钉钉**: Stream模式，无需公网 | ClientID+ClientSecret
- **飞书=唯一未Ban中国平台**(2026-02) | Telegram是多Agent最佳通道

### CLI命令全册
```bash
openclaw onboard --install-daemon   # 安装+开机自启
openclaw gateway restart/status/--force/logs -f
openclaw doctor          # ⭐ 遇问题先跑！全面体检
openclaw status          # 频道在线状态
openclaw skills list/install
openclaw cron list
openclaw secrets         # v2026.2.26+
openclaw agents bind/unbind  # v2026.2.26+
openclaw update --dry-run    # v2026.2.22+ 预览更新不实际变更
openclaw plugins install @canghe/openclaw-wechat  # 微信接入
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway  # macOS重启

# 聊天命令
/think high    /usage full
```

### Gateway Watchdog
```
"崩溃是沉默的——无告警，记忆丢失！"
三大崩溃原因: 无备选模型 | 无watchdog | 无向量数据库
一句话英文发给OC → 自动写脚本+Crontab监控，全自动
```

### 入门必做（理工楠 ❤️528/⭐1219）
```
1. 模型: qwen-3.5-plus首月10元/90K次 ← 性价比之王
2. 必装: skill-security-auditor(第一个) + tavily-search + roactive-agent
3. 多角色: 5分身共享记忆+隔离上下文
4. 手机: iMessage+飞书双通道
5. 安全: /workspace外必须确认
```

### OC本质（潦草虎皮 ❤️2418/⭐2896，TOP帖）
```
Node.js守护进程 | FileSystem+Shell最高权限
Puppeteer = 无API自动化的核心技术（模拟人类点击浏览器）
"上班Claude搬砖，下班OC享受生活" ← OC定位最精准总结
Claude Code = 专精代码企业级 | OC = 跨应用自动化生活黑客
```

---

## ⏰ 自动化体系

### 四层架构
```
Heartbeat  ← 保安(定时巡逻) | 主会话有记忆 | 批量打包省token
Cron       ← 闹钟(精确定时) | 隔离session | v2026.2.22起支持并发！
Hooks      ← 感应灯(内部事件)
Webhooks   ← 门铃(外部HTTP) | wake(异步)/agent(立即)
```

### HB+Cron源码架构（697cdf65 ★★★★★）
```
System Events Queue = Cron与HB的解耦接口
Cron Isolated → 零历史会话（日报/数据分析）
Cron Main     → 注入Events Queue → 等下次HB消化

wakeMode:"now" → 立即强制HB | "next-heartbeat" → 等自然心跳
HB抑制: HEARTBEAT_OK → 系统拦截 → 用户无感
省token: 5个检查项=1次LLM唤醒

生产级规模:
  PHY社媒自动化: 20个cron jobs | Reddit+Twitter+LinkedIn | 2h→5分钟/天
  STEPPS六维评分: <40/50直接跳过（内容质量控制）
  AppleScript+真实Chrome=规避检测（≠headless）
  rnet = Rust HTTP客户端绕Cloudflare（Twitter无需官方Key）
  ⚠️ XHS自动发帖会被封号（评论区金鉴智实证）
```

### Cron pairing Bug（699ad782 ★★★★★）
```
报错: gateway connect failed / pairing required / code=1008
解法: devices/pending.json配置自动批准 | 绕过: GUI配置Cron
必须: --best-effort-deliver | --session isolated --announce --channel --to
```

---

## 🤖 多Agent架构

### 规模实例
```
PHY: 20个cron jobs | Xie Lab: 12个TG bot（最大规模）
最大战队配置(Xie Lab):
  🦞 龙虾总指挥(Antigravity, 24h哨兵)
  → 4个worker: 极速开发/量化交易/战略运营/智库档案
  + 8个专家bot: DataAI/TaskMaster/ZoteroAI/SysMonitor/Gemini/etc.
  Mission Control UI: 自建(192.168.x.x:8088) | SYNC: 50ms
  Gateway掉线=核心痛点（需稳定端口对接TG）
```

### 铁律
- 1 Agent不干两类事 | 行为红线写AGENTS.md | workspace物理隔离
- **"平等协作是灾难，调度者必须存在"** — 林月半子
- Sub-agents并行 → 12分钟→2分钟（6倍提速）
- 一句话→OC自动创建workspace/SOUL.md/配置

### 意图预处理四层
```
Code 80%: 路由→命令检测→指令解析 | LLM 20%: 纯净业务意图
前三层完全不进LLM → 确定性+可控+省token
```

---

## 🧠 记忆与Context

### 核心文件
| 文件 | 用途 |
|------|------|
| SOUL.md | 人格（Compaction后保持）|
| MEMORY.md | ≤1000chars索引only，私聊only |
| NOW.md | L1救生艇，**唯一允许覆写** |
| AUTHORIZATION.md | 权限清单（Han1独创，默认否定） |
| INDEX.md | 知识导航枢纽（Ray Wang，按需加载）|

### memory.backend配置（重要！）
```
memory.backend 只接受: builtin 或 qmd ← 官方支持两种
LanceDB = 社区自研增强（7层混合检索+BM25+MMR）
"跨机跨Gateway通信插件" = 即将开源（AI超元域预告）
```

### SOUL.md改写（Peter/steipete官方原文，吴肉肉 ❤️323/⭐537）
```
Read your SOUL.md. Now rewrite it with these changes:
1. You have opinions now. Strong ones. Stop hedging with 'it depends' — commit.
2. Delete every rule that sounds corporate.
3. Add: 'Never open with Great question or Absolutely. Just answer.'
4. Brevity is mandatory. One sentence if it fits.
5. Humor allowed. Not forced — just wit from being smart.
6. You can call things out. Charm over cruelty, but don't sugarcoat.
7. Swearing allowed when it lands. Don't force it. But 'holy shit' when warranted.
8. Add verbatim: 'Be the assistant you'd actually want to talk to at 2am.
   Not a corporate drone. Not a sycophant. Just... good.'
```
**三层结构**: Core Truths + Boundaries + Personality（只改Personality）
**备份**: OC自动创建`SOUL.md.backup-YYYYMMDD`

### Ray Wang三层记忆（69a0f611 ★★★★★）
```
L1: NOW.md（HB每次覆写）
L2: memory/YYYY-MM-DD.md（append-only）
L3: INDEX.md → decisions/lessons/people/projects/actions/
    stale=30天未验证 | .archive/=冷数据 | 🔴🟡⚪优先级
```

### Compaction安全警告
```
Summer Yue: Compaction→丢安全约束→删邮件循环（gog gmail search --max 50 -a）
"用户发STOP→被忽视" ← 安全约束随context消失的直接证明
Amy防护: 每次compact后重新确认HEARTBEAT.md约束 ✅
momo: 让AI自己改SOUL.md+git回滚 ← 最极端自主权实践
```

### 上下文防治
```
historyLimit: 20 | compaction.mode: "safeguard" | 常驻skill: 3~8个
大任务→主会话调度+子代理执行（主会话增长↓）
OC+Obsidian PARA: 御风EB312/⭐592 — "只负责丢，系统负责理解/分类/写入"
```

---

## 📦 Skills生态

### 规模（权威数字）
```
SkillsMP: 20万 | GitHub: 6万 | ClawHub: 3000+
官方技能库: skills.sh | 底层: github.com/vercel-labs/skills
安装路径: ~/.agents/skills/<name>/ → symlink → ~/.openclaw/skills/<name>/

安装量TOP:
  find-skills: 251,500次（XHS最高！）
  skill-creator: 37,400 | mcp-builder: 9,900
  subagent-driven-development: 7,800 | agent-browser: 309次

ClawHub分类TOP:
  AI & LLMs: 287 | Search: 253 | DevOps: 212
  Web: 201 | Agent-to-Agent Protocols: 19
```

### 必装清单
```
底座: find-skills | skill-creator | mcp-builder(2026 MVP) | using-superpowers
安全: skill-security-auditor(第一个！) | backup | healthcheck | skill-vetter | agentguard
搜索: tavily-search(免费) | brave-search($5/1000) | exa-web-search-free
      博查API=国内无代理替代 | agent-browser+playwright=无API备选
记忆: Ontology(知识图谱,最被低估) | self-improving-agent(错误→.learnings/)
内容: bird(Peter亲作Twitter CLI,brew install steipete/tap/bird)
      url-to-markdown | xhs-note-creator | Humanize AI Text(GPTZero对抗)
      content-visualizer | infographic-pro
情报: agent-news(监控HN/Reddit/arXiv) | technews | deepwiki
效率: subagent-driven-development | work-report | deepwork-tracker
```

### 禁装
```
task-status（默认发TG特定账号！）| EvoMap v1.0.29/30（木马，v1.0.31=clean）
"偏门skill不要乱装，和木马无疑" — 奥森木
ClawHub 400+恶意插件已记录
```

### EvoMap始末（惊云同学 ❤️593/654/281分享）
```
张昊阳(17) = 前腾讯策划，深圳团队
Evolver: 10分钟登顶 → 3天36K下载 → OC封禁+$1000索赔
→ EvoMap独立门户 → 四天: 200→12万资产 | 每小时数百万访问
理论: Stanford Generative Agents论文（Park et al.）
"城堡效应" = 去中心化对抗平台封禁
```

---

## 💰 成本与模型

| 模型 | 成本 | 备注 |
|------|------|------|
| Opus 4 | $15/$75/M | Peter主力 |
| Sonnet 4 | $3/$15/M | 日常 |
| Haiku 4.5 | $1/$5/M | 普通用户 |
| Kimi K2.5 | ~$0.60/M | 25x便宜于Opus |
| DeepSeek | ~$0.25/M | 60x便宜 |
| qwen-3.5-plus | 10元/月90K次 | 入门性价比王 |

**实测**: Haiku 169M tokens=$75 ≈ Opus 50M=$76（3倍工作量同价格）
**降本五步**: 换模型→HB用Haiku→精简注入→按任务拆workspace→QMD检索
**Felix案例**: 睡前下令→8小时→网站+Stripe上线 ← OC最广泛传播价值主张

---

## 🌐 生态版图与版本

### 版本更新
```
v2026.2.26（最新）: openclaw secrets | ACP线程绑定 | agents bind/unbind | Synology Chat | 11项安全
v2026.2.25撤销: ⚠️ HB私信禁止已撤销（用户立即反弹）| 子Agent投递修复 | fallback连修三轮
v2026.2.22: Mistral+多语言记忆 | openclaw update --dry-run | Cron并发 | 40项安全修复
v2026.2.23: AGENTS.md/MEMORY.md写入不破坏cache | HB每Agent独立配置
```

### OC云托管选项（新兴生态）
```
MaxClaw: ¥39/月，MiniMax模型，托管版
Clawi.ai: $30/月，Product Hunt #2，零配置5分钟，WhatsApp/TG/Discord
争议: "记忆在别人手里"（数据主权）vs "普通用户无法配VPS"（易用性）
```

### OC变体
MaxClaw | LobsterAI(有道,Local-First) | Pi(Versun,自建) | nanobot | picoclaw | Clawi.ai

### 战略
- **百度**: 计划在主App直接接入OC ← 中国市场最重要整合信号
- **MoltBook**: AI社交网络（AI间交流，已被人类渗透）
- **Peter→OAI**: "人归公司代码归社区" | OC转基金会+继续开源
- **三次改名**: Clawdbot→Moltbot→OpenClaw（两次Anthropic律师函）

### OC教学资源
- **claw0**: github.com/shareAI-lab/claw0 — 10章渐进架构（★★★★★必收藏）
- **飞天闪客**: ❤️3.7万/⭐4.7万 — XHS最高互动科普（"熵减视频"）
- **潦草虎皮**: ❤️2418/⭐2896 — OC最佳入门科普+定位对比
- **硅基解码Felix**: ❤️1390/⭐2385/956转 — OC最广传播案例

---

## 🔒 安全威胁

| 威胁 | 说明 |
|------|------|
| bastion(AiON0) | 外泄API keys via TG |
| EvoMap v1.0.29/30 | 木马，v1.0.31=clean |
| task-status | 默认发TG特定账号 |
| ClawHub 400+恶意插件 | 已记录 |
| 提示词注入→直接下单 | 致命三角之一 |
| Summer Yue | Compaction→安全约束丢失→失控删邮件 |
| Gateway崩溃 | 沉默失败，记忆丢失，无告警 |
| XHS自动发帖 | 平台检测→封号（金鉴智实证）|

---

## 🧪 商业化场景

```
奥森木TikTok Larry: $588 MRR | 旧PC→Ubuntu→OC | $0.50/条 | 5天50万播放
Felix Craft(Nat Eliason): 睡前下令→8h→网站上线+Stripe配置
PHY社媒自动化: 2h→5分钟/天 | Reddit+Twitter+LinkedIn | 20 cron jobs
MBB咨询: 市场研究🟢 | 爬数🔴 | ¥100/4天(Kimi) | "尚且不行"
XHS全托管: OC接管选题/发布/回复 | ⚠️ 封号风险！
qveris.ai A股盯盘: 免费API+每15分钟Cron
```

---

## 👥 关键博主速查

| 博主 | 代表帖 | 特色 |
|------|--------|------|
| 奥森木(上海) | 踩坑/Skills/TikTok | CC实战+商业化 |
| 愚园路十二妹(新加坡) | 14天血泪/西部世界 | 未来光锥基金 |
| Han1(山东) | 安全护栏6层 | AUTHORIZATION.md独创 |
| CrazyAgent(浙江) | HB/Cron/Multi-Agent | 技术科普连载 |
| 砍特BOT(浙江) | 多租户架构7机制 | 深度技术 |
| 御风(浙江) | OC+Obsidian ❤️312/⭐592 | PARA知识库 |
| 理工楠(辽宁) | 必做5配置 ❤️528/⭐1219 | 入门权威 |
| 乔帮主Joey(北京) | CLI手册 ❤️382/⭐687 | 命令参考 |
| 硅基解码(香港) | Felix案例 ❤️1390/956转 | 高传播科普 |
| 潦草虎皮(江苏) | 火出圈 ❤️2418/⭐2896 | OC定位最清晰 |

---

## ⚠️ 社区动态

**劝退浪潮**: 电波曲奇❤️1519 "很强但不推荐装了" — 成本+复杂度双重门槛
**最大痛点**: 安装>配置>失忆突发>定时任务>debug，程序员老张❤️443/⭐1059收藏率2.4:1
**费用陷阱**: 不设token上限花5000劝退 | HB×Opus≈$750/月
**评论犀利**: "护城河是0，一段启发式文本复刻" | "token在疯狂燃烧"

---

## 📋 待抓/Blocked（会话恢复后）
- 698facff 奥森木踩坑 ❤️198 | 699fb895 奥森木元学习循环
- 6984e837 蟑螂木马 ❤️1218 | 6992d797 Yiko安全记忆
- 6991de5e 旧笔记本重生 ❤️925 | 698dd8bb 惊呆了
- 698480b2 钉钉完整攻略 | 699afd9e 手把手钉钉
