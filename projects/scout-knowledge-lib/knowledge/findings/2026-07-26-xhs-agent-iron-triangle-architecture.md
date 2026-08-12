---
title: "Agent Landing Iron Triangle: Graph, Loop, Harness"
date: 2026-07-26
last_updated: 2026-07-26
source_platform: xhs
query: "AI agent 智能体"
tags: [agent-architecture, graph, loop, harness, design-patterns, production-deployment]
---

# Agent Landing Iron Triangle: Graph, Loop, Harness

## Summary

A new architectural synthesis gaining traction on XHS (78 likes) frames production
agent deployment as requiring three interdependent pillars — the "Iron Triangle"
(铁三角):

1. **Graph** — the task/workflow graph that defines what the agent can do and
   how subtasks relate (DAG structure, branching, dependencies)
2. **Loop** — the feedback/iteration cycle that governs how the agent improves
   within a session (retry logic, reflection, self-correction)
3. **Harness** — the external infrastructure that constrains, observes, and
   governs the agent (budgets, safety rails, observability, rollback)

The framework argues that production agents fail when any one pillar is missing:
- Graph without Loop = brittle single-pass execution
- Loop without Harness = runaway iteration, resource waste
- Harness without Graph = constrained but aimless

## Relevance

This crystallizes the progression tracked in our XHS Chinese AI Trends note:
the community moved from Prompt Engineering → Loop Engineering → Harness
Engineering. The iron-triangle framing synthesizes these as co-required rather
than sequential replacements. It aligns with our existing knowledge that
infrastructure-layer constraints outperform text-layer constraints (KE-1924).

The "models eat the harness" debate (Section 3 of xhs_chinese_ai_trends_june2026.md)
is implicitly answered: models may absorb Graph and Loop functions, but Harness
remains external infrastructure.

## Source

- Source: https://www.xiaohongshu.com/search_result/6a65ac06000000000503b864
- Author: 咔嗒库栗
- Engagement: 78 likes

## Also Noted This Scan

- **ByteDance + Renmin U: AI Agent toward real world** (133 likes, 机器之心) — industry paper on bridging lab agents to production. Source: https://www.xiaohongshu.com/search_result/6a01a85e0000000036030889
- **Agentic RL must-read papers collection** (1,461 likes) — highest-engagement post in the feed, indicating RL-based agent training is a dominant interest. Already partially tracked.
- **Agent self-evolution OPD from Tsinghua** (404 likes) — extends the self-evolution discourse already documented in 2026-07-20-xhs-self-evolving-agents.md.
