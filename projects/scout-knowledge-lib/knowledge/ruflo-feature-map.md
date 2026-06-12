<ai_context>
Scout knowledge file: Ruflo Feature Map: Closed-Loop Visibility
</ai_context>

# Ruflo Feature Map: Closed-Loop Visibility

## Context
This document maps how Ruflo implements closed-loop visibility and workflow-task-agent tracking, to inform the `ruflo-learning-loop` project. We focus on iteration 1: making the state of the agent system visible in real-time.

## Evidence from Ruflo

Ruflo implements a highly integrated observability system via Claude Code's status line feature, detailed in `v3/implementation/adrs/ADR-052-statusline-observability-system.md` and `docs/USERGUIDE.md`.

### Core Mechanism: The Statusline
Claude Code pipes JSON session data via **stdin** to a statusline script after each assistant message (debounced ~300ms). The script reads this data and combines it with local project metrics to produce a single-line status output.

- **Configuration:** Stored in `.claude/settings.json` under the `statusLine` key.
- **Script:** Generated as `.claude/helpers/statusline.cjs` by `npx ruflo init`.
- **Execution:** Runs frequently (e.g., every 5000ms).

### Data Surfaced
Ruflo's statusline provides real-time visibility into multiple subsystems:
- **Context Usage:** `% ctx`, token counts, compaction status (e.g., `[●●●●○] 4/5`).
- **Swarm Activity:** Active agents, topology, task metrics (e.g., `🤖 ◉ [12/8]  👥 3`).
- **Intelligence/Learning:** Pattern storage scores (e.g., `🧠 15%`).
- **Security:** Active CVEs (e.g., `🟢 CVE 3/3`).
- **AgentDB/Memory:** Vector counts, index status (e.g., `📦 AgentDB ●1.2K vectors`, `⚡ HNSW 150x`).

### Supporting Tools
- `ruflo status` (CLI) and MCP tools like `swarm_status`, `agent_status`, `task_status`, `workflow_status` provide deeper inspection.
- Shell-based daemons (e.g., `swarm-monitor.sh`) watch processes and dump metrics to JSON files (like `.claude-flow/metrics/v3-progress.json`), which the fast `.cjs` status script reads synchronously.

## What May-Agent Already Has
- A SQLite database (`may.db`) containing `sessions`, `metrics`, and `events`.
- A running server/daemon that processes events and could emit state.
- Existing metrics for session duration, error rates, etc., but not yet exposed in a real-time, zero-friction UI like a terminal statusline.

## Possible Tiny Experiments
1. **SQLite Polling Script:** Write a small script (e.g., `bin/status.js`) that queries `metrics` or `sessions` from SQLite and outputs a single formatted line (e.g., `May: 🟢 Idle | 📈 3 tasks | 🧠 2 lessons`). We can run this manually or in a watch loop to see if the density of info is useful.
2. **Event Tailer:** Create a lightweight CLI command that tails the `events` table (or log) in real-time, showing agent transitions (e.g., `[Scout] finished task X -> [Arc] evaluating`).

## Complexity Risks
- **Performance:** Running a script every few seconds to poll SQLite could lock the DB or degrade performance if the queries are complex.
- **Integration:** May-agent does not run inside Claude Code, so we don't get the automatic UI integration. Building a persistent TUI or status bar requires a wrapper script or terminal multiplexer integration, which might be overkill.

## What Arc Must Judge Next
- Should we prioritize a terminal-based statusline (like Ruflo) or a web/dashboard view?
- Does the value of real-time visibility justify the cost of building a dedicated UI wrapper for the developer workflow?
- Which 3 metrics are absolutely critical to see at a glance during development?