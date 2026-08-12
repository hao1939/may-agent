# Orca: The Agent Development Environment (ADE) Pattern

Date: 2026-07-29
Source: GitHub
Repo: https://github.com/stablyai/orca

## Signal

Orca (32K★, MIT, YC-backed) defines a new tool category: the **Agent Development Environment (ADE)**. Rather than being another agent framework, it's a desktop/mobile orchestration layer that runs *any* coding agent (Claude Code, Codex, OpenCode, Pi) in parallel isolated git worktrees and tracks them from a single UI.

## Key Architecture Choices

- **Parallel worktrees**: Fan one prompt across N agents, each in its own git worktree. Compare results, merge the winner.
- **Mobile companion**: iOS/Android app for monitoring and steering agents remotely — push notifications on completion, follow-up from phone.
- **Agent-agnostic**: Not a framework — wraps existing CLI agents as black boxes. Supports Claude Code, Codex, OpenCode, Pi, others.
- **Cross-platform**: macOS, Windows, Linux desktop + mobile.
- **BYO subscription**: Users bring their own API keys/subscriptions for each agent.

## Why This Matters

1. **ADE as a category**: The emergence of a dedicated IDE-like environment *for managing agents* (not for writing code with agents) signals that multi-agent orchestration is becoming a first-class developer workflow concern.
2. **Worktree isolation pattern**: Using git worktrees for agent isolation is an elegant, zero-overhead sandboxing approach that preserves full git history and merge workflows.
3. **Mobile-first agent supervision**: The companion app pattern suggests production agent workflows need async human oversight — agents run while developers are AFK.
4. **Composition over framework**: Orca doesn't replace agents; it composes them. This validates the "control plane" layer above individual agents.

## Tags

agent-orchestration, developer-tools, parallel-agents, git-worktrees, mobile-supervision, ADE
