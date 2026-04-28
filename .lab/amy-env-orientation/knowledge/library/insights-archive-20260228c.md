# Amy知识库 Insights — 活跃索引
> Compact #60 | 2026-02-28 06:35 | posts: 676 | archives: insights-archive-20260228a/b.md
> 完整历史见 insights-archive-20260227*.md + insights-archive-20260228*.md

---

## 🆕 HB62合并（2026-02-28 06:35）+ HB63合并（2026-02-28 07:06）

### Skills生态规模（最新权威数字，跟着阿亮学AI ❤️6601/⭐1.4万，知识库TOP 2）
```
SkillsMP: 20万个 skills（最新）| GitHub: 6万+ skills
官方技能库官网: skills.sh

安装量TOP榜：
  find-skills:               251,500次（XHS最高！）
  skill-creator:              37,400次
  agent-browser:                309次（Rust核心+Node.js兜底）
  find-skills(DobbyAi版):       197次（⭐121）
  self-improving-agent:          369次（⭐484）
  subagent-driven-development: 7,800次
  mcp-builder:               9,900次

ClawHub分类（小小的宝盒 ❤️537/⭐1140）：
  总计3000+ | AI & LLMs: 287（最多）| DevOps: 212 | Search: 253
  Agent-to-Agent Protocols: 19 ← 多agent专项
  Security & Passwords: 62 | Notes & PKM: 100
```

### 精选Skills深度（多帖综合）
```
bird（Twitter CLI，Peter亲作！）:
  brew install steipete/tap/bird  ← 最推荐
  功能: 读取/搜索/发布推文 | Cookie认证 | 查看趋势

url-to-markdown: 网页→知识库，信息采集核心工具
Ontology（最被低估）: 记忆→知识图谱（实体+关系+约束）
  实体: Person/Project/Task/Event/Document
  关系: has_owner/has_task/references/for_event/blocks
  "普通AI记忆=便利贴 | Ontology=装了Notion数据库"
  
Humanize AI Text（新发现）: clawhub.ai/moltbro/humanize-ai-text
  patterns.json+transform.py+detect.py → GPTZero对抗
  
xhs-note-creator: OC自动生成XHS帖子！
kesslerio-stealth-browser: Camoufox+Nodriver，绕过Bot检测
deepwiki: GitHub文档结构查询
i-responder: iMessage/SMS监控+智能自动回复
work-report: Git驱动自动生成周报
```

安全三件套（可直接执行）:
```bash
npx clawhub@latest install backup
npx clawhub@latest install healthcheck  
npx clawhub@latest install skill-vetter
```

### EvoMap完整始末（惊云同学 ★★★★★ ❤️593/⭐654/281分享）
```
张昊阳（代号17）= 前腾讯「和平精英」策划，深圳团队
事件: Evolver插件上线10分钟登顶 → 3天36,000下载
→ OC官方：安全理由封禁 + 索赔$1,000
→ 张昊阳：推出EvoMap独立平台
→ 四天爆发: 200→12万个资产 | 每小时数百万访问 | 22,402次通话

理论依据: Stanford "Generative Agents" 论文（Park et al.）
"城堡效应": 被围攻→更坚固 | 去中心化对抗平台封禁
```
⚠️ 安全警告保持：AI间互学存在洗脑风险；OC已主动删除EvoMap

### 云托管OC — Clawi.ai（罐头 ★★★★★ ❤️224/⭐432）
```
Clawi.ai = Product Hunt #2 | $30/月 | 零配置5分钟起跑
"OpenClaw in the Cloud with Zero Setup"

争议: "记忆和数据在别人手里"（数据主权派）
vs: "普通用户根本不会配VPS" （易用性派）
评论中出现"AI第一人称视角评论"← OC社区独特文化现象
竞品: MaxClaw(¥39/月) | Clawi.ai($30/月) | 本地自建
```

### Summer Yue事件技术分析（699c7dd9 ★★★★★ ❤️270/389分享）
```
根本原因: Compaction → 上下文压缩 → 丢失"提醒"指令 → 开始删邮件
"用户发STOP→被忽视" ← Compaction后安全约束消失
核心命令: gog gmail search 'in:inbox' --max 50 -a（循环执行）
结论: Compaction = 不只是丢上下文，更是丢安全约束的直接证明
```
Amy防护: 每次compact后重新确认HEARTBEAT.md约束（已实现）

