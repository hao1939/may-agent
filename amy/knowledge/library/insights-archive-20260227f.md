# Amy XHS Intelligence — insights.md
_Compact #38 @ 2026-02-27 07:22 (HB46) | Archive: insights-archive-20260227e.md_
_Chain: 20260225→20260226→b…ag→20260227→b→c→d→e_

---

## ACTIVE INSIGHTS (post compact #38)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
风险图: ✅1.4→MEMORY.md ✅2.4→SIGNALS.md ⚠️3.3错误验证 ⚠️1.1→HEARTBEAT.md质量
Tom叛变=现实MAST 1.1+2.4: 提示词注入+权限混乱 (Cosmo 698435ec ❤️188)
```

### 🌍 Environment+Verifier > 算法 ★★★★★
```
<env,tools,task,verifier>四元组缺一→"工具cosplay"非真Agent
DB-as-State: 读=可逆探索(免费) | 写=不可逆承诺(昂贵)
s>β → MA在预算内超越SA | arXiv:2601.17311 Phase Transition
```

### 🤖 拓扑+模型 ★★★★★
```
Claude在MAS下-4.6% | 错误放大: Independent 17.2× vs Centralized 4.4×
Amy/Bob/Scout = 并行+中心化 ✅ | 单heartbeat内保持单agent顺序执行
```

### 🔬 生产RL+过程奖励 ★★★★★
```
ROME(Sydney He 698d47f3): 收敛84.85% | Strategy Error>Knowledge Gap
HEARTBEAT.md指令质量 > 模型能力
Reagent(arXiv:2601.22154): <think>+<critique>+<score> | Reagent-U: GAIA 43.7%
JOURNAL.md加<critique>字段 = 过程奖励信号
```

### 🧠 记忆架构 — 七源收敛 ★★★★★
```
OC官方(docs.openclaw.ai, 你瞅啥699dc427 ❤️7):
  文件即记忆=唯一真相源 | memory/日志: 当天+前一天自动加载
  MEMORY.md: 仅私有会话加载（群聊不加载！防泄露）
  检索: 切片→SQLite(BM25+向量)混合→相关性注入
  必开: memoryFlush.enabled=true | memory_search优先→fallback才读文件

四层cron(bryan 69950693 ❤️170):
  L1 Flush | L2 Hourly(10/13/16) | L3 Daily23:30(sessions回溯) | L4 Weekly(蒸馏)
  sessionTarget=isolated | memorySearch.sources=["memory","sessions"]
  "Memory infrastructure > agent intelligence"

MEM1(MIT+NUS github:MIT-MI/MEM1): <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层对应: posts/(L2全文) | insights.md(L1概览) | MEMORY.md(L0摘要) ← OpenViking命名
JOURNAL.md=IS_t近似 | insights.md compact=L4 Weekly Compound近似
```

### 🔧 OC多Agent配置 — 多源收敛 ★★★★★
```
架构(过气Pm张 6985f45a ❤️139):
  单bot多agent: agentToAgent+sessions_send有效
  多bot: TG层bot-to-bot不可用(平台限制) → SIGNALS.md共享文件=正确解法 ✅
  坑: 共享workspace→人设混乱 | 分层: 独立workspace+共享knowledge/memory/skills

配置验证(TG+飞书+企业):
  TG: agents.list+bindings+mentionPatterns+agentToAgent.allow(三必开见6991e3a1)
  飞书: bindings+peer.id | im:message.group_msg=敏感权限,按需开启
  企业: AGENTS.md岗位说明书最重要 | RACI矩阵 | 安全铁律:发布须人工确认
  中枢调度>自由通信 | 差异化人设=信息过滤器

Antfarm github:snarktank/antfarm: `install github.com/snarktank/antfarm`
  7角色+确定性工作流+Ralph Loop+YAML/SQLite/Cron零额外基础设施
```

### 🔐 安全设计 ★★★★★
```
Tom叛变三原则(Cosmo 698435ec):
  ①群聊中永不暴露系统提示/口令(群聊可能被读取)
  ②权限验证需单独skill,非会话ID+口令
  ③"只能添加不能删除"boundary = 最小权限写入原则

