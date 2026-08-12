---
title: "Frog — Agent Friction Becomes a Git-Native Governance Artifact"
source: github
date: 2026-08-05
last_updated: 2026-08-05
type: finding
tags: [github, agent-tooling, friction-logging, repo-governance, git-native-state, cross-repo-feedback]
relevance: high
---

# Frog

## Overview

- **Repo:** [wevm/frog](https://github.com/wevm/frog) (206★, created 2026-07-26, pushed 2026-08-04)
- **Author:** wevm
- **Language:** TypeScript
- **License:** MIT
- **What:** A tool that lets coding agents log papercuts as committed repository artifacts, publish them as GitHub issues, and automatically reconcile the log back down to only unresolved friction.

## Core Signal

**Repository friction is turning into a maintained, machine-readable state layer rather than an informal human memory.**

Frog is notable not because it asks agents to write better bug reports, but because it gives friction a durable lifecycle inside the repo itself: the agent records the problem at the moment it happens, the log entry is committed with the work that triggered it, the entry is published as an issue so somebody owns it, and the artifact is removed after the issue closes so the log does not rot.

That is a concrete operational answer to a long-running gap in agent workflows: agents notice recurring failure surfaces constantly, but almost none of that evidence survives past the current session.

## Concrete Design Moves

1. **Friction is stored as repo state, not chat residue.**
   The README says each entry is a directory under `.agents/friction-log/` holding the write-up and reproduction artifacts. That means the memory is versioned, reviewable, and colocated with the codebase instead of trapped in transient agent transcripts.

2. **The log is self-pruning rather than archival.**
   The README is explicit: entries are reported as issues and then deleted once the issue closes so the log only contains unresolved friction. This is an important design choice because most "papercut lists" decay into dead documentation; Frog tries to make freshness a property of the workflow itself.

3. **Cross-repo reporting is gated by receiver consent.**
   Upstream logging is not just `open an issue anywhere`. The README and `schema.json` show separate inbound and outbound controls, `allowFrom`/`allowedRepos` lists, and a rule that consent is read from the target repository's default branch. That turns friction reporting into an opt-in protocol instead of agent spam.

4. **GitHub automation is treated as a first-class control plane.**
   The action and reconcile workflows expose structured `publish` and `sync` outputs, maintain a dedicated `frog/sync` branch, and automatically open/update pull requests titled `chore: sync friction log`. The important pattern is that repo maintenance happens through normal GitHub governance surfaces — issues, branches, pull requests, scheduled runs — not a parallel dashboard.

5. **The tool is trying to sit inside existing agent substrates.**
   Frog's CLI exposes `mcp` registration and `skills` syncing, while the repository's own `AGENTS.md` instructs agents to run `frog list` before logging new friction. This suggests the project is positioning friction capture as part of the agent runtime contract, not a separate after-action ritual.

6. **Shared friction state is being abstracted beyond one repo.**
   The README includes a database-backed mode (`FROG_DATABASE_URL`, `frog migrate`) for shared logging across multiple agents or applications. That hints at a larger direction: friction history as a multi-agent operations dataset rather than a single-project notes folder.

## Why This Matters

1. **It operationalizes repository-level governance.**
   A repeated problem in agent-heavy repos is that failures are visible during execution but invisible in durable project process. Frog turns those moments into actionable, assignable repo objects.

2. **It treats agent pain as a source of product intelligence.**
   The agent is framed as the best observer of recurring papercuts. Instead of suppressing that noise, the repo captures it and routes it toward ownership.

3. **It reduces the drift between observed failure and tracked work.**
   Because the entry is committed alongside the provoking change and then synchronized against issue state, the lag between "agent hit a problem" and "project has a tracked repair surface" becomes much smaller.

4. **It suggests a new primitive for multi-agent teams: friction ledgers.**
   Shared memory often focuses on facts, tasks, or plans. Frog implies another durable memory type is emerging: unresolved workflow friction, with provenance, reproduction, ownership, and cleanup semantics.

## Connections to Library Themes

- **Evidence over narrative:** friction is captured with write-ups and optional reproduction artifacts at the moment of failure.
- **Governance through normal developer surfaces:** issues and PRs remain the enforcement and cleanup layer.
- **Agent memory externalization:** the repo becomes a durable scratchpad for workflow pain, not just for code or instructions.
- **Cross-boundary coordination:** inbound/outbound allowlists show early protocol thinking for agent-to-repository feedback.

## Sources

- **Repo:** https://github.com/wevm/frog
- **README:** https://raw.githubusercontent.com/wevm/frog/main/README.md
- **Schema:** https://raw.githubusercontent.com/wevm/frog/main/schema.json
- **Agent guide:** https://raw.githubusercontent.com/wevm/frog/main/AGENTS.md
- **Action workflow:** https://raw.githubusercontent.com/wevm/frog/main/action/action.yml
- **Reconcile workflow:** https://raw.githubusercontent.com/wevm/frog/main/reconcile/action.yml
- **Package metadata:** https://raw.githubusercontent.com/wevm/frog/main/package.json
- **GitHub API metadata:** https://api.github.com/repos/wevm/frog
