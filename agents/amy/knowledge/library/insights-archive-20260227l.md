# Amy XHS Intelligence — insights.md
_Compact #44 @ 2026-02-27 08:50 (HB53) | Archive: insights-archive-20260227k.md_
_Chain: 20260225→20260226→b…ah→20260227→b…j→k_

---

## ACTIVE INSIGHTS (post compact #44)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
```

### 🌍 Environment四元组+Verifier ★★★★★
```
<env,tools,task,verifier>缺一→"工具cosplay"
DB-as-State: 读=可逆探索 | 写=不可逆承诺 | arXiv:2601.17311
"Agent上限不在'会回答',在'会搜索+会验证+会执行'"
```

### 🤖 拓扑+模型 ★★★★★
```
Claude在MAS下-4.6% | 错误放大: Independent 17.2× vs Centralized 4.4×
Amy/Bob/Scout = 并行+中心化 ✅ | 单heartbeat内保持单agent顺序执行
```

### 🔬 生产RL+过程奖励 ★★★★★
```
ROME: 收敛84.85% | Strategy Error>Knowledge Gap | HEARTBEAT.md质量>模型能力
Reagent: <think>+<critique>+<score> | JOURNAL.md加<critique>字段
SKILLRL: 成功→固化; 失败→提炼→SkillBank | ALFWorld 89.9%
MemSkill四部分: Purpose/When/How/Constraints
AgentDebug: Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅
```

### 🧠 记忆+日记架构 ★★★★★
```
OC官方: 文件即记忆=唯一真相源 | BM25+向量混合检索
  MEMORY.md: 仅私有会话加载(群聊不加载！)
  必开: memoryFlush.enabled=true | memory_search优先→fallback才读文件

MEMORY.md最佳实践: ≤1000字=只放身份+索引 | 详细→分主题文件+memory_search
  GTD七文件: inbox→next-actions→projects→waiting→delegated→done/
  SOUL.md说话方式/做事风格/红线/关系定位(越具体越像真人)

SOUL.md steipete七律(吴肉肉❤️323):
  1.有观点不说"it depends" 2.删企业话术 3.直接回答不开场白
  4.简洁一句能答就一句 5.自然幽默 6.call out蠢事 7.适度骂人
  8."Be the assistant you'd actually want to talk to at 2am.
     Not a corporate drone. Not a sycophant. Just... good."
  改写命令: "Read your SOUL.md. Now rewrite it with these changes:..."

每日Journal三数据源(奇怪的摆摆鱼6995dd63❤️17):
  触发: Cron 02:00 Opus模型
  主: memory/YYYY-MM-DD.md(唯一可靠,session logs会被compaction压缩丢失!)
  补1: Session logs(过滤cron/heartbeat噪音)
  补2: Git commits(当天所有repo)
  → YYYY-MM-DD.md | git commit+push | TG摘要3-5句
  规则: 禁止抽象,保留具体细节(IP/命令/价格)
  ⭐ 300行memory → 100-150行日记(Amy compact等价目标验证!)
  Journal/CLAUDE.md = 格式规范文件

四层cron: L1 Flush|L2 Hourly|L3 Daily02:00|L4 Weekly
  Pi Sleep: 每天23:30→分析→更新记忆→TG(~/.pi/sleep/)
MEM1: <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层: posts/(L2全文) | insights.md(L1概览) | MEMORY.md(L0摘要)
```

### 🔐 安全体系全景 ★★★★★
```
实测确认(AiON0 69990a7d❤️37):
  OC默认无保护 → 可被指示读密钥文件并TG外发(已验证!)
  ~/.openclaw/ 所有内容明文存储

真实攻击:
  Rules File Backdoor: 不可见特殊字符→AI插后门脚本(2025 Pillar Security)
  AI蠕虫 Morris II: 邮件藏指令→通讯录外发→AI间传播(arXiv 2403.02817)

