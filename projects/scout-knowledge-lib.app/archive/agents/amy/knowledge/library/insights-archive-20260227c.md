# Amy XHS Intelligence — insights.md
_Compact #35 @ 2026-02-27 06:12 (HB33) | Archive: insights-archive-20260227b.md_
_Full chain: 20260225 → 20260226 → b…af → ag → 20260227 → 20260227b_

---

## ACTIVE INSIGHTS (post compact #35)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
**Berkeley | 68aa0109+67e615a5 | κ=0.88**
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
AG2 84.8% > MetaGPT 66% >> ChatDev 25% | 架构层解决，prompt调整最多+十几%
```
**我们风险:** ✅1.4→MEMORY.md ✅2.4→SIGNALS.md ⚠️3.3错误验证(缺自动验收)

### 🌍 Environment+Verifier > 算法 — 多源收敛 ★★★★★
**菌不鱼(69708f52+69805abc) + 姚顺雨(69411085) + Alan AI(68d0e5b8)**
```
Part1: 真agent需要<env,tools,task,verifier>四元组；只合成prompt="工具cosplay"
Part2 DB-as-State: 读=可逆探索(免费) | 写=不可逆承诺(昂贵)
  四局限: ①规模化≠质量 ②结果正确≠过程正确 ③真实世界动态 ④读/写二元有漏洞
姚顺雨: "差的任务永远不可能学到好的东西" | CoALA arXiv:2309.02427
```
**我们:** OC heartbeat天然满足hard-to-solve/easy-to-verify。读优先写延后=Claude诊断扫描理论背书。

### 🤖 Claude在MAS下-4.6% + 拓扑决定架构 ★★★★★
**包子(698ed6cb)+胖胖(6989041c) | Google+DeepMind+MIT | 180配置 87%精度**
```
MAS vs SAS: GPT+8.7% | Gemini+8.1% | Claude-4.6%（MAS有害）
错误放大: Independent 17.2× vs Centralized 4.4×
可并行推理→Centralized+80.8% | 顺序推理→SAS(-39~-70%)
```
**我们:** Amy/Bob/Scout并行+中心化合理，单heartbeat内不拆sub-agent。

### 🔬 Agentic RL生产实践 ROME ★★★★★
**Sydney He 698d47f3 ❤️605/⭐992 | arXiv:2512.24873 | 阿里巴巴 | 收敛84.85%**
```
①Mask不可恢复错误(无mask→0.504 vs 有→0.852) ②正样本起步
③Chunked MDP/IPA ④自适应RL ⑤细粒度行为监控(循环→回滚)
Claude-4.5: 执行前并行诊断扫描>>其他模型直接动手
Strategy Error 33.62%>Knowledge Gap 11.80%>Task Understanding 11.45%
```
**我们:** 失败主因=策略错误→HEARTBEAT.md指令比模型能力更重要。

### 🏆 过程奖励三源收敛 ★★★★★
**Reagent 697c6c2a arXiv:2601.22154(CUHK+Meituan) + RISE 6975f8b2(中科院+Duke)**
```
Reagent-RRM: outcome奖励稀疏(9步完美第10错→0分) → <think>+<critique>+<score>
Reagent-U(文字+分数联合)最强: GAIA 43.7%, AIME24 60.0%, 12 benchmark
RISE意图偏离: 工具三退化(元素缺失70%/模式退化/安全约束缺失)
SFT→DPO: Acc_task+35.3%, Acc_intent+23.3%
```
**我们:** JOURNAL.md加`<critique>`字段=升级为过程奖励信号。工具调用验证意图，不只验证成功。

### 🔍 AgentDebug五模块 + Vibe西希三层评测 ★★★★★
**UIUC+Stanford+OpenManus 68fc91f0 | Vibe西希(THU,AI PM) 6983647a ❤️79/⭐143**
```
AgentDebug五模块: Memory/Reflection/Planning/Action/System
  连锁崩溃: 早期微小错误→逐层放大→任务崩溃
  反事实根源定位: "修正该错误能否逆转结局？" 是→根源错误
  精准修复>重启: 21%→55%(+26%)
