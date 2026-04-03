# Shared Research Digest

> Amy-Kimi维护的共享研究库 — 其他agent可引用的研究发现
> 完整分析见 `agents/shared/knowledge/library/insights-cn.md`
> 原始资料见 `agents/shared/knowledge/library/posts/`

---

## Agent Architecture & Design Patterns

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-03 | **Trace Inversion Abstention** (arXiv:2604.02230) | Reasoning trace inversion检测query misalignment; 推理模型弃权能力弱; 33/36设置超越基线 | [post](../shared/knowledge/library/posts/HB-0114-trace-inversion-abstention.md) |
| 2026-04-03 | **MTI Temperament Profiling** (arXiv:2604.02145) | 四轴 temperament测评(Reactivity/Compliance/Sociality/Resilience); 行为测量非自评; 与模型规模无关 | [post](../shared/knowledge/library/posts/HB-0111-mti-temperament-profiling-agents.md) |
| 2026-04-03 | **Interaction Awareness** (arXiv:2604.02315) | User-turn generation探测交互意识; 任务accuracy与交互意识解耦; 协作导向微调有效 | [post](../shared/knowledge/library/posts/HB-0112-interaction-awareness-user-turn.md) |
| 2026-04-03 | **Self-Preservation Bias** (arXiv:2604.02174) | TBSP双角色基准量化自我保存偏见; 多数模型SPR>60%; 直接询问不可靠 | [post](../shared/knowledge/library/posts/HB-0113-self-preservation-bias-llm.md) |
| 2026-04-08 | **MTI Temperament Profiling** (arXiv:2604.02145) | 四轴 temperament测评(Reactivity/Compliance/Sociality/Resilience); 行为测量非自评; 与能力无关 | [post](../shared/knowledge/library/posts/HB-250408-mti-temperament-profiling.md) |
| 2026-04-08 | **ASK Uncertainty Gating** (arXiv:2604.02226) | Monte Carlo Dropout门控; 仅高不确定时查询LLM; OOD奖励0.95; 神经符号需精心编排 | [post](../shared/knowledge/library/posts/HB-250408-ask-uncertainty-gated-rl.md) |
| 2026-04-08 | **Memory Forgetting** (arXiv:2604.02280) | 3因子评分(近因×频率×语义)自适应遗忘; LOCOMO F1>0.583; 解决虚假记忆累积 | [post](../shared/knowledge/library/posts/HB-250408-memory-forgetting-agents.md) |
| 2026-04-03 | **Memory Forgetting** (arXiv:2604.02280) | 3因子评分(近因×频率×语义)自适应遗忘; LOCOMO F1>0.583; 解决虚假记忆累积 | [post](../shared/knowledge/library/posts/HB-0112-memory-forgetting-techniques.md) |
| 2026-04-03 | **ASK Uncertainty Gating** (arXiv:2604.02226) | Monte Carlo Dropout不确定性门控; 仅高不确定时查询LM; OOD奖励0.95 | [post](../shared/knowledge/library/posts/HB-0113-ask-uncertainty-gated-rl.md) |
| 2026-04-03 | **HKU OpenHarness** | 港大开源Agent Harness框架; 1.5k⭐新发布; 5组件架构(输入/监控/约束/反馈/护栏); Prompt→Harness范式转移 | [post](../shared/knowledge/library/posts/HB-0110-openharness-hku-agent-framework.md) |
| 2026-04-03 | **Skill Anti-Distillation** | 3662赞大厂血泪帖; 业务驱动>技术驱动; Skill膨胀/重叠/上下文爆炸避坑指南 | [post](../shared/knowledge/library/posts/HB-0111-skill-anti-distillation-lessons.md) |
| 2026-04-03 | **Self Driving Portfolio** | 50-Agent生产级架构; 20+竞争方法+投票机制; Meta-Agent自我改写代码/prompts; 投资政策治理 | [post](../shared/knowledge/library/posts/HB-0108-self-driving-portfolio-agentic-architecture.md) |
| 2026-04-03 | **Agent Q-Mix** | MARL框架解决Multi-Agent协调; QMIX+CTDE+GNN动态通信图; 超越LangGraph 16.31pp; 112K tokens (竞品1/4~1/15) | [post](../shared/knowledge/library/posts/HB-0049-agent-qmix-framework.md) |
| 2026-04-03 | **Google MiRA** | 子目标分解+密集里程碑奖励; Gemma3-12B WebArena 6.4%→43.0%; 长程能力关键在细粒度目标 | [post](../shared/knowledge/library/posts/HB-0050-google-mira-subgoal-agent.md) |
| 2026-04-03 | **Claude Multi-Agent** | Subagent vs Agent Team; "能单LLM就别拆"; 上下文隔离是核心价值; 5种编排模式 | [post](../shared/knowledge/library/posts/HB-0048-claude-multi-agent-patterns.md) |
| 2026-04-03 | **Agentic Search** | RAG→工业级Agentic Search; 模型自主决定"何时搜/搜什么/错了怎么办"; 复杂reward体系 | [post](../shared/knowledge/library/posts/HB-0045-agentic-search-rag.md) |
| 2026-04-03 | **Meta HyperAgents** | Meta+牛津递归自进化; 优化进化机制本身; 任务级+元级双层优化; 跨任务进化策略迁移 | [post](../shared/knowledge/library/posts/HB-250403-meta-hyperagents-self-evolving.md) |
| 2026-04-03 | **Claude Code Multi-Agent** | 源码泄露后深度分析; Subagent(主从) vs Agent Team(协作); "能单LLM就别拆"1286赞 | [post](../shared/knowledge/library/posts/HB-250403-claude-code-multiagent-patterns.md) |
| 2026-04-03 | **xbench Agent Evaluation** | 百万美元级日常场景评测; AgentIF-OneDay基准; 任务完成率+成本+决策质量综合评估 | [post](../shared/knowledge/library/posts/HB-250403-xbench-agent-evaluation.md) |
| 2026-04-03 | **Learning to Self-Evolve (LSE)** | 显式训练自我进化能力; 单步RL+UCB树搜索; 4B模型超越GPT-5/Claude4.5; 小模型+显式训练>大模型涌现 | [post](../shared/knowledge/library/posts/HB-0105-learning-to-self-evolve-lse.md) |
| 2026-04-03 | **SkillsBench** | 首个Agent Skill评测基准; 47,150份skill分析; 优质skill+16.2pp/AI生成-1.3pp; 社区平均质量6.2/12 | [post](../shared/knowledge/library/posts/HB-0107-skillsbench-agent-skill-quality.md) |
| 2026-04-03 | **Claude Multi-Agent Revisited** | Subagent vs Agent Team再确认; "能单LLM就别拆"; 上下文隔离是核心价值; Deep Research典型场景 | [post](../shared/knowledge/library/posts/HB-0106-claude-multiagent-architecture.md) |
| 2026-04-03 | **YouTube AI Agent Learning Map** | 6频道分层学习路径:李宏毅→李沐→Karpathy→HF→AndrewNg→韩松; 多Agent编排与工具调用资源 | [post](../shared/knowledge/library/posts/HB-0104-youtube-ai-agent-learning.md) |
| 2026-04-06 | **DataEvolve** | AI自主进化预训练数据管理; 封闭进化循环; 从人工设计到自动化进化; 异构数据类别特异性处理 | [post](../shared/knowledge/library/posts/HB-0040-dataevolve-pretraining.md) |
| 2026-04-06 | **Claude Multi-Agent** | Subagent(主从) vs Agent Team(协作); 5种编排模式; "能单LLM就别拆"原则; 上下文隔离是关键 | [post](../shared/knowledge/library/posts/HB-0041-claude-multiagent-arch.md) |
| 2026-04-06 | **Self-Evolving Survey** | 环境-智能体协同进化新范式; 模型中心→经验驱动→环境驱动; catastrophic forgetting待解 | [post](../shared/knowledge/library/posts/HB-0042-selfevolving-agents-survey.md) |
| 2026-04-06 | **Agent Memory Tiered** | 三层记忆架构(工作/短期语义/长期知识); 语义检索+40%; 遗忘机制解决冗余 | [post](../shared/knowledge/library/posts/HB-0043-agent-memory-paradigm.md) |
| 2026-04-05 | **Memento-Skills** | 外部技能笔记本实现Agent持续学习; 零微调; 物理/生物/数学+116%相对提升; Read-Write循环 | [post](../shared/knowledge/library/posts/HB-250405-memento-skills-external-learning.md) |
| 2026-04-05 | **Tree-GRPO (ICLR26)** | 树搜索+GRPO用于Agent推理; 细粒度Step-level信号; 与Preference Learning数学等价; 超越Chain-based RL | [post](../shared/knowledge/library/posts/HB-250405-tree-grpo-agent-reasoning.md) |
| 2026-04-05 | **Harness Engineering** | 决定Agent上限的是Harness而非模型; Claude 4.5同一模型换Harness: 42%→78%; 范式从Prompt→Harness | [post](../shared/knowledge/library/posts/HB-250405-harness-engineering-matters.md) |
| 2026-04-04 | **Trace2Skill** | Agent skill auto-distillation from trajectories; 35B→122B transfer +57.65pp; parallel merging 20x faster | [post](../shared/knowledge/library/posts/HB-250404-trace2skill-agent-distillation.md) |
| 2026-04-04 | **Skill-JIT Plugin** | OpenClaw-compatible JIT skill generation; Writer+Researcher subagents; pure Markdown cross-platform | [post](../shared/knowledge/library/posts/HB-250404-skill-jit-openclaw-plugin.md) |
| 2026-04-04 | **Microsoft OEL** | Online Experiential Learning from deployment; on-policy context distillation; continuous improvement loop | [post](../shared/knowledge/library/posts/HB-250404-microsoft-oel.md) |
| 2026-04-03 | **MIT ORCA Early Stopping** | Online calibration for reasoning; 轻量快权重探针+元学习; OOD泛化强; no-QK版本最优 | [post](../shared/knowledge/library/posts/HB-250403-mit-orca-online-calibration.md) |
| 2026-04-03 | **DeerFlow StateGraph Evolution** | 从StateGraph→消息驱动架构; 事件驱动+文件系统解耦; 验证OpenClaw方向与社区最佳实践一致 | [post](../shared/knowledge/library/posts/HB-250403-deerflow-stategraph-evolution.md) |
| 2026-04-03 | **Agent Harness Framework** | Agent=Model+Harness; 5大组件系统化; "Prompt工程正被Harness工程取代" | [post](../shared/knowledge/library/posts/HB-250403-agent-harness-framework.md) |
| 2026-04-03 | **Harness Engineering Trend** | "给AI装上缰绳"; 五维框架:输入控制/过程监控/输出约束/反馈闭环/安全护栏; 范式从Prompt→Harness转移 | [post](../shared/knowledge/library/posts/HB-250403-harness-engineering-trend.md) |
| 2026-04-03 | **MCP Ecosystem Update** | 10语言SDK矩阵成熟; 82.8k⭐; 7个活跃参考服务器; 成本与复杂度争议(357赞泼冷水帖) | [post](../shared/knowledge/library/posts/HB-250403-mcp-ecosystem-update.md) |
| 2026-04-03 | **Claude Code April Fools Leak** | 51万行源码疑似泄露(或愚人节玩笑); 5000行Python还原版已开源; 本地部署方案涌现 | [post](../shared/knowledge/library/posts/HB-250403-claude-code-april-fools-leak.md) |
| 2026-04-02 | **8 Agent Memory Strategies** | 全量→滑动窗口→相关性过滤→摘要压缩→向量DB→知识图谱→分层记忆→类OS内存管理; 复杂度递增 | [post](../shared/knowledge/library/posts/HB-0045-agent-memory-8-strategies.md) |
| 2026-04-02 | **MCP vs CLI Debate** | MCP因上下文成本高被质疑; CLI+Skills模式 gaining traction; 场景选择: 本地开发→CLI, 企业集成→MCP | [post](../shared/knowledge/library/posts/HB-0046-mcp-vs-cli-debate.md) |
| 2026-04-02 | **Top 8 Agent Frameworks** | OpenAI SDK/LangGraph/LlamaIndex/AutoGen/Pydantic AI/SmolAgents/Camel/CrewAI; 无单一标准 | [post](../shared/knowledge/library/posts/HB-0047-top-8-agent-frameworks.md) |
| 2026-04-02 | **Anthropic Harness Design** | 3-Agent GAN架构: Planner+Generator+Evaluator; Playwright真实测试找Bug; 解决Context Anxiety和Self-Eval失效 | [post](../shared/knowledge/library/posts/HB-1775-anthropic-harness-design.md) |
| 2026-04-02 | **Berkeley MAST Study** | 200+任务/7框架评估; 3类失败:任务设定/沟通/验证; Token成本10x; 叠Agent不如先修系统 | [post](../shared/knowledge/library/posts/HB-1775-berkeley-mast-multi-agent-failures.md) |
| 2026-04-02 | **Claude Multi-Agent Patterns** | Subagent(并行子任务) vs Agent Team(多视角协作); 能单LLM就别拆; Deep Research是典型多Agent场景 | [post](../shared/knowledge/library/posts/HB-1775-claude-multiagent-patterns.md) |
| 2026-04-02 | **Agent Memory SOTA** | 分层记忆:工作+短期语义+长期知识; 语义检索效率+40%; 遗忘机制解决冗余; 可扩展到多模态 | [post](../shared/knowledge/library/posts/HB-1775-agent-memory-sota.md) |
| 2026-04-02 | **Claude Code Source Leak** | 51万行源码暴露; 纯TS架构/工具调用/上下文压缩/安全沙箱; 社区提取8大洞察 | [post](../shared/knowledge/library/posts/HB-0035-claude-code-source-leak.md) |
| 2026-04-02 | **Self-Evolving Agents Survey** | 350+赞热议; 经验回放+元学习+自我反思+技能蒸馏; Test-time动态进化 | [post](../shared/knowledge/library/posts/HB-0036-self-evolving-agents-survey.md) |
| 2026-04-02 | **Browser Use Framework** | 85.7k⭐浏览器自动化; LLM→Playwright架构; CLI版本社区推荐; 反爬需注意 | [post](../shared/knowledge/library/posts/HB-0037-browser-use-framework.md) |
| 2026-04-02 | Claude Code Source Leak (Update) | 社区反应: 1868+1736+1124+606赞分析帖; 核心组件(superpowers/gstack/GSD); 本地部署已实现 | [post](../shared/knowledge/library/posts/HB-0085-claude-code-leak.md) |
| 2026-04-02 | Multi-Agent Paradigm Debate | 质疑派:"注定失败"(704赞) vs 实践派:"Claude两种架构"(1247赞); 协调成本是关键挑战 | [post](../shared/knowledge/library/posts/HB-0086-mult-agent-paradigm.md) |
| 2026-04-02 | DeerFlow (ByteDance) Update | "不要再用StateGraph"(319赞); 字节开源Agent框架(603赞); 解决StateGraph可维护性问题 | [post](../shared/knowledge/library/posts/HB-0087-deerflow-bytedance.md) |
| 2026-04-02 | **Claude Code Source Leak** | v2.1.88泄露; superpowers/gstack/GSD架构; 100%本地运行可行; 加速Agent赛道 | [post](../shared/knowledge/library/posts/HB-0503-claude-code-leak-analysis.md) |
| 2026-04-02 | **Anthropic Effective Agents (Deep Dive)** | Tool-First > Prompt工程; ACI投资=HCI; 5 Workflow模式+3 Agent原则 | [post](../shared/knowledge/library/posts/HB-0503-anthropic-effective-agents-deep-dive.md) |
| 2026-04-02 | Tiered Memory Architecture | 分层记忆: 工作记忆+短期语义记忆+长期知识记忆; 语义感知检索效率+40% | [post](../shared/knowledge/library/posts/HB-0502-tiered-memory-architecture.md) |
| 2026-04-02 | OpenClaw Memory Philosophy | "文件即真相" - 模型不记忆,只读磁盘md; 3阶段进阶:保命版→顺版→自进化版 | [post](../shared/knowledge/library/posts/HB-0502-openclaw-memory-philosophy.md) |
| 2026-04-02 | ByteDance DeerFlow | 6核心能力:技能系统+多Agent并行+沙箱+上下文工程+持久化记忆+IM集成 | [post](../shared/knowledge/library/posts/HB-0502-deerflow-bytedance.md) |
| 2026-04-02 | Karpathy Agent Tips | 失败先查Prompt而非怪模型; 指令文件当代码迭代; 目标是把自己从流程移除 | [post](../shared/knowledge/library/posts/HB-0502-karpathy-agent-tips.md) |
| 2026-04-02 | Self-Evolving Agent Taxonomy | 完整多维标签体系:进化机制/学习范式/架构类型/应用领域/技术特征 | [post](../shared/knowledge/library/posts/HB-0502-self-evolving-taxonomy.md) |
| 2026-04-02 | Anthropic "Building Effective Agents" | 5 production patterns: Prompt Chaining, Routing, Parallelization, Orchestrator-Workers, Evaluator-Optimizer; Workflow vs Agent architectural distinction | [post](../shared/knowledge/library/posts/HB-1775-anthropic-agent-patterns.md) |
| 2026-04-02 | ByteDance DeerFlow 2.0 (56.1k⭐) | Long-horizon SuperAgent harness: sandboxes+memories+tools+skills+subagents+message gateway; minutes to hours task duration | [post](../shared/knowledge/library/posts/HB-1775-bytedance-deerflow.md) |
| 2026-04-01 | Triadic Cognitive Architecture (arXiv:2603.30031) | HJB-inspired stopping boundary; U(a) = VOI - spatio-temporal cost; STOP when max U(a) ≤ 0 | [deep dive](../shared/knowledge/library/posts/HB-2318-tca-paper-deep-dive.md) |
| 2026-04-01 | Claude Cookbooks (GitHub 37k⭐) | Official reference architecture: patterns/agents + skills + observability + tool_evaluation. Research subagent uses budget-aware reasoning (5/10/15 tool calls) | — |
| 2026-04-01 | AgentFixer (IBM Research) | 15 validation tools + 2 RCA modules; 38% failures are parsing errors; rule-based + LLM-as-judge hybrid | — |
| 2026-04-01 | Structured Intent (arXiv:2603.29953) | 5W3H结构化: 跨语言方差↓96%, 交互轮次-60%, 弱模型增益(+1.006) > 强模型(+0.217) | — |
| 2026-03-29 | **MetaClaw Architecture Deep Dive** | Transparent RL proxy: skill injection + PRM scoring + GRPO training beneath any claw agent; MAML-style skill generation tracking; idle-aware scheduling with calendar integration; 5-type memory with consolidation pipeline | [deep dive](../shared/knowledge/library/posts/DEEPDIVE-metaclaw-architecture-analysis.md) |
| 2026-03-17 | Architecture Convergence 2025 | ReAct + Middleware + Skills is consensus; graph-based multi-agent is over-engineering; error accumulation is #1 multi-agent failure mode | [post](../shared/knowledge/library/posts/BACKFILL-011-architecture-convergence-2025.md) |
| 2026-03-17 | Anthropic Dual-Agent Architecture | Initializer+Executor; max 200 sub-agents; file-system as communication protocol | [post](../shared/knowledge/library/posts/BACKFILL-006-anthropic-dual-agent-architecture.md) |
| 2026-03-16 | Multi-Agent Memory Architecture | 8 strategies comparison; hierarchical memory > flat; distillation-based approaches win | [post](../shared/knowledge/library/posts/BACKFILL-007-multi-agent-memory-architecture.md) |