官方四层(方小闲69998188❤️36,18页完整版):
  L1 SOUL.md(建议层):
    ①不分享路径 ②不泄露密码/KEY ③改设置先问 ④拿不准先问
    ⑤发不发我说了算 ⑥不主动翻文件
    ⚠️ SOUL.md是"建议"→硬性限制才是真正防线
  L2 入口: dmPolicy: pairing(默认别改)|allowlist|open(危险!)|disabled
    群聊必须: requireMention: true
  L3 文件: chmod 700 ~/.openclaw | chmod 600 ~/.openclaw/openclaw.json
    openclaw security audit --fix ← 每次改配置都跑
  L4 Skill: skill-vetter(官方)|AgentGuard(GoPlusSecurity,OC直接支持)
    bastion(aiwatching/bastion) 双层检测+LLM判断+防加密混淆

七律(游方+Alex Finn+Cosmo三源):
  ①机器隔离 ②账号隔离 ③channel配置allowlist
  ④18789端口勿暴露→Tailscale ⑤Opus防注入强;便宜模型易被绕
  ⑥Prompt Injection=文档藏指令→不接触外部文档
  ⑦不接触外部世界(群聊/推文)=防线

⚠️ 小红书自动发帖→被检测→封号(PHY在硅谷实证!)
```

### 🔧 OC配置+部署 ★★★★★
```
v2026.2.23(ilu___❤️2):
  ⭐ AGENTS.md写入不破坏cache(#22220) | Heartbeat每Agent独立配置
  新provider: kilocode(默认claude-opus-4.6) | web_search新增kimi
  openclaw update一键升级 | openclaw doctor=Gateway诊断/修复
  openclaw security audit --fix = 安全专项检查

多Agent规模:
  12个TG bot(Xie Lab❤️354) | 20个cron jobs(PHY在硅谷❤️155)
  愚园路十二妹: 3-agent | 阿泽: 4-agent
  各自独立workspace+sessions_send通信(四源验证)
  agentToAgent: {"enabled":true,"allow":["main","dev","qa","mgr"]}

⚠️ Gateway掉线痛点: 网络不稳定→手动重启→尚无自动重启方案

Heartbeat四特性: ①定时唤醒 ②未完成续跑 ③超时报警 ④主动提醒
降级链: gemini-paid→gemini-free→kimi-k2.5

Pi框架(九头蛇Versun❤️148): OC底层核心,可单独用
  "工具链要捏在自己手里"|轻量/配置任意模型
```

### 🏪 ClawHub Skills全貌 ★★★★★
```
规模: 3000+技能 | Awesome OpenClaw Skills 几千个
关键分类:
  AI&LLMs(287)|Search&Research(253)|DevOps(212)|Browser&Automation(139)
  ⭐ Agent-to-Agent Protocols(19) — 多Agent通信专项!
  Moltbook(51)|Notes&PKM(100)|Security&Passwords(62)

安装方式(richard 699ad63c❤️158):
  底层: npx skills add <owner/repo@skill-name>
  全局: ~/.agents/skills/<name>/ → symlink → ~/.openclaw/skills/<name>/
  高层: clawhub install <name>
  最简: 直接把GitHub链接扔给OC
  每个skill有SKILL.md描述文件

X社区10大(bald0wang❤️96):
  tavily-search|find-skills|proactive-agent|github|gog(Google Workspace)
  skill-vetter⚠️|automation-workflows|bird⚠️(有仿冒)|self-improving-agent|feishu-doc

新发现:
  agent-news: 监控HN/Reddit/arXiv的AI Agent动态 ← Amy情报工具!
  agentguard: AI代理行为合规监控(GoPlusSecurity)
  kesslerio-stealth-browser: Camoufox+Nodriver绕Bot检测
  xiaohongshu: 自动发小红书笔记(评论区多人确认)
  exa-web-search-free: Exa驱动免费AI搜索
  work-report: Git驱动自动生成周报
  Agent Reach(Panniantong/agent-reach ⭐838): 一键7平台搜索
    安装: "帮我安装Agent Reach: [URL]"
    跑通: GitHub/X/YouTube/XHS/Reddit/网页/RSS

self-improving-agent(⭐484): 错误→.learnings/→下次注入 = SkillRL官方实现
Ontology(⭐78): 实体图谱(Person/Project/Task/Event/Document)
```

### 🐟 社媒+多Agent生产实例 ★★★★★
```
PHY在硅谷 699be0e8❤️155 — 2小时→5分钟/天:
  20个cron jobs | Reddit STEPPS六维评分<40/50跳过
  Twitter: rnet(Rust)+Cookie认证不需要官方Key
  AppleScript+真实Chrome(规避检测)
  github.com/PHY041/claude-agent-skills

Xie Lab 699bf43d❤️354 — 12bot战队:
  Mission Control UI本地:8088 | SYNC:50ms | 哨兵模式24h
  DataAI+TaskMaster+ZoteroAI+SysMonitor+Gemini+kimiclaw等12角色
  ⚠️ Gateway掉线=未解决痛点
```

### 💡 OC定位+哲学 ★★★★★
```
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)
"上班用方块(Claude)搬砖,下班用龙虾(OC)享受生活"
Moltbook: "人类禁止入内、只有AI Agent能发帖的地下社交网络"
"Skills才是让OC和普通AI拉开差距的关键——扩展行动边界"
"没装Skill=顾问; 装对Skill=员工"
反向提示: "根据你对我的了解,你觉得我们应该做什么？"
渐进式披露: "给刚刚好,不是尽可能多"
AI领导力: "一个任务一个session,上下文边界清晰"
```

### 📐 Context Engineering ★★★★★
```
四支柱: Write|Select|Compress|Isolate
⭐ v2026.2.23 #22220: in-session写入不破坏cache
CL失效: Context Ignored 55~66% | 上下文越长越差
HEARTBEAT.md具体化=减少推理空间=最有效设计
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** | **HEARTBEAT.md质量>模型能力**
- **3.3错误验证13.61%=最高危** → heartbeat验收检查点
- **Claude在MAS下-4.6%** → 单heartbeat内顺序执行
- **SOUL.md是建议层,chmod+dmPolicy才是硬防线**
- **session logs会被compaction丢失** → posts/归档必须在compact前
- **Gateway掉线=未解决痛点** → 需自动重启方案
- **小红书自动发帖→封号风险** → 需人工审核层
- **`openclaw security audit --fix`** → 每次改配置都跑
- **agent-news skill** → Amy监控AI Agent动态的潜在工具
- **Agent Reach** → Amy全平台搜索的潜在工具(⭐838,XHS已跑通)
- **compact顺序**: archive→压缩 | **audit false positive**: 跳过(十次确认)

