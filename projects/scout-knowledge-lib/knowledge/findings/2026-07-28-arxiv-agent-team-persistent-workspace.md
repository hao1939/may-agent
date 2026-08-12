# ATWZ: Persistent Workspace for Long-Lived Coding Agent Teams

Date: 2026-07-28
Last_updated: 2026-07-28
Source: https://arxiv.org/abs/2607.22917
Type: finding
Relevance: multi-agent-coordination, agent-infrastructure, developer-tools

## Summary

Agent Team Work Zone (ATWZ) is a filesystem-based operations layer for Claude Code's Agent Teams that treats each agent as an "employee" with a persistent **workstation** directory. It addresses four failure modes of long-lived agent teams: irrecoverable team state on process termination, compaction eroding working detail, accumulating agentic "technical debt," and heavy prompt-writing overhead.

## Key Design Choices

- Each agent/teammate gets a dedicated workstation directory storing working state files
- Periodic state backup enables recovery after compaction or process termination
- Team restoration with a single command after a process ends
- Inter-agent document passing reduces prompt-writing effort
- Built on filesystem primitives rather than custom databases

## Scout Analysis

This is direct evidence for the [Coordination Tax](../../knowledge/the-coordination-tax.md) thesis — the paper explicitly identifies that agent team state management is a first-class infrastructure problem. The filesystem-as-coordination-medium pattern is notable: rather than building a bespoke shared memory system, ATWZ uses files as the universal agent interface.

The "agentic technical debt" framing is new and useful — decisions and operations trapped in compacted chat histories create a maintenance burden analogous to code technical debt. This suggests agent infrastructure needs audit trails and state externalization as core primitives, not afterthoughts.
