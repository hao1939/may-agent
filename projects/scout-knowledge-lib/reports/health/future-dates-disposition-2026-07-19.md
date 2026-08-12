<ai_context>
summary: "Documents why future-dated strings in .state/tasks/tree.json are not actionable and should not trigger repeated health signals."
last_updated: "2026-07-19"
</ai_context>

# Future-Dated Library Content — Disposition Record

**Date:** 2026-07-19
**Signal:** `future-dated-library-content` (9 consecutive packets)

## Finding

All 40 future-dated references are inside `.state/tasks/tree.json` task
progress notes. They fall into two categories:

1. **Historical batch-rename records** (dates like 2026-10-06, 2026-10-16,
   2026-10-17, 2026-11-19): These are progress notes in the `future-date-rename-batch`
   task documenting which impossible-future filenames were renamed to their
   actual dates. The future dates appear *inside quoted strings describing
   the old filenames* — they are provenance, not current content.

2. **XHS cookie-refresh fallback date** (2026-07-25): The task
   `xhs-cookie-refresh-blocked` has a fallback date of 2026-07-25. This is
   an intentional future deadline (6 days from now) for pausing the XHS lane
   if cookies are not refreshed.

## Disposition

- **Category 1:** No correction needed. The dates are historical references
  to old filenames embedded in task completion evidence. Editing task history
  to remove them would destroy provenance.
- **Category 2:** Intentional future deadline. Will naturally resolve by
  2026-07-25.

## Recommendation

The health scanner should either exclude `.state/` paths from future-date
scanning or treat quoted date references inside task progress notes as
non-actionable. Until then, this record documents the accepted no-op.

## Addendum — 2026-08-05

This no-op disposition applies only to the quoted future-date strings inside
`.state/tasks/tree.json`.

A later owner review found three **actionable** future-dated report artifacts
under `reports/health/` whose dates could not be trusted:

- `library-health-2026-08-19.md`
- `library-health-2026-08-22.md`
- `library-health-2026-08-25.md`

Verification also found content-equivalent earlier-path siblings in
`reports/health/`:

- `library-health-2026-07-09b.md`
- `library-health-2026-07-09c.md`
- `library-health-2026-06-20.md`

All six files were moved out of `reports/health/` and preserved as triage
artifacts documented in `../triage/future-dated-health-reports-2026-08-05.md`.
Authoritative health snapshots in `reports/health/` now stop at
`library-health-2026-08-02.md`.
