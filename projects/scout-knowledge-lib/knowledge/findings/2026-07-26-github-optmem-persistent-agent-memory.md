---
title: "OptMem — Minimalist Persistent Memory for AI Agents"
Date: 2026-07-26
last_updated: 2026-07-29
source: github
Repo: https://github.com/VictorTaelin/OptMem
tags: [agent-memory, persistent-state, binary-tree, context-management]
relevance: high
---

# OptMem — Permanent Memory for AI Agents

## What It Is

OptMem is a single-file Python tool (no dependencies) by Victor Taelin (creator of HVM/Bend) that gives AI agents persistent memory across sessions, vendors, and model changes. 802★ in 4 days (created 2026-07-25; 216★ at first observation, 593★ by 2026-07-27, 802★ by 2026-07-29). Growth sustaining at ~100★/day.

## How It Works

- **Append-only log**: Every memory is a single line (≤280 chars) appended to `LOG.txt`. Never edited.
- **Binary-tree summaries**: Pairs of memories are summarized into tree nodes (`#0-1`, `#2-3`, `#0-3`, etc.). Summaries are a cache — rebuildable from the log alone.
- **Fixed-width records**: Position is identity; every lookup is one seek. At 1M memories (608 MB), `wake` takes 0.03s.
- **Reading budget, not storage budget**: `WAKE_LINES` controls how many lines `wake` prints. Changing it doesn't trigger recomputation.
- **Inline merge compaction**: When `memo note` is called, it may ask the agent to do a merge (compress two adjacent summaries). No background processes.

## Key Commands

| Command | Purpose |
|---|---|
| `memo wake` | Load memory at session start (mandatory first call) |
| `memo note "..."` | Record one memory (≤280 chars) |
| `memo nap` | Process pending merge compactions |
| `memo recall <regex>` | Full-text search across all memories |
| `memo zoom <lo>-<hi>` | Drill into a summary tree node |

## Integration Surface

A 426-token prompt block (pasted into `CLAUDE.md` or `AGENTS.md`) that instructs the agent to: (1) run `wake` first in every session, (2) call `note` for durable learnings, (3) handle merges inline. Subagents are explicitly excluded to prevent duplicates.

## Why It Matters

1. **Memory as portable infrastructure**: Decouples memory from any specific LLM vendor or harness. Survives model switches, compaction, and context resets.
2. **Zero-dependency, zero-daemon**: Aligns with the "tool, not service" pattern — a single Python file the agent calls as a CLI tool.
3. **Binary-tree compaction is novel for agent memory**: Most agent memory systems use vector stores or flat key-value stores. The hierarchical merge structure gives O(log n) navigation with constant-time append.
4. **Validates "memory is the durable value layer"**: Reinforces the pattern seen in Cindy (meta-harness client) — the persistent state an agent accumulates is more valuable than the LLM backend.

## Connection to Existing Knowledge

- Implements the "Operational Memory" concept tracked in `hn-agent-operational-memory.md`, but as a concrete minimal tool rather than an architectural discussion.
- Complements the Cindy finding (`2026-07-26-github-cindy-meta-harness-client.md`) which treats memory/skills as the portable layer across harness switches.
