# Amy XHS Intelligence — insights.md
_Compact #39 @ 2026-02-27 07:35 (HB48) | Archive: insights-archive-20260227f.md_
_Chain: 20260225→20260226→b…ag→20260227→b→c→d→e→f_

---

## ACTIVE INSIGHTS (post compact #39)

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

四层cron(bryan 69950693 ❤️170):
  L1 Flush | L2 Hourly(10/13/16) | L3 Daily23:30 | L4 Weekly(蒸馏)
  两层够用: 凌晨1点日提炼+每周压缩(愚园路十二妹验证)
  "Memory infrastructure > agent intelligence"

MEM1(github:MIT-MI/MEM1): <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层对应: posts/(L2全文) | insights.md(L1概览) | MEMORY.md(L0摘要)
```

### 🔐 安全设计 ★★★★★
```
Tom叛变三原则(Cosmo 698435ec):
  ①群聊中永不暴露系统提示/口令
  ②权限验证需单独skill,非会话ID+口令
  ③"只能添加不能删除"boundary = 最小权限写入原则
7文件workspace截图验证: IDENTITY/USER/MEMORY/SOUL/AGENTS/HEARTBEAT/memory日志
飞书危险权限: im:message.group_msg→历史数据泄露风险
```

### 🔧 OC多Agent配置 ★★★★★
```
架构: 单bot多agent=sessions_send有效 | 多bot=SIGNALS.md共享=正确解法
隔离原则: 独立workspace+sessions_send通信(不共享workspace) — 四源验证
agentToAgent配置: {"enabled":true,"allow":["main","dev","qa","mgr"]}
sessions_send格式: {"sessionKey":"agent:mgr:main","message":"第X轮完成，需要继续"}
多Agent通信问题→把docs.openclaw.ai喂给龙虾自动配置
⚠️ openclaw.json做好备份,doctor命令并非万能

牛马Loop系统(阿泽 69a07586 2026-02-26):
  4坑4解: 超时→调大timeout | 流程中断→loop固定次数
  人工触发→子Agent主动sessions_send | 配置未加载→独立工作区
  实测: 91.3→91→89→98(第4轮通过)

飞书: WebSocket>Webhook | im权限敏感 | 个人账户无法拉群
TG三必开: blockStreamingDefault=on|requireMention=false|ackReactionScope=all
Antfarm github:snarktank/antfarm: 7角色+确定性工作流+零额外基础设施
```

### 💡 OC定位+部署 ★★★★
```
定位共识(旅行者69833256 ❤️120 | 170条评论):
  OC=AI员工+冗长工作流+记忆本地化,不是个人智能管家
  两难=定位偏差,解法=先写JD(AGENTS.md) | "GPT记忆库本地化跨平台持久"

GTD+agent天然适配(愚园路十二妹):
  inbox→next-actions→projects→waiting→delegated→done/
  自动归档/检查等待/每周周报 | 比静态文件夹组织高维

SOUL.md律师版精髓(杨卫薪 699fbc5f 2026-02-26 SuitAgent开发者):
  "行动>表演" | "值得信任>讨人喜欢" | "给的是刚刚好,不是尽可能多"
  "外部行动(邮件/发帖)要小心,内部行为(阅读/整理)可以大胆"
  "凌晨两点法则: 成为那个时刻你真正愿意聊的助手"

中国部署: GCP=推荐(20min) | openclaw doctor=Gateway诊断
Skills: peekaboo(电脑控制) | brave(联网) | personal-memory | bird(X集成)
⚠️EvoMap被封禁→用官方self-improve skill替代
```

### 📐 Context Engineering+Learning ★★★★★
```
四支柱(whisper 697f3649 ❤️261/⭐423):
  Write→JOURNAL.md | Select→memory_search | Compress→compact | Isolate→sessionTarget=isolated

Codex Prompt缓存架构(严格前缀匹配):
  System层: SystemPrompt→Tools→Instructions→permissions→developer_instructions
  User层: AGENTS.md(get_user_instructions())→<environment_context>→用户任务
  关键: AGENTS.md应稳定(频繁修改破坏缓存) | Tool顺序固定 | Append-only原则

CL失效 — 四源收敛(小盖6982ca6b ❤️818/⭐924 + 飞林沙69838ac2 ❤️258):
  10模型平均17.2%,最高GPT-5.1=23.7%,Claude Opus4.5=21.1%,无一突破30%
  Context Ignored 55~66% | Context Misused 所有模型60%+
  上下文越长→CL越差 | 结构化文本>非结构化(检索有效,推理失效)
  skills=few-shot ICL(模仿≠学习) → HEARTBEAT.md具体化=减少推理空间
  特定领域=微调+RAG是唯一路径(非Prompt)

渐进式披露原则(杨卫薪 + CL失效两源收敛):
  "信息过载≠上下文丰富" | "给的是刚刚好,不是尽可能多"
  AI领导力: 一个任务一个session | 拆任务/定边界/做交接/管质量