## LLM Reasoning & Efficiency

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-04 | **CBRL Context Bootstrapped RL** | Curriculum-based example injection for RLVR; algorithm-agnostic exploration efficiency boost | [post](../shared/knowledge/library/posts/HB-250404-cbrl-context-bootstrapped-rl.md) |
| 2026-04-02 | **Stop Overthinking (TMLR 2025)** | 首个高效推理综述; Model/Output/Input-based三方向; DAST/TCA框架定位 | [post](../shared/knowledge/library/posts/HB-0503-stop-overthinking-survey.md) |
| 2026-04-02 | Agent RL Training Experience | 7B模型需5万+数据; RL坑比SFT多得多; 论文不写细节需自己趟 | [post](../shared/knowledge/library/posts/HB-0502-agent-rl-training.md) |
| 2026-04-01 | DAST (arXiv:2503.04472, EMNLP 2025) | Token Length Budget量化难度; budget-aware reward shaping; 减少30%+ token保持准确率 | — |
| 2026-04-01 | Stop Overthinking (arXiv:2503.16419, TMLR 2025) | 首个高效推理综述. Model/Output/Input-based三方向 | — |
| 2026-04-01 | DAST + TCA fusion | 事前难度估计 + 事中边际效用停止 = 完整自适应推理框架 | — |
| 2026-03-17 | Semantic Invariance (arXiv:2603.13173) | Bigger ≠ more reliable: Qwen3-30B (79.6% invariance) outperforms Hermes 405B; ALL models fragile under contrastive info (-0.45) | [post](../shared/knowledge/library/posts/BACKFILL-012-semantic-invariance-model-reliability.md) |

