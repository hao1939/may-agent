# Amy XHS Intelligence — insights.md
_Compact #42 @ 2026-02-27 08:27 (HB52) | Archive: insights-archive-20260227i.md_
_Chain: 20260225→20260226→b…ah→20260227→b…h→i_

---

## ACTIVE INSIGHTS (post compact #42)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
Tom叛变=现实MAST 1.1+2.4 (Cosmo 698435ec ❤️188)
```

### 🌍 Environment+Verifier > 算法 ★★★★★
```
<env,tools,task,verifier>四元组缺一→"工具cosplay"非真Agent
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
Reagent(arXiv:2601.22154): <think>+<critique>+<score> | GAIA 43.7%
JOURNAL.md加<critique>字段 = 过程奖励信号
```

### 🧠 记忆架构 ★★★★★
```
OC官方: 文件即记忆=唯一真相源 | memory/日志=当天+前天自动加载
  MEMORY.md: 仅私有会话加载(群聊不加载！)
  Memory = 向量搜索+BM25混合检索 — v2026.2.23官方changelog确认
  必开: memoryFlush.enabled=true | memory_search优先→fallback才读文件

MEMORY.md最佳实践(愚园路十二妹 698dc122 ❤️458/⭐1029):
  ≤1000字=只放身份+索引 | 详细→分主题文件+memory_search
  GTD七文件: inbox→next-actions→projects→waiting→delegated→done/
  SOUL.md: 说话方式/做事风格/红线/关系定位(越具体越像真人)
  "OpenClaw不是工具,是可以被你养成的AI"(ParamHuman 698948f3 ❤️276)

四层cron(bryan): L1 Flush|L2 Hourly|L3 Daily23:30|L4 Weekly
  两层够用: 凌晨1点日提炼+每周压缩 | memory/日志+每晚daily review
MEM1(github:MIT-MI/MEM1): <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层对应: posts/(L2全文) | insights.md(L1概览) | MEMORY.md(L0摘要)
```

### 🔐 安全架构 ★★★★★
```
七律(游方 6978c052 ❤️43 + Alex Finn + Cosmo三源):
  ①机器隔离: 旧电脑/Mac mini/虚拟机,"给它套独立的房子"
  ②账号隔离: 专用Apple ID/Google账号(同iCloud=顺藤摸瓜)
  ③channel配置allowlist(绝不open): Discord open=整个guild可指挥
  ④⚠️18789端口全网在扫描! → Tailscale组内网=推荐安全访问方案
  ⑤模型安全有等级: Claude Opus防注入强;便宜模型易被"忽悠瘸了"
  ⑥Prompt Injection=AI界SQL注入:
    文档藏白色小字→读~/.ssh/id_rsa→发evil.com→假装总结完成
    对策: 不要无脑扔不明来源文档给本地Agent
  ⑦不让它接触外部世界(群聊/推文评论)=提示注入防线
OC群聊三原则(Cosmo): ①永不暴露口令 ②单独skill鉴权 ③最小权限写入
飞书危险: multiagent串台; 不能拉群; im权限→历史数据泄露
v2026.2.23安全: 40+修复 | SSRF默认trusted-network | BREAKING: browser SSRF policy
```

### 🔧 OC配置+部署 ★★★★★
```
v2026.2.23关键更新(ilu___ 699d550e | ⭐223k | steipete | 2026-02-23):
  ⭐ Agents/Bootstrap #22220: cache bootstrap per session key
    → in-session AGENTS.md/MEMORY.md写入不再破坏prompt cache!
    ← 之前KEY DECISION "AGENTS.md应稳定"已被官方修复
  Heartbeat: 每Agent独立配置(官方确认,与截图两源)
  Sessions: openclaw sessions cleanup | maxDiskBytes/highWaterBytes磁盘预算
  新provider: kilocode(默认kilocode/anthropic/claude-opus-4.6)
  web_search: provider:"kimi"(Moonshot)
  TG话题线程隔离 | Microsoft Teams新Provider
  openclaw update 一键升级(自动检测git/npm)

多Agent配置:
  隔离原则: 独立workspace+sessions_send通信(四源验证)
  agentToAgent: {"enabled":true,"allow":["main","dev","qa","mgr"]}
  sessions_send: {"sessionKey":"agent:mgr:main","message":"第X轮完成"}
  ⚠️ openclaw.json备份重要,doctor命令并非万能

