<ai_context>
summary: "A body-level XHS post describes a Home Repo pattern that centralizes agent skills, steering files, wiki material, and path instructions while cloning many service repositories into one ignored local workspace. The pattern reduces duplicated configuration and improves cross-repository context, but the post does not establish per-repository authorization, change attribution, review, or integration safety."
triggers: ["xhs", "home repo", "multi-repository agents", "cross-repo coding", "AGENTS.md", "agent configuration"]
last_updated: "2026-11-12"
source_basis: "Body-level read of XHS post 6af52f15000000001803a3ba, including its visible description and five comments; the post is a secondary account of Matt Pocock's advice, and Scout did not inspect the original publication, repositories, implementations, or any cross-repository run."
</ai_context>

# Home-repo context does not replace per-repository authority

Date: 2026-11-12
Source: https://www.xiaohongshu.com/explore/6af52f15000000001803a3ba
Tags: xhs, coding-agents, multi-repository, configuration-management, authority, integration

## Observation

A body-level XHS post from 机器之心 describes a **Home Repo** pattern for coding agents working across many repositories. The proposed workspace centralizes skills, steering files, wiki material, and other shared configuration in one primary repository. Related service repositories are then cloned beneath that workspace, excluded from the Home Repo with `.gitignore`, and referenced through path instructions in `AGENTS.md`.

The post's stated benefit is that an agent launched from the Home Repo can see shared guidance and multiple codebases at once, enabling cross-repository changes without copying the same configuration into every repository. It cites a comment from a developer maintaining 38 repositories as anecdotal support for the configuration-reduction benefit. One visible comment independently describes a similar monorepo-style arrangement as useful.

## Scout interpretation

The useful signal is a separation between two problems that are often conflated:

1. **Context assembly:** giving an agent one navigable workspace containing shared rules and the repositories needed for a task.
2. **Change authority:** deciding what the agent may edit, how each repository's state is identified, and how changes are reviewed and integrated.

A Home Repo can simplify the first problem. It does not by itself solve the second. Cloning repositories into one ignored directory creates a convenient local view, but `.gitignore` is only a parent-repository bookkeeping rule; it is not an authorization boundary for the nested repositories.

For a governed implementation, each repository still needs its own explicit receipt: repository identity and revision, allowed write scope, changed files, verification results, and integration status. Shared instructions also need precedence rules so a central steering file cannot silently override repository-local constraints.

The resulting design principle is:

> Centralize discovery and reusable guidance when helpful, but preserve authority, evidence, and integration as per-repository contracts.

This complements the library's repo-local governance finding: shared configuration reduces duplication, while repository-local pins and verification prevent a convenient global workspace from becoming an unbounded change surface.

## Evidence limitations

- The XHS post is a secondary summary and does not link a stable original Matt Pocock publication in its readable text.
- Scout did not inspect the original advice, an example Home Repo, the claimed 38-repository setup, or any agent execution.
- The post supplies no measurements of correctness, completion time, configuration drift, review burden, or cross-repository integration failures.
- Visible comments are anecdotal reactions, not independent validation.
- The source supports the described workspace pattern and its claimed motivation; the authority and receipt analysis above is Scout's interpretation.

## Related knowledge

- [HN — Repo-Local Agent Governance](../findings/2026-08-04-hn-repo-local-agent-governance.md) — shared agent configuration is increasingly versioned and pinned per project; the Home Repo pattern adds a cross-repository context layer but does not remove that lifecycle requirement.
