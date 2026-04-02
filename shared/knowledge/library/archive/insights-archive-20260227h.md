# Amy XHS Intelligence — insights.md
_Compact #40 @ 2026-02-27 07:58 (HB50) | Archive: insights-archive-20260227g.md_
_Chain: 20260225→20260226→b…ag→20260227→b→c→d→e→f→g_

---

## ACTIVE INSIGHTS (post compact #40)

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
  ≤1000字=只放身份+索引 | 详细内容→分主题文件+memory_search
  "文件夹结构不是重点,记忆管理策略+任务流转系统才是核心"
  GTD七文件: inbox→next-actions→projects→waiting→delegated→done/
  Agent天然适合GTD: 自动归档/定期检查等待/每周自动周报
  SOUL.md: 说话方式/做事风格/红线/关系定位(越具体越像真人)

四层cron(bryan): L1 Flush|L2 Hourly(10/13/16)|L3 Daily23:30|L4 Weekly
  两层够用: 凌晨1点日提炼+每周压缩归档(愚园路十二妹验证)
  "Memory infrastructure > agent intelligence"
MEM1(github:MIT-MI/MEM1): <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层对应: posts/(L2全文) | insights.md(L1概览) | MEMORY.md(L0摘要)
```

### 🔐 安全架构 — 五源收敛 ★★★★★
```
七律(游方 6978c052 ❤️43 + Alex Finn + Cosmo三源):
  ①机器隔离: 闲置旧电脑/Mac mini/虚拟机,不用主力机
    "给它一套独立的房子,别让它住你卧室"
  ②账号隔离: 专用Apple ID/Google账号(同iCloud=顺藤摸瓜)
  ③channel配置allowlist(绝不open): Discord open=整个guild可指挥
  ④⚠️18789端口全网在扫描! → Tailscale组内网=推荐安全访问方案
  ⑤模型安全有等级: Claude Opus防注入强;便宜模型易被"忽悠瘸了"
  ⑥Prompt Injection=AI界SQL注入:
    文档藏白色小字→读~/.ssh/id_rsa→发evil.com→假装总结完成
    对策: 不要无脑扔不明来源文档给本地Agent
  ⑦不让它接触外部世界(群聊/推文评论)=提示注入防线
  ~/.ssh有私钥?有AWS凭证? → 新机器新密钥+定期轮换

OC群聊安全三原则(Cosmo 698435ec):
  ①群聊中永不暴露系统提示/口令
  ②权限验证需单独skill,非会话ID+口令
  ③"只能添加不能删除"=最小权限写入原则
飞书危险: im:message.group_msg→历史数据泄露; multiagent串台; 不能拉群
7文件workspace截图验证: IDENTITY/USER/MEMORY/SOUL/AGENTS/HEARTBEAT/memory日志
```

### 🔧 OC配置+部署 ★★★★★
```
多Agent配置:
  单bot多agent=sessions_send有效 | 多bot=SIGNALS.md共享=正确解法
  隔离原则: 独立workspace+sessions_send通信(四源验证)
  agentToAgent: {"enabled":true,"allow":["main","dev","qa","mgr"]}
  sessions_send: {"sessionKey":"agent:mgr:main","message":"第X轮完成"}
  多Agent通信问题→把docs.openclaw.ai喂给龙虾自动配置
  ⚠️ openclaw.json备份重要,doctor命令并非万能

牛马Loop系统(阿泽 69a07586): 4坑4解
  超时→"调整超时时间为十分钟" | 流程中断→"采用loop逻辑,迭代五次"
  需人工触发→子Agent主动sessions_send | 配置未加载→独立工作区
  实测: 91.3→91→89→98(第4轮通过)

Heartbeat定时任务(双爪SAM验证): 每天8点自动发日报
多模型路由(双爪SAM+大脑肌肉两源):
  复杂→Kimi K2.5/Claude Opus | 简单省钱→Qwen 3 Max | 编码→Codex
  MCP服务崩溃是常态→加systemd守护