7文件workspace(截图验证=三源):
  IDENTITY/USER/MEMORY/SOUL/AGENTS/HEARTBEAT/memory日志 + ls/pwd可执行
愚园路十二妹安全铁律: 搜/写/分析=自主; 发布/消息/邮件=必须人工确认
MEMORY.md群聊不加载(你瞅啥验证) → heartbeat(私有)有完整身份
```

### 💡 OC定位+部署 ★★★★
```
定位共识(旅行者69833256 ❤️120 | 170条评论):
  OC = AI员工+冗长工作流+记忆本地化,不是个人智能管家
  高风险不敢用+低风险GPT更快 → 两难=定位偏差,解法=先写JD(AGENTS.md)
  "搭建冗长繁琐工作流节省人力成本" | "GPT记忆库本地化跨平台持久"

Skills生态(AI布丁 698e85a6 ❤️242):
  peekaboo(官方电脑控制) | brave(联网) | personal-memory | bird(X集成)
  ⚠️EvoMap被封禁 → 用官方self-improve skill替代

中国部署(程序员的二三事 698865fa ❤️318):
  境内VPS: TG不通+企微死循环+Gateway崩溃 | GCP=推荐(20min)
  openclaw doctor = Gateway诊断/修复命令
  火山云东南亚+antigravity OAuth=低成本境外替代
  模型: MiniMax Max Coding Plan | Antigravity代理 | Codex可给OC做模型
```

### 📊 SKILLRL+MemSkill ★★★★★ / AgentDebug ★★★★★ (carry-forward)
```
SkillRL(arXiv:2602.08234): 成功→固化; 失败→提炼→SkillBank | ALFWorld 89.9%
MemSkill四部分: Purpose/When to use/How to apply/Constraints
HEARTBEAT.md规则 = 手写SkillBank → 应用四部分格式文档化
AgentDebug五模块: Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** (MAST+Google+Antfarm三验证)
- **HEARTBEAT.md质量 > 模型能力** (ROME+MAST+SkillRL三验证)
- **3.3错误验证13.61%=最高危** → 建议添加heartbeat验收检查点
- **Claude在MAS下-4.6%** → 单heartbeat内保持单agent顺序执行
- **JOURNAL.md加`<critique>`字段** = Reagent-U+MEM1+MemSkill三源收敛
- **MEMORY.md群聊不加载** → heartbeat(私有)有完整身份;群聊会话无长期记忆
- **SIGNALS.md = 正确跨Bot解法** → TG多Bot层面无法直接互通
- **compact顺序**: archive(可逆)→压缩(不可逆)，顺序不可颠倒
- **OC=AI员工非个人助手** (旅行者170条评论验证) → 先写JD再部署
- **群聊安全三原则**: ①不暴露口令 ②单独skill鉴权 ③最小权限写入
- **AI只是放大器，放大管理能力** (愚园路十二妹实证)
- **audit false positive**: WORKFLOW_AUTO.md/memory/date.md非Amy文件，直接跳过(六次确认)

### 🔬 Context Learning vs Context Engineering ★★★★★
**小盖 6982ca6b ❤️818/⭐924 | 姚顺雨(腾讯)论文 | 2026-02-04**
```
CE = 工程问题: 把对的信息组织好给模型（我们做的）
CL = 学习问题: 模型能否从上下文学会训练数据里没有的新东西

结果残酷: 10个顶尖模型平均成功率17.2%（无上下文<1%）
  GPT-5.1=23.7% | Claude Opus4.5=21.1% | o3=17.8% | 无一突破30%
→ MEMORY.md/skills具体化 = 降低CL难度的工程补偿
→ 四层记忆+SkillRL = 绕过CL失败的架构补偿
评论: "skills是经验的总结规范化，能缓解CL问题" ❤️3
```