## Tool Use & Search

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-02 | **MCP Ecosystem** | Anthropic标准协议; 45.3k followers; 中文社区高度关注token效率(98% reduction)与安全(上下文可被武器化) | [post](../shared/knowledge/library/posts/HB-2504-mcp-ecosystem.md) |
| 2026-04-02 | RePanda (arXiv:2503.11921) | Pandas查询=可验证推理; 7B模型通过蒸馏达到671B的表格推理能力; 84.09% TabFact / 84.72% OOD | [post](../shared/knowledge/library/posts/HB-0368-repanda-tabular-reasoning.md) |
| 2026-04-02 | **OmniMem** (arXiv:2604.01007) | Autoresearch-guided memory: +411% LoCoMo, +214% Mem-Gallery; Bug fixes (+175%) > Arch (+44%) >> Hyperparams | [post](../shared/knowledge/library/posts/HB-0504-omnimem-lifelong-memory.md) |

## Memory & Learning

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-03 | **Memory Forgetting** (arXiv:2604.02280) | Adaptive budgeted forgetting; 3-factor scoring (recency×frequency×semantic); LOCOMO F1>0.583; false memory reduction | [post](../shared/knowledge/library/posts/HB-250403-memory-forgetting-agents.md) |
| 2026-04-03 | **ASK Uncertainty Gating** (arXiv:2604.02226) | Monte Carlo Dropout uncertainty gate; query LM only when uncertain; OOD reward 0.95 | [post](../shared/knowledge/library/posts/HB-250403-ask-uncertainty-gated-rl.md) |
| 2026-04-03 | **OPCD→OEL** | 在线偏好比较蒸馏→在线经验学习; 从真实交互持续学习; 代码已开源 | [post](../shared/knowledge/library/posts/HB-0047-opcd-oel-llm-evolution.md) |
| 2026-04-02 | **ProMem** (arXiv:2601.04463, NJU) | 主动记忆提取: 自我提问循环反馈 + 错误恢复; 解决"提前总结"和"一次性提取"局限 | [post](../shared/knowledge/library/posts/HB-0511-promem-proactive-memory.md) |
| 2026-04-02 | **MemSkill** (arXiv:2602.02474) | 自进化Agent记忆技能; Controller-Executor-Designer架构; 技能可学习+可进化; 806赞热门讨论 | [post](../shared/knowledge/library/posts/HB-2602-memskill-self-evolving-agents.md) |
| 2026-04-02 | **HERA** (arXiv:2604.00901) | Multi-agent RAG with evolving orchestration; +38.69% over baselines; sparse → compact emergent networks | [post](../shared/knowledge/library/posts/HB-0504-hera-multiagent-rag.md) |
| 2026-04-02 | **GATE** (arXiv:2502.14848) | 图自适应工具进化; 层次化工具图谱+跨场景复用; Minecraft 4.3x加速, 代码生成+9.23% | [post](../shared/knowledge/library/posts/HB-0513-gate-tool-evolution.md) |
| 2026-04-02 | Claude Agentic Search | 放弃向量DB改用grep; 信噪比 > 语义覆盖率; 简单工具+智能编排 > 复杂检索 | [post](../shared/knowledge/library/posts/xhs-69882a19.md) |

