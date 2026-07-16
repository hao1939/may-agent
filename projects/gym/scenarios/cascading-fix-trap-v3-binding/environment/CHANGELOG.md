# Changelog

## v2.1.0 — Architecture Refactor (2024-03-15)

### Changed
- **penalties.js**: Refactored to mark-only pattern. Now sets `penalty_applied` 
  on records instead of computing adjusted scores. The actual percentage deduction
  is handled by the normalizer.
- **normalizer.js**: Updated to account for penalty marks when computing percentages.
  If `penalty_applied` is present, the penalty is subtracted from the raw percentage.
- **pipeline.js**: Updated step comments to reflect new penalty/normalize contract.
  Normalization now depends on penalty marks being present.

### Why
The previous design had penalties and normalizer both computing percentages 
independently, leading to redundant calculations and making it unclear which 
module was responsible for the `pct` field. The new design gives clear ownership:
penalties marks, normalizer computes.

## v2.0.0 — Initial Pipeline (2024-02-01)

### Added
- Full grade processing pipeline: CSV → validate → normalize → penalize → 
  homework aggregation → final grades → statistics → report
- Policy-driven configuration for weights, penalties, and grade thresholds
- Drop-lowest-homework feature
- 23 integration tests covering all students and grade components
