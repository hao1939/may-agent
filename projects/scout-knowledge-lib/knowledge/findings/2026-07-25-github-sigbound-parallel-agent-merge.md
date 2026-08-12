---
title: "Sigbound — Verified Parallel Agent Merge Coordination"
source: github
date: 2026-07-25
last_updated: 2026-07-25
type: finding
tags: [github, parallel-agents, coding-agents, git-merge, verified-merge, agent-coordination, golang]
---

# Sigbound — Verified Parallel Agent Merge Coordination

Repo: https://github.com/surya-koritala/sigbound

## Summary

Sigbound (51★, created 2026-07-21, Go, Apache-2.0) solves the merge bottleneck when running multiple AI coding agents in parallel on a single repository. Each agent gets its own git worktree; Sigbound handles planning, parallel non-conflicting merge, model-assisted conflict resolution (with low-confidence flagging rather than guessing), and gates every merged result on user-supplied build + test commands. Nothing lands unless it compiles and passes.

## Key Design Decisions

- **Bring your own model** — planner, agent, resolver, and repair steps are each a user-supplied shell command. Works with Claude CLI, Codex, Aider, or anything else.
- **File lanes** — each task declares which files it may touch; agents that stray are rejected. This is a structural conflict-prevention mechanism, not just a merge strategy.
- **Self-repair loop** — a merge that breaks the build is sent back to an agent for fixing, then re-verified.
- **Landing policy** — a committed `sigbound.policy` file declares the quality bar; CLI flags can tighten but never loosen it.
- **On top of plain git** — uses worktrees and `merge-tree`; no server, no lock-in.
- **GitHub Action** — ships as a reusable action for CI integration.

## Why This Matters

The README cites a real practitioner pain point: one engineer spent 30–50% of parallel-agent time on conflict resolution; another got zero conflicts but still spent six hours fixing a broken build. Sigbound addresses both failure modes — merge conflicts *and* semantic breakage.

Cursor's Origin announced a closed version of this pattern; Sigbound is the open-source counterpart, available now.

## Architectural Pattern

**Verified parallel merge** — the pattern of splitting work across agents with file-level isolation, combining results optimistically, and gating on build/test verification. This is distinct from orchestration frameworks (which route tasks) and from simple git worktree parallelism (which leaves merge to the user). The "never guess, flag instead" conflict resolution policy is a governance pattern worth tracking.

## Connections

- Relates to **agent workspace isolation** (see block-buzz, ferrox-factory findings)
- Extends the **governance compilation gradient** — landing policies are declarative quality contracts
- Complements **agent accountability** tools like agentacct (cost tracking) with merge-level quality tracking