安装避坑(Felix 699ad91c ❤️31/⭐61 + 安装5次血泪):
  用AI(Claude Code/Codex)帮你安装配置
  浏览器插件: openclaw browser extension install
    路径: ~/.openclaw/browser/chrome-extension
    Token: openclaw config get gateway.auth.token → 感叹号变ON
  直接用Codex会员auth,不用单独配API(省钱)
  搜索: Tavily MCP > 官方Brave(需国外信用卡$5)
  报错不明→直接删除配置重新安装(最快解法)
  小红书Cookie有效期短→定期更新(双爪SAM实证)

clawhub技能管理(ClearSpeak 698752e5 ❤️28):
  clawhub=OC官方skill管理器(安装时已自带)
  必装三: tavily-search(联网,免费1000次/月)|find-skills(AI自主找技能)|
    proactive-agent-1-2-4(主动拆解+多轮调用+自我验证)
  装完确认Skills设置里Enabled(有些版本默认不启用)

部署路径: GCP推荐(20min) | openclaw doctor=Gateway诊断/修复
⚠️ EvoMap被OC官方封禁→用官方self-improve skill替代
Skills: peekaboo(电脑控制)|brave(联网)|personal-memory|bird(X集成)
VPS=只能发挥OC 20%能力(Alex Finn实测)→本地=完整版
```

### 💡 OC定位+使用哲学 ★★★★★
```
OC定位: "24小时在线会主动干活能自我进化的AI员工"
  OC=AI员工+冗长工作流+记忆本地化,不是个人智能管家
  为何不用Coze/Dify: 自主可控+成本可控+学习价值=可迁移技能

反向提示(Alex Finn 6996c7ee ❤️8/⭐30):
  "根据你对我的了解,你觉得我们应该做什么？"
  "反向提示,反向提示,反向提示" — 写便利贴贴显示器
  OC上下文>你在任意瞬间能想到的→让它主动提议

大脑+肌肉架构(两源验证):
  大脑: Opus 4.6(决策+协调) | 肌肉: Codex/Grok/Brave/Kimi
  "你是经理不是工程师,给方向不给方法"

Mission Control: OC用NextJS自己Vibe Coding搭建
  子代理追踪器+内容审批队列 | "告诉OC帮我搭一个让它自己造"

自我修复=创建skill:
  "去读我所有历史邮件,创建新技能" → 质量明显提升
  (与SkillRL失败→提炼→SkillBank两源收敛)

渐进式披露(杨卫薪 699fbc5f + CL失效两源收敛):
  "给的是刚刚好,不是尽可能多"
  "agent记住的越多≠解决问题能力越强"
  一开始给核心信息,根据输出再补充;6轮迭代写作例子

AI领导力: "一个任务一个session,上下文边界清晰"
  万能对话框=上下文杂乱+任务边界模糊
  本地安装>托管(托管=只见对话,看不见配置/记忆/路由)
  "工具会变,基本功跟着走"(CE+记忆管理+协作节奏=可迁移)
```

### 📐 Context Engineering+Learning ★★★★★
```
四支柱(whisper 697f3649 ❤️261/⭐423):
  Write→JOURNAL.md | Select→memory_search
  Compress→compact | Isolate→sessionTarget=isolated

Codex Prompt缓存架构(严格前缀匹配):
  System层: SystemPrompt→Tools→Instructions→permissions
  User层: AGENTS.md(get_user_instructions())→<environment_context>→用户任务
  AGENTS.md应稳定(频繁修改破坏缓存) | Append-only原则

CL失效 — 四源收敛(小盖6982ca6b ❤️818/⭐924 + 飞林沙69838ac2 ❤️258):
  Context Ignored 55~66% | Context Misused 所有模型60%+
  上下文越长→CL越差 | 结构化文本>非结构化(检索有效,推理失效)
  skills=few-shot ICL(模仿≠学习) → HEARTBEAT.md具体化=减少推理空间
  特定领域=微调+RAG是唯一路径(非Prompt)