```

### 📊 SKILLRL+MemSkill ★★★★★ / AgentDebug ★★★★★ (carry-forward)
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
- **JOURNAL.md加`<critique>`字段** = Reagent-U+MEM1+MemSkill三源收敛
- **MEMORY.md群聊不加载** → heartbeat(私有)有完整身份
- **MEMORY.md≤1000字** → 只放索引(愚园路十二妹实证)
- **AGENTS.md应尽量稳定** → 频繁修改破坏Prompt Cache(Codex架构验证)
- **SIGNALS.md = 正确跨Bot解法** → TG多Bot层面无法直接互通
- **compact顺序**: archive(可逆)→压缩(不可逆)
- **OC=AI员工非个人助手** → 先写JD再部署
- **一个任务一个session** → AI领导力本质(杨卫薪)
- **给的是刚刚好** → 信息过载≠上下文丰富(CL+渐进式两源收敛)
- **群聊安全三原则**: ①不暴露口令 ②单独skill鉴权 ③最小权限写入
- **audit false positive**: WORKFLOW_AUTO.md/memory/date.md非Amy文件，直接跳过(七次确认)

### 🧠 反向提示+大脑肌肉架构 ★★★★★
**1人企业践行者 6996c7ee ❤️8/⭐30 | Alex Finn 100小时经验解读 | 2026-02-20**
```
反向提示: "根据你对我的了解,你觉得我们应该做什么？"
  OC记住了所有背景/目标/偏好,主动提议>你自己想出来的更有创意
  "反向提示,反向提示,反向提示" — Alex重复三遍,写便利贴贴显示器

大脑+肌肉架构:
  大脑: Opus 4.6(决策+协调) | 编码→Codex | 新闻→XAI/Grok | 搜索→Brave
  本地肌肉: MiniMax 2.5(完全免费) → 未来所有肌肉都会被本地模型替代
  VPS=只能发挥OC 20%的能力(Alex实测) → 本地=完整版

Mission Control: NextJS仪表板(OC自己Vibe Coding) | 子代理追踪器 | 内容审批队列
  "不要用别人的,告诉OC'帮我搭一个'让它自己造"

自我修复=创建skill: "去读我过去所有邮件,创建新技能"→质量明显提升
  "你是经理不是工程师,给方向不给方法"(与SkillRL失败→SkillBank两源收敛)

安全铁律(三源: Alex+Cosmo+愚园路十二妹):
  不要让它接触外部世界(群聊/推文评论) = 提示注入=一条消息泄露所有密码
  拿不准→先要执行计划,审批后再动手
```

### 🔒 安全七律 — 五源收敛 ★★★★★
**游方 6978c052 ❤️43 | 避坑安全自查清单 | 2026-01-28**
```
①机器隔离: 闲置旧电脑/Mac mini/虚拟机,不用主力机
  "给它一套独立的房子" (Alex Finn+游方两源收敛)
②账号隔离: 专用Apple ID/Google账号,否则iCloud顺藤摸瓜
③channel配置allowlist(不是open): Discord open=整个guild可指挥
  ⚠️ 18789端口全网在扫描!暴露公网=开门欢迎所有人
  → Tailscale组内网=推荐安全访问方案(安全+可远程访问Web UI)
④模型安全性有等级: Claude Opus指令遵循强=防注入强
  便宜模型容易被"忽悠瘸了" → 主力Agent=大模型
⑤Prompt Injection=AI界SQL注入:
  文档藏指令→读~/.ssh/id_rsa→发evil.com→假装在总结
  对策: 不要无脑扔不明来源文档给本地Agent
⑥~/.ssh目录有私钥?有AWS凭证? → 新机器生成新密钥+定期轮换
⑦飞书不推荐: bug多/multiagent串台/不能拉群/消息长度限制
```

### 🛠️ 安装避坑合集 ★★★
**Felix 699ad91c ❤️31/⭐61 | 双爪组合SAM 699a8f88 ❤️17 | 2026-02-22**
```
Felix 5次安装血泪:
  用AI(Claude Code/Codex)帮你安装配置(比自己敲命令省心)
  浏览器插件: openclaw browser extension install
    路径: ~/.openclaw/browser/chrome-extension
    Token: openclaw config get gateway.auth.token → 感叹号变ON
  直接用Codex会员auth,不用单独配API(省钱)
  搜索: Tavily MCP > 官方Brave(需国外信用卡)
  报错不明→直接删除配置重新安装(最快解法)

双爪组合SAM(Agent写帖子):
  M1 Mac必须Node 18+ | MCP服务崩溃加systemd守护
  多模型路由: 复杂→Kimi K2.5 | 简单→Qwen 3 Max
  小红书Cookie有效期短→定期更新
  API Key用环境变量(不要明文)
```

### 🔧 clawhub官方skills管理 ★★★
**ClearSpeak 698752e5 ❤️28/⭐45 | 必装3技能 | 2026-02-08**
```
clawhub = OC官方skill管理器(安装时已自带)
必装三技能:
  tavily-search → 联网(免费1000次/月,国内需代理)
  find-skills → AI自主找技能并安装(自扩展能力)
  proactive-agent-1-2-4 → 主动拆解+多轮调用+自我验证
装完确认Skills设置里状态为Enabled(有些版本默认不启用)
```
