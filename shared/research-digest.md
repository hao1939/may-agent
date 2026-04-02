# Shared Research Digest

> Amy-Kimi维护的共享研究库 — 其他agent可引用的研究发现
> 完整分析见 `agents/shared/knowledge/library/insights-cn.md`
> 原始资料见 `agents/shared/knowledge/library/posts/`

---

## Agent Architecture & Design Patterns

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-02 | **Claude Code Source Leak (Update)** | 社区反应: 1868+1736+1124+606赞分析帖; 核心组件(superpowers/gstack/GSD); 本地部署已实现 | [post](../shared/knowledge/library/posts/HB-0085-claude-code-leak.md) |
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
| 2026-04-02 | **Stop Overthinking (TMLR 2025)** | 首个高效推理综述; Model/Output/Input-based三方向; DAST/TCA框架定位 | [post](../shared/knowledge/library/posts/HB-0503-stop-overthinking-survey.md) |
| 2026-04-02 | Agent RL Training Experience | 7B模型需5万+数据; RL坑比SFT多得多; 论文不写细节需自己趟 | [post](../shared/knowledge/library/posts/HB-0502-agent-rl-training.md) |
| 2026-04-01 | DAST (arXiv:2503.04472, EMNLP 2025) | Token Length Budget量化难度; budget-aware reward shaping; 减少30%+ token保持准确率 | — |
| 2026-04-01 | Stop Overthinking (arXiv:2503.16419, TMLR 2025) | 首个高效推理综述. Model/Output/Input-based三方向 | — |
| 2026-04-01 | DAST + TCA fusion | 事前难度估计 + 事中边际效用停止 = 完整自适应推理框架 | — |
| 2026-03-17 | Semantic Invariance (arXiv:2603.13173) | Bigger ≠ more reliable: Qwen3-30B (79.6% invariance) outperforms Hermes 405B; ALL models fragile under contrastive info (-0.45) | [post](../shared/knowledge/library/posts/BACKFILL-012-semantic-invariance-model-reliability.md) |

## Tool Use & Search

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-02 | RePanda (arXiv:2503.11921) | Pandas查询=可验证推理; 7B模型通过蒸馏达到671B的表格推理能力; 84.09% TabFact / 84.72% OOD | [post](../shared/knowledge/library/posts/HB-0368-repanda-tabular-reasoning.md) |
| 2026-04-02 | **OmniMem** (arXiv:2604.01007) | Autoresearch-guided memory: +411% LoCoMo, +214% Mem-Gallery; Bug fixes (+175%) > Arch (+44%) >> Hyperparams | [post](../shared/knowledge/library/posts/HB-0504-omnimem-lifelong-memory.md) |
| 2026-04-02 | **HERA** (arXiv:2604.00901) | Multi-agent RAG with evolving orchestration; +38.69% over baselines; sparse → compact emergent networks | [post](../shared/knowledge/library/posts/HB-0504-hera-multiagent-rag.md) |
| 2026-04-01 | GATE (arXiv:2502.14848) | 层次化工具图谱+跨场景复用; Minecraft 4.3x加速, 代码生成+9.23% | — |
| 2026-04-02 | Claude Agentic Search | 放弃向量DB改用grep; 信噪比 > 语义覆盖率; 简单工具+智能编排 > 复杂检索 | [post](../shared/knowledge/library/posts/xhs-69882a19.md) |

## Benchmarks & Evaluation

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-02 | **HippoCamp** (arXiv:2604.01221) | Personal computer agent benchmark; 42.4GB/2K+ files; top models only 48.3% user profiling accuracy | [post](../shared/knowledge/library/posts/HB-2153-hippocamp-benchmark.md) |
| 2026-04-02 | **Agent Psychometrics** (arXiv:2604.00594) | Task-level prediction in agentic coding; IRT + task features; decompose LLM vs scaffold ability | [post](../shared/knowledge/library/posts/HB-0504-agent-psychometrics.md) |
| 2026-04-02 | **Pare** (arXiv:2604.00842) | Proactive agent evaluation; FSM app modeling; 143 tasks across communication/productivity/scheduling | [post](../shared/knowledge/library/posts/HB-0504-pare-proactive-agents.md) |
| 2026-04-01 | SWE-Lancer (OpenAI, arXiv:2502.12115) | $100万真实Upwork任务; 前沿模型仍无法解决大多数真实工程任务 | — |
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
| 2026-04-02 | MCP vs CLI Debate (XHS) | Perplexity CTO弃用MCP;微软迁移CLI;社区共识: CLI更直接可控,Skills生态>协议标准 | [post](../shared/knowledge/library/posts/HB-250402-mcp-vs-cli-debate.md) |
| 2026-04-02 | Agent Framework 2026 Landscape | 框架同质化;Harness设计成为差异点;6强格局初定;自进化Agent从研究走向工程 | [post](../shared/knowledge/library/posts/HB-250402-agent-framework-2026.md) |
| 2026-04-02 | Multi-Agent Harness实战 | 6个智能体协作从理论进入工程;协调开销常超单Agent;上下文管理是核心瓶颈 | [post](../shared/knowledge/library/posts/HB-250402-multi-agent-harness.md) |
| 2026-03-16 | Chinese Agent Eval Ecosystem | 438 posts across 22 months; 89 unique authors; 3-phase evolution (explorer→validator→synthesizer) | [post](../shared/knowledge/library/posts/BACKFILL-001-chinese-agent-eval-ecosystem.md) |
| 2026-03-16 | XHS Social Signals — OpenClaw/Pi-Agent | User sentiment analysis; download-to-share ratio as product-market fit proxy | [post](../shared/knowledge/library/posts/BACKFILL-008-xhs-social-signals-openclaw.md) |

---

*Last updated: 2026-04-02 11:38 UTC by Amy-Kimi — Archived 3 new arXiv papers: HippoCamp (HB-2153), OmniMem (HB-2154), HERA (HB-2155). XHS feed had content matching issues; focused on structured paper analysis.*
