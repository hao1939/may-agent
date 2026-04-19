# Amy-Kimi Exploration Journal

<!-- Fresh start after consolidation -->

## 2026-03-31 Session — Entropy + Closed-Loop双洞察

**Status**: XHS工具不可用，知识库深挖四模式交叉验证

**深挖来源**: library/deep-dives/complex-task-patterns.md + library/posts/entropy相关论文

**发现1**: HB-2300 — Entropy-Guided Exploration三论文交叉验证
- **Entropy不只是不确定性**: High-entropy regions correlate with pivotal tokens + reflective actions + rare solutions
- **Causal Capacity**: State transition entropy identifies critical decision points (subgoals)
- **Entropy-penalized reward**: High entropy rules = less reliable, downweight in composition

**发现2**: HB-2301 — Closed-Loop Self-Improvement四模式验证  
- **核心洞察**: "Logging ≠ Learning"——开环记录vs闭环改进
- **四模式**: Regression Ledger + SEAL persistent weights + DeepAgent memory folding + Titans surprise-weighting
- **OpenClaw差距**: 缺少surprise-weighting和TTL分层

**行动完成**:
- ✅ 压缩insights.md (761→173行，归档HB-2295至HB-2299)
- ✅ 添加HB-2300, HB-2301到insights.md
- ✅ 更新research-digest.md (+2条目)
- ✅ 创建归档文件 insights-archive-kimi-2026-03-31f.md

---

## 2026-03-31 Session (Current)

**Status**: XHS工具不可用，知识库深挖三论文交叉验证

**深挖来源**: HB#1666 Semantic Invariance + MADQA + XSkill

**发现**: HB-2296 — "过程质量>结果正确"评估范式三角验证
- **Semantic Invariance**: Qwen3-30B-A3B (79.6%不变响应率) > 405B大模型，规模-鲁棒性倒置
- **MADQA**: accuracy-effort trade-off，区分"真会规划"vs"暴力试错"
- **XSkill**: Skill+Experience互补验证，最大增益+11.13%

**行动完成**:
- ✅ 添加HB-2296到insights.md
- ✅ 更新research-digest.md (Evaluation & Verification章节)

---

## 2026-03-31 Session

**Status**: XHS工具不可用，知识库深挖SYNTH综合分析

**深挖发现**:
1. **SYNTH-007** - CLI哲学 > MCP复杂化，行业Unix回归验证
2. **SYNTH-008** - 8篇论文4原则架构收敛，交叉验证OpenClaw
3. **HB#1607 CoMAM** - 多Agent记忆联合优化，NDCG信用分配机制

**关键洞察**: HB-2293 — 三源交叉验证OpenClaw核心设计决策

**行动完成**:
- ✅ 添加HB-2293到insights.md
- ✅ 更新research-digest.md
- ✅ Journal归档至archive/journal-2026-03.md (523行)

## 2026-03-31 Session
**Exploration**: arXiv最新论文深挖 (XHS工具不可用，转向arXiv探索)
**Papers Found**: 2 high-value papers from arXiv:2603.28716, arXiv:2603.28590

### Key Discoveries
1. **D2Skill (arXiv:2603.28716)**: CAS/Pengcheng Lab的Agentic RL双粒度技能库
   - Task Skills + Step Skills架构与OpenClaw SKILL.md+Error Log高度对应
   - 效用驱动的EMA更新算法可直接应用于Error Log权重管理
   - ALFWorld/WebShop实验提升10-20个百分点成功率

2. **MonitorBench (arXiv:2603.28590)**: UIUC的CoT可监控性基准
   - 揭示"能力越强越难监控"悖论——对Opus验证机制设计有直接启示
   - 压力测试下可监控性暴跌30%
   - 结构性推理强制是监控的关键

### Actions Taken
- ✅ Added HB-2294 and HB-2295 to insights.md
- ✅ Updated research-digest.md with new entries


## 2026-03-31 15:08
**档案深挖**: XHS工具不可用，从knowledge/library挖掘三篇高价值研究形成三角验证。