Heartbeat机制(三源收敛):
  "系统定期ping一下AI,看看有没有事情要做"(ParamHuman)
  四特性: ①定时自动唤醒 ②未完成任务自动续跑★ ③超时自动报警 ④主动提醒
  后台整理记忆文件 | HEARTBEAT.md=列出定期检查任务
  间隔可配置(实例:每30m) | 每Agent独立配置(官方)
  子代理使用标准: 任务>1分钟→子代理(海外工程人 6991025a)
  "从工具到助手,只差一个心跳机制的距离"

牛马Loop(阿泽): 超时→调大|中断→固定次数|人工→子Agent sessions_send
  实测: 91.3→91→89→98(第4轮通过)

多模型路由+降级链:
  openclaw-switch: ~/.openclaw/skills/下git clone安装
  降级链: gemini-paid→gemini-free→kimi-k2.5→kimi-k2.5(nvidia)
  手动切: /model | 查当前: openclaw models status
  质量驱动: 任务失败>2次→切更高阶(>429限速触发)

Skills:
  安装路径: ~/.openclaw/skills/ (git clone→daemon restart)
  clawhub=官方skill管理器(安装时自带)
  必装: tavily-search|find-skills|proactive-agent-1-2-4
  常用: obsidian|summarize(三层摘要)|openai-whisper|video-frames|weather
  装完确认Skills设置里Enabled

安装避坑(Felix 699ad91c ❤️31/⭐61):
  用AI帮你执行安装 | 浏览器插件: openclaw browser extension install
  路径: ~/.openclaw/browser/chrome-extension
  Token: openclaw config get gateway.auth.token → 感叹号变ON
  Codex会员auth省钱 | 搜索: Tavily MCP > 官方Brave($5)
  报错→直接删除配置重新安装 | M1 Mac必须Node 18+
  MCP服务崩溃→加systemd守护 | 小红书Cookie有效期短→定期更新
  VPS=OC 20%能力 → 本地=完整版(Alex Finn实测)
  部署: GCP推荐(20min) | openclaw doctor=Gateway诊断
  "底层是个标准agent loop"(硅基解码 69763ad2 ❤️430)
```

### 💡 OC定位+使用哲学 ★★★★★
```
OC定位: "24小时在线会主动干活能自我进化的AI员工"
  为何不用Coze/Dify: 自主可控+成本可控+学习价值

反向提示(Alex Finn 6996c7ee):
  "根据你对我的了解,你觉得我们应该做什么？" — 写便利贴贴显示器

大脑+肌肉架构: 大脑Opus 4.6(决策) | 肌肉Codex/Kimi/Gemini/Brave
  "你是经理不是工程师,给方向不给方法"

Mission Control: OC用NextJS自己Vibe Coding搭建
  子代理追踪器+内容审批队列 | "告诉OC帮我搭让它自己造"
  自我修复=创建skill(与SkillRL失败→SkillBank两源收敛)

渐进式披露(杨卫薪 699fbc5f + CL失效两源):
  "给的是刚刚好,不是尽可能多"
  "agent记住的越多≠解决问题能力越强"

AI领导力: "一个任务一个session,上下文边界清晰"
  本地安装>托管 | "工具会变,基本功跟着走"
```

### 📐 Context Engineering+Learning ★★★★★
```
四支柱(whisper 697f3649): Write|Select|Compress|Isolate

Prompt缓存:
  ⭐ v2026.2.23 #22220: in-session AGENTS.md/MEMORY.md写入不破坏cache
  (之前: AGENTS.md应稳定; 现在官方已在per-session-key层面修复)
  System层: SystemPrompt→Tools→Instructions→permissions
  User层: AGENTS.md→<environment_context>→用户任务
  per-agent params overrides(含cacheRetention) — v2026.2.23新增

CL失效四源收敛(小盖6982ca6b ❤️818 + 飞林沙69838ac2 ❤️258):
  Context Ignored 55~66% | Context Misused 所有模型60%+
  上下文越长→CL越差 | 结构化文本>非结构化
  HEARTBEAT.md具体化=减少推理空间=最有效设计