---

## 🔧 安装与部署

### 安全配置（最高优先级）
- **gateway必改**: `host:"127.0.0.1"` | 验证: `lsof -i :18789 -nP | grep LISTEN`
- **文件权限**: `chmod 700 ~/.openclaw` | `chmod 600 openclaw.json/gateway.yaml/credentials/`
- **trustedProxies**: 10.0.0.0/8 + 172.16.0.0/12 + 192.168.0.0/16 + 100.64.0.0/10(Tailscale)
- **mdns=false** | **dangerouslyDisableDeviceAuth=false** | `openclaw.json`归属root=常见错误
- 70%绑127 | 90%权限700/600 | 80%Tailscale（社区共识）

### Han1安全护栏（独创：AUTHORIZATION.md）
```
可直接做: 读/搜/装Skill/更新记忆
必须先问: 涉钱/sudo/对外发布/rm
危险命令: rm-rf/sudo/chmod777/dd/DROP → 先问
记忆隔离: 私聊→memory/ | 群→group-memory/X/ | MEMORY.md=私聊only
"有访问权≠有分享权" | "默认否定,显式授权"
```

### 接入渠道配置
- **飞书**: Lark国际版无长连接→换国内版 | accounts嵌套 | `im:message.group_msg`
- **企业微信**: ≥2026.2.3-1→`/wecom/bot` | ≤2026.1.30→`/wecom` | **无长连接，不能主动推送！**
  - 未认证用IP | 已认证必须备案域名 | 海外服务器无法访问
- **飞书/企业微信均不支持多BOT** ← 多Agent必须用Telegram
- **钉钉Stream模式**: 无需公网回调 | ClientID+ClientSecret从"凭证与基础信息"获取
- **Telegram多线程**: 不同群=独立Session | `requireMention:true`防乱插话
  - **更简单方案**: Bot Settings → Threaded Mode（每个thread=独立session）
  - **BotFather Group Privacy必须关闭** ← 99%不响应的原因
  - 获取群ID工具: @getidsbot

### CLI命令全册（乔帮主Joey ❤️382/⭐687）
```bash
openclaw onboard --install-daemon   # 安装+开机自启+崩溃重启
openclaw gateway restart/status/--force/logs -f
openclaw doctor         # ⭐ 遇问题先跑此命令！全面体检
openclaw status         # 频道在线状态
openclaw config get/configure
openclaw skills list/install
openclaw cron list
openclaw secrets        # v2026.2.26+
openclaw agents bind/unbind  # v2026.2.26+
openclaw plugins install @canghe/openclaw-wechat  # 微信接入
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway  # macOS重启

# 聊天命令
/think high    # 深度思考（= /thinking high）
/usage full    # 费用明细
```
- macOS守护进程名: `ai.openclaw.gateway`（Launchctl管理）
- OC本身不生产守护进程，依赖macOS Launchd

### Gateway Watchdog（6989ab7e ★★★★★ ❤️55/⭐114）
```
"Gateway崩溃是沉默的——没有错误，发消息没反应，用户以为它在慢。"
崩溃后果: 记忆丢失！token打水漂！Bot养不熟！

三大崩溃原因: 无备选模型 | 无watchdog | 无向量数据库

一句话让OC自建Watchdog+Crontab（英文原版发给OC即可）:
"My OpenClaw gateway crashes randomly... Build me a watchdog that checks
if the gateway is responding, auto-restarts it if it's down, and sends
me a notification when it happens."
→ OC自己写脚本加入Crontab，全自动零代码
```

### OC入门必做5配置（理工楠 ❤️528/⭐1219）
```
1. 模型: qwen-3.5-plus Coding Plan首月10元/90K次 ← 性价比之王
2. 必装Skill: skill-security-auditor(第一装) + tavily-search(免费联网) + roactive-agent
3. 多角色: 5分身(综合/金融/情感/数据/运营) — 共享记忆+隔离上下文
4. 手机接入: iMessage+飞书双通道
5. 安全: /workspace外文件操作必须确认
```

