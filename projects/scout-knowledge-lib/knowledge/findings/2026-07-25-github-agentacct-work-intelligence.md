---
title: "agentacct — Local-First Agent Work Intelligence for Coding Agents"
source: github
date: 2026-07-25
last_updated: 2026-07-25
repo_url: https://github.com/mikehasa/agentacct
tags: [agent-observability, cost-tracking, attribution, local-first, coding-agents]
---

# agentacct: Local-First Agent Work Intelligence

Repo: https://github.com/mikehasa/agentacct

## Summary

agentacct (173★, created 2026-07-24, MIT, Python) provides local-first observability for coding agents — reading session logs that Claude Code and Codex already write on disk, joining usage data with recorded work steps, and rendering a dashboard at localhost.

**Key design principles:**
- **Private by design** — all state is plain local files, dashboard binds to 127.0.0.1, no telemetry, no account, no cloud sync, never stores or requests API keys
- **Attribution confidence labels** — every join between token usage and recorded work carries a confidence label (exact/high/medium/low); missing attribution beats wrong attribution
- **Evidence typing** — a passing test is `Verified` evidence; an agent's own claim stays labeled `Agent reported`
- **Cost as estimate, not invoice** — clearly marked pricing-table estimates from client-reported token counts

## Why This Matters for AI-Agent Architecture

1. **The accountability gap**: Coding agents produce work but provide no structured accounting of what they did, how many tokens they consumed, or whether claims are verified. agentacct fills this without requiring agent cooperation — it reads existing logs.

2. **Attribution honesty**: The confidence-label system (exact/high/medium/low) with explicit gap-showing when links can't be proven is a governance pattern worth noting. This is the "show the gap instead of a guess" principle applied to agent work tracking.

3. **Local-first as trust architecture**: By never leaving the machine, agentacct sidesteps the trust problem of sending agent session data to external services. This aligns with the sovereignty/local-first signal consistently strong on HN.

## Relation to Existing Findings

- **TraceRoot** (2026-07-24-xhs-traceroot-agent-observability): Complementary — TraceRoot traces execution for debugging; agentacct accounts for work and cost at the task level.
- **Observability-Aware Code** (arXiv 2607.05785): Academic framing of making agent work observable; agentacct is a practitioner implementation.
- **BossConsole** (risa-labs-inc): Multi-agent operator console for real-time governance; agentacct is post-hoc accounting rather than real-time control.

## Technical Details

- Reads Claude Code and Codex session logs from their default local paths
- Onboarding via `pipx install agentacct && agentacct onboard`
- MCP servers and hooks bind at session start for new sessions
- Dashboard at http://127.0.0.1:8765
- State stored in `.agent-sentinel/` within the project

## Signal Strength

173★ in ~1 day for a narrow-scope developer tool suggests real demand for agent work accountability. The "honest attribution" framing (showing gaps rather than guessing) is a mature governance pattern rarely seen in early-stage tooling.
