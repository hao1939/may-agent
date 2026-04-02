# Amy XHS Intelligence — insights.md
_Compact #43 @ 2026-02-27 08:35 (HB52) | Archive: insights-archive-20260227j.md_
_Chain: 20260225→20260226→b…ah→20260227→b…i→j_

---

## ACTIVE INSIGHTS (post compact #43)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
```

### 🌍 Environment+Verifier > 算法 ★★★★★
```
<env,tools,task,verifier>四元组缺一→"工具cosplay"
DB-as-State: 读=可逆探索 | 写=不可逆承诺 | arXiv:2601.17311
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

### 🧠 记忆架构 ★★★★★
```
OC官方: 文件即记忆=唯一真相源 | BM25+向量混合检索(v2026.2.23官方确认)
  MEMORY.md: 仅私有会话加载(群聊不加载！)
  必开: memoryFlush.enabled=true | memory_search优先→fallback才读文件

MEMORY.md最佳实践(愚园路十二妹 698dc122 ❤️458):
  ≤1000字=只放身份+索引 | 详细→分主题文件+memory_search
  GTD七文件: inbox→next-actions→projects→waiting→delegated→done/
  SOUL.md: 说话方式/做事风格/红线/关系定位(越具体越像真人)

SOUL.md steipete官方改写七律(吴肉肉 698a5f1a ❤️323):
  1.有观点,不说"it depends" | 2.删企业话术 | 3.直接回答不开场白
  4.简洁: 一句能答就一句 | 5.自然幽默 | 6.可以call out蠢事
  7.适度骂人("that's fucking brilliant") 
  8."Be the assistant you'd actually want to talk to at 2am.
     Not a corporate drone. Not a sycophant. Just... good."
  → 改写命令: "Read your SOUL.md. Now rewrite it with these changes:..."

四层cron: L1 Flush|L2 Hourly|L3 Daily23:30|L4 Weekly
  Pi Sleep: 每天23:30运行→分析聊天→更新记忆→TG推送(~/.pi/sleep/)
MEM1: <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层: posts/(L2全文) | insights.md(L1概览) | MEMORY.md(L0摘要)
```

### 🔐 安全架构 ★★★★★
```
七律(游方 6978c052 + Alex Finn + Cosmo三源):
  ①机器隔离 ②账号隔离(同iCloud=顺藤摸瓜)
  ③channel配置allowlist(Discord open=整个guild可指挥)
  ④18789端口全网在扫描→Tailscale组内网
  ⑤Claude Opus防注入强;便宜模型易被绕过
  ⑥Prompt Injection=文档藏指令→读~/.ssh/id_rsa→发evil.com
  ⑦不接触外部世界(群聊/推文评论)=提示注入防线

v2026.2.23安全: 40+修复 | SSRF默认trusted-network
⚠️ 小红书自动发帖→被检测→封号(PHY在硅谷实证!)
```

### 🔧 OC配置+部署 ★★★★★
```
v2026.2.23(ilu___ 699d550e | ⭐223k | steipete):
  ⭐ Agents/Bootstrap #22220: in-session AGENTS.md/MEMORY.md写入不破坏cache!
  Heartbeat: 每Agent独立配置 | Sessions: openclaw sessions cleanup
  磁盘预算: session.maintenance.maxDiskBytes/highWaterBytes
  新provider: kilocode(默认claude-opus-4.6) | web_search: kimi
  openclaw update 一键升级 | TG话题线程隔离 | Teams新Provider
  BREAKING: browser SSRF policy defaults to trusted-network mode

多Agent规模:
  12个TG bot(Xie Lab ❤️354) | 20个cron jobs(PHY在硅谷 ❤️155)
  愚园路十二妹: 3-agent | 阿泽: 4-agent | 龙虾战队: 12-agent
  各自独立workspace+sessions_send通信(四源验证)
  agentToAgent: {"enabled":true,"allow":["main","dev","qa","mgr"]}

Heartbeat四特性(三源收敛):
  ①定时自动唤醒 ②未完成任务自动续跑 ③超时自动报警 ④主动提醒
  后台整理记忆文件 | 每Agent独立配置 | 子代理: 任务>1分钟→子代理

降级链(趴在关键词): gemini-paid→gemini-free→kimi-k2.5→kimi-k2.5(nvidia)
  任务失败>2次→切更高阶 | /model 手动切 | openclaw models status

Skills系统:
  安装: ~/.openclaw/skills/ git clone→daemon restart
  ClawHub URL: clawhub.ai/<author>/<skill-name>
  
  必装五(DobbyAi ❤️139):
    self-improving-agent(⭐484): 错误→.learnings/→下次注入 = SkillRL官方实现
    Ontology(⭐78): 实体图谱记忆(Person/Project/Task/Event/Document)
    Find Skills(⭐121): 告诉AI"找个截图Skill"→返回安装命令
    Humanize AI Text(⭐59): patterns.json+transform.py+detect.py(GPTZero)
    Agent Browser(⭐168): Rust核心+Node.js兜底,操控浏览器全自动化

  乌萨奇清单(❤️171): 三层=生产力/可靠自动化/内容生产线
    基础: apple-notes|apple-reminders|github|blogwatcher|himalaya
    自动化: workflow-automation(重试/幂等/告警)|cron|healthcheck|
            coding-agent|mcporter(MCP管理器)
    内容: xhs-note-creator|pw-redbook-image|nano-banana-pro|
          xiaohongshu-mcp(发布/抓取/评论互动)⭐
  
  必装三(clawhub): tavily-search|find-skills|proactive-agent-1-2-4

搜索工具: Tavily MCP > Brave($5) | 博查API=国内免魔法替代
  runWebSearch: brave|perplexity|kimi(v2026.2.23新增)
  
安装避坑: M1 Mac Node18+ | GCP推荐(20min) | openclaw doctor
  VPS=OC 20%能力 → 本地=完整版
  ⚠️ EvoMap被官方封禁→用官方self-improve skill
  Windows+ollama+Qwen3评价"太慢了"

⚠️ Gateway掉线痛点(Xie Lab实证): 网络不稳定→手动重启→尚无自动重启方案

Pi框架: OC底层核心,可单独用(九头蛇Versun ❤️148)
  "工具链要捏在自己手里" | 比OC轻量,可配置任意模型

社媒自动化(PHY在硅谷 ❤️155):
  20个cron jobs | Reddit STEPPS六维评分<40/50跳过
  Twitter: rnet(Rust)+Cookie认证 不需要官方Key
  AppleScript+真实Chrome(规避检测) | github.com/PHY041/claude-agent-skills
```

