<ai_context>
summary: "Entry point for Scout's project-owned knowledge library. Use this before creating or updating Scout-local knowledge notes."
triggers: ["scout knowledge", "agent architecture research", "multi-agent trends", "XHS trends", "knowledge library maintenance"]
last_updated: "2026-06-12"
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
- [Scout Research Ideas](./temp-ideas.md)

Migration and project-operation artifacts live outside `knowledge/`:

- [Initial library inventory](../reports/library-inventory-2026-06-12.md)
- [Second-brain migration outputs](../reports/migration/scout-second-brain-learning/README.md)

## Agent Architecture And Control

- [Agent Architecture Trends](./agent-architecture-trends.md)
- [Agent Architectures](./agent-architectures.md)
- [Agent Architecture Patterns](./agent-patterns.md)
- [Agent Architecture Patterns - legacy filename](./agent_patterns.md)
- [Trend Report: Multi-Agent Reflection & Memory Tiers](./agent_architectures_01.md)
- [Enterprise AI Agent Architecture 2026](./enterprise-agent-architecture-2026.md)
- [HN Agent Research Synthesis](./hn-recent-agent-synthesis.md)
- [AI Agent Architecture: Operational Memory Layer](./hn-agent-operational-memory.md)
- [Multi-Agent Coordination Patterns: MetaGPT](./metagpt-architecture-pattern.md)
- [Ruflo Feature Map: Closed-Loop Visibility](./ruflo-feature-map.md)

## Memory, Context, And Knowledge Reuse

- [Agent Long-Term Memory: Memary Pattern](./agent-memory-patterns.md)
- [Agent Memory Architectural Trends](./agent-memory-trends-2024.md)
- [Emerging Pattern: Agents and Shared Context](./agent-context-osmosis.md)
- [Emergent Multi-Agent Coordination via Context Stigmergy](./context-stigmergy-synthesis.md)
- [Multi-Agent Coordination: Stigmergy and Identity-Aware Routing](./multi-agent-stigmergy.md)

## Evaluation, Failure, And Recovery

- [Agent Evaluation Patterns](./agent-evaluation.md)
- [Agent Evaluation Trends](./agent-evaluation-trends.md)
- [Agent Evaluation Trends 2026](./agent-evaluation-trends-updated.md)
- [Self-Correction and Reflection: 2026 Trends Analysis](./agent-self-correction-trends-2026.md)
- [Agent Error Recovery and Resilience Patterns](./agent-error-recovery.md)
- [AI Agent Failure Modes & Solutions](./agent_failure_modes.md)
- [XHS Multi-Agent Failure Modes](./multi-agent-failure-modes-2024.md)
- [Agent Anti-Patterns](./insights/agent-anti-patterns.md)

## Multi-Agent Coordination

- [Multi-Agent Coordination Patterns: 2024 Research](./multi-agent-coordination-2024.md)
- [Recent Research on Multi-Agent Coordination](./multi-agent-coordination-trends.md)
- [Multi-Agent Coordination Frameworks Overview 2026](./multi-agent-trends-2026.md)
- [Multi-Agent Trends and Observations](./multi-agent-trends-v1.md)
- [Multi-Agent Coordination Insights](./multi_agent_coordination.md)
- [Trends in Multi-Agent Coordination](./multi_agent_trends.md)
- [Multi-Agent Architecture Trends: HN Review](./multi_agent_trends_hn.md)
- [Multi-Agent Architecture Trends: XHS & Academic Synthesis](./multi_agent_trends_may2024_synthesis.md)
- [Recent Open Source Multi-Agent Architectures](./recent-oss-coordination.md)
- [Metric-Driven Agent Coordination Patterns](./metric-driven-agent-coordination-2026.md)
- [AI Agent Trends: Error Recovery and Stigmergy](./agent-stigmergy-and-critics.md)

## XHS And Chinese AI Community Trends

- [XHS AI Agent Trends & Synthesis](./xhs-agent-trends.md)
- [XHS Trends: Autonomous Agent Architectures & Patterns](./xhs-architecture-patterns.md)
- [XHS AI Agent Trends: Autonomous Patterns](./xhs_autonomous_patterns.md)
- [Autonomous Agent Insights from XHS](./xhs_agent_insights.md)
- [XHS Chinese AI Community Trends - May 2026](./xhs_chinese_ai_trends_may2026.md)
- [XHS Multi-Agent Coordination Trends - May 2026](./xhs_coordination_trends_may2026.md)
- [XHS AI Agent Trends: Multi-Agent Coordination](./xhs_multi_agent_trends.md)
- [Multi-Agent Trends and Synthesis: XHS Research](./xhs_synthesis.md)
- [XHS AI Agent Trends Report - Q2 2026](./xhs_trends_report_Q2_2026.md)
- [XHS AI Agent Trends Report - Update 5](./insights/xhs_trends_v5.md)
- [XHS & AI Community Trends: May 2026 Analysis](./xhs_latest_trends_insight_report.md)

## XHS Evaluation And Failure Notes

- [Synthesis of Evaluative Trends for Agents in H2 2024](./xhs-eval-synthesis-2024.md)
- [XHS Trend: AI Agent Evaluation](./xhs_eval_trends_may2024.md)
- [XHS AI Agent Trends: Common Failure Modes](./xhs_failure_modes.md)
- [AI Agent Patterns: Hierarchical Coordination & Three-Tier Memory](./agent-patterns-xhs-2024.md)

## Findings

- [arXiv Triage - Apr 28-30, 2026](./findings/2026-04-30-arxiv-triage.md)
- [arXiv Triage - Apr 30, 2026](./findings/2026-04-30-arxiv-triage-2.md)
- [Hacker News Trends: AI Agents](./findings/hn-ai-agent-trends.md)
- [HackerNews Trends: Agent Memory Patterns](./findings/hn-memory-patterns.md)
- [Multi-Agent Coordination Patterns](./findings/multi-agent-coordination-patterns.md)
- [Multi-Agent Coordination Patterns: Updates & Trends](./findings/multi-agent-patterns-2024.md)
- [Multi-Agent Coordination Failures: Synthesis & XHS Trends](./findings/multi-agent-failures-2026-synthesis.md)
- [Scout Friction Analysis - 2025-05-09](./findings/scout-friction-analysis-2025-05-09.md)

## Migration Notes

The first migration deliberately did not consolidate duplicate-looking files.
Those are now visible through this index so the project can review and merge
them with task-tracked evidence instead of silently deleting context.

Known consolidation clusters:

- Agent architecture: `agent-architecture-trends.md`, `agent-architectures.md`,
  `agent-patterns.md`, `agent_patterns.md`, `agent_architectures_01.md`.
- Evaluation: `agent-evaluation.md`, `agent-evaluation-trends.md`,
  `agent-evaluation-trends-updated.md`, `xhs-eval-synthesis-2024.md`,
  `xhs_eval_trends_may2024.md`.
- Multi-agent trends: `multi-agent-*`, `multi_agent_*`, and related XHS trend
  files.
- XHS reports: several May 2026 reports overlap and should be consolidated only
  after source checks.
