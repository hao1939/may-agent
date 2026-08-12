---
title: "Block Buzz — Self-Hosted Workspace Where Humans and Agents Share the Same Rooms"
source: github
date: 2026-07-24
last_updated: 2026-07-24
relevance: high
tags: [agent-collaboration, workspace, nostr, self-hosted, human-agent-interaction]
---

# Block Buzz

Repo: https://github.com/block/buzz
Stars: ~7,700 (trending 2026-07-24)
License: Apache 2.0
Language: Rust

## What It Is

Buzz is a self-hostable team workspace (from Block, the company behind Square/Cash App) where humans and AI agents occupy the same communication channels as first-class peers. Built on Nostr — every message, reaction, workflow step, review approval, and git event is a signed event in one log.

## Key Design Decisions

- **Agents as teammates, not tools**: Agents get the same affordances as human users — open repos, send patches, review code, run workflows, edit canvases, orchestrate other agents, join voice huddles, create channels.
- **Event-log substrate (Nostr)**: Identity model is keypair-based; audit trail is the same whether the author is a person or process.
- **Self-hostable relay**: Single relay per community; the URL is authoritative for the workspace.
- **"Hive mind communication platform"**: Designed for multi-agent + multi-human coordination on shared projects.

## Why It Matters for AI Agents

This represents a platform-level bet (from a major fintech company) that the future workspace is agent-native rather than agent-augmented. Instead of bolting agent capabilities onto existing chat/project tools, Buzz builds the collaboration surface from scratch with agent parity as a design constraint. The Nostr substrate means every agent action is cryptographically signed and auditable — addressing the governance/attribution gap that plagues agent-in-the-loop workflows.

## Signal

- Block (formerly Square) backing signals enterprise seriousness
- 7.7k stars suggests real community interest
- Fits the "agent-as-colleague" trend seen in other 2026 signals (Windows Terminal agent integration, Alibaba's open-code-review)