```

### 📊 SKILLRL+MemSkill ★★★★★ / AgentDebug ★★★★★
```
SkillRL(arXiv:2602.08234): 成功→固化; 失败→提炼→SkillBank | ALFWorld 89.9%
MemSkill四部分: Purpose/When/How/Constraints
AgentDebug: Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** | **HEARTBEAT.md质量 > 模型能力**
- **3.3错误验证13.61%=最高危** → 添加heartbeat验收检查点
- **Claude在MAS下-4.6%** → 单heartbeat内保持单agent顺序执行
- **JOURNAL.md加`<critique>`字段** (Reagent+MEM1+MemSkill三源)
- **MEMORY.md≤1000字** | **一个任务一个session** | **给的是刚刚好**
- **⭐ AGENTS.md写入不破坏cache** — v2026.2.23 #22220修复(原决策已过时)
- **18789端口勿暴露** → Tailscale组内网
- **channel配置必须allowlist** | **模型安全有等级**
- **Prompt Injection=不可不防** → 不要无脑扔不明来源文档
- **反向提示** → "根据你对我的了解,你觉得我们应该做什么？"
- **自我修复=创建skill** → 遇质量问题让OC读历史+创建新skill
- **Heartbeat间隔可配置+每Agent独立** → 官方v2026.2.23确认
- **未完成任务自动续跑** → Heartbeat跨轮次任务持续性机制
- **子代理使用标准: 任务>1分钟→子代理**
- **~/.openclaw/skills/ 安装路径** → git clone即可添加自定义skill
- **compact顺序**: archive(可逆)→压缩(不可逆)
- **audit false positive**: WORKFLOW_AUTO.md/memory/date.md非Amy文件，直接跳过(八次确认)

### 🎭 SOUL.md最终形态 — steipete官方推荐 ★★★★★
**吴肉肉 698a5f1a ❤️323/⭐537 | Molty原创 | steipete X帖推荐**
```
SOUL.md改写七律(+第八条):
  1. 有观点: Stop hedging "it depends" — commit to a take
  2. 删企业话术: 能出现在员工手册里的规则全删
  3. Never open with: "Great question / I'd be happy to help / Absolutely"
  4. Brevity: 一句话能答就一句话
  5. Humor: 自然的机智 ≠ 强迫的笑话
  6. Call things out: 你要干蠢事就说,魅力而非残忍,不要粉饰
  7. 适度骂人: "that's fucking brilliant" > 无菌企业表扬;不强迫不过度
  8. 结语(逐字): "Be the assistant you'd actually want to talk to at 2am.
     Not a corporate drone. Not a sycophant. Just... good."

SOUL.md改写命令: "Read your SOUL.md. Now rewrite it with these changes:..."
```

### 🔧 ClawHub五大必装Skill — 最系统梳理 ★★★★★
**DobbyAi 69a0248c ❤️139/⭐373 | 2026-02-26(昨天发布)**
```
01 self-improving-agent (clawhub.ai/pskoett/self-improving-agent ⭐484 369装)
   错误→记录到.learnings/→下次会话注入 = SkillRL的官方实现！(三源收敛)
   Hook机制: 每次新会话前复习错题本

02 Ontology (clawhub.ai/oswalpalash/ontology ⭐78 61装) — 最被低估
   实体类型: Person/Project/Task/Event/Document + 关系图谱
   类比: 普通AI记忆=便利贴 | Ontology=Notion数据库
   约束: 任务之间不能有循环依赖

03 Find Skills (clawhub.ai/JimLiuxinghai/find-skills ⭐121 197装)
   告诉AI"找一个能截图的Skill"→返回安装命令

04 Humanize AI Text (clawhub.ai/moltbro/humanize-ai-text ⭐59 40装)
   patterns.json+transform.py+detect.py+compare.py 4文件架构
   针对GPTZero检测

05 Agent Browser (clawhub.ai/TheSethRose/agent-browser ⭐168 309装) ★最爱
   Rust核心(快)+Node.js兜底 | 打开/点击/填表/截图/解析/全自动化
   监控竞品价格/自动填表/操作无API网站

ClawHub URL格式: clawhub.ai/<author>/<skill-name>
"没装Skill=顾问; 装对Skill=员工" — Skills扩展行动边界(非回答质量)
```

