---
title: "Kookr — Human Attention Routing Becomes a First-Class Agent Layer"
source: github
date: 2026-08-04
last_updated: 2026-08-04
type: finding
tags: [github, coding-agents, supervision, attention-routing, multi-agent, hooks, github-awareness]
relevance: high
---

# Kookr

## Overview

- **Repo:** [kookr-ai/kookr](https://github.com/kookr-ai/kookr) (3★, created 2026-05-05, updated 2026-08-04)
- **Author:** kookr-ai
- **Language:** TypeScript
- **License:** Apache-2.0
- **What:** A local supervision layer for developers running several Claude Code or Codex-style coding agents in parallel, with a findings queue that explains which agent most needs human attention.

## Core Signal

Kookr's interesting move is that it does **not** treat the main scaling problem as "make one agent more autonomous."

It treats the bottleneck as **human attention across many active agents**.

The repo's architecture and user guide describe a supervisor-first system that watches agent hook streams, detects concrete blocker patterns, and routes the developer toward the most urgent intervention. The main UI surface is a prioritized **findings queue**, not a flat terminal multiplexer and not a generic multi-agent planner.

That makes Kookr less like an agent framework and more like an **air-traffic-control layer for agent fleets**.

## Concrete Design Details

1. **Observability is hook-native and event-driven.**  
   The architecture doc says Kookr watches per-agent JSONL hook files with `fs.watch()` and processes new events immediately. Current V1 findings are grounded in structured signals such as `PermissionRequest`, `Stop`, repeated tool failures, hook-health problems, and budget thresholds rather than terminal scraping.

2. **The unit of orchestration is the human interruption queue.**  
   Kookr's chosen UI is explicitly "supervisor-first triage": findings cards on the left, the selected agent terminal on the right. The user guide says healthy agents remain visible but are intentionally kept out of the urgent queue until something changes.

3. **GitHub workflow state is folded into the same attention surface.**  
   The architecture doc says Kookr extracts PR and issue references from agent tool results, polls GitHub for review and CI changes, then routes actionable updates back through the same queue used for agent anomalies. That joins live agent supervision with downstream repository-state monitoring.

4. **The system is local-first but durable.**  
   Kookr runs agents inside managed `dtach` sessions, keeps local task/session state under `~/.kookr/`, replays hook history on restart, and restores anomaly state after crashes. The persistence target is the supervisor's operational picture, not just the raw agent transcript.

5. **The repo is explicit about a staged control model.**  
   The architecture doc says V1 uses rule-based anomaly detection with structured hooks, while an LLM-powered supervisor is a later V2 layer for subtler trajectory analysis. That sequencing matters: reliable supervision is being built on deterministic signals first, with model judgment added only after the evidence layer exists.

## Why This Matters

1. **Multi-agent tooling is shifting from parallel execution to parallel supervision.**  
   Once developers can easily launch many agents, the scarce resource stops being terminal slots and becomes interruption triage.

2. **Attention routing is emerging as its own product layer.**  
   Earlier orchestration repos mostly focused on planning, delegation, memory, or merge control. Kookr instead optimizes for "which agent should the human look at right now?"

3. **Agent observability is expanding beyond the model loop.**  
   The GitHub-awareness path shows that an agent's real state includes PR reviews, CI failures, and other external workflow events, not only what appears in the terminal.

4. **Human-in-the-loop is becoming operational rather than ceremonial.**  
   Kookr is not just adding an approval button. It is trying to rank, explain, and compress the moments where human judgment has the highest leverage.

## Connections to Library Themes

- **Repo-local governance:** reinforces the move toward supervision and approval surfaces that live beside the repository workflow rather than inside a generic chat window.
- **Harness engineering:** the value comes from hooks, managed sessions, replay, and queue design, not from a new base model.
- **Multi-agent coordination:** suggests that for coding-agent teams, the key coordinator may be a human attention router rather than another autonomous planner.
- **Operational state over transcript bulk:** the important object is a live, prioritized picture of blockers and external state changes.

## Sources

- **Repo:** https://github.com/kookr-ai/kookr
- **README:** https://raw.githubusercontent.com/kookr-ai/kookr/main/README.md
- **Architecture:** https://raw.githubusercontent.com/kookr-ai/kookr/main/docs/architecture.md
- **User guide:** https://raw.githubusercontent.com/kookr-ai/kookr/main/docs/user-guide.md
- **GitHub API metadata:** https://api.github.com/repos/kookr-ai/kookr