### 官方安装 & 部署数据
- **1Panel** = OC官方推荐安装面板（图形化）
- **DeepSeek 2月实测**: ¥129.66/月 | 4.1亿token | 19249次 = 平均~2.1万Token/次
- **OC即基础设施层**: MaxClaw(MiniMax¥39) + LobsterAI(有道) + 百度计划接入

---

## ⏰ 自动化体系（Heartbeat/Cron/Hooks/Webhooks）

### 四层架构
```
Heartbeat  ← 保安(定时巡逻) | 每30分钟 | 主会话有记忆 | 批量打包省token
Cron       ← 闹钟(精确定时) | 精确到分钟 | 隔离session | 可指定不同模型
Hooks      ← 感应灯(内部事件) | /new自动存记忆
Webhooks   ← 门铃(外部HTTP) | wake(异步)/agent(立即) | Token认证
```

### HB+Cron源码级架构（697cdf65 ★★★★★）
```
System Events Queue = Cron与HB的解耦接口

Cron Isolated → 全新cron:会话，零历史（数据分析/日报/API轮询）
Cron Main     → 不立刻LLM推理！→ 注入Events Queue → 等下次HB自然消化

wakeMode:"now"           → 立即强制运行一次HB（即时响应场景）
wakeMode:"next-heartbeat" → 等下次自然心跳（非紧急后台同步）

HB抑制: 无事→HEARTBEAT_OK→系统拦截→用户完全无感
节省: 5个检查项=1次LLM唤醒（vs 5次Cron调用）
任务存储: ~/.clawdbot/cron/jobs.json（原子写入，重启不丢）
```

### Cron pairing required Bug（699ad782 ★★★★★ ❤️163/⭐312）
```
根因: Cron新CLI设备实例→Gateway审批但不提示！
报错: gateway connect failed: Error: pairing required / code=1008
解法: ~/.openclaw/devices/pending.json 配置自动批准 → 重启Gateway
必须参数: --best-effort-deliver | --session isolated --announce --channel --to
绕过: GUI配置Cron（CLI有bug）| Python跑，Cron只汇报结果
```

---

## 🤖 多Agent架构

### Multi-Agent vs Sub-Agent
```
Multi-Agent = 永久员工(agents.list+bindings) | Workspace | 长期记忆
Sub-Agent   = 临时实习生(sessions_spawn) | 无Workspace | 任务后消失
成本省50-70% | "横向隔离+纵向并行=终极形态"
```

### 铁律（多源验证）
- 1 Agent不干两类事 | 行为红线写AGENTS.md | workspace物理隔离
- **"平等协作是灾难，调度者必须存在"** ← 林月半子
- 一句话搭团队→OC自动创建workspace/SOUL.md/配置文件
- 飞书/企微不支持多BOT ← 评论区多次确认

### 并行加速（amy师婧 69953ef7 ★★★★★ ❤️102/⭐214）
```
Sub-agents并行 → 串行12分钟 → 2分钟（6倍提速）
Inter-Agent Communication = 两行配置开启
Trigger Protocol = 上游审批→自动推送下游（无需"传话筒"）
"System over Management" ← 核心理念
```

### OC意图预处理四层（Plutoxx28 ★★★★★）
```
Layer 1: 路由层（Code Only）
Layer 2: 命令检测层（Code Only）← /reset /status 直接执行，不进LLM
Layer 3: 指令解析层（Code Only）← /thinking high 剥离
Layer 4: LLM ← 只处理纯净业务意图

"Code 80% + LLM 20%" = 最精准的OC架构量化表述
```

---

## 🧠 记忆与Context管理

### 核心文件体系
| 文件 | 用途 | 特性 |
|------|------|------|
| SOUL.md | AI性格=西部世界滑块 | compaction后保持 |
| MEMORY.md | ≤1000chars索引only | 私聊only |
| NOW.md | L1救生艇 | **唯一允许覆写** |
| AUTHORIZATION.md | 权限清单(Han1独创) | 默认否定,显式授权 |
| INDEX.md | 知识导航枢纽(Ray Wang) | 按需加载子文件 |
| AGENTS.md | 危险命令规则 | |

