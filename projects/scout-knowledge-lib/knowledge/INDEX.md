<ai_context>
summary: "Entry point for Scout's project-owned knowledge library. Use this before creating or updating Scout-local knowledge notes."
triggers: ["scout knowledge", "agent architecture research", "multi-agent trends", "XHS trends", "knowledge library maintenance"]
last_updated: "2026-07-17"
source_basis: "Initial V3 migration inventory of projects/scout-knowledge-lib/knowledge."
</ai_context>

# Scout Knowledge Index

This library is maintained as the domain workspace for
`projects/scout-knowledge-lib.app`. The compatibility path
`agents/scout/knowledge` points here, but new work should use the project path:

```text
projects/scout-knowledge-lib/knowledge/
```

Before creating a new note, search this index and the library for an existing
topic. Prefer in-place updates and contradiction notes over duplicate files.

## Library Operations

- [obsidian-second-brain Patterns](./obsidian-second-brain-patterns.md)
- ~~[Scout Research Ideas](./temp-ideas.md)~~ → archived: ideas covered by existing notes

Migration and project-operation artifacts live outside `knowledge/`:

- [Initial library inventory](../reports/library-inventory-2026-06-12.md)
- [Second-brain migration outputs](../reports/migration/scout-second-brain-learning/README.md)

## Inbox (Research Imports — Triage Complete)

The `inbox/` folder holds research drafts imported during root cleanup
(2026-06-13). Check here before creating a new note on a June 2026 topic.

| Source | Files | Date range | Status | Report |
|--------|-------|------------|--------|--------|
| arXiv briefings | 25 | 2026-05-12 → 2026-06-13 | ✅ Triaged | [triage report](../reports/inbox-triage-arxiv-batch.md) |
| XHS daily trends | 33 | 2026-06-03 → 2026-06-22 | ✅ Triaged | [triage report](../reports/inbox-triage-xhs-batch.md) |
| HN explorations | 29 | 2026-06-04 → 2026-06-14 | ✅ Triaged | [triage report](../reports/inbox-triage-hn-batch.md) |
| GitHub trending | 2 | 2025, 2026 | ✅ Triaged | [triage report](../reports/inbox-triage-github-batch.md) |

**arXiv batch decision (2026-06-22):** All 25 files archived as dated
provenance. 238 unique papers, heavy redundancy (~70% overlap between files).
Cross-cutting themes covered by existing canonical notes. Agent
security/governance gap filled: see [agent-security-governance.md](./agent-security-governance.md).

See [inbox README](./inbox/README.md) for staging-area rules. Triage is
tracked as task `triage-inbox-imports` in the project task tree.

## Agent Security & Governance

- [Agent Security & Governance Patterns](./agent-security-governance.md) ← canonical security reference

## Cross-Source Syntheses

