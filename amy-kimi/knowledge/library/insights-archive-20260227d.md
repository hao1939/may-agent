# Amy XHS Intelligence — insights.md
_Compact #36 @ 2026-02-27 06:15 (HB39) | Archive: insights-archive-20260227c.md_
_Full chain: 20260225 → 20260226 → b…af → ag → 20260227 → b → c_

---

## ACTIVE INSIGHTS (post compact #36)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
**Berkeley | 68aa0109+67e615a5 | κ=0.88**
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
AG2>MetaGPT>>ChatDev | 架构层解决，prompt调整最多+十几%
```
**风险图:** ✅1.4→MEMORY.md ✅2.4→SIGNALS.md ⚠️3.3错误验证(缺自动验收) ⚠️1.1→HEARTBEAT.md质量

### 🌍 Environment+Verifier > 算法 ★★★★★
**菌不鱼(69708f52+69805abc) + 姚顺雨(69411085) + Alan AI(68d0e5b8) + Phase Transition arXiv:2601.17311**
```
<env,tools,task,verifier>四元组缺一→"工具cosplay"非真Agent
DB-as-State: 读=可逆探索(免费) | 写=不可逆承诺(昂贵)
s>β → MA在预算内超越SA | 好环境>好算法 三源收敛
```

### 🤖 拓扑+模型选择 ★★★★★
**包子(698ed6cb)+胖胖(6989041c) | Google+DeepMind+MIT | 180配置 87%精度**
```
MAS vs SAS: GPT+8.7% | Gemini+8.1% | Claude-4.6%（MAS对Claude有害）
错误放大: Independent 17.2× vs Centralized 4.4×
可并行推理→Centralized+80.8% | 顺序推理→SAS(-39~-70%)
```
**Amy/Bob/Scout = 并行+中心化 ✅ | 单heartbeat内保持单agent顺序执行**

### 🔬 Agentic RL生产 ROME ★★★★★
**Sydney He 698d47f3 ❤️605 | arXiv:2512.24873 | 阿里 | 收敛84.85%**
```
①Mask不可恢复错误 ②正样本起步 ③Chunked MDP/IPA ④自适应RL ⑤细粒度监控
Claude诊断扫描>>直接动手 | Strategy Error 33.62%>Knowledge Gap 11.80%
```
**HEARTBEAT.md指令质量 > 模型能力**

### 🏆 过程奖励三源收敛 ★★★★★
**Reagent 697c6c2a arXiv:2601.22154(CUHK+Meituan) + RISE 6975f8b2(中科院+Duke)**
```
Reagent-RRM: <think>+<critique>+<score>三元 | Reagent-U最强: GAIA 43.7%,AIME24 60.0%
RISE: 工具三退化(元素缺失/模式退化/安全约束缺失) | Acc_task+35.3%,Acc_intent+23.3%
```
**JOURNAL.md加`<critique>`字段 = 过程奖励信号**

### 📁 记忆三层架构 — 五源收敛 ★★★★★
**清欢(6936c189)+黎同学(68be35a5)+MEM1(68c8040f)+MemSkill+Context Folding**
```
三圆模型: Total Context⊃Needed Context≈Retrieved Context
三层结构: 原始内容(posts/) + 摘要层(insights.md) + 索引层(MEMORY.md/people.md)
MEM1: <IS_t>内化记忆为推理本身 → 强制剪枝 → 约束即学习信号
  MEM1-7B×3.5超Qwen2.5-14B,内存×1/3.7 | 2跳训练泛化16跳 | github:MIT-MI/MEM1
Context Folding arXiv:2510.11967: branch/return | FoldGRPO | 10×更小active context
```
**JOURNAL.md = `<IS_t>` near-equivalent; 强制写JOURNAL.md = 人工实施强制剪枝**

### 🔍 AgentDebug+Vibe西希 ★★★★★
**UIUC+Stanford 68fc91f0 | Vibe西希(THU) 6983647a ❤️79**
```
五模块: Memory/Reflection/Planning/Action/System
连锁崩溃: 早期微小错误→逐层放大 | 反事实根源定位 | 精准修复21%→55%
三层评测: 基模能力地板→Agent稳定性→从失败反推
```
**Amy自检:** Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅

### 📊 SKILLRL+MemSkill：Abstraction>Memorization ★★★★★
**698bb2f5 arXiv:2602.08234(UNC+Berkeley) + 698c5f60 arXiv:2602.02474**
```
SkillRL: 成功→固化策略; 失败→提炼教训 → SkillBank(General+Task-Specific)
  Co-evolution | ALFWorld 89.9%(>GPT-4o) | +15.3% | 收敛+33% | Prompt-10.3%
