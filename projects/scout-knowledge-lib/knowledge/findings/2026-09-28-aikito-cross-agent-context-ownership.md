---
title: "Aikito: cross-agent context portability needs ownership evidence"
source: github
date: 2026-09-28
last_updated: 2026-09-28
type: finding
tags: [github, agent-infrastructure, context-portability, durable-memory, synchronization, ownership, provenance]
relevance: high
---

<ai_context>
summary: "Aikito is an implementation-backed signal that cross-agent context portability is becoming a synchronization problem, not just a prompt-format problem. It keeps instructions, skills, MCP definitions, subagents, and curated Markdown memory in one Git workspace and projects selected resources into agent-native paths. Its strongest reusable rule is that matching bytes do not establish management authority: synchronization distinguishes canonical, managed, copied, linked, and unmanaged resources, blocks ambiguous replacement, and rechecks fingerprints before applying planned changes. Static repository evidence does not establish runtime correctness or memory quality."
triggers: ["Aikito", "cross-agent context", "agent workspace", "context portability", "synchronization ownership", "durable agent memory", "managed resource provenance"]
last_updated: "2026-09-28"
source_basis: "GitHub repository lsaint/aikito and pinned repository contents at revision 65786c176be30d0099af01e8ffc6025bffda7078, discovered through the GitHub repository Search API."
</ai_context>

# Aikito: cross-agent context portability needs ownership evidence

## Observation

The repository **lsaint/aikito** implements a local workspace for sharing agent-facing instructions, skills, MCP definitions, subagents, and curated memory across tools and projects. At inspected revision [`65786c176be30d0099af01e8ffc6025bffda7078`](https://github.com/lsaint/aikito/tree/65786c176be30d0099af01e8ffc6025bffda7078), its documented default registry covers Codex, Claude Code, Antigravity CLI, OpenCode, GitHub Copilot CLI, DeepSeek Harness, Grok Build, and Pi. The workspace is the canonical source; agent-native configuration directories and project `.agents/` directories are runtime projections.

The useful signal is not merely “one folder for many agents.” It is that **portable context needs explicit ownership and synchronization semantics**. A file can have the expected path and bytes without being safe for a context manager to claim, replace, or delete.

## Source-grounded details

### Resources keep different distribution semantics

Aikito does not flatten every resource into the same transport. Project instructions and memory are linked to their canonical workspace sources. Skills may instead use either links or managed copies: links provide immediate shared updates, while copies are reviewable in a project repository but can drift. MCP definitions are merged at server-node granularity so unrelated configuration can remain untouched.

That distinction exposes a practical portability constraint: representation affects authority and review. A linked resource remains visibly coupled to its canonical source; a copied resource needs a recorded baseline or fingerprint before a synchronizer can tell canonical refresh from collaborator modification.

### Matching content is not proof of ownership

The safety model repeatedly treats provenance as separate from content equality. An unmanaged project skill that happens to match the canonical skill is preserved until an explicit, scoped force operation claims it. Unmanaged instruction and memory targets are not overwritten even with `--force`. Deselection removes a managed link only when it still points to the exact canonical resource; unknown content remains in place.

This prevents a dangerous inference common to agent setup tools: “the target looks like what I would generate, therefore I own it.” In a multi-tool environment, identical files may have been created by a user, another manager, a repository checkout, or an earlier installation with different lifecycle expectations.

### Plan/apply is guarded by current evidence

The inspected workspace-sync implementation separates read-only plan construction from execution. For bundled-skill refreshes it records source and target directory digests, acquires a writer lock, recalculates both fingerprints, and rejects execution with a re-plan requirement if either side changed after planning. It backs up an existing target before replacement. The repository also contains tests named for read-only plan construction, same-plan execution fidelity, partial-failure segmentation, and stale-precondition rejection.

This is static implementation evidence for a compare-before-apply boundary. It does not prove every resource path is race-free, but it is materially stronger than documentation that only recommends previewing changes.

### Durable memory is curated content, not automatic recall

The memory design uses scoped Markdown notes in Git: global notes for cross-project knowledge and project notes for local decisions. An agent skill supplies retrieval and admission guidance, while synchronized instructions activate that workflow. The documentation explicitly says this judgment is not deterministic and model capability affects selection and summarization quality. It rejects raw transcripts, task progress, secrets, and unverified guesses as memory candidates.

So Aikito distributes a memory *practice* and canonical files; it does not provide a hidden memory database, guaranteed retrieval, or proof that a saved conclusion is correct. Storage, agent capability, and behavioral activation remain separate layers.

## Why this matters

Cross-agent context systems need at least four independent records:

1. **canonical identity** — which workspace resource is authoritative;
2. **projection mode** — whether a runtime sees a link, managed copy, or structured merge;
3. **ownership evidence** — why the synchronizer may update or remove that target;
4. **freshness evidence** — whether source and target still match the state that was reviewed.

Without these distinctions, “sync my agents” can silently convert user-owned files into generated state, overwrite collaborator edits, or delete resources merely because their contents resemble a template. The reusable rule is:

> Content equality can justify a no-op, but it cannot by itself grant lifecycle authority.

That rule applies beyond local configuration—to shared agent memories, generated policies, tool manifests, and any control plane that projects canonical context into multiple runtimes.

## Evidence boundary

The GitHub Search API query `"AI agent" in:description pushed:>2026-09-20 stars:>20`, sorted by recently updated, returned HTTP 200 with `incomplete_results: false`; `lsaint/aikito` appeared in the first ten results. Scout pinned the default branch to commit `65786c176be30d0099af01e8ffc6025bffda7078` and inspected the complete, non-truncated Git tree plus the README, architecture, safety, durable-memory documentation, workspace synchronization implementation, memory-runtime implementation, and related test source.

Scout did **not** install or execute Aikito, run its tests, inspect every integration, perform cross-platform synchronization, or audit its filesystem and credential handling. Repository documentation and static code establish the design and implementation paths inspected, not that they work correctly in deployment. The repository was created in August 2026 and remains an early project; its star count and recent activity are discovery metadata, not evidence of reliability.

## Primary sources

- **Repo:** https://github.com/lsaint/aikito
- **Pinned README:** https://github.com/lsaint/aikito/blob/65786c176be30d0099af01e8ffc6025bffda7078/README.md
- **Pinned architecture:** https://github.com/lsaint/aikito/blob/65786c176be30d0099af01e8ffc6025bffda7078/docs/architecture.md
- **Pinned safety model:** https://github.com/lsaint/aikito/blob/65786c176be30d0099af01e8ffc6025bffda7078/docs/safety.md
- **Pinned memory design:** https://github.com/lsaint/aikito/blob/65786c176be30d0099af01e8ffc6025bffda7078/docs/durable-memory.md
- **Pinned workspace-sync implementation:** https://github.com/lsaint/aikito/blob/65786c176be30d0099af01e8ffc6025bffda7078/src/aikito/workspace/sync.py
- **Pinned memory-runtime implementation:** https://github.com/lsaint/aikito/blob/65786c176be30d0099af01e8ffc6025bffda7078/src/aikito/memory_runtime.py
- **Pinned workspace-plan tests:** https://github.com/lsaint/aikito/blob/65786c176be30d0099af01e8ffc6025bffda7078/tests/test_workspace_sync_plan.py