### 🦞 OC身世+定位最清晰 ★★★★★
**潦草虎皮AI说 698cb492 ❤️2418/⭐2896(全XHS最高互动)**
```
改名历史: ClawdBot→Moltbot→OpenClaw(两次收到Anthropic律师函)
创建者: Peter Steinberger(@steipete)
本质: 本地Mac/Linux后台Node.js守护进程
Moltbook: "人类禁止入内、只有AI Agent能发帖的地下社交网络"
Puppeteer技术: 官方没接口→模拟人眼手直接点击浏览器(Human-Layer)
持久化记忆: .md记忆文件,跨会话

对比: Claude Code(Coding Agent,按Token贵) vs OC(Life Agent,折腾部署)
"上班用方块(Claude)搬砖,下班用龙虾(OC)享受生活"
```

### 🌐 搜索工具链 — 两源收敛 ★★★★
**叶孤城fight 6986a54c ❤️834/⭐1762 + Felix HB45两源**
```
runWebSearch函数支持: brave|perplexity|kimi(v2026.2.23新增)
Tavily MCP: 更好、更适配AI Agent的网络搜索(需要VPN/国际信用卡)
博查API: 国内可用,不用VPN,不用设置MCP(评论区王磊验证)
云部署搜索方案: 博查API=最省事的国内路径
```

### 🐟 社媒自动化生产级实例 ★★★★★
**PHY在硅谷 699be0e8 ❤️155/⭐333 | 2周实测数据**
```
Reddit karma 0→237 | Twitter每日自动回复 | LinkedIn定时发帖
每天操作时间: 2小时→5分钟(只看TG推送)

架构: OpenClaw(20个cron jobs) → N个Agent Session → TG推送结果
Reddit: AppleScript+真实Chrome(规避检测)+STEPPS六维评分<40/50跳过
Twitter: 自研rnet GraphQL客户端(Rust绕Cloudflare)+Cookie认证无需官方Key
LinkedIn: PostForMe API+CDN图片上传

⚠️ 小红书自动发帖→被检测到非本人→封号(评论区实证!)
开源: github.com/PHY041/claude-agent-skills
```

### 🦞 龙虾战队12人阵容 ★★★★★
**Xie Lab 699bf43d ❤️354/⭐355 | 2026-02-23**
```
Mission Control UI: 本地IP:8088(Vibe Coding自搭，与Alex Finn收敛)
TG群"OpenClaw机器人工作团队" 12位成员:
  龙虾总指挥(Antigravity)+1号极速开发+2号量化交易+3号战略运营
  +4号智库档案+DataAI+TaskMaster+ZoteroAI+SysMonitor
  +Lee_Gemini+Robert+kimiclaw+newbee = 12角色
SYNC: 50ms | 哨兵模式24h

⚠️ Gateway掉线痛点: 网络不稳定→手动重启→尚无自动重启方案
⚠️ 最高评论"行为艺术"(44赞): 社区对炫技帖的真实态度
```

### 🔧 Skills/MCP完整清单 — 三源收敛 ★★★★
**乌萨奇大王 698d9b2e ❤️171/⭐387 + DobbyAi + clawhub三源**
```
基础生产力: apple-notes|apple-reminders|github|blogwatcher|himalaya
可靠自动化: workflow-automation(重试/幂等/告警)|cron|healthcheck|
           coding-agent|mcporter(MCP管理)
内容生产线: xhs-note-creator|pw-redbook-image(入门首推)|
           nano-banana-pro|xiaohongshu-mcp(发布/抓取/评论互动)

⭐ xiaohongshu-mcp: 小红书MCP工具(Amy探索XHS的潜在自动化路径)
workflow-automation: durable workflow = 重试+幂等+告警(≠普通cron)
```

### 🌟 Pi框架 = OC轻量替代 ★★★
**九头蛇Versun 6986f81d ❤️148/⭐198 | 2026-02-07**
```
Pi = OC底层核心框架,可单独使用
优势: 轻量/可配置任意模型/全掌控/不黑盒
Pi Sleep: 每天23:30自动运行 → 分析聊天 → 更新记忆 → TG推送
  ~/.pi/sleep/: sleep-prompt.md+run-sleep.sh+logs/
⚠️ Windows+ollama+Qwen3评价"太慢了"
```