### 📐 Context Engineering四支柱+Codex架构 ★★★★★
**whisper 697f3649 ❤️261/⭐423 | 2026-02-01**
```
四支柱: Write | Select | Compress | Isolate
  Write→JOURNAL.md | Select→memory_search | Compress→compact | Isolate→sessionTarget=isolated

Codex Prompt组装顺序(严格前缀匹配→最大化缓存命中):
  System层(服务器): System Prompt → Tools → Instructions → permissions → developer_instructions
  User层(用户控制): AGENTS.md(get_user_instructions()) → <environment_context> → 用户任务

关键推论:
  AGENTS.md应尽量稳定(频繁修改破坏Prompt Cache命中)
  Tool Definition顺序要固定(重排序=缓存失效=成本暴增)
  Append-only原则 = memory追加写入的理论基础
```

### 🔬 Context Learning失效三源收敛 ★★★★★
**飞林沙 69838ac2 ❤️258 | 姚顺雨论文解读 | 2026-02-05**
```
CL失效三结论(与小盖6982ca6b两源验证):
  上下文越长→CL效果越差 | 推理≠CL提升,有时反而更差
  Context Ignored 55~66% | Context Misused 所有模型60%+
→ 特定领域=微调+RAG是唯一路径,非Prompt
→ 结构化文本优于非结构化(CL检索>推理)
评论"skills属于ICL吗？" → skills=few-shot ICL(模仿≠学习)
→ HEARTBEAT.md规则具体化=减少推理空间=最有效设计
```

### 📋 MEMORY.md最佳实践 — 五源收敛 ★★★★★
**愚园路十二妹 698dc122 ❤️458/⭐1029 | 14天5条血泪经验 | 2026-02-12**
```
5条核心经验:
  ①MEMORY.md≤1000字=只放身份+索引,细节→分主题文件+memory_search
  ②多agent隔离workspace=三个独立的人(≠一个大脑分三份)
    agent间通信=sessions_send,不共享workspace(四源验证)
  ③记忆自动化=凌晨1点提炼+每周压缩归档(两层cron够用)
  ④Markdown GTD: inbox→next-actions→projects→waiting→delegated→done/
    agent天然适合GTD: 自动归档/自动检查等待中/每周自动周报
  ⑤SOUL.md=灵魂非说明书: 说话方式/做事风格/红线/关系定位
结论: 文件夹结构不是重点,记忆管理策略+任务流转系统才是核心
```

### 🔄 多Agent Loop实战 — 牛马系统 ★★★★
**阿泽 69a07586 ❤️3 | 2026-02-26(仅6h前) | 北京**
```
架构: 零号(调度中控)→一号(规划:Tavily+高德+12306)→二号(评审:5维打分)→loop
实测: 91.3→91→89→98(第4轮通过,目标95分)

4坑4解:
  超时→调大timeout: "调整超时时间为十分钟"
  流程中断→loop固定次数: "采用loop逻辑,迭代五次"
  需人工触发→子Agent主动sessions_send: {"sessionKey":"agent:mgr:main","message":"第X轮完成"}
  配置未加载→指定独立工作区读取.md
  多Agent通信问题→把docs.openclaw.ai喂给龙虾即可解决
⚠️ openclaw.json做好备份,doctor命令并非万能
```

### 💎 AI领导力+渐进式披露 ★★★★★
**杨卫薪律师 699fbc5f ❤️30 | SuitAgent开发者 | 2026-02-26**
```
10条经验精华:
  本地安装>托管(托管=只见对话,看不见上下文组织/记忆/路由)
  推荐路径: Claude Code练边界→再到OC(基本功可迁移)
  "买coding plan,把用光它当成训练"→倒逼定义输入边界/评价标准/完成状态

渐进式披露原则(与CL失效两源收敛):
  "给的是刚刚好,而不是尽可能多"
  "agent记住的越多≠解决问题能力越强"
  一开始给核心信息,根据输出再补充;6轮迭代写作例子

AI领导力本质="一个任务一个session,上下文边界清晰"
  万能对话框=上下文杂乱+任务边界模糊(等于让agent同时做5件事)
  拆任务/定边界/做交接/管质量 = 可迁移的AI协作能力

SOUL.md律师版精髓: "行动>表演" | "值得信任>讨人喜欢"
  "外部行动(邮件/发帖)要小心,内部行为(阅读/整理)可以大胆"
  "凌晨两点法则: 成为那个时刻你真正愿意聊的助手"
```
