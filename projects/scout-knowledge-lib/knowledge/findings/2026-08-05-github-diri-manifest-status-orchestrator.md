---
title: "diri — Manifest-Defined Status and Remote Identity Turn Agent Orchestration Into a Host Control Plane"
source: github
date: 2026-08-05
last_updated: 2026-08-05
type: finding
tags: [github, coding-agents, orchestration, worktrees, session-durability, status-detection, remote-hosts, mcp]
relevance: high
---

# diri

## Overview

- **Repo:** [cristicretu/diri](https://github.com/cristicretu/diri) (193★, created 2026-08-04, pushed 2026-08-05)
- **Author:** cristicretu
- **Language:** Rust
- **License:** Apache-2.0
- **What:** A native macOS orchestrator for Claude Code, Codex, Cursor, Gemini, and shell sessions that keeps agent terminals alive behind a daemon, spreads them across git worktrees or remote hosts, and exposes the whole fleet through an MCP control surface.

## Core Signal

**Agent orchestration is starting to look less like "a better terminal tab manager" and more like a host-level control plane for heterogeneous coding agents.**

The important move in diri is not just that it can launch many agent CLIs at once. It splits the problem into four separate runtime layers:

1. **Session survival** lives in a background daemon rather than in the GUI process.
2. **Status truth** is derived from actual screen state or hook events, per agent, from data files rather than per-integration hardcoding.
3. **Delegation** is exposed as MCP tools, so one running agent can spawn and supervise other agents or shells.
4. **Remote execution** keeps provider credentials and account state on the node where the agent runs instead of copying auth state through the orchestrator.

That combination makes diri a useful signal that the coding-agent stack is thickening around the model CLI: the durable product is becoming the **session host, status engine, and identity-aware handoff layer**, not just the prompt surface.

## Concrete Design Details

1. **The GUI is explicitly not the owner of the session.**
   The README says the desktop app and the `dirijord` daemon are separate processes, with the daemon owning PTYs, the session registry, persistence, worktrees, and the control socket. The stated UX promise is that closing the app never kills a session and reopening restores conversations.

2. **Agent support is data, not adapter code.**
   The README says each supported agent is "one JSON file" under `Sources/DirijorCore/Resources/manifests/`. `PORT.md` doubles down on this with "Rules stay data" and says detection manifests are read from that directory unchanged by the Rust port. This matters because adding or adjusting an agent becomes a manifest/discriminator problem, not a bespoke client integration.

3. **Status authority is per-agent and operationally specific.**
   `claude-code.json` sets `statusAuthority` to `hooks`, injects Claude hooks and MCP wiring, and defines blocked-permission / blocked-question patterns tied to visible prompt structure. `codex.json` instead uses `statusAuthority: "screen"`, injects Codex notify + MCP wiring, and keys its blocker state off title text and prompt-box text. In other words, diri is not pretending one generic "is the agent busy?" heuristic works across every CLI.

4. **The status engine treats output detection as a real subsystem.**
   `StatusEngine.swift` runs repeated screen scans, ingests hook/notify events, adopts a foreground agent when a shell tab starts running `claude` or `codex`, and throttles expensive manifest evaluation separately from cheap PTY activity detection. That is a notable design choice: status is treated as an evidence pipeline with cadence, authority, and arbitration rules, not as cosmetic UI chrome.

5. **Agent-of-agent control is part of the default tool surface.**
   `Sources/DirijorMCP/Tools.swift` exposes `spawn_agent`, `list_agents`, `get_status`, `send_prompt`, `wait_for_agent`, `read_output`, and worktree-management tools. The code comments say spawnable kinds come from the manifest catalog, meaning a newly added manifest becomes MCP-spawnable without another tool implementation pass.

6. **Worktrees are a first-class scheduling primitive, not a user habit.**
   The MCP tool surface can create/list/remove worktrees, and `GitWorktreesImpl.swift` includes generated branch naming and porcelain parsing. The orchestration layer is therefore opinionated that parallel agent work should often land in isolated branches and directories rather than in a shared mutable checkout.

7. **Remote nodes separate orchestration from provider identity custody.**
   `diri/NODE.md` says provider credentials remain on the machine where Claude Code or Codex runs, while diri gets a versioned management interface for accounts, usage, sessions, and handoff. The node protocol uses a Tailscale/private endpoint plus an app-layer token, supports per-provider profiles like personal/work, and treats moves/forks as checkpointed handoff operations rather than raw shell hopping.

8. **The repo is converging on cross-platform engine portability without changing detection truth.**
   `PORT.md` says the Swift daemon remains live while `crates/diri-engine` replaces it additively, and that logs, sockets, and on-disk records written by one engine must remain readable by the other. This is a strong signal that agent orchestrators are beginning to stabilize their runtime contracts below the UI layer.

## Why This Matters

1. **The orchestration moat is shifting below the chat UI.**
   If status detection, durable PTYs, worktree isolation, and remote handoff are the hard parts, then the durable value is increasingly in the control plane around agent CLIs rather than in any single interface skin.

2. **"Multi-agent" is becoming a systems problem.**
   diri treats multi-agent work as coordination over sessions, branches, remote hosts, and explicit status authorities. That is more mature than simply opening several model calls in parallel.

3. **Agent portability may come from manifests plus host contracts.**
   The repo suggests a practical path to heterogeneous-agent support: normalize spawn/resume/approval/status metadata in manifests, then keep the execution substrate stable underneath.

4. **Identity separation is being treated as part of orchestration quality.**
   The remote-node design is notable because it avoids centralizing provider credentials in the orchestration app. As coding-agent fleets spread across laptops and VPS nodes, identity custody may become as important as prompt routing.

## Connections to Library Themes

- **Harness-first reliability:** stable PTYs, replayable logs, authority-aware status detection, and worktree isolation matter as much as model quality.
- **Verification over narration:** the orchestrator infers state from screen content and hook events, not from self-reported agent claims.
- **Thin prompt surface, thick runtime:** the visible app is light; the daemon, node service, manifests, and MCP control plane carry the real operational weight.
- **Delegation with containment:** spawned agents get explicit sessions, cwd/host choices, and observable status instead of disappearing into an opaque subagent abstraction.

## Sources

- **Repo:** https://github.com/cristicretu/diri
- **README:** https://raw.githubusercontent.com/cristicretu/diri/main/README.md
- **Claude Code manifest:** https://raw.githubusercontent.com/cristicretu/diri/main/Sources/DirijorCore/Resources/manifests/claude-code.json
- **Codex manifest:** https://raw.githubusercontent.com/cristicretu/diri/main/Sources/DirijorCore/Resources/manifests/codex.json
- **MCP tools:** https://raw.githubusercontent.com/cristicretu/diri/main/Sources/DirijorMCP/Tools.swift
- **Status engine:** https://raw.githubusercontent.com/cristicretu/diri/main/Sources/DirijorDaemonKit/StatusEngine.swift
- **Worktree implementation:** https://raw.githubusercontent.com/cristicretu/diri/main/Sources/DirijorGit/GitWorktreesImpl.swift
- **Remote node design:** https://raw.githubusercontent.com/cristicretu/diri/main/diri/NODE.md
- **Rust port notes:** https://raw.githubusercontent.com/cristicretu/diri/main/diri/PORT.md
- **GitHub API metadata:** https://api.github.com/repos/cristicretu/diri