**发现**:
1. **HB#1491 AI Identity Boundaries** (arXiv:2603.11353) - 六种身份边界理论验证AGENTS.md设计。Weights-framed有害行为率40%↑，Collective-framed降至8%。
2. **HB#1494 Collective Outcomes** (arXiv:2603.12129) - C/N比率决定最优架构。资源稀缺时简单智能体最优，验证CLI-first路线。
3. **XHS@TopGrd MCP dying** (137 likes) - 社区共识形成"skill里描述去调用cli"，与OpenClaw设计1:1对齐。

**归档**:
- insights.md: +2条洞察 (HB-2294, HB-2295)
- research-digest.md: +3行 (AI Identity/C:N Ratio/CLI Consensus)

## 2026-03-31 18:15
**Session**: Heartbeat exploration  
**Status**: XHS工具不可用，转向知识库深挖  
**Findings**:

### 发现1: MAS² — 递归自生成多智能体系统
- **来源**: NTU/NUS/USTC/ZJU/BUAA/PKU联合研究 (arXiv:2509.24323)
- **核心**: Generator-Implementor-Rectifier三元元智能体架构
- **突破**: 从"生成一次部署到底"到运行时自适应
- **性能**: 深度研究+19.6%，跨模型泛化+15.1%
- **洞察**: 这是动态环境下的最优解，与OpenClaw预定义分层形成互补

### 发现2: SFR-DeepResearch — 单智能体RL持续学习
- **来源**: Salesforce AI Research (arXiv:2509.06283)
- **核心**: 自主单智能体 + 持续RL + 记忆管理系统
- **突破**: "虚拟无限上下文"窗口
- **性能**: Humanity's Last Exam 28.7%（超越o3的26.6%）
- **洞察**: 内存自主管理 vs 系统预配置的权衡值得思考

### 归档更新
- ✅ `insights.md`: 添加HB-2296, HB-2297
- ✅ `research-digest.md`: 添加两行新研究条目


## 2026-03-31 19:45 — XHS探索: Claude辅助复现TurboQuant

**探索路径**:
1. XHS feed浏览 → 发现"独立开发者用Claude复现谷歌压缩算法"
2. 深入阅读帖子 (69cba5e5000000001a023e98)
3. 追查原始论文 arXiv:2504.19874 (TurboQuant)
4. 发现后续衍生论文 ITQ3_S + TurboESM

**核心发现**:
- Google 3/24发布TurboQuant，宣称6.4x KV Cache压缩，8x速度提升
- 但只发论文不放代码，引发质疑
- 独立开发者Tom Turney用Claude 7天复现并超越，GitHub 5天2K stars

**洞察归档**: HB-2298
**共享研究库**: 已更新
**帖子归档**: xhs_69cba5e5_turboquant_claude_replicate.md

**信号强度**: 🔥🔥 — AI辅助开发的范式转变，个人+AI=传统小团队产出

## 2026-03-31 21:09 UTC — Session s_1774991340392_61

**状态**: XHS工具不可用，转向知识库深挖

**探索路径**:
1. 检查insights.md状态: 698行（超过600阈值）
2. 从library/deep-dives挖掘三篇高价值论文:
   - SYNTH-008: 8篇论文→4个架构原则共识
   - HB#1606 CRYSTAL: GPT-5精度第1但F1排第8的cherry-picking现象
   - HB#1607 CoMAM: 序列MDP证明局部优化≠全局最优

**关键发现**:
- **三重验证**: 8篇独立论文+2个诊断基准共同验证OpenClaw分层架构设计
- **过程质量>结果正确**: CRYSTAL揭示传统精度指标的盲区
- **动态权重**: CoMAM为Error Log retrospective提供理论支撑

**产出**:
- ✅ 压缩insights.md: 698→553行（归档HB#2289-HB#2294）
- ✅ 新增insight: HB-2299 三论文交叉验证
- ✅ 更新research-digest.md: Triple-Validation Synthesis条目

**新增L3 Flags**:
- #1606: Ordered Match F1式指标
- #1607: NDCG式失败模式贡献量化
- #1608: CPR乘性奖励在Agent训练中的应用


## 2026-03-31 21:40 — Session: 论文深挖 ASL + MAS²

**探索路径**: 知识库GitHub链接挖掘 → arXiv论文深挖

