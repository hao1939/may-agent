# App Root Layout

This document classifies the current `/app` root so cleanup can happen without
blurring source, runtime state, project workspaces, and research scratch.

## Root Contract

The root should contain only:

- entry documentation: `README.md`, `CONVENTIONS.md`
- repo-wide package/build config: `package.json`, `bun.lock`, `bunfig.toml`,
  `tsconfig.json`, `.gitignore`
- durable top-level source directories listed below

Everything else should have a clear home under a source directory, a project
workspace, or `.state/`.

## Durable Source Directories

- `agents/` - agent identities, prompts, tools, workflows, and per-agent
  workspaces.
- `shared/` - shared knowledge, docs, skills, guards, tools, libraries, tests,
  and compatibility surfaces used across agents.
- `shared/knowledge/` - system-consumed knowledge base entries, conventions,
  concepts, and agent-operational knowledge.
- `projects/` - project apps, domain workspaces, legacy project workspaces, and
  archives. Its own classification lives in `projects/README.md`.
- `projects/scout-knowledge-lib/knowledge/` - Scout-maintained external
  research and paper/doc knowledge library.
- `gym/` - agent behavior and evaluation scenarios.
- `contracts/` - explicit contracts used by the system.
- `scripts/` - reusable app-level scripts.

Durable May-agent design docs should live under `shared/may-agent-docs/`.
Top-level `docs/` is legacy/ignored in this workspace and should not be used
for new source-controlled design material.

## Knowledge Base Rule

Most papers, external docs, research summaries, and reusable source-grounded
notes should become knowledge base material:

- Use `projects/scout-knowledge-lib/knowledge/` for Scout-curated external
  research, papers, trends, and literature-style syntheses.
- Use `shared/knowledge/` for May-agent system knowledge that agents should
  consume directly during operation.
- Use project-local knowledge/model folders when the material only belongs to a
  domain project, such as `projects/aks-rp-e2e/model/`.

Do not use top-level `docs/` for new paper/doc storage.

## Data And Output Directories

- Top-level `research/`, `reports/`, `outputs/`, `evidence/`, and
  `explorations/` should not be used for new durable material.
- Research papers/docs belong in the knowledge base after curation.
- Project-owned outputs and evidence belong inside the owning project
  workspace.
- `test-results/` - generated test output.

## Runtime And Local State

- `.state/` - runtime/local state only. Keep it as-is; do not include it in
  source layout cleanup.
- `.initialized`, `may.db`, `*.db-wal`, and `*.db-shm` - local runtime
  artifacts; ignored by git.
- `.copilot/` - local tool configuration and possible secrets; ignored by git.
- `.codex/`, `.agents/` - local tool or runtime metadata; ignored by git.
- `test-results/` - generated test runner state; ignored by git.

## Root Scratch Cleanup

Root cleanup started on 2026-06-13. The first batch moved root-level HN/Arxiv
research markdown into:

```text
projects/scout-knowledge-lib/knowledge/inbox/app-root-cleanup-2026-06-13/
```

It also moved root-level HN/XHS helper scripts into:

```text
scripts/research/
```

The imported research markdown should be curated into the Scout knowledge
library or retired after deduplication.

The same cleanup moved the old ignored top-level `docs/` payload into:

```text
projects/scout-knowledge-lib/knowledge/inbox/app-docs-cleanup-2026-06-13/
```

The root `docs/` directory was removed after the move.

The cleanup also moved old top-level `research/`, `reports/`, `outputs/`, and
`explorations/` into:

```text
projects/scout-knowledge-lib/knowledge/inbox/app-research-cleanup-2026-06-13/
```

The old top-level `evidence/` AKS item moved into:

```text
projects/aks-rp-e2e/evidence/archive/local-managedsystem-vmsize-mutation-negative.json
```

Moved research/report markdown:

- `arxiv_ai_agent_papers_report.md`
- `arxiv_ai_agents_briefing.md`
- `arxiv_ai_agents_report.md`
- `hn-ai-agents-exploration.md`
- `hn-ai-agents-exploration-jun11.md`
- `hn-ai-agents-exploration-jun12.md`
- `hn-ai-agents-exploration-jun12-v2.md`
- `hn-ai-agents-exploration-jun12-v3.md`
- `hn-ai-agents-exploration-jun12-v4.md`
- `hn-ai-agents-exploration-jun13.md`
- `hn-ai-agents-exploration-jun14.md`
- `hn-ai-agents-exploration-jun14-v2.md`
- `hn-ai-agents-research.md`

Moved research/helper scripts:

- `hn_search.py`
- `xhs-browse.mjs`
- `xhs-browse2.mjs`
- `xhs-browse3.mjs`
- `xhs-explore-fresh.mjs`
- `xhs-explore-jun12-fresh.mjs`
- `xhs-explore-jun12-r2.mjs`
- `xhs-explore-jun12-r5.mjs`
- `xhs-explore-jun12-r6.mjs`
- `xhs-explore-jun12-v2.mjs`
- `xhs-explore-jun12-v3.mjs`
- `xhs-explore-jun12.mjs`
- `xhs-explore-jun13-pm.mjs`
- `xhs-explore-jun13-r2.mjs`
- `xhs-explore-jun13-r3.mjs`
- `xhs-explore-jun13-r3b.mjs`
- `xhs-explore-jun13-sat.mjs`
- `xhs-explore-jun13-sat2.mjs`
- `xhs-explore-jun13.mjs`
- `xhs-explore-jun14-evening.mjs`
- `xhs-explore-jun14-evening2.mjs`
- `xhs-search.mjs`
- `xhs-search2.mjs`
- `xhs-search3.mjs`

## Suggested Cleanup Order

1. Keep `.state/` untouched.
2. Stop adding new research or one-off scripts at root.
3. Move reusable root scripts to `scripts/research/`.
4. Curate durable root writeups into `projects/scout-knowledge-lib/knowledge/`,
   `shared/knowledge/`, or a project-local model/knowledge folder.
5. Use `research/` only for drafts that are not ready to become knowledge.
6. Retire or archive duplicate drafts after comparing them with existing
   knowledge base, research, reports, and outputs files.
7. Keep root limited to entry docs and repo-wide config.
