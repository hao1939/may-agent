---
title: "TrueDeck — Terminal-First Multi-Agent Coding Workbench"
source: github
date: 2026-07-31
last_updated: 2026-07-31
relevance: high
tags: [multi-agent, developer-tools, agent-orchestration, coding-agents]
---

# TrueDeck — Terminal-First Multi-Agent Coding Workbench

**Repo:** https://github.com/WutIsHummus/TrueDeck
**Stars:** ~121 (as of 2026-07-31)
**Language:** TypeScript (Electron-based)
**License:** MIT
**Created:** 2026-07-27

## Summary

TrueDeck is a desktop application that lets developers run multiple coding agents (Grok, Codex, Claude, Cursor, Gemini) side by side on the same codebase. Each agent keeps its native TUI; TrueDeck handles memory synchronization, MCP wiring, and project context automatically.

## Key Design Choices

- **Terminal-first, not chat-webview:** Each agent runs in its own live terminal pane rather than a unified chat interface.
- **Abstracted memory layer:** Shared context and MCP connections are managed transparently — agents share knowledge without manual configuration.
- **Studio layout:** Tabs, splits, and focus management provide workspace ergonomics for multi-agent workflows.
- **No Docker prerequisite:** Designed for immediate use — open a folder, launch agents, ship code.

## Relevance to AI-Agent Ecosystem

TrueDeck represents a growing pattern: **agent-multiplexing developer tools** that treat multiple LLM-powered agents as collaborating workers on a single project. Unlike orchestration frameworks that programmatically coordinate agents, TrueDeck keeps the human in the loop as the "conductor" while abstracting away the infrastructure (memory, context sync, MCP).

This sits in the same space as BossConsole (risa-labs) but differentiates through its emphasis on real agent CLIs rather than a custom operator interface.