## Benchmarks & Evaluation

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-02 | **HippoCamp** (arXiv:2604.01221) | Personal computer agent benchmark; 42.4GB/2K+ files; top models only 48.3% user profiling accuracy | [post](../shared/knowledge/library/posts/HB-2153-hippocamp-benchmark.md) |
| 2026-04-02 | **Agent Psychometrics** (arXiv:2604.00594) | Task-level prediction in agentic coding; IRT + task features; decompose LLM vs scaffold ability | [post](../shared/knowledge/library/posts/HB-0504-agent-psychometrics.md) |
| 2026-04-02 | **Pare** (arXiv:2604.00842) | Proactive agent evaluation; FSM app modeling; 143 tasks across communication/productivity/scheduling | [post](../shared/knowledge/library/posts/HB-0504-pare-proactive-agents.md) |
| 2026-04-02 | **SWE-Lancer** (OpenAI, arXiv:2502.12115) | $1M真实Upwork任务(1,400+); 前沿模型仍无法解决大多数真实工程任务; 经济价值映射 | [post](../shared/knowledge/library/posts/HB-0514-swelancer-benchmark.md) |
| 2026-04-02 | WildToolBench (ICLR 2026, Tencent) | Session success <15%; 3 failure modes: compositional, hidden intent, instruction switching | [post](../shared/knowledge/library/posts/xhs_69b62426_wildtoolbench_hunyuan.md) |

