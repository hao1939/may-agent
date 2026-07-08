# App-repo unpublished-change residue classification — 2026-07-07

Task: `reconcile-app-repo-unpublished-change-residue-20260707`

## Scope

This note inventories the current unpublished-change surface in `/app/projects/aks-rp-e2e.app` and separates the intended durable app-tooling work from the accumulated metric-alert evidence residue.

The task intentionally does **not** touch `/app/projects/aks-rp-e2e` domain feature/spec/model files.

## Current app-repo worktree shape

Direct check in `/app/projects/aks-rp-e2e.app` during this task now shows:

- branch: `main`
- tracked modified paths: `2`
- untracked paths: `63`
- untracked `evidence/metric-alert-*` paths: `60`
- untracked `scripts/*` paths: `2`
- untracked `evidence/archive/*` paths: `1`

Tracked modified paths:

1. `evidence/metric-alert-unpublished-change-count-20260704.md`
2. `package.json`

Untracked non-metric-alert paths:

1. `scripts/compact-organizer.ts`
2. `scripts/compact-organizer.test.ts`
3. `evidence/archive/reconcile-app-repo-unpublished-change-residue-20260707.md`

## Intended durable tooling/package slice

These changes belong together as one coherent app-repo tooling checkpoint:

### 1. `package.json`

Current diff adds exactly one script entry:

```json
"compact-organizer": "bun run ./scripts/compact-organizer.ts"
```

This is a durable package-level wiring change, not residue.

### 2. `scripts/compact-organizer.ts`

This new script is durable app tooling. It provides supported helper commands around existing task-tree / compact-loop state surfaces:

- `publish-holder`
- `upsert-holder`
- `bind-task`
- `show-binding`

Its role is to make exact task-id/task-holder writeback operations explicit and repeatable instead of relying on ad hoc file edits.

### 3. `scripts/compact-organizer.test.ts`

This new test file is part of the same durable slice. It verifies the helper behavior for:

- publishing a runtime holder into the durable tree
- upserting a holder into both trees
- rebinding a compact-loop feature to an existing holder

## Why the tooling slice is checkpoint-ready

This slice is self-contained and verifiable:

- `package.json` only wires the CLI entrypoint for the new script
- the implementation and its tests live together under `scripts/`
- repository content already references `compact-organizer` usage in task-tree text and script help/output
- targeted tests pass:

```bash
cd /app/projects/aks-rp-e2e.app && bun test ./scripts/compact-organizer.test.ts --timeout 30000
```

Observed result: `3 pass, 0 fail`

## Metric-alert evidence residue

The remaining unpublished surface is a separate evidence batch, not part of the tooling slice.

### Modified legacy alert evidence

- `evidence/metric-alert-unpublished-change-count-20260704.md`

This file has accumulated additional refresh blocks for later unpublished-change alert triage. It is evidence churn, not part of the compact-organizer tool.

### Untracked metric-alert evidence files

Current `evidence/metric-alert-*` inventory in the app repo totals `60` files under these families:

- `blocked-missing-fallback-count`: `6`
- `blocked-missing-observer-count`: `25`
- `blocked-missing-owner-count`: `3`
- `blocked-missing-waiting-for-count`: `15`
- `task-tree-problem-count`: `2`
- `unowned-work-count`: `4`
- `unowned-work-count-aad-rbac-holder-repair`: `1`
- `unpublished-change-count`: `4`

Representative files reviewed during this task:

- `evidence/metric-alert-unpublished-change-count-20260707-alert2974.md`
  - current waiting-with-evidence note for a real compact-writeback hygiene breach
- `evidence/metric-alert-unpublished-change-count-20260707-alert2956.md`
  - stale/recovered alert note from an earlier clean state
- `evidence/metric-alert-blocked-missing-observer-count-20260707-alert3009.md`
  - fix-root-cause note documenting a supported blocked-contract repair and post-fix metric recovery
- `evidence/metric-alert-unowned-work-count-aad-rbac-holder-repair-20260707.md`
  - fix-root-cause note documenting restoration of exact task ownership for one spec frontier

## Classification

### Durable intended work

Keep together as one publishable tooling slice:

- `package.json`
- `scripts/compact-organizer.ts`
- `scripts/compact-organizer.test.ts`
- this archive note: `evidence/archive/reconcile-app-repo-unpublished-change-residue-20260707.md`

### Separate alert-evidence residue

Do **not** mix into the tooling checkpoint:

- `evidence/metric-alert-unpublished-change-count-20260704.md`
- the current untracked `evidence/metric-alert-*.md` batch

Reason: these files are audit notes from multiple alert families and multiple operations (`waiting_with_evidence`, `resolve_stale`, `fix_root_cause`). They are coherent as an evidence batch, but they are not required to ship the compact-organizer tool and would make the tooling checkpoint misleadingly broad.

## Exact next action

The cleanest next publish-or-cleanup slice is now narrower than the task's original packaging hypothesis.

### Publish now

Create one checkpoint containing only the durable tooling slice:

- `package.json`
- `scripts/compact-organizer.ts`
- `scripts/compact-organizer.test.ts`
- `evidence/archive/reconcile-app-repo-unpublished-change-residue-20260707.md`

### Do not include in that checkpoint

Leave out:

- all `evidence/metric-alert-*` files, including the modified legacy `evidence/metric-alert-unpublished-change-count-20260704.md`

## Remaining cleanup decisions after the tooling slice

After the tooling slice is published, the owner should handle the alert residue as one evidence-only follow-up by either:

- **publishing it as one evidence batch** if the project wants to preserve every current metric-triage memo in git, or
- **compacting/pruning it intentionally** after preserving any keeper conclusions in a smaller rollup note.

## Narrowed blocker / owner follow-up

The tooling slice itself is self-contained and testable, but it is **not the whole remaining app-repo breach**.

The exact narrowed owner follow-up is:

1. checkpoint the compact-organizer tooling slice separately; and
2. then either checkpoint or compact the metric-alert evidence batch separately.

## Current blocker to further automatic cleanup

There is no safe automatic deletion or bundling rule from this worker session for the non-tooling residue because the remaining unpublished surface mixes:

- stale/recovered alerts,
- current waiting alerts,
- and root-cause-fix audit records.

So the remaining cleanup is now narrowed to an exact alert-residue owner decision rather than a broader ambiguous hygiene surface.
