---
title: "a2wave — Agent CLIs Are Becoming Governed Shared Services"
source: github
date: 2026-08-07
last_updated: 2026-08-07
type: finding
tags: [github, agent-infrastructure, control-plane, cli-agents, multi-channel, evaluation, trust-boundaries]
relevance: high
---

Repo: https://github.com/LilithGames/a2wave

# a2wave

## Overview

- **Repo:** [LilithGames/a2wave](https://github.com/LilithGames/a2wave) (10★, 1 fork, created 2026-08-06)
- **Revision checked:** [`fd2af5aa5665fcbbc3520496551b5e5737731807`](https://github.com/LilithGames/a2wave/commit/fd2af5aa5665fcbbc3520496551b5e5737731807)
- **License:** Apache-2.0
- **What:** A control plane that publishes existing agent CLIs—including Claude Code, Cursor Agent, Codex, OpenCode, Qoder, Trae, Kimi, and Pi—to chat channels, HTTP, schedules, repository triggers, and agent-to-agent calls.

## Core Signal

**The agent CLI is becoming an execution backend that teams can publish like an internal service.**

a2wave does not replace a coding-agent harness with a new graph runtime. Its stated boundary is “orchestrates; it does not execute”: natural-language Agent configurations bind an existing CLI and then add shared ingress, queues, permissions, credential injection, memory, audit trails, and delivery. This is a useful distinction from both local terminal agents and node-and-edge workflow builders. The CLI retains its native reasoning and tool behavior, while the surrounding platform turns it into a governed team capability.

## Source-Grounded Details

1. **One configuration can be reached through many ingress paths.** The README lists Feishu, Slack, Discord, HTTP, schedules, GitHub/GitLab triggers, a first-party chat page, and A2A calls. This makes publication and continuity control-plane responsibilities rather than features each CLI must implement.

2. **Provider identity is separated from display naming.** `docs/core-concepts.md` says a stable provider `kind` selects runtime dispatch, authentication, model probing, MCP injection, session resume, sandbox behavior, and execution options. The backend and UI consume the same capability manifest, reducing name-based integration drift.

3. **Evaluation freezes operational context.** The README describes replaying case sets with a frozen provider/model/prompt snapshot, while evaluation runs use isolated source-control worktrees. The notable pattern is not merely “built-in evals,” but binding a result to the execution configuration and workspace that produced it.

4. **CLI supply-chain state is explicit.** The repository includes a provider CLI lockfile, checksum verification, minimum-version diagnostics, and a verification script. A published agent service inherits binary provenance and compatibility obligations from every underlying CLI, so treating the provider executable as a pinned dependency is important.

5. **The security boundary is candidly narrower than the governance surface.** `SECURITY.md` says agent subprocesses have filesystem, shell, and injected credentials by design; runtime HOME isolation is not an OS sandbox. Authentication, permissions, rate limits, audit logging, and execution-scoped credentials provide accountability among trusted colleagues, not containment from hostile authors or configurations. Untrusted workloads require a separate UID, container, or host.

## Why It Matters

- **Agent products can separate execution from publication.** Teams may standardize ingress, identity, queues, memory, evaluation, and audit without forcing every agent into one reasoning framework.
- **Capability manifests become compatibility contracts.** When multiple CLIs sit behind one service plane, model discovery, authentication mode, resume support, MCP support, and sandbox semantics must remain provider-specific and machine-readable.
- **Governance is not containment.** A polished permission and audit layer can still run a highly privileged subprocess. Deployments should describe the trusted-author boundary as prominently as their access-control features.
- **Evaluation snapshots should include the harness dependency.** Freezing model and prompt is insufficient if the selected CLI version, provider adapter, workspace revision, or tool configuration can drift.

## Caveats

This is a newly created repository with limited adoption evidence. The signal is architectural and source-grounded, not proof of production reliability or enterprise deployment. PostgreSQL is explicitly marked experimental, and the README states there is no SQLite-to-PostgreSQL migration path.

## Scout Take

The non-obvious shift is that “bring your own model” is expanding into **bring your own agent harness**. Once an agent CLI becomes a shared backend, the control plane must preserve rather than flatten its provider-specific capabilities—and must make clear that shared access controls govern callers while a separate isolation layer governs code execution.

## Sources

- **Repo:** https://github.com/LilithGames/a2wave
- **Revision:** https://github.com/LilithGames/a2wave/commit/fd2af5aa5665fcbbc3520496551b5e5737731807
- **GitHub API metadata:** https://api.github.com/repos/LilithGames/a2wave
- **GitHub search feed:** https://api.github.com/search/repositories?q=agentic+created%3A%3E%3D2026-08-06+stars%3A%3E5&sort=stars&order=desc&per_page=20
- **README:** https://github.com/LilithGames/a2wave/blob/fd2af5aa5665fcbbc3520496551b5e5737731807/README.md
- **Core concepts:** https://github.com/LilithGames/a2wave/blob/fd2af5aa5665fcbbc3520496551b5e5737731807/docs/core-concepts.md
- **Security model:** https://github.com/LilithGames/a2wave/blob/fd2af5aa5665fcbbc3520496551b5e5737731807/SECURITY.md
- **Provider CLI lock:** https://github.com/LilithGames/a2wave/blob/fd2af5aa5665fcbbc3520496551b5e5737731807/provider-cli-lock.json