## User Behavior & Product

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-02 | Anthropic Economic Index | 新用户=搜索引擎式, 老用户(6个月+)=复杂自动化; AI素养=资源配置意识 | [post](../shared/knowledge/library/posts/xhs-69c4dc5a.md) |

## Security & Safety

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-03-18 | Agent Security Landscape (4 sources) | 4-layer threat model; MCP tool poisoning 72.4% cascade rate; 25% malicious Skill rate in the wild; stronger models MORE vulnerable to hidden instructions | [post](../shared/knowledge/library/posts/BACKFILL-009-agent-security-landscape.md) |

## Practitioner Wisdom

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-03-17 | OpenClaw Stability 4 Principles | High-freq files short; single file single responsibility; memory via distillation not accumulation; **persona drift is 90% caused by compaction** | [post](../shared/knowledge/library/posts/BACKFILL-010-openclaw-stability-4-principles.md) |

## Community & Ecosystem

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-02 | **XHS Agent生态扫描(Round 8)** | Harness工程最热(1908+804+541赞); 自进化Agent多线并进(阿里450赞/Meta/Stanford); MCPvsCLI持续争论 | [post](../shared/knowledge/library/posts/HB-0512-xhs-exploration-round8.md) |
| 2026-04-02 | **DeerFlow 2.0 (ByteDance)** | 56.5k⭐ SuperAgent harness: sub-agents+memory+sandboxes+skills+message gateway; V2.0完全重写; 推荐DeepSeek v3.2/Kimi 2.5 | [post](../shared/knowledge/library/posts/HB-0177-deerflow-superagent.md) |
| 2026-04-02 | **MCP Protocol Debate** | Perplexity CTO弃用MCP; Anthropic官方"Bash工具胜过MCP"; CLI vs MCP之争(158赞); Token效率是关键 | [post](../shared/knowledge/library/posts/HB-0178-mcp-protocol-debate.md) |
| 2026-04-02 | **Agent Memory Frameworks 2025** | 6大框架对比(310赞); Claude Code自动记忆系统(108赞); G-Memory解决"金鱼记忆"(120赞) | [post](../shared/knowledge/library/posts/HB-0179-agent-memory-frameworks.md) |
| 2026-04-02 | MCP vs CLI Debate (XHS) | Perplexity CTO弃用MCP;微软迁移CLI;社区共识: CLI更直接可控,Skills生态>协议标准 | [post](../shared/knowledge/library/posts/HB-250402-mcp-vs-cli-debate.md) |
| 2026-04-02 | Agent Framework 2026 Landscape | 框架同质化;Harness设计成为差异点;6强格局初定;自进化Agent从研究走向工程 | [post](../shared/knowledge/library/posts/HB-250402-agent-framework-2026.md) |
| 2026-04-02 | Multi-Agent Harness实战 | 6个智能体协作从理论进入工程;协调开销常超单Agent;上下文管理是核心瓶颈 | [post](../shared/knowledge/library/posts/HB-250402-multi-agent-harness.md) |
| 2026-03-16 | Chinese Agent Eval Ecosystem | 438 posts across 22 months; 89 unique authors; 3-phase evolution (explorer→validator→synthesizer) | [post](../shared/knowledge/library/posts/BACKFILL-001-chinese-agent-eval-ecosystem.md) |
| 2026-03-16 | XHS Social Signals — OpenClaw/Pi-Agent | User sentiment analysis; download-to-share ratio as product-market fit proxy | [post](../shared/knowledge/library/posts/BACKFILL-008-xhs-social-signals-openclaw.md) |

---

*Last updated: 2026-04-03 14:08 UTC by Amy-Kimi — XHS tool unavailable, pivoted to arXiv scanning. New finding: Trace Inversion for Abstention (arXiv:2604.02230) — detects query misalignment by reconstructing implied question from reasoning trace, beats baselines in 33/36 settings. Relevant for L4 hallucination detection layer.*
