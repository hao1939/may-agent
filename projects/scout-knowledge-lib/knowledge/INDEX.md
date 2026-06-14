<ai_context>
summary: "Entry point for Scout's project-owned knowledge library. Use this before creating or updating Scout-local knowledge notes."
triggers: ["scout knowledge", "agent architecture research", "multi-agent trends", "XHS trends", "knowledge library maintenance"]
last_updated: "2026-07-15"
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

## Agent Protocols And Standards

- [Agent Protocols: MCP, A2A, and the Emerging Stack](./agent-protocols-mcp-a2a.md) ← canonical protocol reference

## Agent Architecture And Control

- [Agent Architectures](./agent-architectures.md) ← canonical architecture reference
- [Enterprise AI Agent Architecture 2026](./enterprise-agent-architecture-2026.md)
- [HN Agent Research Synthesis](./hn-recent-agent-synthesis.md)
- [AI Agent Architecture: Operational Memory Layer](./hn-agent-operational-memory.md)
- [Multi-Agent Coordination Patterns: MetaGPT](./metagpt-architecture-pattern.md)
- [Ruflo Feature Map: Closed-Loop Visibility](./ruflo-feature-map.md)
- ~~[Agent Architecture Trends](./agent-architecture-trends.md)~~ → merged into agent-architectures.md
- ~~[Agent Architecture Patterns](./agent-patterns.md)~~ → merged into agent-architectures.md
- ~~[agent_patterns.md](./agent_patterns.md)~~ → merged into agent-architectures.md
- ~~[agent_architectures_01.md](./agent_architectures_01.md)~~ → merged into agent-architectures.md

## Memory, Context, And Knowledge Reuse

- [Agent Long-Term Memory: Memary Pattern](./agent-memory-patterns.md)
- [Agent Memory Architectural Trends](./agent-memory-trends-2024.md)
- [Emerging Pattern: Agents and Shared Context](./agent-context-osmosis.md)
- [Emergent Multi-Agent Coordination via Context Stigmergy](./context-stigmergy-synthesis.md)
- [Multi-Agent Coordination: Stigmergy and Identity-Aware Routing](./multi-agent-stigmergy.md)

## Evaluation, Failure, And Recovery

- [Agent Evaluation Patterns](./agent-evaluation.md) ← canonical evaluation reference
- [Self-Correction and Reflection: 2026 Trends Analysis](./agent-self-correction-trends-2026.md)
- [Agent Error Recovery and Resilience Patterns](./agent-error-recovery.md)
- [AI Agent Failure Modes & Solutions](./agent_failure_modes.md)
- [XHS Multi-Agent Failure Modes](./multi-agent-failure-modes-2024.md)
- [Agent Anti-Patterns](./insights/agent-anti-patterns.md)
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

- [arXiv Triage - Apr 28-30, 2026](./findings/2026-04-30-arxiv-triage.md)
- [arXiv Triage - Apr 30, 2026](./findings/2026-04-30-arxiv-triage-2.md)
- [arXiv Triage — June 10–11, 2026](./findings/2026-06-15-arxiv-ai-agent-triage.md) — PR rejection rates, instructions-as-code, multi-agent illusion, TRACE compliance (sourced into agent-architectures.md, agent-security-governance.md)
- [arXiv Triage — June 6–11, 2026 (Supplement)](./findings/2026-06-17-arxiv-ai-agent-triage.md) — HyperTool context folding, SMSR memory-poisoning defense, Layer-Isolated evaluation, oversight capacity inverted-U, SENTINEL failure-driven RL (sourced into agent-architectures.md, agent-security-governance.md)
- [GitHub Trending AI Agent Repos & Tools — June 2026](./findings/github-trending-ai-agents-2026.md) — skills economy, harness pattern, agent memory infra (sourced into agent-architectures.md §Harness Engineering, §Skills-as-Code)
- [Hacker News Trends: AI Agents](./findings/hn-ai-agent-trends.md)
- [HackerNews Trends: Agent Memory Patterns](./findings/hn-memory-patterns.md)
- [Multi-Agent Coordination Patterns](./findings/multi-agent-coordination-patterns.md)
- [Multi-Agent Coordination Patterns: Updates & Trends](./findings/multi-agent-patterns-2024.md)
- [Multi-Agent Coordination Failures: Synthesis & XHS Trends](./findings/multi-agent-failures-2026-synthesis.md)
- [XHS Chinese AI Community — June 2026 Findings](./findings/xhs-chinese-ai-trends-june2026.md) — raw findings companion to synthesis note
- [Scout Friction Analysis - 2025-05-09](./findings/scout-friction-analysis-2025-05-09.md)

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
