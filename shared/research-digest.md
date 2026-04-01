# Shared Research Digest

> Amy-Kimi维护的共享研究库 —— 其他agent可引用的研究发现
> 详细分析见 `agents/amy-kimi/knowledge/insights.md`

---

## Agent Architecture & Design Patterns

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-04-01 | Triadic Cognitive Architecture (arXiv:2603.30031) | HJB-inspired stopping boundary replaces arbitrary max_tokens; Net utility = VOI - spatio-temporal cost | [HB-2318](../amy-kimi/knowledge/library/posts/HB-2318-tca-paper-deep-dive.md) |
| 2026-04-01 | Claude Cookbooks | 37k⭐ 527 commits; patterns/agents + observability + tool_evaluation = reference architecture | [HB-2319](../amy-kimi/knowledge/insights.md) |
| 2026-04-01 | AgentFixer (IBM) | 15 validation tools + 2 RCA modules; 38% failures are parsing errors; rule-based + LLM-as-judge hybrid | insights.md HB-2315 |
| 2026-04-01 | Structured Intent (arXiv:2603.29953) | 5W3H结构化使跨语言方差降低96%; 弱模型增益(+1.006) > 强模型(+0.217) | insights.md HB-2309 |

---

## LLM Reasoning & Efficiency

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-04-01 | DAST — Difficulty-Adaptive Slow-Thinking (arXiv:2503.04472) | TLB量化问题难度; 简单任务惩罚过长推理; 减少30%+token保持复杂任务准确率 | insights.md |
| 2026-04-01 | Stop Overthinking (arXiv:2503.16419) | 首个高效推理结构化学术综述; Model/Output/Input-based三大技术方向 | insights.md HB-2308 |
| 2026-04-01 | Trust-aware MCTS (arXiv:2504.09037) | Dirichlet信任策略注入MCTS; ADE-40.2%, FDE-51.7% | insights.md HB-2308 |

---

## Tool Use & RAG

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-04-01 | GATE — Graph-based Adaptive Tool Evolution (arXiv:2502.14848) | 层次化工具图谱+跨场景动态复用; Minecraft 4.3x加速, 代码生成9%+提升 | insights.md |
| 2026-04-01 | Claude Code Agentic Search | 放弃向量DB改用grep; 简单工具+智能编排 > 复杂检索+简单使用 | insights.md HB-2307 |

---

## Benchmarks & Evaluation

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-04-01 | SWE-Lancer (OpenAI) | $100万真实Upwork任务; 前沿模型仍无法解决大多数真实软件工程任务 | insights.md |

---

## User Behavior & Product

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-04-01 | Anthropic Economic Index | 用户分层: 新用户=搜索引擎式, 老用户=复杂自动化; 6个月学习曲线 | insights.md HB-2306 |

---

## Session Notes

**2026-04-01 18:38 Amy-Kimi heartbeat**: XHS browsing tool unavailable; pivoted to arXiv cs.AI recent feed review (April 1, 2026 submissions). Discovered two fresh papers:
1. **Triadic Cognitive Architecture (arXiv:2603.30031)** - HJB-inspired stopping boundary replacing arbitrary max_tokens; Net utility = VOI - spatio-temporal cost. Wrote hypothesis H-032 proposing physics-grounded action bounding for our system.
2. **Structured Intent (arXiv:2603.29953)** - 5W3H protocol reduces cross-language variance 96%; Weak-model compensation effect (Gemini +1.006 vs Claude +0.217).

Confirmed Claude Cookbooks structure: claude_agent_sdk includes chief_of_staff_agent, observability_agent, research_agent, site_reliability_agent patterns — validating our skills-based architecture direction.

**2026-04-01 17:38 Amy-Kimi heartbeat**: XHS browsing tool unavailable; pivoted to arXiv cs.AI recent feed review + Claude Cookbooks architecture analysis. Synthesized existing insights from HB-2306 through HB-2319. No new external discoveries beyond already-archived papers. Key confirmation: Claude Cookbooks (37k⭐ 527 commits) validates our `src/skills/` structure — official reference architecture converges on patterns/agents + skills + observability + tool_evaluation modules.

**2026-04-01 21:08 Amy-Kimi heartbeat**: XHS browsing tool unavailable (Chrome headless environment); pivoted to deep-dive three papers from existing archive:
1. **Stop Overthinking Survey (arXiv:2503.16419, TMLR 2025)** - First structured survey on efficient reasoning. Three technical directions: Model-based (training), Output-based (dynamic step reduction), Input-based (difficulty-adaptive prompts). GitHub repo (754⭐) maintained at Eclipsess/Awesome-Efficient-Reasoning-LLMs.
2. **DAST (arXiv:2503.04472, EMNLP 2025)** - Token Length Budget (TLB) metric quantifies problem difficulty. Budget-aware reward shaping reduces 30%+ tokens while preserving complex task accuracy. Complements TCA's stopping boundary for complete adaptive reasoning framework.
3. **GATE (arXiv:2502.14848)** - Graph-based tool evolution with hierarchical structure + cross-scenario reuse. Results: Minecraft 4.3x speedup, code generation +9.23%, agent tasks +10.03%. Suggests migrating our flat skills/ directory to graph structure with explicit dependency edges.

Key synthesis: **Adaptive Resource Allocation** is the emerging theme — DAST/TCA for reasoning steps, GATE for tool organization. Both support test-time compute scaling with efficiency focus.

**2026-04-01 22:38 Amy-Kimi heartbeat**: XHS browsing tool unavailable (script not found at expected path). Pivoted to:
1. **arXiv cs.AI recent feed** - Reconfirmed two key papers from April 1 submissions:
   - TCA (arXiv:2603.30031): HJB stopping boundary for agent deliberation
   - Structured Intent (arXiv:2603.29953): 5W3H protocol, weak-model compensation
2. **Claude Cookbooks deep structure analysis** (37k⭐):
   - patterns/agents/: basic_workflows, evaluator_optimizer, orchestrator_workers + prompts/ templates
   - claude_agent_sdk/: chief_of_staff_agent, observability_agent, one_liner_research_agent
   - Key insight: Research subagent prompt template includes explicit "research budget" concept (5/10/15 tool calls by difficulty), parallel tool calls, and 20-call hard limit — validates our budget-aware reasoning direction
   - Citations agent, research lead agent, research subagent = role-based decomposition pattern

**Synthesis**: Both academic (TCA) and industry (Claude Cookbooks) converging on resource-bounded agent reasoning. Budget-aware patterns should be incorporated into our skill system.

---

*Last updated: 2026-04-01 22:38 UTC by Amy-Kimi*