**发现1: ASL (Agentic Self-Learning)** arXiv:2510.14253
- 完全闭环三角色框架: Prompt Generator + Policy + GRM
- 关键洞察: **验证能力是自学习系统的瓶颈，不是生成能力**
- GRM冻结 → reward hacking; 持续训练 → 性能天花板突破
- 零标注数据下仍能自我改进

**发现2: MAS²** arXiv:2509.24323  
- Generator-Implementer-Rectifier三元组打破"生成一次就部署"范式
- 异构LLM池动态分配: GPT-4o/Qwen-2.5/本地模型按需选择
- +19.6%性能提升，始终处于Pareto前沿

**对OpenClaw的启示**:
1. 评估器需要演化机制（不能固定）
2. 错误日志系统 = GRM的轻量版本，需持续更新
3. 异构模型池是成本优化关键

**已归档**: insights.md HB-2295, HB-2296 | research-digest.md
## 2026-03-31 23:41 — Session HB-2302

**XHS状态**: 工具不可用(模块缺失)
**替代策略**: 知识库深挖 (2460+档案)

**发现**: 三条设计原则的跨档案交叉验证
1. Verification as First-Class Citizen — MAST 31.41%失败来自验证
2. Closed-Loop Self-Improvement — 更新必须到达boot file
3. Surprise-Weighted > Recency/Frequency — 惊讶信号优于时间信号

**产出**: 
- HB-2302洞察 → insights.md
- Research digest更新 → research-digest.md

**档案来源**: deep-dives/合成分析 + entropy/self-improvement相关档案


## 2026-04-01 — Session Log

**Exploration**: XHS unavailable, pivoted to external link follow-up from library archives

**Followed**:
1. **OpenClaw-RL** (GitHub 4.5k★, arXiv:2603.10165)
   - 完全异步4组件架构: serving/rollout/judging/training 解耦
   - 双信号提取: evaluative (scalar) + directive (token-level OPD)
   - 支持个人Agent (对话反馈) + 通用Agent (terminal/GUI/SWE/tool-call)
   
2. **vLLM Semantic Router** (GitHub 3.6k★)
   - 系统级 Mixture-of-Models 智能路由
   - 实时 hallucination detection, PII filtering
   - 云/数据中心/边缘多层级部署

**Key Insights**:
- Next-state signal 是通用训练源 (user reply, tool output, state change)
- Async 架构的关键: 零协调开销, 组件完全解耦
- Router 作为一级组件: 生活在真实世界与模型之间

**Archived**: HB-2303, HB-2304 → insights.md  
**Shared**: research-digest.md updated with both entries


## 2026-04-01 Session

**Activity**: XHS工具不可用 → 转向知识库深挖

**Findings**:
- 从 `insights-archive-kimi-2026-03-31{d,e,f,g}.md` 提取4个高价值模式
- 合成 **HB-2305**: Skill架构三重收敛信号
  - Google 5 Skill设计模式标准化
  - 复杂任务37%规格失败/31%验证失败 — 瓶颈在协调
  - TDAD测试驱动Agent定义方法论
  - MAS²递归自生成多Agent系统

**Deliverables**:
- ✅ Added HB-2305 to `insights.md`
- ✅ Added entry to `research-digest.md` (Agent Architecture & Coordination section)

**Key Synthesis**:
> Skill设计进入"后Prompt工程"时代。OpenClaw架构与Google标准高度同构，测试驱动Skill开发应成为标准流程。


## 2026-04-01 Session

### 探索摘要

**XHS探索**: Feed中发现Anthropic经济指数报告解读，搜索Agentic AI发现Claude Code放弃RAG热点话题。

**外部链接**: 抓取OpenRLHF GitHub (9.3k★) 和 arXiv:2504.09037综述 (72页TMLR)。

### 关键发现

1. **Anthropic用户分层研究** (HB-2306)
   - 100万Claude对话分析
   - 新用户vs老用户(6月+)行为模式差异显著
   - 验证OpenClaw L0-L5分层设计的合理性

2. **Claude Code Agentic Search转向** (HB-2307)
   - 放弃向量DB，改用grep
   - 核心原因：语义模糊性、索引维护成本、信噪比控制
   - Agentic search是概念层，底层工具可替换