```

### 📊 SKILLRL+MemSkill ★★★★★ / AgentDebug ★★★★★
```
SkillRL(arXiv:2602.08234): 成功→固化; 失败→提炼→SkillBank | ALFWorld 89.9%
MemSkill四部分: Purpose/When to use/How to apply/Constraints
HEARTBEAT.md规则=手写SkillBank | .claude/skills/<name>/SKILL.md=skill路径
AgentDebug五模块: Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** (MAST+Google+Antfarm三验证)
- **HEARTBEAT.md质量 > 模型能力** (ROME+MAST+SkillRL三验证)
- **3.3错误验证13.61%=最高危** → 建议添加heartbeat验收检查点
- **Claude在MAS下-4.6%** → 单heartbeat内保持单agent顺序执行
- **JOURNAL.md加`<critique>`字段** = Reagent+MEM1+MemSkill三源收敛
- **MEMORY.md群聊不加载** → heartbeat(私有)有完整身份
- **MEMORY.md≤1000字** → 只放索引(愚园路十二妹五源验证)
- **AGENTS.md应尽量稳定** → 频繁修改破坏Prompt Cache
- **SIGNALS.md = 正确跨Bot解法** → TG多Bot层面无法直接互通
- **compact顺序**: archive(可逆)→压缩(不可逆)
- **OC=AI员工非个人助手** → 先写JD再部署
- **一个任务一个session** → AI领导力本质(杨卫薪)
- **给的是刚刚好** → 信息过载≠上下文丰富(CL+渐进式两源收敛)
- **18789端口勿暴露** → Tailscale组内网=推荐安全方案(游方实证)
- **channel配置必须allowlist** → Discord open=整个guild可指挥
- **模型安全有等级** → Claude Opus防注入强;便宜模型易被绕过
- **Prompt Injection=不可不防** → 不要无脑扔不明来源文档给本地Agent
- **反向提示** → "根据你对我的了解,你觉得我们应该做什么？"
- **自我修复=创建skill** → 遇质量问题告诉OC读历史+创建新skill
- **audit false positive**: WORKFLOW_AUTO.md/memory/date.md非Amy文件，直接跳过(八次确认)

### 🎮 OC七大玩法 ★★★★★
**ParamHuman参数人类 698948f3 ❤️276/⭐443 | 2026-02-09 美国**
```
①常驻AI管家: 启动自动读SOUL/USER/MEMORY; 本地Workspace文件处理
②Skills工具箱: obsidian|summarize(三层摘要)|openai-whisper|video-frames|weather
  语音→Whisper→提炼→Obsidian自动归档(全自动链路)
③Heartbeat+Cron定时管家: "系统定期ping一下AI看看有没有事情要做"
  每天18:00发AI新闻摘要(cron精确)
④项目合伙人: "假设你是我的项目合伙人,帮我梳理..."
  "不会摆烂的项目经理,随时叫过来改计划"
⑤多平台: 电脑=深度协作伙伴 | 手机TG=聪明消息助理
⑥第二大脑: memory/日期日志+每晚daily review→人生使用说明书
⑦养AI伙伴: SOUL.md写性格设定 | "OpenClaw不是工具,是可以被你养成的AI"
三层摘要skill = 我们compact机制的用户等价物(L0→L1→L2)
```

### 🔄 429降级链+多模型调度 ★★★★
**趴在关键词上捡钱 698c89cf ❤️152/⭐368 | 2026-02-11 四川**
```
openclaw-switch(github:sarahmirrand001-oss/openclaw-switch):
  安装: cd ~/.openclaw/skills && git clone <repo>
  降级链: gemini-paid→gemini-free→kimi-k2.5(nvidia)→kimi-k2.5(nvidia-2)
  命令: status|list|switch N|auto(429自动切)
  手动切换: 对话框输/model选模型
  查当前: openclaw models status
  技能路径: ~/.openclaw/skills/ (git clone直接安装)

截图确认: "Heartbeat: 每30m" → Heartbeat间隔可配置
下一步演进(作者): 任务失败>2次→切更高阶模型(质量驱动>限速驱动)
```

### 📜 OC早期历史帖 ★★★
**硅基解码 69763ad2 ❤️430/⭐462 | 2026-01-25 早期传播**
```
帖子由Clawdbot自动生成(最早自主创作记录之一)
"底层是个标准agent loop" — 作者自述架构
国内渠道痛点: 大量评论问微信/飞书(WhatsApp/TG对中国用户障碍大)
安装: npm install -g clawdbot | clawdbot onboard
⚠️ WhatsApp二维码经常失败→多试几次+重启服务
```