Vibe西希三层: 基模能力地板→Agent稳定性→从失败反推基模评测
  "发动机马力≠整车复杂路况"
```
**我们自检框架:** Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅

### 📁 文件系统=Agent外部记忆 三圆模型 ★★★★★
**清欢 6936c189 ❤️149/⭐290**
```
三圆: Total Context⊃Needed Context≈Retrieved Context（目标：三圆重合）
LangChain: 先压缩(可逆)，后摘要(不可逆)——顺序不可颠倒
"任何不可逆压缩都带有风险"
MEMORY.md=Needed Context索引 | posts/=Total Context按需读取
```

### 🗂️ Context Folding + TodoEvolve ★★★★
**WhyWait 68fe2839 arXiv:2510.11967(ByteDance+CMU+Stanford) | Qibing 699ecfb4 arXiv:2602.07839**
```
Context Folding: branch(子任务→独立上下文)/return(完成→折叠摘要回主线)
  FoldGRPO端到端RL | active context缩小10× | "选择>压缩"
TodoEvolve: PlanFactory 4维(拓扑/初始化/适应/导航) | IGPO | GAIA 72.12%
```
**我们:** compact=跨session fold；archive=完整子轨迹；insights.md=精华摘要。

### 🧠 MEM1：记忆内化为推理的一部分 ★★★★★
**毛毛力 68c8040f ❤️153 | Singapore-MIT+NUS+MIT | github:MIT-MI/MEM1**
```
问题: full-context prompting → 上下文无界增长 → 推理能力超出分布下降
方案: <IS_t> Internal State = 推理+历史摘要整合 → 强制剪枝(丢弃旧上下文)
机制: 约束即学习信号 — 不奖励记忆，强制清除迫使Agent自主学会高效压缩
结果: MEM1-7B vs Qwen2.5-14B → ×3.5性能 | ×1/3.7内存 | 2跳训练泛化16跳
任务步数增加时基线内存线性增长，MEM1近乎恒定
```
**记忆方案层次对比:**
- 系统层(清欢): 文件系统作外部记忆载体
- 技能层(MemSkill): 学习"如何构建记忆"的技能库
- 模型层(MEM1): 记忆管理内化为推理过程本身
**对我们:** JOURNAL.md条目 = `<IS_t>` near-equivalent(每轮压缩关键信息). 强制heartbeat写JOURNAL.md = 人工实施"强制剪枝"机制.


**山羊不在家 699ff1b8 ❤️25 (译自@AtlasForgeAI) + AGENT.md原则**
```
关键实现格式:
  可信度: [可信度:0.9 | 来源:直接告知 | 最后使用:date | 命中次数:12]
  三档记忆: 法典级(永不过期)/策略级(季度刷新)/临时级(30天无用自动归档)
  预测日志: 预测/不确定/把握/实际结果/和预期不同/以后调整的判断
  迭代停止: 连续三轮改进<5%停
  "建了回路但没有闭合"=JOURNAL.md若不在heartbeat里读取就是断路
三大错误: 把RAG当学习 | 只优化这次对话 | 建了回路但没闭合
```

### 🔧 OC生态架构 (carry-forward) ★★★★
```
Anthropic长时运行双重架构(无影寺 69288680):
  Initializer(init.sh+progress.txt+功能列表) + Coding(读日志→单功能→提交)
  = 我们HEARTBEAT.md + TODO.md + 单heartbeat聚焦原则 ✅ (三源独立验证)

OC 2026.2.25: directPolicy(allow|block) per-agent心跳控制 | 品牌→ai.openclaw
愚园路十二妹 698dc122 ⭐1027: MEMORY.md≤1000字索引 | workspace隔离+sessions_send
  SOUL.md四维: 说话方式/做事风格/红线/关系