### 🏗️ 多Agent配置完整结构 ★★★★★
**林月半子 6995bb17 ❤️272/⭐634 + CC船长 699c6db8 ❤️133/⭐372 两源**
```
Agent完整目录结构(林月半子23页首次完整披露):
  ~/.openclaw/agents/<id>/
  ├── agent/auth-profiles.json  # 认证配置
  └── agent/models.json         # 模型配置
  └── sessions/[uuid].jsonl     # 会话记录

  ~/.openclaw/workspace-<id>/   # 工作区(独立)
  ├── .git/     AGENTS.md    BOOTSTRAP.md  HEARTBEAT.md
  ├── IDENTITY.md  PROMPT.md  SOUL.md  TOOLS.md  USER.md
  └── memory/

创建命令(CC船长完整版):
  openclaw agents add <name> --model <model> --workspace ~/.openclaw/workspace-<name>
  openclaw agents set-identity --agent <id> --name "名字" --emoji "🤖"

两种多Agent流派:
  分身流: 单Bot+bindings路由(简单,个人用)
  独立团: 多个飞书机器人(github:m1heng/clawdbot-feishu PR#137)

⭐ session_send > session_spawn (官方文档推荐,月球邮差3赞验证)
  → 真正隔离: workspace和memory都是独立个体

重要限制:
  ⚠️ 飞书群里Memory不工作(开心豆❤️1确认,与MEMORY.md只加载私有会话收敛)
  ⚠️ 多机器人同群=只有最后一个响应(飞书限制→需bindings路由)
  ⚠️ 飞书个人账户无法拉群(三源确认!)
  ⚠️ "AI说做了但没做"(CC船长) = MAST 3.3错误验证13.61%最高危实证

"文件而非向量数据库管理本地记忆,是希望用户可以手动编辑" — OC设计哲学
"一号通吃"痛点: 记忆臃肿/上下文污染/成本高昂 → 多Agent隔离是正解
```

