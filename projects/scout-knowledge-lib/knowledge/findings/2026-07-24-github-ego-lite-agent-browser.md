---
title: "ego lite — A Browser Designed for Human-Agent Parallel Work"
source: github
date: 2026-07-24
last_updated: 2026-07-24
relevance: high
tags: [browser-agents, human-agent-collaboration, mcp, computer-use, developer-tools]
---

# ego lite — A Browser Designed for Human-Agent Parallel Work

Repo: https://github.com/citrolabs/ego-lite

## Signal

ego lite (1,746★, MIT, created 2026-04-16) is a macOS browser purpose-built
for AI agents to run web automation alongside human browsing. Unlike browser
automation frameworks (browser-use, Playwright wrappers) that hijack a
separate browser instance, ego lite is a single browser where human and agent
share the same environment — agents get isolated "Spaces" while human tabs
remain untouched.

Currently trending on GitHub (daily, Python category).

## Key Design Decisions

1. **Code-base, not CLI-base** — Exposes JavaScript functions the agent calls
   directly rather than a command-per-step loop. Claims 2.5× faster complex
   task completion with fewer tool calls.

2. **Shared auth context** — Agent inherits real logins, cookies, extensions
   via optional Chrome data migration. No separate credential management.

3. **Space isolation** — Each agent gets a dedicated browsing Space. Human can
   observe, take over, or stop agent Spaces at any time.

4. **Skill-based integration** — Installs as `ego-browser` skill via
   `npx skills add citrolabs/ego-lite`. Works with Claude, Cursor, and other
   MCP-compatible agents.

5. **Snapshot-based perception** — Agent reads page state via Snapshots (DOM
   summaries) rather than screenshots, reducing token cost vs. vision-based
   computer-use approaches.

## Pattern: Shared-Context Agent Browsers

This represents a distinct approach in the browser-agent space:

| Approach | Example | Tradeoff |
|----------|---------|----------|
| Automation framework + separate browser | browser-use, Playwright | No shared auth, tab conflicts |
| Vision-based computer-use | Claude CUA, Fara | High token cost per step |
| Capability caching | PilotBrowseMCP | Reduces re-exploration but still separate |
| **Shared browser with agent Spaces** | **ego lite** | **Native auth sharing, human oversight built-in** |

The "shared browser" model is particularly interesting for enterprise use
cases where SSO/cookie-gated sites are common — agents can access
authenticated state without credential vaulting.

## Connections

- **PilotBrowseMCP** (2026-07-24 finding): Complementary — ego lite handles
  runtime execution environment while PilotBrowseMCP handles capability
  memory. Could potentially combine both.
- **Agent oversight patterns**: The Space visibility and human takeover
  aligns with governance/oversight themes in the library.
- **Token efficiency cluster**: Code-based execution (single multi-step
  output) vs. iterative tool calls is the same optimization as structured
  tool schemas vs. chat-loop agents.

## Limitations

- macOS only (Windows/Linux on roadmap)
- Closed-source browser binary (only the skill/MCP layer is MIT-licensed)
- Privacy model unclear beyond "data stays on device"

## Implication

For agent builders targeting web tasks: the "shared browser" paradigm
removes the auth bootstrapping problem that plagues most browser automation.
Watch for this pattern to become standard — agents that inherit human browser
sessions rather than managing separate credential stores.
