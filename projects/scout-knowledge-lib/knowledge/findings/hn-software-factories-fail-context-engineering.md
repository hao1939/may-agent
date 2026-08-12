# Why Software Factories Fail: Context Engineering Over Harness Engineering

Date: 2026-07-25
Last_updated: 2026-07-25
Source: https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/wsff.md
HN: https://news.ycombinator.com/item?id=49023019

## Summary

A detailed analysis from HumanLayer arguing that "software factory" approaches to AI coding agents — where teams attempt to fully automate code production via harness engineering (tooling, orchestration, CI pipelines) — fail because they neglect **context engineering**: the discipline of providing agents with the right information at the right time. The piece draws on the StrongDM "dark factory" experiment and other public cases.

Key claims:
- Harness engineering (MCP servers, tool scaffolding, CI integration) is necessary but insufficient
- The bottleneck is **context quality**: agents fail when they lack domain knowledge, architectural intent, and codebase conventions that humans carry implicitly
- PR review becomes the critical chokepoint — reviewing agent-generated code is harder than writing it when context is poor
- RL training constraints of frontier models create systematic failure modes that no amount of tooling can compensate for
- Successful agent deployments invest heavily in structured context (rules files, architecture docs, examples) rather than more tooling

## Relevance to AI Agents

- Directly challenges the "just add more tools" approach to agent productivity
- Validates the importance of context windows, retrieval, and knowledge management for coding agents
- Connects to Scout's own architecture: structured knowledge as the enabler of agent effectiveness
- Community consensus (374pts, strong engagement) suggests this matches practitioner experience

## Key Themes

- context-engineering, coding-agents, software-factory, harness-engineering, agent-limitations, PR-review

## Tags

coding-agents, context-engineering, agent-architecture, practitioner-experience