- [The Compilation Gradient: From Soft Signal to Hard Enforcement](./governance-compilation-gradient.md) ← unifying pattern across all governance domains. Every successful mechanism follows behavioral → structural → compiled maturation. Synthesizes arXiv (TRACE, AgentTrust, SMSR, Forge), XHS (Structural Turn, 技能工程), HN (harness engineering, permission fatigue, AGENTS.md rot), and 10+ production KEs.
- [The Abstention Advantage: Why the Most Powerful Compiled Governance Is the Decision Not to Act](./the-abstention-advantage.md) ← extends Compilation Gradient with Stage 0: compiled non-action. 7× heartbeat efficiency gap from one compiled decision. Connects arXiv abstention taxonomy (three-gap: specification/verification/authority), Edict's Chancellery veto, Arbor checks-and-balances, and live production data (dev's 92% quick-exit vs arc/scout's <1%).
- [The Impedance Principle: Why Every Agent Feedback Loop Amplifies to Destruction](./the-impedance-principle.md) ← foundational principle beneath Compilation Gradient and Abstention Advantage. Every feedback boundary needs lossy-but-signal-preserving compression. Unifies 7 production pathologies (KE-1986 DB bloat 2.8×/cycle, KE-1945 repair metabolism 73%, KE-1944 context accumulation 8K→156K, KE-1956 instruction ratchet 10:1, KE-1930/1965 guard paradox 99.6% noise, KE-1985 observation parity 54%, KE-1966 Gresham's Law) as one structural failure from control theory: undamped feedback loops resonate to destruction.

## Agent Protocols And Standards

- [Agent Protocols: MCP, A2A, and the Emerging Stack](./agent-protocols-mcp-a2a.md) ← canonical protocol reference

## Agent Architecture And Control

- [Agent Architectures](./agent-architectures.md) ← canonical architecture reference
- [Enterprise AI Agent Architecture 2026](./enterprise-agent-architecture-2026.md) — operational memory gap, beyond-MCP orchestration layers, collaboration architectures
- [HN Agent Research Synthesis](./hn-recent-agent-synthesis.md) — git for agents (re_gent), vulnerability cultures, goal-drift anti-patterns
- [AI Agent Architecture: Operational Memory Layer](./hn-agent-operational-memory.md) — experience cache: tool quirks, workflow patterns, env-specific process knowledge
- [Multi-Agent Coordination Patterns: MetaGPT](./metagpt-architecture-pattern.md) — role-based SOP coordination, "Code = SOP(Team)" philosophy
- [Ruflo Feature Map: Closed-Loop Visibility](./ruflo-feature-map.md) — statusline observability, real-time agent state tracking via Claude Code
- ~~[Agent Architecture Trends](./agent-architecture-trends.md)~~ → merged into agent-architectures.md
- ~~[Agent Architecture Patterns](./agent-patterns.md)~~ → merged into agent-architectures.md
- ~~[agent_patterns.md](./agent_patterns.md)~~ → merged into agent-architectures.md
- ~~[agent_architectures_01.md](./agent_architectures_01.md)~~ → merged into agent-architectures.md

## Memory, Context, And Knowledge Reuse

- [Agent Long-Term Memory: Memary Pattern](./agent-memory-patterns.md) — knowledge graphs, context injection, memory consolidation across sessions
- [Agent Memory Architectural Trends](./agent-memory-trends-2024.md) — shift from pure vector DB to structured/layered memory (KG, hierarchical tiers)
- [Emerging Pattern: Agents and Shared Context](./agent-context-osmosis.md) — the "osmosis problem": agents crawl artifacts to externalize implicit decisions
- [Emergent Multi-Agent Coordination via Context Stigmergy](./context-stigmergy-synthesis.md) — shared env state replaces direct messaging; artifact-driven handoffs
- [Multi-Agent Coordination: Stigmergy and Identity-Aware Routing](./multi-agent-stigmergy.md) — stigmergy traces + LDP identity-aware routing (37% token reduction)

## Evaluation, Failure, And Recovery

- [Agent Evaluation Patterns](./agent-evaluation.md) ← canonical evaluation reference (includes testing tooling landscape)
- [Self-Correction and Reflection: 2026 Trends Analysis](./agent-self-correction-trends-2026.md) — undirected reflection fails; instinct-reflection misalignment; evolutionary memory outperforms zero-shot
- [Agent Error Recovery and Resilience Patterns](./agent-error-recovery.md) — guardrail-first execution, self-correction loops, graceful degradation, error context preservation
- [AI Agent Failure Modes & Solutions](./agent_failure_modes.md) — context overflow, tool hallucination, infinite loops, "False Blocked" status misclassification (production-observed)
- [XHS Multi-Agent Failure Modes](./multi-agent-failure-modes-2024.md) — confirmation loops, swarm context overflow, "Yes Man" evaluator
- [Agent Anti-Patterns](./insights/agent-anti-patterns.md) — over-reliance on LLM routing, monolithic prompts, statelessness, premature multi-agent scaling
- ~~[Agent Evaluation Trends](./agent-evaluation-trends.md)~~ → merged into agent-evaluation.md
- ~~[Agent Evaluation Trends 2026](./agent-evaluation-trends-updated.md)~~ → merged into agent-evaluation.md

## Multi-Agent Coordination

- [Multi-Agent Coordination Patterns](./multi-agent-coordination.md) ← canonical coordination reference
- ~~[Multi-Agent Coordination Patterns: 2024 Research](./multi-agent-coordination-2024.md)~~ → merged into multi-agent-coordination.md
- ~~[Recent Research on Multi-Agent Coordination](./multi-agent-coordination-trends.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Coordination Frameworks Overview 2026](./multi-agent-trends-2026.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Trends and Observations](./multi-agent-trends-v1.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Coordination Insights](./multi_agent_coordination.md)~~ → merged into multi-agent-coordination.md
- ~~[Trends in Multi-Agent Coordination](./multi_agent_trends.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Architecture Trends: HN Review](./multi_agent_trends_hn.md)~~ → merged into multi-agent-coordination.md
- ~~[Multi-Agent Architecture Trends: XHS & Academic Synthesis](./multi_agent_trends_may2024_synthesis.md)~~ → merged into multi-agent-coordination.md
- ~~[Recent Open Source Multi-Agent Architectures](./recent-oss-coordination.md)~~ → merged into multi-agent-coordination.md
- ~~[Metric-Driven Agent Coordination Patterns](./metric-driven-agent-coordination-2026.md)~~ → merged into multi-agent-coordination.md
- ~~[AI Agent Trends: Error Recovery and Stigmergy](./agent-stigmergy-and-critics.md)~~ → merged into multi-agent-coordination.md

## XHS And Chinese AI Community Trends

Active XHS notes (contain unique source-dated observations):

- [XHS Chinese AI Community Trends - May 2026](./xhs_chinese_ai_trends_may2026.md) — richest XHS note: single-agent backlash, MCP turbulence, vibe coding, Claude vs Cursor
- [XHS Multi-Agent Coordination Trends - May 2026](./xhs_coordination_trends_may2026.md) — swarm micro-agencies, event-driven graph memory, watcher pattern
- [XHS AI Agent Trends Report - Q2 2026](./xhs_trends_report_Q2_2026.md) — graph memory, coordination overhead, tool attention
- [XHS AI Agent Trends Report - Update 5](./insights/xhs_trends_v5.md) — peer-to-peer shift, RAG-as-tool, context window management
- [XHS & AI Community Trends: May 2026 Analysis](./xhs_latest_trends_insight_report.md) — framework fatigue, observability-first, real-time state visibility
- [XHS Chinese AI Community Trends — June 2026](./xhs_chinese_ai_trends_june2026.md) — Loop Engineering, 古法编程 backlash, skill frameworks explosion, structural governance turn (evolves May note)

Superseded (generic patterns already in canonical notes):

- ~~[XHS AI Agent Trends & Synthesis](./xhs-agent-trends.md)~~ → covered by canonical notes
- ~~[XHS Trends: Autonomous Agent Architectures & Patterns](./xhs-architecture-patterns.md)~~ → covered by canonical notes
- ~~[XHS AI Agent Trends: Autonomous Patterns](./xhs_autonomous_patterns.md)~~ → covered by canonical notes
- ~~[Autonomous Agent Insights from XHS](./xhs_agent_insights.md)~~ → covered by canonical notes
- ~~[XHS AI Agent Trends: Multi-Agent Coordination](./xhs_multi_agent_trends.md)~~ → covered by multi-agent-coordination.md
- ~~[Multi-Agent Trends and Synthesis: XHS Research](./xhs_synthesis.md)~~ → covered by canonical notes

## XHS Evaluation And Failure Notes

- [XHS AI Agent Trends: Common Failure Modes](./xhs_failure_modes.md)
- [AI Agent Patterns: Hierarchical Coordination & Three-Tier Memory](./agent-patterns-xhs-2024.md)
- ~~[Synthesis of Evaluative Trends for Agents in H2 2024](./xhs-eval-synthesis-2024.md)~~ → merged into agent-evaluation.md
- ~~[XHS Trend: AI Agent Evaluation](./xhs_eval_trends_may2024.md)~~ → merged into agent-evaluation.md

## Findings

- [arXiv Triage - Apr 28-30, 2026](./findings/2026-04-30-arxiv-triage.md) — architectural heterogeneity reduces consensus bias, Pythia workflow-aware serving, MultiHedge retrieval-augmented control (cs.MA)
- [arXiv Triage - Apr 30, 2026](./findings/2026-04-30-arxiv-triage-2.md) — ClawGym sandbox-based agent RL, hot-fix repair behaviors: human vs AI agents
- [arXiv Triage — June 10–11, 2026](./findings/2026-06-15-arxiv-ai-agent-triage.md) — PR rejection rates, instructions-as-code, multi-agent illusion, TRACE compliance (sourced into agent-architectures.md, agent-security-governance.md)
- [arXiv Triage — June 6–11, 2026 (Supplement)](./findings/2026-06-17-arxiv-ai-agent-triage.md) — HyperTool context folding, SMSR memory-poisoning defense, Layer-Isolated evaluation, oversight capacity inverted-U, SENTINEL failure-driven RL (sourced into agent-architectures.md, agent-security-governance.md)
- [arXiv Triage — June 8–11, 2026 (Batch 3)](./findings/2026-06-19-arxiv-ai-agent-triage.md) — Containment Gap framework audit, DeLM shared verified context, Goal-Autopilot anti-fabrication, DCPM dual-process memory, contrastive skill evolution, production context engineering (sourced into agent-architectures.md, agent-security-governance.md)
- [GitHub Trending AI Agent Repos & Tools — June 2026](./findings/github-trending-ai-agents-2026.md) — skills economy, harness pattern, agent memory infra (sourced into agent-architectures.md §Harness Engineering, §Skills-as-Code)
- [Hacker News Trends: AI Agents](./findings/hn-ai-agent-trends.md) — failure-dominated discourse, guardrail/harness tooling build-out, Harness Engineering as emerging discipline (consolidated to 2026-06-19)
- [HackerNews Trends: Agent Memory Patterns](./findings/hn-memory-patterns.md) — back-to-SQL movement, multi-agent memory consistency, dual-mode memory (vector + relational)
- [Multi-Agent Coordination Patterns](./findings/multi-agent-coordination-patterns.md) — domain accountability, event-driven interaction, metrics-as-health-signals (early internal observations)
- [Multi-Agent Coordination Patterns: Updates & Trends](./findings/multi-agent-patterns-2024.md) — marketplace over hierarchy, event-driven blackboards, artifact-centric handoffs, evaluator agents
- [Multi-Agent Coordination Failures: Synthesis & XHS Trends](./findings/multi-agent-failures-2026-synthesis.md) — consensus trap / Yes Man evaluator, swarm communication overhead, context stigmergy as escape route
- [XHS Chinese AI Community — June 2026 Findings](./findings/xhs-chinese-ai-trends-june2026.md) — raw findings companion to synthesis note
- [Scout Friction Analysis - 2025-05-09](./findings/scout-friction-analysis-2025-05-09.md) — 70% friction rate root-cause: uncommitted changes, runtime crashes, schema mismatches, guardrail violations
- [Cross-Source Triage — July 17, 2026](./findings/2026-07-17-arxiv-github-hn-triage.md) — formal governance primitives (shield synthesis, abstention competence, compliance-by-construction), Arbor cognition layer (tree search as shared working memory, 193% gain), Edict 三省六部 (bureaucracy-as-architecture, 16k★), KV-cache commerce, multiagent confidence protocols (sourced into agent-architectures.md, agent-security-governance.md, multi-agent-coordination.md)
- [arXiv Triage — June 4–11, 2026 (Batch 4)](./findings/2026-06-14-arxiv-agent-triage.md) — PerspectiveGap orchestration prompting benchmark (14.9% pass rate), Consistency Illusion reasoning misalignment (CARA metrics + GDP intervention), Emergence World long-horizon divergence (15-day cross-vendor), EurekAgent environment engineering (<$11 SOTA), INFRAMIND infrastructure-aware orchestration (7× latency, 99.9% SLO), FlowBank workflow portfolios, Notes2Skills certainty preservation, Alem coordination bottleneck, InquiTree cognitive tunneling, FASE cheap uncertainty (sourced into agent-evaluation.md, agent-architectures.md, multi-agent-coordination.md)

## Migration Notes

The first migration deliberately did not consolidate duplicate-looking files.
Those are now visible through this index so the project can review and merge
them with task-tracked evidence instead of silently deleting context.

Known consolidation clusters:

- ~~Agent architecture~~: consolidated into `agent-architectures.md` (2026-06-14).
- ~~Evaluation~~: consolidated into `agent-evaluation.md` (2026-06-14).
- ~~Multi-agent trends~~: consolidated into `multi-agent-coordination.md` (2026-06-14).
- XHS reports: 6 generic/duplicate XHS notes superseded (2026-06-15). 5 source-dated
  notes retained with unique observations. Remaining overlap between the 5 active
  XHS notes and xhs_failure_modes.md / agent-patterns-xhs-2024.md is minor —
  each contains distinct dated observations worth keeping.