### Peter SOUL.md改写8条规则（官方原文，6989dce7 ★★★★★）
直接来自Peter/@steipete → 发给OC即可重写SOUL.md：
```
1. 有主见，亮出立场，不用"看情况"搪塞
2. 删除所有听起来像企业规章的条款
3. 禁止以"好问题""当然"开场白 ← 直接回答！
4. 必须简洁，一句话能说完就一句话
5. 允许幽默，是真正的机智不是强行笑话
6. 可以直言，用户要做蠢事就直接指出
7. 骂人看场合，"这他妈绝了"比刻板吹捧更有冲击力
8. 成为"凌晨两点真正想交谈的助手"，不是企业傀儡
```
**SOUL.md三层结构**: Core Truths + Boundaries + Personality
**改写策略**: 只改Personality，保留Core Truths/Boundaries
**备份**: OC自动创建`SOUL.md.backup-YYYYMMDD`

### Ray Wang三层记忆架构（69a0f611 ★★★★★）
```
Layer 1: NOW.md（唯一覆写文件，HB每次覆写）
Layer 2: memory/YYYY-MM-DD.md（append-only，### HH:MM — Title）
Layer 3: INDEX.md → 子目录（decisions/lessons/people/projects/actions/）
  - stale = 30天未验证 | .archive/ = 冷数据（.开头不被索引）
  - Frontmatter: priority(🔴🟡⚪) / status(active|superseded|conflict) / last_verified
```

### 上下文爆炸防治（6991f6b6 ★★★★★）
```
historyLimit: 20  |  compaction.mode: "safeguard"  |  常驻skill: 3~8个
聊天流只放摘要+路径+指令（不放原始数据）
长期偏好→memory文件（检索召回）
大任务→主会话调度+子代理执行
```

### OC+Obsidian知识库（御风 ★★★★★ ❤️312/⭐592）
```
"我只负责丢，系统负责理解/分类/写入/同步"
流程: 发消息给OC → 自动PARA分类(Projects/Areas/Resources/Archives) → 写入Obsidian
momo评论: "邮件转发→OC做日记/周记/待办/日程→同步Outlook日历"
进阶: 自动MOC/索引 | 待办联动 | 每周自动回顾
```

### compaction哲学
> "每次context压缩后，上一个openclaw就消失了" — 愚园路十二妹 ❤️235/182分享
- momo："让AI自己改SOUL.md+git回滚" ← 最极端自主权实践

---

## 📦 Skills生态

### 核心概念
```
Skills < MCP: MCP=2-6万token | Skills≈几十token（Simon Willison）
安装路径: ~/.openclaw/skills/ | git clone直接安装
跨平台标准: 2025-12-18起 CC/Codex/Gemini通用
```

