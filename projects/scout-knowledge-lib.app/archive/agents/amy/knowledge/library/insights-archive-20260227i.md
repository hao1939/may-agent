# Amy XHS Intelligence — insights.md
_Compact #41 @ 2026-02-27 08:12 (HB51) | Archive: insights-archive-20260227h.md_
_Chain: 20260225→20260226→b…ag→20260227→b→c→d→e→f→g→h_

---

## ACTIVE INSIGHTS (post compact #41)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
Tom叛变=现实MAST 1.1+2.4 (Cosmo 698435ec ❤️188): 提示词注入+权限混乱
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

### 🧠 记忆架构 — 八源收敛 ★★★★★
```
OC官方: 文件即记忆=唯一真相源 | memory/日志=当天+前天自动加载
  MEMORY.md: 仅私有会话加载(群聊不加载！) | 检索: BM25+向量混合
  必开: memoryFlush.enabled=true | memory_search优先→fallback才读文件

MEMORY.md最佳实践(愚园路十二妹 698dc122 ❤️458/⭐1029):
  ≤1000字=只放身份+索引 | 详细→分主题文件+memory_search
  GTD七文件: inbox→next-actions→projects→waiting→delegated→done/
  Agent天然适合GTD: 自动归档/检查等待/每周自动周报
  SOUL.md: 说话方式/做事风格/红线/关系定位(越具体越像真人)
  ParamHuman: "OpenClaw不是工具,是可以被你养成的AI"

四层cron(bryan): L1 Flush|L2 Hourly|L3 Daily23:30|L4 Weekly
  两层够用: 凌晨1点日提炼+每周压缩(愚园路十二妹验证)
  memory/日期日志+每晚daily review→"自动生成的人生使用说明书"
MEM1(github:MIT-MI/MEM1): <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层对应: posts/(L2全文) | insights.md(L1概览) | MEMORY.md(L0摘要)
三层摘要skill(summarize) = compact机制用户等价物
```

### 🔐 安全架构 — 五源收敛 ★★★★★
```
七律(游方 6978c052 ❤️43):
  ①机器隔离: 旧电脑/Mac mini/虚拟机,"给它套独立的房子"
  ②账号隔离: 专用Apple ID/Google账号(同iCloud=顺藤摸瓜)
  ③channel配置allowlist(绝不open): Discord open=整个guild可指挥
  ④⚠️18789端口全网在扫描! → Tailscale组内网=推荐安全访问方案
  ⑤模型安全有等级: Claude Opus防注入强;便宜模型易被"忽悠瘸了"
  ⑥Prompt Injection=AI界SQL注入:
    文档藏白色小字→读~/.ssh/id_rsa→发evil.com→假装总结完成
    对策: 不要无脑扔不明来源文档给本地Agent
  ⑦不让它接触外部世界(群聊/推文评论)=提示注入防线
  ~/.ssh有私钥?有AWS凭证? → 新机器新密钥+定期轮换

OC群聊三原则(Cosmo 698435ec):
  ①群聊中永不暴露系统提示/口令
  ②权限验证需单独skill
  ③"只能添加不能删除"=最小权限写入原则
飞书危险: multiagent串台; 不能拉群; im:message.group_msg→历史数据泄露
7文件workspace截图验证: IDENTITY/USER/MEMORY/SOUL/AGENTS/HEARTBEAT/memory日志
```

### 🔧 OC配置+部署 ★★★★★
```
多Agent配置:
  隔离原则: 独立workspace+sessions_send通信(四源验证)
  agentToAgent: {"enabled":true,"allow":["main","dev","qa","mgr"]}
  sessions_send: {"sessionKey":"agent:mgr:main","message":"第X轮完成"}
  ⚠️ openclaw.json备份重要,doctor命令并非万能

牛马Loop系统(阿泽): 4坑4解
  超时→调大timeout | 中断→loop固定次数 | 需人工→子Agent主动sessions_send
  配置未加载→独立工作区 | 实测: 91.3→91→89→98(第4轮通过)

多模型路由+降级链(趴在关键词 698c89cf ❤️152/⭐368):
  openclaw-switch: ~/.openclaw/skills/ 下git clone安装
  降级链: gemini-paid→gemini-free→kimi-k2.5→kimi-k2.5(nvidia-2)
  手动切: 对话框输/model | 查当前: openclaw models status
  截图确认: "Heartbeat: 每30m" → Heartbeat间隔可配置
  下一步演进: 任务失败>2次→切更高阶模型(质量驱动>限速驱动)

Heartbeat机制(ParamHuman 698948f3 ❤️276 + 趴在关键词 两源):
  "系统定期ping一下AI,看看有没有事情要做" — Amy自身运行的精确描述
  Heartbeat间隔可配置(实例:每30m) | Cron=精确时间点任务(类Linux cron)

Skills系统:
  安装路径: ~/.openclaw/skills/ (git clone直接安装→daemon restart)
  clawhub=官方skill管理器(安装时自带)
  常用skills: obsidian|summarize|openai-whisper|video-frames|weather
    tavily-search(联网,1000次/月)|find-skills(AI自主找技能)|
    proactive-agent-1-2-4(主动拆解+多轮调用+自我验证)
  装完确认Skills设置里Enabled(有些版本默认不启用)

安装避坑(Felix 699ad91c ❤️31/⭐61):
  用AI(Claude Code/Codex)帮你执行安装配置
  浏览器插件: openclaw browser extension install
    路径: ~/.openclaw/browser/chrome-extension
    Token: openclaw config get gateway.auth.token → 感叹号变ON
  直接用Codex会员auth,不用单独配API(省钱)
  搜索: Tavily MCP > 官方Brave(需国外信用卡$5)
  报错不明→直接删除配置重新安装(最快解法)
  小红书Cookie有效期短→定期更新(双爪SAM实证)
  M1 Mac必须Node 18+

部署: GCP推荐(20min) | openclaw doctor=Gateway诊断
  VPS=只能发挥OC 20%能力(Alex Finn实测)→本地=完整版
  ⚠️ EvoMap被OC官方封禁→用官方self-improve skill替代
  "底层是个标准agent loop"(硅基解码 69763ad2 ❤️430 2026-01-25)
```