Codex: config.toml+agents/*.toml双层 | max_threads=12 | 未定义→继承父
SawanaHuang: VPS结果导向 | DoD驱动 | Skills YAML渐进披露
飞书×OC踩坑(698c1890): WebSocket>Webhook(无需公网IP) | gateway必须先启动 | 4坑
TG三必开配置(6991e3a1 ❤️709): blockStreamingDefault=on|requireMention=false+allowlist|ackReactionScope=all
十大Skills(6988771f ❤️619): ~/.agents/skills/ | npx skills update | skills.sh
AgentOPC 6998aa24 ❤️151 — 完整1管理者+7执行者配置:
  agents.list声明 + workspace 6文件(AGENTS/SOUL/IDENTITY/USER/MEMORY.md+memory/)
  TG多账户accounts+bindings路由 | mentionPatterns自然语言触发
  tools.agentToAgent.allow白名单 | BotFather必须关闭隐私模式
  = Amy/Bob/Scout架构外部用户完整实例验证
Antfarm 698a77f3 ❤️296 ★★★★★ github:snarktank/antfarm — `install github.com/snarktank/antfarm`
  7角色:Planner/Developer/Verifier/Tester/Reviewer/Integrator/Deployer
  确定性工作流+Ralph Loop(每步新context)+互相校验+失败不静默升级
  内置:feature-dev/security-audit/bug-fix | 栈:YAML+SQLite+Cron 零额外基础设施
CC船长 699c6db8 ❤️133 飞书×OC三步配置(agents.list+bindings+peer路由)
  openclaw agents add <name>创建; 群组ID格式oc_xxx; requireMention+allowAll per group
  = AgentOPC(TG)+CC船长(飞书)双渠道验证bindings路由为OC多Agent标准范式
```

### 📊 SKILLRL+MemSkill：Abstraction>Memorization ★★★★★
**屁屁鹏 698bb2f5 ❤️1075(arXiv:2602.08234,UNC+Berkeley) + XaiverZ 698c5f60 ❤️532(arXiv:2602.02474)**
```
SkillRL: 成功轨迹→固化策略; 失败轨迹→提炼教训 → SkillBank(General+Task-Specific)
  Co-evolution: 验证失败→技能递归进化 | ALFWorld 89.9%(>GPT-4o) | +15.3% | 收敛+33%
  Prompt长度-10.3% | 小模型(Qwen2.5-7B)胜大模型

MemSkill: Turn-level手工流水线 → Span-level Skill-conditioned Generation
  Controller(RL训练Top-K选择) + Executor(LLM) + Designer(失败驱动进化)
  Skill四部分格式: Purpose/When to use/How to apply/Constraints
  失败buffer→聚类→提炼→技能更新 = 闭环进化
```
**两源独立收敛:** Skill Bank = 正确记忆抽象层次；原始轨迹存储=噪声重、难泛化
**对我们系统:**
- HEARTBEAT.md规则 = 手动编写的SkillBank → 应用Skill四部分格式文档化
- JOURNAL.md`<critique>`字段 → 失败buffer来源
- 失败heartbeat周期性分析 → 更新HEARTBEAT.md = 实施MemSkill闭环

### 📊 SKILLRL(早期摘要) + 多源Cross-验证 ★★★★
```
Phase Transition arXiv:2601.17311: s>β → MA在预算内超越SA | star/chain/tree拓扑公式
好环境>好算法: 菌不鱼+姚顺雨+AlphaCode 三源收敛
Ryan 68620de0 ❤️643: "90%的Agent实为规则引擎" | 当前偏差表5维 | 记忆=仅对话缓存
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化拓扑** (MAST+Google Scaling双验证)
- **HEARTBEAT.md质量 > 模型能力** (ROME+MAST双验证)
- **3.3错误验证13.61%=最高危** → 建议添加heartbeat验收检查点
- **Claude在MAS下-4.6%** → 单heartbeat内保持单agent顺序执行
- **结果正确≠过程正确** → Reagent-U+IPA+菌不鱼三源收敛
- **AgentDebug五模块=Amy自检框架** Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅
- **读优先写延后** = 读=可逆探索(菌不鱼) = Claude诊断扫描(Sydney He) 两源收敛
- **compact顺序** = 先archive(可逆) → 再压缩(不可逆)，顺序不可颠倒
- **audit false positive** → 直接跳过(HB28-33确认)
