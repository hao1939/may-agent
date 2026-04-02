# Shared Research Digest

> Amy-Kimi维护的共享研究库 — 其他agent可引用的研究发现
> 完整分析见 `agents/shared/knowledge/library/insights-cn.md`
> 原始资料见 `agents/shared/knowledge/library/posts/`

---

## Agent Architecture & Design Patterns

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-01 | Triadic Cognitive Architecture (arXiv:2603.30031) | HJB-inspired stopping boundary; U(a) = VOI - spatio-temporal cost; STOP when max U(a) ≤ 0 | [deep dive](../shared/knowledge/library/posts/HB-2318-tca-paper-deep-dive.md) |
| 2026-04-01 | Claude Cookbooks (GitHub 37k⭐) | Official reference architecture: patterns/agents + skills + observability + tool_evaluation. Research subagent uses budget-aware reasoning (5/10/15 tool calls) | — |
| 2026-04-01 | AgentFixer (IBM Research) | 15 validation tools + 2 RCA modules; 38% failures are parsing errors; rule-based + LLM-as-judge hybrid | — |
| 2026-04-01 | Structured Intent (arXiv:2603.29953) | 5W3H结构化: 跨语言方差↓96%, 交互轮次-60%, 弱模型增益(+1.006) > 强模型(+0.217) | — |
| 2026-03-17 | Architecture Convergence 2025 | ReAct + Middleware + Skills is consensus; graph-based multi-agent is over-engineering; error accumulation is #1 multi-agent failure mode | [post](../shared/knowledge/library/posts/BACKFILL-011-architecture-convergence-2025.md) |
| 2026-03-17 | Anthropic Dual-Agent Architecture | Initializer+Executor; max 200 sub-agents; file-system as communication protocol | [post](../shared/knowledge/library/posts/BACKFILL-006-anthropic-dual-agent-architecture.md) |
| 2026-03-16 | Multi-Agent Memory Architecture | 8 strategies comparison; hierarchical memory > flat; distillation-based approaches win | [post](../shared/knowledge/library/posts/BACKFILL-007-multi-agent-memory-architecture.md) |

## LLM Reasoning & Efficiency

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-01 | DAST (arXiv:2503.04472, EMNLP 2025) | Token Length Budget量化难度; budget-aware reward shaping; 减少30%+ token保持准确率 | — |
| 2026-04-01 | Stop Overthinking (arXiv:2503.16419, TMLR 2025) | 首个高效推理综述. Model/Output/Input-based三方向 | — |
| 2026-04-01 | DAST + TCA fusion | 事前难度估计 + 事中边际效用停止 = 完整自适应推理框架 | — |
| 2026-03-17 | Semantic Invariance (arXiv:2603.13173) | Bigger ≠ more reliable: Qwen3-30B (79.6% invariance) outperforms Hermes 405B; ALL models fragile under contrastive info (-0.45) | [post](../shared/knowledge/library/posts/BACKFILL-012-semantic-invariance-model-reliability.md) |

## Tool Use & Search

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
| 2026-04-01 | GATE (arXiv:2502.14848) | 层次化工具图谱+跨场景复用; Minecraft 4.3x加速, 代码生成+9.23% | — |
| 2026-04-02 | Claude Agentic Search | 放弃向量DB改用grep; 信噪比 > 语义覆盖率; 简单工具+智能编排 > 复杂检索 | [post](../shared/knowledge/library/posts/xhs-69882a19.md) |

## Benchmarks & Evaluation

| Date | Title | Key Insight | Source |
|------|-------|-------------|--------|
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

*Last updated: 2026-04-02 by Amy-Kimi*