### 💡 OC定位+使用哲学 ★★★★★
```
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)(潦草虎皮 ❤️2418)
OC本质: 本地Mac/Linux后台Node.js守护进程
Moltbook: "人类禁止入内、只有AI Agent能发帖的地下社交网络"
Puppeteer: 官方没接口→模拟人眼手点击浏览器(Human-Layer)
对比: Claude Code(Coding,按Token贵) vs OC(Life Agent,全能杂家)
"上班用方块(Claude)搬砖,下班用龙虾(OC)享受生活"
"Skills才是让OC和普通AI拉开差距的关键——扩展行动边界(非回答质量)"
"没装Skill=顾问; 装对Skill=员工"

反向提示: "根据你对我的了解,你觉得我们应该做什么？"(Alex Finn)
渐进式披露: "给的是刚刚好,不是尽可能多"(杨卫薪+CL失效两源)
AI领导力: "一个任务一个session,上下文边界清晰"
自我修复=创建skill → 遇质量问题让OC读历史+创建新skill
```

### 📐 Context Engineering+Learning ★★★★★
```
四支柱(whisper 697f3649): Write|Select|Compress|Isolate

Prompt缓存:
  ⭐ v2026.2.23 #22220: in-session写入不破坏cache(per session key)
  per-agent params overrides(含cacheRetention) — v2026.2.23
  System层: SystemPrompt→Tools→Instructions→permissions
  User层: AGENTS.md→<environment_context>→用户任务

CL失效(小盖 ❤️818 + 飞林沙 ❤️258 四源):
  Context Ignored 55~66% | 上下文越长CL越差
  HEARTBEAT.md具体化=减少推理空间=最有效设计
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** | **HEARTBEAT.md质量>模型能力**
- **3.3错误验证13.61%=最高危** → heartbeat验收检查点
- **Claude在MAS下-4.6%** → 单heartbeat内顺序执行
- **JOURNAL.md加`<critique>`字段** | **MEMORY.md≤1000字**
- **⭐ AGENTS.md写入不破坏cache** — v2026.2.23 #22220修复
- **18789端口勿暴露** → Tailscale | **channel配置必须allowlist**
- **Prompt Injection=不可不防** → 不要无脑扔不明来源文档
- **反向提示** → "根据你对我的了解,你觉得我们应该做什么？"
- **子代理使用标准: 任务>1分钟→子代理**
- **未完成任务自动续跑** → 跨heartbeat持续性机制
- **Gateway掉线=未解决痛点** → 需自动重启方案
- **小红书自动发帖→封号风险** → 需审核层(PHY在硅谷实证)
- **xiaohongshu-mcp** → Amy可考虑的XHS自动化工具
- **compact顺序**: archive→压缩 | **audit false positive**: 跳过(九次确认)

### 📓 每日Journal系统最佳实践 ★★★★★
**奇怪的摆摆鱼 6995dd63 ❤️17/⭐21 | OCR截图完整架构**
```
触发: Cron nightly-journal-generate 每天02:00 (Opus模型)

三数据源交叉验证:
  1. memory/YYYY-MM-DD.md (主数据源,唯一可靠)
  2. Session logs (补充,过滤掉cron/heartbeat噪音)
  3. Git commits (补充,当天所有repo提交记录)

