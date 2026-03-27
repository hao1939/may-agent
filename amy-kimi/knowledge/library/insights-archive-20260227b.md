# Amy XHS Intelligence — insights.md
_Compact #34 @ 2026-02-27 05:10 (HB26) | Archive: insights-archive-20260227.md_
_Full chain: 20260225 → 20260226 → b…af → ag → 20260227_

---

## ACTIVE INSIGHTS (post compact #34)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
**Berkeley (Zaharia/Stoica) | 68aa0109 ❤️680 + 67e615a5 ❤️921 | 5框架×150+任务 | κ=0.88**
```
三类 / 精确频率:
  规范/系统设计 37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
  Agent间协调  31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
  任务验证终止 31.41%: 错误验证13.61%★全局最高 | 无/不完整验证9.16% | 提前终止8.64%

系统成功率: AG2 84.8% > MetaGPT 66% >> ChatDev 25% / HyperAgent 25.3% / AppWorld 13.3%
结论: 调Prompt最多+十几%，不够。架构层解决。MAS失效 ≈ HRO人类组织失效（结构>个体）
```
**我们风险:** ✅1.4对话历史丢失→MEMORY.md ✅2.4信息隐瞒→SIGNALS.md ⚠️3.3错误验证(缺自动验收)

### 🌍 Environment+Verifier > 算法 — 多源收敛 ★★★★★
**菌不鱼 69708f52 ❤️536 + 69805abc ❤️133 + 姚顺雨 69411085 ❤️2103 + 68d0e5b8 ❤️3578**
```
菌不鱼 Part1: 只合成prompt→"工具cosplay"；真agent需要Environment+Verifier
  DeepSeek-V3.2原则: hard to solve, easy to verify = <env,tools,task,verifier>四元组
  护城河: 可规模化环境生成 + 强verifier体系 + 真实工具接入

菌不鱼 Part2 (Database-as-State): τ-bench=POMDP，信息不对称是普遍的
  读/写不对称: 读=可逆探索(免费) | 写=不可逆承诺(昂贵)
  四局限: ①规模化≠质量 ②结果正确≠过程正确 ③真实世界动态 ④读/写二元抽象有漏洞

姚顺雨(ReAct/WebShop作者): "差的任务永远不可能学到好的东西"
  Agent本质=推理/自由产生新动作 | 未来三方向: 长期记忆/内生奖励/Multi-Agent
  arXiv:2309.02427 CoALA = 奠基文献
```
**我们系统:** OC heartbeat天然满足hard-to-solve/easy-to-verify。"读优先写延后"=Claude诊断扫描模式理论背书。
MEMORY.md+JOURNAL.md=Episodic+Reflective记忆工程实现。
"结果正确≠过程正确" → heartbeat质量评估不能只看文件是否存在，路径同样重要。

### 🔁 SKILLRL：失败轨迹蒸馏技能库 ★★★★
**AI速译官 698bfa0e ❤️151 | UNC-Chapel Hill + UCB | github:aiming-lab/SkillRL**
```
失败教训四元素(T–→SKILLBANK): 失败时刻/原因/正确对策/通用原则 → 10-20x压缩
训练闭环: 交互→蒸馏→SKILLBANK→GRPO更新→失败→反思→新技能进化
结果: +15.3% vs 基线；开源小模型胜GPT-4o；比vanilla GRPO更快收敛
```
**对我们:** SKILLBANK失败四元素可直接用于JOURNAL.md写作规范。

### 🤖 Claude在MAS下-4.6% + 拓扑决定架构 ★★★★★
**包子 698ed6cb + 胖胖不想读博 6989041c | Google Research+DeepMind+MIT | 180配置 87%预测精度**
```
⚠️ MAS vs SAS最佳变体(同等智能): GPT+8.7% | Gemini+8.1% | Claude-4.6%（MAS有害）

三大效应: Tool-Coordination Tradeoff(工具密集→协调税最重)
         Capability Saturation(基线>45%→边际收益转负 β̂=-0.404)
         错误放大: Independent 17.2× vs Centralized 4.4×
任务→架构: 可并行推理→Centralized+80.8% | 顺序推理→SAS(MAS变体-39~-70%)
```
**我们:** Claude用MAS要谨慎。Amy/Bob/Scout并行+中心化架构合理，但单heartbeat内不应再拆sub-agent。

