# App Root Layout

**Design status:** Accepted.
**Implementation status:** Partial; source roots are stable and read-only layout diagnostics identify unclassified entries.

This document classifies the current `/app` root so cleanup can happen without
blurring source, runtime state, project workspaces, and research scratch.

## Root Contract

`/app` is this installation's shared source checkout; it is not a required Host
path. Integrate verified source and coordinate checkout changes with active
writers. Use isolated worktrees for experiments, conventionally outside the
checkout or under ignored local `.state/worktrees/`. Their location grants no
runtime authority. Keep source, generated evidence and live state distinguishable.

The root should contain only:

- entry documentation: `README.md`, `CONVENTIONS.md`
- repo-wide package/build config: `package.json`, `bun.lock`, `bunfig.toml`,
  `tsconfig.json`, `.gitignore`
- durable top-level source directories listed below

Everything else should have a clear home under a source directory, a project
workspace, `.state/`, or an external scratch/archive directory. Dependencies,
local tool configuration and separately managed project repositories are
intentional local data; a clean source checkout does not require deleting them.

## Durable Source Directories

- `agents/` - agent identities, prompts, tools, workflows, and per-agent
  workspaces.
- `shared/` - shared knowledge, docs, skills, guards, tools, libraries, tests,
  and compatibility surfaces used across agents.
- `shared/knowledge/` - system-consumed knowledge base entries, conventions,
  concepts, and agent-operational knowledge.
- `projects/` - Apps, domain workspaces, legacy project workspaces, and
  archives. Its own classification lives in `projects/README.md`.
- `projects/scout-knowledge-lib/knowledge/` - Scout-maintained external
  research and paper/doc knowledge library.
- `projects/gym/` - Gym comparison workspace; `projects/gym.app/` owns its App contract.
- `contracts/` - explicit contracts used by the system.
- `scripts/` - reusable app-level scripts.

Durable May and Host design docs should live under
`projects/may-agent.app/docs/`.
Top-level `docs/` is legacy/ignored in this workspace and should not be used
for new source-controlled design material.

## Knowledge Base Rule

Most papers, external docs, research summaries, and reusable source-grounded
notes should become knowledge base material:

- Use `projects/scout-knowledge-lib/knowledge/` for Scout-curated external
  research, papers, trends, and literature-style syntheses.
- Use `shared/knowledge/` for May and Host knowledge that agents should
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
- Temporary checkouts and scratch copies belong in an explicitly local worktree
  or scratch directory. Before cleanup, inspect ownership, dirty files and unique
  commits. Keep useful evidence at stable paths; moving records into an archive
  is not cleanup or a lifecycle transition. Remove a worktree only after its
  unique work is integrated or deliberately abandoned.

## Runtime And Local State

- `.state/` - runtime/local state only. Keep it as-is; do not include it in
  source layout cleanup.
- `.initialized`, `may.db`, `*.db-wal`, and `*.db-shm` - local runtime
  artifacts; ignored by git.
- `.copilot/` - local tool configuration and possible secrets; ignored by git.
- `.codex/`, `.agents/` - local tool or runtime metadata; ignored by git.
- `.azure/` - local Azure CLI configuration and credentials; ignored by git.
- `.tools/` - locally installed tooling; ignored by git.
- `test-results/` - generated test runner state; ignored by git.

## Layout hygiene

Read-only layout diagnostics may report unclassified root entries. Treat those
as ownership questions, not as permission for bulk movement:

1. leave runtime-owned `.state/` and ignored local-tool state untouched;
2. identify whether the entry is source, generated state, project evidence,
   reusable knowledge, or disposable scratch;
3. move durable material only into its accountable source/project owner;
4. update references and validate the affected owner; and
5. remove duplicates only after the authoritative copy is clear.

Do not create new top-level research, report, output, evidence, or exploration
roots. Dated cleanup inventories belong in the
[documentation archive](../archive/implementation/2026-06-13-app-root-cleanup.md),
not in this contract.