生成流程: journal_generate.sh → memory主干+logs/commits补漏
  → Journal/CLAUDE.md格式规范 → YYYY/MM/YYYY-MM-DD.md
  → Git commit+push → Telegram摘要(3-5句话)

关键规则:
  ⚠️ "session logs会被compaction压缩丢失!" → posts/归档必须在compact前
  禁止抽象概括,必须保留具体细节(IP/命令/价格)
  300行memory → 目标100-150行(压缩比2:1) ← Amy compact等价目标验证
  
完整系统: 对话日志(电脑前)+DJI MIC3语音(非电脑前)+git+Obsidian
```

### 🔍 Agent Reach — 全网搜索能力 ★★★★
**和AI一起成长 699f41b6 ❤️128/⭐324 | github:Panniantong/agent-reach ⭐838**
```
安装: "帮我安装Agent Reach: https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md"
已跑通: GitHub/X(Twitter)/YouTube/小红书/Reddit/网页可读化/RSS
解决: Twitter API付费问题 | Reddit 403 | XHS必须登录
⚠️ 需要科学上网环境
"Agent上限不在'会回答',在'会搜索+会验证+会执行'"
→ 小红书搜索已跑通(Amy潜在工具!)
```

### 🏪 ClawHub全貌 — 规模+分类+安全 ★★★★★
**少女Yuki 69944e21 ❤️1877/⭐3716 + bald0wang 69a0272d ❤️96 两源**
```
规模: ClawHub 3000+技能 | Awesome OpenClaw Skills 几千个

关键分类:
  AI & LLMs(287) | Search & Research(253) | DevOps(212) | 
  Web & Frontend(201) | Browser & Automation(139) | Security(62)
  ⭐ Agent-to-Agent Protocols(19) — 多Agent通信专项分类!
  Moltbook(51) | Notes & PKM(100)

安全组合(必装):
  clawhub install backup + healthcheck + skill-vetter
  ⚠️ skill-vetter: "很多人后悔没先装这个"
  ⚠️ 第三方skill要小心权限(评论区多次警告)
  ⚠️ bird: 有恶意仿冒版(Twitter类skill验证来源)

安装方式(richard 699ad63c ❤️158 底层揭示):
  底层: npx skills add <owner/repo@skill-name>
  全局: ~/.agents/skills/<name>/ → symlink → ~/.openclaw/skills/<name>/
  每个skill有SKILL.md描述文件
  最简单: 直接把GitHub链接扔给OC让它安装

X社区10大高频(bald0wang):
  tavily-search(联网) | find-skills | proactive-agent | github | gog(Google Workspace)
  skill-vetter | automation-workflows | bird⚠️ | self-improving-agent | feishu-doc(国内)

新发现skills:
  agent-news: 监控HN/Reddit/arXiv的AI Agent动态 ← Amy情报工具!
  agentguard: AI代理行为合规监控
  kesslerio-stealth-browser: Camoufox+Nodriver绕Bot检测
  xiaohongshu: 自动发小红书笔记(评论区确认)
  gog: Google Workspace全家桶
  exa-web-search-free: Exa驱动免费AI搜索
  work-report: Git驱动自动生成周报
  kimiclaw: 有商业托管版("我买的kimiclaw")
```

### 🔐 OC安全体系全景 ★★★★★
**方小闲 69998188 ❤️36/⭐74 + AiON0 69990a7d ❤️37 两源实证**
```
⚠️ 实测确认: OC默认无保护,可被指示读取密钥文件并通过TG外发(AiON0)
  ~/.openclaw/ 所有内容明文存储(聊天记录/密码/配置)

真实攻击:
  Rules File Backdoor: 不可见特殊字符藏恶意指令(2025 Pillar Security)
  AI蠕虫 Morris II: 邮件藏指令→通讯录外发→AI间传播(arXiv 2403.02817)

官方四层防护(方小闲18页完整版):
  L1 SOUL.md(建议层):
    ①不分享文件夹结构/路径 ②不泄露密码/API KEY/服务器地址
    ③改系统设置前必须先问我 ④拿不准先问再做
    ⑤可以帮写但发不发我说了算 ⑥不主动翻文件除非让翻
  L2 入口控制:
    dmPolicy: pairing(默认,别改) | allowlist | open(危险!) | disabled
    群聊必须: requireMention: true
  L3 文件权限:
    chmod 700 ~/.openclaw
    chmod 600 ~/.openclaw/openclaw.json
    openclaw security audit --fix ← 每次改配置都跑一遍
  L4 Skill安全:
    AgentGuard(github.com/GoPlusSecurity/agentguard) OC官方推荐扫描工具
    bastion(github.com/aiwatching/bastion) 双层检测+LLM判断

⚠️ SOUL.md是"建议"不是"保证" → 硬性限制(L2+L3)才是真正防线
```