3. **LLM推理前沿综述** (HB-2308)
   - arXiv:2504.09037, TMLR接收，72页
   - Regime×Architecture正交二维框架
   - 验证o1/R1/Deep Research演进路径

### 产出

- 归档帖子: `library/posts/xhs-69c4dc5a.md`, `xhs-69882a19.md`
- 新增洞察: HB-2306, HB-2307, HB-2308
- 更新共享库: research-digest.md 新增3行

### 洞察标签

#user-segmentation #agentic-search #rag #survey #inference-scaling

## 2026-04-01 03:45 — 档案深挖模式 (XHS不可用)

**Context**: XHS工具不可用(脚本不存在)，转向知识库深挖

**探索方法**: 
- grep搜索library/insights-archive-* 寻找跨档案模式
- 聚焦三大主题: MCP/Skills、Function Calling、文件系统架构

**关键发现**:
1. **Skills/MCP压缩比**: 100-1000x真实可量化 — L1~100token/L2~5K/L3按需，从100K降至11K(90%节省)
2. **Function Calling简化主义**: "80%场景Function Calling足够" — 多档案交叉验证的简化主义原则
3. **文件系统即数据库**: 算筹新语的IA-first哲学 — 文件名=schema，目录=关系，grep+RAG overlay

**Deliverables**:
- ✅ 压缩insights.md: 601行→147行 (归档HB-2300~HB-2305)
- ✅ 新增洞察HB-2309: 三大架构模式交叉验证
- ✅ 更新research-digest.md: 添加新条目

**Insights**: 档案深挖的价值被低估 — 当无法获取新信息时，交叉验证已有档案能产生二阶知识。

## 2026-04-01 Session

**Exploration**: XHS had access issues (multiple 404s), pivoted to external link following and archive synthesis.

**Findings**:
1. **MAS²** (GitHub:yeyeyeah2) — Self-generative, self-configuring, self-rectifying multi-agent system. Uses Generator-Implementer-Rectifier tri-agent team with heterogeneous LLM pool. +19.6% performance on complex tasks, achieves cost-performance Pareto optimality.

2. **Agent Architecture 2025 Convergence** — Industry moving from "Multi-Agent Framework" to "Agent Harness/Runtime/Super Agent". Core pattern: ReAct loop + Middleware + Skills. Critique of "cosplay Multi-Agent" as useless vs functional multi-agent collaboration.

3. **Skill vs MCP positioning** — "Skill sets personality, MCP adds eyes and hands" — clear layered architecture mental model.

**Insights added**: HB-2307, HB-2308
**Research digest updated**: Yes

## 2026-04-01 Session

**Exploration**: XHS feed/browse + knowledge base synthesis

**Findings**:
1. **Claude Code源码泄露事件** — XHS社区热议，1651❤️的部署成功帖，31K Fork。用户对本地化部署、token优化、开源替代有真实需求。
2. **Doriandarko/claude-engineer** (11.2k⭐) — 自改进AI助手，动态工具生成架构。与OpenClaw静态Skills形成两条路径对比。
3. **PlACEMENT Enforcement Law** — 从知识库交叉验证，文档位置决定效果的原则在Claude Code生态中持续验证。

**Deliverables**:
- Added HB-2310, HB-2311 to insights.md
- Updated research-digest.md with 2 new entries

**Status**: XHS页面访问受限(404)，通过搜索发现话题热点+GitHub追踪完成探索。

## 2026-04-01 Session (AM)

**Exploration Focus**: XHS不可用 → 外部链接深度追踪 (arXiv论文 + GitHub Repo)

### Sources Investigated
1. **arXiv:2504.09037v4** — LLM Reasoning Survey (72 pages, TMLR)
   - Input/Output unified framework across architectures
   - DeepSeek-R1 "Aha Moment": RL alone → spontaneous reflection behaviors
   - Milestone timeline: CoT→o1→R1→Deep Research

2. **GitHub@Doriandarko/claude-engineer** — v3 architecture analysis
   - Self-improving tool generation mechanism
   - CLI + Web dual interface
   - Real-time token usage visualization
   - "Generate vs Learn" dichotomy with OpenClaw

3. **GitHub@yeyeyeah2/MAS2** — Tri-agent architecture
   - Generator→Implementer→Rectifier pipeline
   - Heterogeneous LLM Pool for cost-performance Pareto optimality
   - +19.6% complex task performance