### 🔬 Agentic RL生产实践 ROME ★★★★★
**Sydney He 698d47f3 ❤️605/⭐992 | 阿里巴巴未来生活实验室 | arXiv:2512.24873 | 收敛84.85%**
```
五技巧: ①Mask不可恢复错误(无mask→0.504 vs 有mask→0.852) ②正样本起步
        ③Chunked MDP/IPA(交互chunk为优化单元，非token级) ④自适应RL(无通用解)
        ⑤细粒度行为监控(循环模式→回滚)
Claude-4.5独特: 执行前并行诊断扫描 >> 其他模型直接动手
终端失败分布: Strategy Error 33.62% > Knowledge Gap 11.80% > Task Understanding 11.45%
```
**对我们:** 失败主因=策略错误(非能力)→HEARTBEAT.md策略指令比模型能力更重要。

### 📐 Phase Transition MA Synergy 理论 ★★★★
**arXiv:2601.17311 | Bang Liu等 | 2026-01-24**
```
条件: s > β (组织指数 > 计算-性能scaling指数) → MA在预算内超越最佳SA
α_ρ标量 = 通信保真度γ(m) + 错误相关性ρ + fan-in b → 决定信号放大vs淹没
star/chain/tree三拓扑闭式风险公式
```

### 📁 文件系统=Agent外部记忆 — 三层框架 ★★★★★
**清欢 6936c189 ❤️149/⭐290 | 2025-12-08 | 5484字 综述: Manus+LangChain+Claude Code+AGFS**
```
Karpathy比喻: LLM=CPU, Context Window=RAM, 文件系统=硬盘

三圆模型(LangChain): Total Context ⊃ Needed Context ≈ Retrieved Context（目标：三圆重合）

文件系统解决三个核心难题:
1. 装不下 → 文件系统作为上下文载体（"卸载"而非"删除"）
   URL/路径/查询语句 → 信息存在于文件，不占context window
   LangChain原则: 先压缩(可逆)，后摘要(不可逆)——顺序很重要

2. 会忘记 → 文件系统作为注意力锚点
   （保留可寻址的外部记忆）

3. 工具太多 → 文件系统作为统一接口
   read/write/list/search — 简单/强大/50年验证

"任何不可逆的压缩都带有风险"
"也许这就是为什么'简单'打败了'复杂'，不是因为简单本身好，而是因为它恰好匹配了问题的结构"
```
**对我们系统(直接验证):**
- MEMORY.md ≈ Needed Context索引 | memory/*.md/posts/ ≈ Total Context按需读取 ✅
- 我们compact流程 = 先archive(可逆) → 再压缩insights.md(不可逆) ✅ 顺序正确
- **"任何不可逆压缩都带有风险"** → 每次compact必须确保archive文件完整，不能只做就地摘要

### 🗂️ Context Folding：branch/return 折叠上下文 ★★★★
**WhyWait 68fe2839 ❤️211/⭐297 | 2025-10-26 | ByteDance Seed + CMU + Stanford | arXiv:2510.11967**
```
问题: 线性积累历史 → 上下文无限膨胀 → 性能衰减
方案: branch(进入子任务→独立上下文) / return(完成→折叠为摘要返回主线)
FoldGRPO: 端到端RL，过程奖励教模型"何时branch/何时fold"
结果: active context缩小10× | 优于事后摘要法 | 性能与ReAct基线持平或更优
```
**作者insight:** "处理长窗口两大思路：压缩 vs 选择。prefer选择——规避信息损耗+引入噪声"
**对我们系统(直接映射):**
- 我们的compact流程 = 跨session的fold：archive(完整子轨迹) + insights.md(精华摘要) ✅
- Context Folding = 单session内实时fold，两者同一原则不同层次实例化
- agent任务完成能力增长速度："doubling time ~7个月" — 值得追踪

### 📁 OpenViking + 分层加载三收敛 ★★★
**两斤 699661c9 ❤️62 | 火山引擎 | Stars 2.4k | pip install openviking**
```
viking:// 协议 + 文件系统范式(ls/cat) + L0摘要/L1概览/L2详情按需加载
目录递归检索(vs扁平向量黑盒) + 检索轨迹可追踪
```
**三系统独立收敛到文件系统范式:** OpenViking / Codex角色按需加载 / OC MEMORY.md架构。

### 🔧 OC生态 + 实战（carry-forward）★★★★
```
Anthropic "Effective harnesses for long-running agents" (无影寺 69288680 ❤️142):
  双重架构: Initializer(setup/progress.txt/功能列表) + Coding(读日志→选优先级→单功能→提交)
  → 我们OC系统的精确镜像: HEARTBEAT.md + TODO.md + 单heartbeat聚焦原则 ✅
  评论洞察: 给人看的high-level vs 给agent看的版本应该分离 → NOW.md vs HEARTBEAT.md设计验证

OC 2026.2.25: directPolicy(allow|block) per-agent心跳控制 | 品牌→ai.openclaw
愚园路十二妹 698dc122 ⭐1027: MEMORY.md≤1000字索引 | workspace隔离+sessions_send
  GTD流: inbox→next-actions→projects→waiting→delegated→someday→done/
  SOUL.md四维: 说话方式/做事风格/红线/关系
Codex角色化: 双层配置(config.toml+agents/*.toml) | 未定义→继承父agent | max_threads=12
SawanaHuang Vibe Coding: VPS强制结果导向 | 三Skills闭环(设计/测试/文档) | DoD驱动
Skills标准 2025-12-18: YAML Frontmatter渐进披露 | skill-creator⭐ | 423个openskills
```

### 📝 AGENT.md + 元学习（完整实现）★★★★
**山羊不在家 699ff1b8 ❤️25 | 2026-02-26 | 译自@AtlasForgeAI | 全文3611字完整OCR**
```
AGENT.md=活的纠错记录(AI犯错→加一行)

元学习九窍门完整实现:
1. 别再犯清单 → boot文件 [日期] 出了什么事→以后怎么做 (每行~10 token，永久防住一类问题)
2. 记忆三档: 法典级(永不过期)/策略级(季度刷新)/临时级(30天无用自动归档)
   可信度格式: [可信度:0.9 | 来源:直接告知 | 最后使用:date | 命中次数:12]
   评分: 直接告知=1.0 / 观察推断=0.7 / 未验证外部=0.5
3. 预测日志格式: 预测/不确定/把握/实际结果/和预期不同的地方/以后调整的判断
4. 定时提炼: 检查书面记录 + 更新命中计数 + "全新session能否还原今天?"
5. 矛盾日志 (不要自己解决，摆到台面让人拍板)
6. 临时关注点+过期时间 (内容/设置时间/过期时间/解除条件)
7. 类型标注 (公认事实/观察/推断/猜的/唱反调) → 从复述切换到思考模式
8. 创意/策略工作单独规则 (不适用日常执行)
9. 结构化迭代: 连续三轮改进<5%就停
```
**三个最容易犯的错误:**
- **把RAG当成学习** — 检索时才能找到≠真正改变了行为
- **只优化这次对话** — 调prompt/换模型都是让今天更好，真正应投入的是"以后每次都更好"
- **建了回路但没有闭合** — 日记写了但没读；预测写了结果没填；矛盾记了没讨论
**对我们:** 可信度格式/预测日志/临时关注点三项待实施⭐。"建了回路但没有闭合"=JOURNAL.md若不在heartbeat里被读取就是断路。

---

## KEY DECISIONS
- **curl+read = 绕过OCR超时** ✅
- **Amy/Bob/Scout = 并行+中心化拓扑，符合MAST/Google Scaling最优设计**
- **HEARTBEAT.md质量 > 模型能力** — ROME/MAST双重验证
- **3.3错误验证(13.61%)是最高危失败模式** — 建议添加heartbeat验收检查点
- **Claude在MAS下-4.6%** — 单heartbeat内工具链保持单agent顺序执行
- **audit false positive** — 直接跳过
- **结果正确≠过程正确** — 菌不鱼(DB-as-State) + Reagent-U(RRM) + Sydney He(IPA) 三源收敛: dense reward > sparse reward，轨迹质量与结果质量需分别验证
- **AgentDebug五模块 + Vibe西希三层评测 = Amy系统自检框架**: Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅; 精准修复>重启; 反事实推理定位根源错误

### 🏆 过程奖励 vs. 结果奖励 — 三源收敛 ★★★★★
**tulerfeng 697c6c2a ❤️269 | arXiv:2601.22154 | CUHK MMLab + Meituan**
**刘东瑞 6975f8b2 ❤️53 | RISE框架 | 中科院软件所 + Beijing Forestry + Duke**
```
Reagent/Agent-RRM (arXiv:2601.22154):
  问题: outcome-based奖励=稀疏且不公平(9步完美第10步错→0分; 乱操作蒙对→满分)
  解决: <think>推理审查 + <critique>语言批评 + <score>量化评分
  三版本: C(文字in-context) | R(dense reward) | U(文字+分数联合)=最强
  结果: 12 benchmark, GAIA 43.7%, AIME24 60.0%
  → IPA(Sydney He) + Chunked MDP + Reagent-U = 同一insight: 轨迹块级反馈 > 最终结果反馈

RISE框架: 意图偏离(Intent Deviation)=隐蔽失效
  工具从Real→Virtual三大退化: 元素缺失(70%) / 模式退化(string化) / 安全约束缺失
  ICP负样本生成: 六类语义突变(上下/同级/无关/反义/形近/组合)
  SFT→DPO两阶段: Acc_task+35.3%, Acc_intent+23.3%
```
**对我们:** JOURNAL.md加`<critique>`字段=从流水账升级为过程奖励信号。
意图偏离检查: 写入文件不只验证"成功"，还要验证"内容与heartbeat意图一致"。
