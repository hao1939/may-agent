# Report Layout Batch: Health Reports

Date: 2026-07-09

## Decision

Move library health reports out of the root `reports/` folder and into
`reports/health/`.

## Files Moved

- `reports/library-health-2026-06-14.md`
- `reports/library-health-2026-07-18.md`
- `reports/library-health-2026-07-18b.md`
- `reports/library-health-2026-07-21.md`
- `reports/library-health-2026-07-29.md`
- `reports/library-health-2026-07-30.md`
- `reports/library-health-2026-07-31.md`
- `reports/library-health-2026-08-01.md`
- `reports/library-health-2026-08-02.md`
- `reports/library-health-2026-08-19.md`
- `reports/library-health-2026-08-22.md`
- `reports/library-health-2026-08-25.md`

## New Location

`reports/health/`

## Verification

The Scout app health observer should continue reporting `reports-layout-backlog`
until the remaining root reports are moved in later small batches. This batch
only handles health reports.

## Addendum — 2026-08-05

The three Aug-named files listed above were later found to be unverified
artifacts with untrustworthy chronology. Their later triage disposition is
tracked in `../triage/future-dated-health-reports-2026-08-05.md`. The list in
this report is preserved as a historical record of the July layout move, not as
proof that those three files remain authoritative health snapshots.