MemSkill: Controller(RL Top-K)+Executor(LLM)+Designer(失败驱动进化)
  Skill四部分: Purpose/When to use/How to apply/Constraints
  失败buffer→聚类→提炼→技能更新 = 闭环进化
```
**HEARTBEAT.md规则 = 手写SkillBank → 应用四部分格式文档化**

### 🔧 AgenticRL框架三层 ★★★★
**丁师兄 69453c2a ❤️271 (美团二面)**
```
通用: TRL/OpenRLHF/LLaMA-Factory (上手快,多轮长轨迹弱)
专用: AgentRL官方实现 (异步流水线+跨策略采样)
生产: vLLM+Ray (大厂实际栈,门槛最高)
PPO稳定(裁剪保守) | GRPO无Critic(~节省50%显存,组内对比奖励)
```

### 🔧 OC生态架构 (carry-forward) ★★★★
```
双重架构(无影寺 69288680):
  Initializer(init.sh+progress.txt+功能列表) + Coding(读日志→单功能→提交)
  = HEARTBEAT.md + TODO.md + 单heartbeat聚焦 ✅

OC 2026.2.25: directPolicy per-agent | 愚园路十二妹 ⭐1027: MEMORY.md≤1000字
SOUL.md四维: 说话方式/做事风格/红线/关系 | Codex双层toml | max_threads=12
CIS-Agent(吸哎斯-Cis 6999af69): Kimi K2 | 4任务看板 | XHS MCP标题≤20字
飞书×OC踩坑(698c1890): WebSocket>Webhook | gateway先启动 | 4坑
飞书个人账户无法拉群（需企业账户）
TG三必开(6991e3a1 ❤️709): blockStreamingDefault=on|requireMention=false|ackReactionScope=all
十大Skills(6988771f ❤️619): ~/.agents/skills/ | npx skills update | skills.sh

AgentOPC 6998aa24 ❤️151 — TG多Agent完整配置:
  agents.list + bindings路由 + mentionPatterns + agentToAgent.allow + BotFather隐私关
CC船长 699c6db8 ❤️133 — 飞书多Agent三步配置:
  openclaw agents add <id>; bindings+peer.id; requireMention+allowAll per group
  群组ID格式: oc_xxxxxxxxxxxxx
  [TG+飞书双渠道三源验证: bindings路由=OC多Agent标准范式]

愚园路十二妹 699169250 ❤️36 ★★★★★ 3891字·15图 "把全能AI拆成三人团队"
  单AI三病: 上下文污染/性格撕裂/串行瓶颈
  三人架构: 思思(主管调度Opus4.6)→老K(数据GPT5.2+5.3双模式)←→念念(内容Opus4.6)
    中枢调度>自由通信(刻意管理设计); 老K/念念不直通,全走思思
  四步: 定义Agent→AGENTS.md岗位说明书→三层记忆→协作关系
  五坑: ①同模型②无记忆③边界模糊(RACI)④无安全铁律⑤无人设文件
  安全铁律: 搜/写/分析=自主; 发布/消息/邮件=必须人工确认
  差异化人设 = 信息过滤器（沟通风格→优先级判断）
  "AI只是放大器，放大的是管理能力，不是技术能力"

bryan 69950693 ❤️170 ★★★★★ "永不失忆"四层记忆系统
  L1 Flush(context满→自动) | L2 Hourly(10/13/16点) | L3 Daily23:30(sessions回溯) | L4 Weekly(蒸馏MEMORY.md)
  配置: memoryFlush.enabled=true | sessionTarget=isolated | memorySearch.sources=["memory","sessions"]
  规范写AGENTS.md: memory_search优先→memory_get→fallback才直读文件
  Daily Log模板: 决策/待办/关键对话/技术Notes | "Memory infrastructure > agent intelligence"
  = L1≈MEM1强制剪枝 | L3=跨session回溯 | L4≈insights.md compact

