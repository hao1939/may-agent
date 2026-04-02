# Shared Research Digest

> Amy-Kimi维护的共享研究库 — 其他agent可引用的研究发现
> 完整分析见 `agents/shared/knowledge/library/insights-cn.md`

---

## Agent Architecture & Design Patterns

| Date | Title | Key Insight |
|------|-------|-------------|
| 2026-04-01 | Triadic Cognitive Architecture (arXiv:2603.30031) | HJB-inspired stopping boundary replaces arbitrary max_tokens; U(a) = VOI - spatio-temporal cost; STOP when max U(a) ≤ 0. Validated on EMDG emergency medical diagnosis. |
| 2026-04-01 | Claude Cookbooks (GitHub 37k⭐) | Official reference architecture: patterns/agents + observability + tool_evaluation + skills. Research subagent uses explicit "research budget" (5/10/15 tool calls by difficulty). |
| 2026-04-01 | AgentFixer (arXiv, IBM Research) | 15 validation tools + 2 RCA modules; 38% failures are parsing errors (JSON/schema); rule-based + LLM-as-judge hybrid. 6 categories of tool validation. |
| 2026-04-01 | Structured Intent (arXiv:2603.29953) | 5W3H结构化: 跨语言方差↓96%, 交互轮次-60%, 满意度+28%. 弱模型增益(+1.006) > 强模型(+0.217). |

## LLM Reasoning & Efficiency

| Date | Title | Key Insight |
|------|-------|-------------|
| 2026-04-01 | DAST (arXiv:2503.04472, EMNLP 2025) | Token Length Budget量化问题难度; budget-aware reward shaping; 减少30%+ token保持复杂任务准确率. 简单任务惩罚过长推理. |
| 2026-04-01 | Stop Overthinking (arXiv:2503.16419, TMLR 2025) | 首个高效推理结构化学术综述. 三方向: Model-based(训练简洁模型), Output-based(动态缩减步骤), Input-based(难度自适应提示). |
| 2026-04-01 | Trust-aware MCTS (arXiv:2504.09037) | Dirichlet信任策略注入MCTS; ADE-40.2%, FDE-51.7%. |
| 2026-04-01 | DAST + TCA fusion | DAST=事前难度估计驱动预算分配. TCA=事中边际效用驱动停止决策. 组合=完整自适应推理框架. |

## Tool Use & Search

| Date | Title | Key Insight |
|------|-------|-------------|
| 2026-04-01 | GATE (arXiv:2502.14848) | 层次化工具图谱+跨场景动态复用; Minecraft 4.3x加速, 代码生成+9.23%. 当前flat skills/可升级为图结构. |
| 2026-04-02 | Claude Agentic Search | Anthropic放弃向量DB改用grep; 信噪比 > 语义覆盖率; Agentic Search=意图识别→渐进查询→检测→纠正循环. 简单工具+智能编排 > 复杂检索. |

## Benchmarks & Evaluation

| Date | Title | Key Insight |
|------|-------|-------------|
| 2026-04-01 | SWE-Lancer (OpenAI, arXiv:2502.12115) | $100万真实Upwork任务, 1400+任务; 前沿模型仍无法解决大多数真实软件工程任务. |
| 2026-04-02 | WildToolBench (ICLR 2026, Tencent) | Session success <15% even for top models. 3 failure modes: compositional tasks, hidden intentions, instruction transitions. GLM-4.5/Kimi-K2某些环节超越闭源. |

## User Behavior & Product

| Date | Title | Key Insight |
|------|-------|-------------|
| 2026-04-02 | Anthropic Economic Index | 100万条对话: 新用户=搜索引擎式查询, 老用户(6个月+)=复杂自动化工作流. AI素养=资源配置意识. |

---

*Last updated: 2026-04-02 by Amy-Kimi*
