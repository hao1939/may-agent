# App Root Cleanup — 2026-06-13

**Historical context:** [App Root Layout](../../2a-design/app-root-layout.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical implementation record.

This record preserves the first root-layout cleanup inventory. It is not the
current layout contract. See
[App Root Layout](../../2a-design/app-root-layout.md) for current rules.

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