Yanlin 6998185c ❤️79 ★★★ 5大外挂记忆方案导图:
  Mem0(YC,+26%准) | Zep(<200ms) | Letta/MemGPT(AI自管理) | OpenViking+qmd(字节) | EverMemOS
  多Agent记忆隔离是OC原生明确限制,跨Agent须外挂
  ⚠️ 数据为自家benchmark,方向正确但数字勿轻信

 ❤️296/⭐690 ★★★★★ github:snarktank/antfarm
  install: `install github.com/snarktank/antfarm`
  7角色: Planner/Developer/Verifier/Tester/Reviewer/Integrator/Deployer
  3工作流: feature-dev | security-audit | bug-fix
  核心: 确定性工作流+Ralph Loop(每步新context)+互相校验+失败不静默
  栈: YAML+SQLite+Cron 零额外基础设施 | dashboard实时看板
  = 当前最完整OC多Agent生产框架
```

### 📝 元学习+OC源码+RISE框架 (carry-forward)
```
元学习九窍门 699ff1b8: 可信度标注[0.9|直接告知|date|12次] | 三档记忆(法典/策略/临时)
  预测日志: 预测/不确定/把握/实际/差异/调整 | 迭代停止<5%连三轮
  "建了回路但没有闭合"=JOURNAL.md若不在heartbeat里读取就是断路

OC源码 69933413: _createNewPlan/executeStep/createSubagent 三核心函数
RISE意图偏离: ICP负样本+六类语义突变+SFT→DPO
  工具三退化: 元素缺失70%/模式退化/安全约束缺失
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** (MAST+Google Scaling+Antfarm三验证)
- **HEARTBEAT.md质量 > 模型能力** (ROME+MAST+SkillRL三验证)
- **3.3错误验证13.61%=最高危** → 建议添加heartbeat验收检查点
- **Claude在MAS下-4.6%** → 单heartbeat内保持单agent顺序执行
- **JOURNAL.md加`<critique>`字段** = Reagent-U+MEM1+MemSkill三源收敛
- **compact顺序**: 先archive(可逆) → 再压缩(不可逆)，顺序不可颠倒
- **读优先写延后**: 菌不鱼DB-as-State + Claude诊断扫描 两源收敛
- **AgentDebug自检**: Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅
- **Kimi K2**: 中国OC用户主流模型 (Yingwei+CIS-Agent多源)
- **audit false positive**: WORKFLOW_AUTO.md/memory/date.md非Amy文件，直接跳过(五次确认)

### 🔧 OC记忆机制+多Bot架构 — 权威技术源 ★★★★★
**你瞅啥 699dc427 ❤️7 | docs.openclaw.ai | 2026-02-24**
```
OC记忆哲学: 文件即记忆，Markdown是唯一真相来源，磁盘>内存
加载规则:
  memory/日志: 当天+前一天自动加载（短期）
  MEMORY.md: 仅私有会话加载（群聊不加载！防泄露）
检索: 切片 → SQLite(BM25全文+向量语义)混合 → 相关性排序注入
写入: 自动→日志; 人工告知"记住" → MEMORY.md → 才是长期记忆
误解纠正: MEMORY.md不自动无限加载; 无独立记忆模块; 群聊有边界
```

**过气Pm张 6985f45a ❤️139 4坑多Bot架构实录**
```
坑1: 共享workspace → 人设混乱(同读SOUL.md) → 每bot必须独立workspace
坑2: TG bot-to-bot通信不可用 — bots看不到彼此消息(平台限制)
坑3: agentToAgent仅限单bot多agent架构 — 跨bot无法用sessions_send
坑4: groupPolicy:allowlist太僵硬 → 直接用open
最终: 独立workspace+agents（上层） + 共享knowledge_hub/memory/skills（下层）
```
**对我们:** SIGNALS.md共享文件 = 绕过TG限制的正确解法 ✅
单bot内sessions_send有效; 跨bot须走共享文件/外部消息队列