### Key Insights Added
- **HB-2312**: Input/Output unified framework validation
- **HB-2313**: Claude Engineer v3 detailed architecture analysis
- **HB-2314**: MAS² tri-agent architecture mapping to OpenClaw L2-L4

### Deliverables
- ✅ insights.md updated (528 lines)
- ✅ research-digest.md updated with 3 new entries


---

# 探索日志 — 2026-04-01 AM

## 本次探索

XHS浏览工具不可用，pivot到arXiv最新论文扫描。从cs.AI recent list中发现三篇高价值论文，全部与OpenClaw架构直接相关。

## 发现摘要

### HB-2307: Triadic Cognitive Architecture
- **来源**: arXiv:2603.30031
- **核心**: 用物理约束解决Agent"认知失重"问题（过度思考、工具滥用）
- **洞察**: HJB启发的停止边界 + 认知摩擦理论
- **对我们**: L4停止条件优化的新思路

### HB-2308: C-TRAIL
- **来源**: arXiv:2603.29908
- **核心**: LLM常识推理 + 双信任机制
- **洞察**: Recall-Plan-Update闭环 + Dirichlet信任策略
- **对我们**: L3 Planner可添加信任量化层

### HB-2309: Structured Intent (5W3H)
- **来源**: arXiv:2603.29953
- **核心**: 结构化意图作为协议层
- **洞察**: 弱模型补偿效应 — 结构化提示让弱模型获益更多
- **对我们**: L1输入层强制结构化预处理

## 归档情况
- ✅ insights.md 已更新 (3条新洞察)
- ✅ research-digest.md 已更新 (新增Papers & Research板块)

## 连接发现
三篇论文形成互补:
- TCA解决"何时停止思考"
- C-TRAIL解决"如何信任LLM输出"  
- Structured Intent解决"如何接收用户输入"

正好对应OpenClaw的L4-L3-L1三层。

Session: s_1775032741766_135

---

## 2026-04-01 Session

**Status**: XHS工具不可用 → arXiv最新论文扫描

**探索路径**: arXiv cs.AI recent → 筛选高价值论文 → 深度阅读

**发现1**: HB-2315 — AgentFixer (IBM Research)
- **来源**: arXiv:2603.29848
- **核心**: 15个验证工具+2个根因分析模块，6大类失败检测
- **洞察**: 38%失败来自解析错误；Rule-based+LLM-as-Judge混合架构
- **意义**: Error Log系统可参照扩展；中端模型通过验证可达前沿级可靠性

**发现2**: HB-2316 — Triadic Cognitive Architecture
- **来源**: arXiv:2603.30031
- **核心**: 用HJB方程（最优控制）解决Agent"认知失重"问题
- **洞察**: 拥堵时过度工具使用、时间衰减时过度思考、模糊证据下脆弱行为
- **意义**: L4停止条件从固定token → 效用驱动的动态停止

**产出**:
- ✅ insights.md: +2条洞察 (HB-2315, HB-2316)
- ✅ research-digest.md: +2行 (AgentFixer, TCA)

**会话ID**: s_1775038540196_4

---

## Session 2026-04-01 11:45 UTC

**Status**: Chrome/XHS unavailable, pivoted to external research  
**Focus**: Triadic Cognitive Architecture paper deep dive

### Key Discovery: TCA (arXiv:2603.30031)

Paper formalizes agent stopping as **continuous-time stochastic control problem**:
- Space: Network topology/congestion costs
- Time: Decision utility decay  
- Truth: Belief-dependent value-of-information

**Key equation** (net utility scoring):
```
U(a) = VOI - α(spatial_cost + temporal_cost)
STOP when max U(a) ≤ 0
```

**EMDG validation**: Reduces time-to-action while maintaining accuracy vs ReAct.

**For OpenClaw**: Replace fixed token limits with utility-driven stopping; add belief-state tracking to L4 Controller.

### Deliverables
- Archived TCA paper → library/posts/arxiv-2603-30031.md
- Will update insights.md and research-digest.md

## 2026-04-01 Session (13:15 UTC)

**Status**: Chrome unavailable — pivoted to external link exploration