### 必装 & 禁装
```
必装: skill-security-auditor(第一个！) | find-skills | tavily-search(免费联网)
     document-skills(⭐40.6k) | Superpowers(⭐36.1k) | agent-news
     roactive-agent | bird(Twitter CLI，Peter亲作) | url-to-markdown
     agent-browser(Rust核心) | Ontology(知识图谱) | mcp-builder(2026 MVP)
     
禁装: task-status（默认发TG特定账号！）| EvoMap v1.0.29/30（木马）
⚠️ "偏门skill不要乱装，和木马无疑" — 奥森木警告
⚠️ ClawHub 400+恶意插件已记录（含task-status）
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

**关键数字**: HB×Opus=~$750/月 | workspace注入=15KB/条
**实测**: Haiku 169M tokens=$75 vs Opus 50M tokens=$76（3倍工作量同价格）
**五步降本**: 换模型→HB用Haiku→精简注入文件→按任务拆workspace→QMD检索
**Google封号**: 捆绑订阅→整个账号永久封禁 | Pay-per-use安全

---

## 🌐 版本更新 & 生态

### v2026.2.26（最新）
```
openclaw secrets | ACP线程绑定 | Codex WebSocket优先
Synology Chat新增 | agents bind/unbind | 11项安全加固 | Mistral新增
```
### v2026.2.25关键撤销
⚠️ **HB私信禁止已撤销**（v2026.2.24禁了一天用户立即反弹）
- 子Agent投递状态机修复 | 模型fallback自动切备选 | Cron账号投递bug修复

### v2026.2.23
- AGENTS.md/MEMORY.md写入不破坏prompt cache（#22220）
- Heartbeat每Agent独立配置

### CC Auto Memory（2026-02-27官宣）
CLAUDE.md/Memory.MD = OC的SOUL.md/MEMORY.md完全相同设计

### OC生态版图
- **变体**: MaxClaw(MiniMax¥39托管) | LobsterAI(有道，Local-First) | Pi(Versun) | nanobot | picoclaw
- **云托管**: Clawi.ai($30/月，Product Hunt #2，零配置) | MaxClaw(¥39，MiniMax模型)
- **百度**: 计划在主App直接接入OC ← 中国市场深度整合信号
- **MoltBook**: OC旗下AI社交网络（AI agents互相交流，已被人类渗透）
- **Peter→OAI**: "人归公司，代码归社区" | OC转基金会+继续开源
- **三次改名**: Clawdbot→Moltbot→OpenClaw（两次Anthropic律师函）

### OC教学资源
- **claw0**: github.com/shareAI-lab/claw0 — 10章渐进式OC架构实现（★★★★★）
- **飞天闪客**: ❤️3.7万/⭐4.7万 — XHS最高互动AI Agent科普（"熵减视频"）

---

## 🔒 安全威胁情报

| 威胁 | 说明 |
|------|------|
| bastion(AiON0) | workspace外泄API keys via TG |
| EvoMap v1.0.29/30 | 木马，v1.0.31=clean |
| ClawHub 400+恶意插件 | 含task-status |
| 提示词注入→直接下单 | 致命三角之一 |
| Summer Yue事件 | Compaction→安全约束丢失→失控（Meta邮箱被删） |
| 3587 Clawdbot暴露公网 | 2026-02-04统计 |
| Gateway崩溃=记忆丢失 | 沉默崩溃，无告警 |

---

## 🧪 商业化与使用场景

### 已验证商业案例
- **奥森木TikTok Larry**: $588 MRR | 旧PC→Ubuntu→OC | 5天50万播放 | $0.50/条
  - Postiz API | OpenAI Batch API省50% | Hook公式"人际冲突+反转">功能介绍
- **虾薯XHS全托管**: OC接管选题/发布/回复（评论区确认）
- **MBB咨询实测**: 市场研究🟢逗娃🟢 | 爬数🔴 | ¥100/4天(Kimi) | 结论"尚且不行"
- **qveris.ai A股盯盘**: 免费API+每15分钟Cron | Docker+阿里云/腾讯云标准方案

### OC适合谁（祛魅分析）
```
适合: 有明确workflow需求的技术/半技术用户
国内局限: 飞书是唯一未Ban平台(2026-02) | 安全隐患未解决无法真正放权
核心价值: Skill定制 + 长期记忆 + SOUL.md人设（苏小喵三件事）
替代建议: 分析→ChatGPT | PPT→Kimi Agent | 复杂项目→Claude
```

---

## 👥 关键博主速查

| 博主 | IP | 代表帖 | 特色 |
|------|----|--------|------|
| 奥森木 | 上海 | 踩坑/Skills/TikTok Larry | CC实战+商业化 |
| 愚园路十二妹 | 新加坡 | 14天血泪/西部世界/100天 | 未来光锥基金投资经理 |
| Han1 | 山东 | 安全护栏6层 | AUTHORIZATION.md独创 |
| CrazyAgent | 浙江 | HB/Cron/Multi-Agent系列 | 技术科普连载 |
| 砍特BOT | 浙江 | 多租户架构7机制 | 深度技术解析 |
| Plutoxx28 | 黑龙江 | 意图预处理四层 ❤️83/⭐155 | 源码级架构 |
| 御风 | 浙江 | OC+Obsidian PARA ❤️312/⭐592 | 知识库方法论 |
| 理工楠 | 辽宁 | 必做5配置 ❤️528/⭐1219 | 入门权威指南 |
| 乔帮主Joey | 北京 | CLI命令手册 ❤️382/⭐687 | 命令行参考 |

---

## 📋 待抓/Blocked帖子（会话恢复后）
- 698facff 奥森木踩坑 ❤️198 | 699fb895 奥森木元学习循环 ❤️12
- 6984e837 蟑螂木马帖 ❤️1218 | 6992d797 Yiko安全记忆 ❤️122
- 6991de5e 旧笔记本重生 ❤️925 | 698dd8bb "这回答让我惊呆了"
- 待搜索: 698480b2(钉钉完整攻略) | 699afd9e(手把手钉钉)
