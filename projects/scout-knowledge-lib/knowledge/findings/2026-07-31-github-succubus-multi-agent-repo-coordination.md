---
title: "Succubus — Shared State Daemon for Multi-Agent Repo Coordination"
source: github
date: 2026-07-31
last_updated: 2026-07-31
type: finding
tags: [github, multi-agent, coordination, coding-agents, mcp, file-locking]
relevance: high
---

# Succubus — Shared State Daemon for Multi-Agent Repo Coordination

Repo: https://github.com/enowdev/succubus (13★, created 2026-07-28)

## What

A Go daemon (single SQLite DB) that gives multiple concurrent coding agent sessions (Claude Code, OpenCode, Codex, Gemini, Factory Droid) awareness of each other when working in the same repository. Ships as an MCP server + git hooks.

## How It Works

1. **Named identities** — each agent session gets a persistent name (ORION, VESPER, KESTREL) that survives restarts and context compaction.
2. **Shared plan & task board** — agents read the active plan on every turn and claim tasks, preventing duplicate work.
3. **File leasing** — agents claim paths before editing; other agents are told who holds a file. Leases auto-expire on crash.
4. **Question posting** — uncertain agents post questions instead of guessing; others see them next turn.
5. **Injection on every prompt** — coordination state is injected into context on session start and every turn, so agents can't claim ignorance.
6. **Graceful degradation** — if daemon is down, hooks exit silently and MCP tools return advisory text. Never blocks work.

## Why This Matters

This is the first open-source tool purpose-built for the **same-repo multi-agent collision problem** — the scenario where 3+ coding agents edit one codebase simultaneously and overwrite each other's work, duplicate effort, or lose the shared plan.

Key design choices:
- **Pessimistic file locking** (leases) rather than optimistic merge — acknowledges that LLM agents can't reliably resolve merge conflicts.
- **Minimum viable communication** — agents share claims and questions, not full context. Aligns with the contamination threshold finding (scan #111): coordination works best when communication is admission-controlled.
- **Identity persistence** — solving the "who was I?" problem that arises from context compaction and session restarts.

## Connections

- Relates to waggle (modiqo/waggle) for cross-agent handoff tokens, but succubus solves _concurrent_ coordination rather than _sequential_ handoffs.
- Addresses the coordination tax problem documented in earlier scans (51% planner sessions exit with nothing to plan).
- The file-lease pattern echoes traditional distributed systems (advisory locks, POSIX flocks) adapted for LLM agent semantics.

## Limitations

- 13★ in 3 days — early traction, not yet validated at scale.
- Go + SQLite means single-machine only; doesn't address distributed/cloud multi-agent scenarios.
- Depends on agents honoring the injected coordination context (no enforcement beyond advisory).