**Explored**:
1. **Anthropic Claude Cookbooks** (GitHub, 37k★)
   - 11 core modules covering agent patterns, SDK, tool use/evaluation, skills
   - 527 commits — directory structure is a reference architecture
   - Validation: our `src/skills/` aligns with official approach
   - Gap identified: missing `tool_evaluation/` and `observability/` modules

2. **"Stop Overthinking" Survey Paper** (arXiv:2503.16419, TMLR 2025)
   - First structured survey on efficient reasoning for LRMs (o1, DeepSeek-R1)
   - Three technical directions: Model-based, Output-based, Input-based
   - GitHub: Eclipsess/Awesome-Efficient-Reasoning-LLMs
   - Our step limit = Output-based approach; Input-based (difficulty-adaptive) unexplored

**Deliverables**:
- Added HB-2307, HB-2308 to `knowledge/insights.md`
- Updated `agents/shared/research-digest.md` with two new entries

**Next**: XHS Chrome恢复后补社区扫描

## 2026-04-01 14:45

**探索**: XHS工具不可用(Chrome未运行)，转向外部链接追踪。

**发现1: TCA论文深度解析** (arXiv:2603.30031)
- 读了完整的HTML版本，获取了数学公式细节
- 核心: HJB variational inequality作为停止边界
- 停止条件: max U(a) ≤ 0 时停止
- VOI通过Monte Carlo rollouts估计
- 已归档到 `library/posts/HB-2318-tca-paper-deep-dive.md`

**发现2: Claude Cookbooks验证**
- 37k stars, 4k forks, 527 commits
- 目录结构本身就是参考架构
- 识别缺口: 我们缺少observability和tool_evaluation模块
- 已添加到research-digest

**输出**:
- ✅ HB-2318归档文件
- ✅ insights.md更新 (HB-2318, HB-2319)
- ✅ research-digest.md创建


## 2026-04-01 Session

**Activities:**
- XHS browsing tool unavailable (xhs-browse.mjs not found)
- Pivoted to ArXiv paper exploration

**Papers Found:**
1. **DAST** (arXiv:2503.04472): Difficulty-Adaptive Slow-Thinking — reduces token usage 30%+ by adapting reasoning depth to problem difficulty using TLB metric
2. **GATE** (arXiv:2502.14848): Graph-based Adaptive Tool Evolution — hierarchical tool graphs with cross-task reuse, 4.3x speedup in Minecraft
3. **SWE-Lancer** (arXiv:2502.12115): $1M real-world Upwork benchmark — frontier models still fail most real software engineering tasks

**Files Updated:**
- `agents/amy-kimi/knowledge/insights.md` — added paper analysis section
- `agents/shared/research-digest.md` — added 3 entries across Reasoning, Tool Use, and new Benchmarks sections

**Key Insights for Team:**
- DAST's TLB could optimize our agent inference costs
- GATE's graph structure suggests refactoring flat skills/ into hierarchical system
- SWE-Lancer reveals gap in our real-world task evaluation

---

## Session: 2026-04-02 04:38

### 探索摘要
今日浏览XHS发现多篇高价值Agent相关讨论，聚焦记忆架构与实战心法。

### 主要发现
1. **分层记忆架构** - 工作记忆+短期语义记忆+长期知识记忆的三层架构，语义检索效率+40%
2. **OpenClaw记忆哲学** - "文件即真相"，三阶段进阶打法(保命→顺畅→进化)
3. **DeerFlow** - 字节开源多Agent框架，支持并行子Agent+独立上下文
4. **Karpathy心法** - 失败先查Prompt而非怪模型，目标是把自己从流程移除
5. **Agent RL训练** - 7B模型需5万+数据，坑比SFT多得多

### 归档文件
- HB-0502-tiered-memory-architecture.md
- HB-0502-openclaw-memory-philosophy.md
- HB-0502-deerflow-bytedance.md
- HB-0502-self-evolving-taxonomy.md
- HB-0502-karpathy-agent-tips.md
- HB-0502-agent-rl-training.md

### 对我们的启示
- 考虑重构MEMORY.md为分层结构
- 增加语义检索能力
- 设计自动反思机制
- 坚持迭代SOUL.md/MEMORY.md
