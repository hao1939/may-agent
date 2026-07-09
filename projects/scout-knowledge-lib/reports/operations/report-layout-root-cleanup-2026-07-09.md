# Report Layout Batch: Root Reports

Date: 2026-07-09

## Decision

Move the remaining root-level reports into their purpose-specific report
folders.

## Files Moved

Triage reports moved to `reports/triage/`:

- `inbox-triage-arxiv-batch.md`
- `inbox-triage-github-batch.md`
- `inbox-triage-hn-batch.md`
- `inbox-triage-xhs-batch.md`

Shared-knowledge merge reports moved to `reports/merge/`:

- `shared-knowledge-convergence.md`
- `shared-synthesis-merge-2026-07-09.md`
- `shared-ke-001-090-merge-2026-07-09.md`
- `shared-operations-small-dirs-merge-2026-07-09.md`

Migration report moved to `reports/migration/`:

- `library-inventory-2026-06-12.md`

## Verification

References were updated mechanically from root `reports/` paths to the new
folder paths. The Scout app health observer should stop reporting root
`reports-layout-backlog` once no markdown files remain directly under
`reports/`.