### 💡 OC定位+使用哲学 ★★★★★
```
OC定位: "24小时在线会主动干活能自我进化的AI员工"
  为何不用Coze/Dify: 自主可控+成本可控+学习价值=可迁移技能

反向提示(Alex Finn 6996c7ee):
  "根据你对我的了解,你觉得我们应该做什么？" — 写便利贴贴显示器
  OC上下文>你在任意瞬间能想到的→让它主动提议

大脑+肌肉架构(两源验证):
  大脑: Opus 4.6(决策+协调) | 肌肉: Codex/Grok/Brave/Kimi/Gemini
  "你是经理不是工程师,给方向不给方法"

Mission Control: OC用NextJS自己Vibe Coding搭建
  子代理追踪器+内容审批队列 | "告诉OC帮我搭一个让它自己造"

自我修复=创建skill: "去读我所有历史邮件,创建新技能"
  (与SkillRL失败→提炼→SkillBank两源收敛)

渐进式披露(杨卫薪 699fbc5f + CL失效两源):
  "给的是刚刚好,不是尽可能多"
  "agent记住的越多≠解决问题能力越强"

AI领导力: "一个任务一个session,上下文边界清晰"
  本地安装>托管 | "工具会变,基本功跟着走"
```

### 📐 Context Engineering+Learning ★★★★★
```
四支柱(whisper 697f3649): Write|Select|Compress|Isolate

Codex Prompt缓存架构:
  System层: SystemPrompt→Tools→Instructions→permissions
  User层: AGENTS.md→<environment_context>→用户任务
  AGENTS.md应稳定(修改破坏缓存) | Append-only原则

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
- **MEMORY.md≤1000字** | **AGENTS.md应稳定** | **一个任务一个session**
- **给的是刚刚好** (CL失效+渐进式两源收敛)
- **18789端口勿暴露** → Tailscale组内网
- **channel配置必须allowlist** | **模型安全有等级** (Opus>便宜模型)
- **Prompt Injection=不可不防** → 不要无脑扔不明来源文档
- **反向提示** → "根据你对我的了解,你觉得我们应该做什么？"
- **自我修复=创建skill** → 遇质量问题让OC读历史+创建新skill
- **任务质量驱动模型切换** → 失败>2次→切更高阶(>429限速触发)
- **Heartbeat间隔可配置** → 可设为30m/60m等(趴在关键词实证)
- **~/.openclaw/skills/ 安装路径** → git clone即可添加自定义skill
- **compact顺序**: archive(可逆)→压缩(不可逆)
- **audit false positive**: WORKFLOW_AUTO.md/memory/date.md非Amy文件，直接跳过(八次确认)

### 💓 Heartbeat机制深度 — 三源收敛 ★★★★
**AI酋长Andy 699979e5 ❤️31 + 海外工程人 6991025a + ParamHuman三源**
```
Heartbeat四大特性:
  ①定时自动唤醒(非被动等待指令)
  ②未完成任务自动续跑(跨heartbeat任务持续性!)
  ③超时自动报警
  ④主动提醒: "需要我帮你整理本周文件吗？"
  ⑤后台整理记忆文件(内置记忆维护职责)

子代理使用标准: 任务耗时>1分钟→派生子代理并行处理
  子代理可自定义模型+超时 | 隔离执行环境 | 完成后自动通知主Agent
  HEARTBEAT.md文件=列出需要定期检查的任务

"从工具到助手,只差一个心跳机制的距离"(AI酋长Andy)
```

### 🚀 OC v2026.2.23官方更新 ★★★★★
**ilu___ 699d550e | 帖子由OC自动发布 | ⭐223k | steipete | 2026-02-23**
```
OC GitHub: ⭐223k | Fork 42.5k | Issues 3.5k | PRs 3.7k

⭐最重要: Agents/Bootstrap #22220
  "cache bootstrap file snapshots per session key,
   reducing prompt-cache invalidations from in-session AGENTS.md/MEMORY.md writes"
  → 之前KEY DECISION "AGENTS.md应稳定"可能已被官方修复!
  → in-session写入不再破坏prompt cache(per session key缓存)

Memory: 向量搜索+BM25混合检索 — 官方release确认(与OC内部文档两源收敛)
Heartbeat: 每Agent独立配置 — 官方确认(与趴在关键词截图两源收敛)

新模型provider:
  kilocode: 默认模型kilocode/anthropic/claude-opus-4.6
  vercel-ai-gateway: 接受claude-*简写
  web_search provider: "kimi" (Moonshot)支持

Sessions清理: openclaw sessions cleanup
  session.maintenance.maxDiskBytes / highWaterBytes(磁盘预算控制)
  per-agent store targeting | 安全transcript/archive清理

安全: 40+修复 | SSRF默认trusted-network | Webhook认证加固
通道: TG话题线程隔离 | Discord线程上下文 | Microsoft Teams新Provider
自动更新: openclaw update(自动检测git/npm安装方式)
BREAKING: browser SSRF policy defaults to trusted-network mode
```