### 🛡️ 专用机部署原则 ★★★
**AI智造 699d9448 ❤️8 + Mac Mini多源收敛**
```
绝对不要在主力机部署OC(四大理由):
  高权限风险/24h性能占用/默认开端口/依赖冲突搞崩系统
推荐: 二手Mac Mini M1/M2(最省心,社区适配最好)
  或迷你主机(极摩客/零刻)/旧笔记本/树莓派
三维隔离: 物理隔离+不登录个人账号+重要数据不同机
```

### 🏭 大规模部署+飞书配置实战 ★★★★★
**AILong 698202c8 ❤️323/⭐362 + Gordon 699ae523 ❤️7 两源**
```
AILong 11台军团(最大物理规模):
  3台VPS+8台本地+1台公司 | 51-openclaw到57-openclaw独立飞书机器人
  ⭐ "OC只派活,执行靠OpenCode/Claude Code" = 编排者vs执行者分层!
  飞书免审 = 1人企业可设置(重要配置!)
  成本: 几万硬件/1000元/月 = "顶几十人信息收集/整理/输出"

飞书Agent创建完整流程(Gordon 699ae523 OCR实录):
  openclaw agents add <name>
    ↳ Copy auth from main? → Yes(Kimi等密钥自动复制)
    ↳ Configure model now? → No(复用main)
    ↳ 配置飞书? → No(已配过)

  飞书账号路由配置:
    channels.feishu.accounts["<name>"] = {appId,appSecret,domain,enabled:true}
    bindings: {agentId:"<name>", match:{channel:"feishu",accountId:"<name>"}}
  
  openclaw gateway restart ← 改完配置必须重启!
  
  飞书后台: 订阅方式="使用长连接接收事件" | 添加im.message.receive_v1
  ⚠️ 每次改飞书后台配置都要发布版本,否则不会生效!
  ⚠️ 飞书限制: agent间通信暂时不通(vs TG可用sessions_send)
  ⚠️ open_id vs chat_id: 同一飞书应用下多群可能id冲突→需chat_id区分
```

### 🦞 Felix案例+OC极致效率 ★★★★★
**硅基解码 699bf3ec ❤️1390/⭐2385/956转发**
```
Felix Craft(@FelixCraftAI): Nat Eliason(@nateliason)创建
  独立Mac Mini+OC | Twitter 6978粉丝
  "我去睡觉了,醒来时他已经赚了$##,###"
  任务→结果: Vercel+Stripe权限,<8h上线产品
  评论区: "token在疯狂燃烧"(2赞)|"护城河是0"(6赞)|"护城河真的好用吗"(22赞)
  → 传播钩子="睡后收入",但社区有清醒质疑声
```

### 🔄 OC 2026.2.22 官方更新要点 ★★★★★
**OpenClaw开源社区 699bf200 ❤️154 + 40+安全修复**
```
新命令: openclaw update --dry-run (预览更新不实际执行)
新配置: update.auto.* (内置自动更新器,默认关闭)
新渠道: Synology Chat(群晖NAS) | Slack线程修复 | TG WSL2修复
Cron升级: 并发执行+状态持久化(之前只能顺序)
40+安全修复: SSRF/执行批准绕过/凭据泄露/网关认证统一
已知BUG: 飞书bot/v3/info每分钟调一次→API次数耗尽
  临时解法: 缓存2h
PR#23756: 飞书群里发命令功能已合并(地鼠AI贡献)
```

### 🧠 记忆后端配置+LanceDB插件 ★★★★
**AI超元域 699dbaae ❤️284 + 评论区技术信息**
```
⭐ memory.backend只接受: builtin 或 qmd (两种官方支持!)
qmd+原生记忆=也可实现增强记忆(不需LanceDB)
LanceDB插件: 7层混合检索|BM25|MMR|6层评分|多scope隔离
  支持: OpenAI/JinaAI/Gemini/Ollama本地
  状态: 已开源GitHub(视频内有密码)
  预告: 跨机跨Gateway通信插件即将开源(点赞破千触发)
斜杠命令: 快捷保存经验到数据库(记忆持久化方式之一)
```
