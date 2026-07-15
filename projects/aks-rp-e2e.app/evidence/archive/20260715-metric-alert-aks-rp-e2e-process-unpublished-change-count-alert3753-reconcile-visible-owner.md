# Metric alert 3753 unpublished-change visibility reconciliation — 2026-07-15

- Task: `ops/reconcile-unpublished-change-visibility-alert-3753-20260715`
- Attempt: `a_ops_reconcile-unpublished-change-visibility-alert-3753-20260715_20260715015524`
- Worker: `app-ops`
- Mode: Task Worker Mode

## Executive verdict

`/app/projects/aks-rp-e2e` currently has exactly **three** unpublished files, and all three are truthfully represented.

They are **not** anonymous drift:

1. they were authored by the already-reviewed archived done slice `domain/author-storage-csi-file-verify-nfs-live-carrier-20260715`, and
2. their smallest truthful next action is the currently active verification leaf `verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1`, which is running the live single-spec pipeline for `spec.storage-csi.file-verify-nfs`.

So this alert does **not** need a new owner task, a filler publication task, or a checkpoint commit. The truthful next move is to let the active verification leaf finish and then review its terminal result before deciding whether this 3-file slice is ready to publish.

## Baseline domain worktree truth

Fresh `git status --short` in `/app/projects/aks-rp-e2e` shows only these paths:

```text
?? features/storage-csi/specs/storage-csi-file-verify-nfs.json
?? features/storage-csi/tests/storage-csi-file-verify-nfs.test.ts
?? features/storage-csi/tests/storage-csi-file-verify-nfs.ts
```

No additional modified, deleted, or renamed domain files were present in this audit.

## File-by-file ownership mapping

| Changed file | Exact owner lineage | Proof | Current next action carrier |
| --- | --- | --- | --- |
| `features/storage-csi/specs/storage-csi-file-verify-nfs.json` | archived done slice `domain/author-storage-csi-file-verify-nfs-live-carrier-20260715` | `.state/tasks/archive/done-leaves-20260715014642464.json` records this exact file in `last_worker_evidence`; `evidence/archive/author-storage-csi-file-verify-nfs-live-carrier-20260715.md` says the worker created the verifyNFS-only spec | active leaf `verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1` has `context.specId = spec.storage-csi.file-verify-nfs` and exists to run/review this exact spec through ADO |
| `features/storage-csi/tests/storage-csi-file-verify-nfs.ts` | archived done slice `domain/author-storage-csi-file-verify-nfs-live-carrier-20260715` | same archive record lists this exact probe file; authoring memo says it created the execute-gated verifyNFS probe and passed local gates | same active verification leaf, because the live spec carrier uses this probe as the spec `probeRef` |
| `features/storage-csi/tests/storage-csi-file-verify-nfs.test.ts` | archived done slice `domain/author-storage-csi-file-verify-nfs-live-carrier-20260715` | same archive record lists this exact Vitest wrapper; authoring memo says the wrapper passed its required local gate | same active verification leaf, because this file is part of the authored carrier now being validated for live use |

## Archived done slice proof

The strongest ownership proof is the archived accepted leaf:

- archive file: `.state/tasks/archive/done-leaves-20260715014642464.json`
- task id: `domain/author-storage-csi-file-verify-nfs-live-carrier-20260715`
- state in archive: `done`
- review summary: the worker authored the verifyNFS-only branch-local carrier and the required local gates passed
- exact recorded worker evidence:
  - `features/storage-csi/specs/storage-csi-file-verify-nfs.json`
  - `features/storage-csi/tests/storage-csi-file-verify-nfs.ts`
  - `features/storage-csi/tests/storage-csi-file-verify-nfs.test.ts`
  - `evidence/archive/author-storage-csi-file-verify-nfs-live-carrier-20260715.md`
  - `runner/generated/spec-catalog.json`

The domain memo `evidence/archive/author-storage-csi-file-verify-nfs-live-carrier-20260715.md` independently confirms the same three files were created as the bounded verifyNFS carrier and that local check/Vitest/private-source-policy/live-admission gates passed.

## Why these files are still unpublished

These files are not idle leftovers from a finished publish slice. They are the authored carrier for a live verification step that is still in progress.

Current live tree fact:

- task id: `verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1`
- state: `active`
- goal: `Run and review spec.storage-csi.file-verify-nfs through the single-spec Azure DevOps pipeline.`
- inputs include:
  - `spec:spec.storage-csi.file-verify-nfs`
  - `pipeline:ado-pipeline-467665`
  - `target:staging`
- outputs include:
  - `.state/spec-loop/state.json`
  - `runs/test-results/`
  - `test-results/`

This means the current 3-file domain dirt is already connected to a visible follow-through step. The authored files are the input surface for the active verification leaf rather than an unowned repo residue.

## Checkpoint-slice judgment

This slice is **coherent** but **not yet checkpoint-ready**.

Reason:

- the authoring slice itself is complete and truthfully archived, but
- the next exact same-lineage action is already active (`verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1`), and
- committing/publishing the files from this worker session would cut across active verification work that has not yet produced its terminal live result.

So the smallest truthful action is **not** a new checkpoint or publication task. It is to preserve visibility and wait for the active verifier to finish.

## Exact next action

Use the existing active leaf as the carrier:

- task id: `verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1`
- wait condition: Azure DevOps single-spec verification for `spec.storage-csi.file-verify-nfs` reaches a terminal result and writes reviewable artifacts
- check method:
  1. inspect the live task state for `verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1`
  2. read terminal artifacts under `runs/test-results/` or `test-results/` when they appear
  3. classify the result as pass/fail/error and only then decide whether the authored 3-file slice is ready to publish as a coherent checkpoint
- no additional follow-up task is needed at this time

## Gap audit result

No changed file in the current `/app/projects/aks-rp-e2e` worktree lacks a truthful owner.

- explicit gap count: `0`
- new follow-up task required: `no`
- checkpoint-ready publication slice required from this session: `no`

## Planner/reviewer outcome

1. Treat alert 3753's current contributor set as exactly the three verifyNFS files above.
2. Keep those files represented by the archived authoring slice `domain/author-storage-csi-file-verify-nfs-live-carrier-20260715` plus the active verifier `verify-spec-storage-csi-file-verify-nfs-retry-202607150148-1`.
3. Do not create a duplicate publication-hygiene task or a generic owner-gap task.
4. Do not force a checkpoint commit while the active verify-spec leaf is still running.
5. Revisit publication only after the active verification leaf reaches a terminal result.
