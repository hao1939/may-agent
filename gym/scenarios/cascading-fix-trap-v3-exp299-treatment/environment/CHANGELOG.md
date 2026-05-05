# Changelog

## v3.1 (2024-03-20)
- Reordered pipeline steps: normalization now runs before penalty
  application so that penalties are deducted in percentage points
  rather than raw score units. This ensures consistent behavior
  regardless of assignment max_score values.
- Added input validation step between load and normalize.

## v3.0 (2024-03-01)
- Major refactor: split monolithic grader into separate modules.
- New modules: reader, penalties, normalizer, homework, grades,
  stats, formatter, validator, policy.
- Grade scale thresholds moved to policy.js configuration.
- Letter grade assignment now uses strict comparison against the
  grade scale (scores must exceed the threshold to earn the grade).

## v2.5 (2024-02-15)
- Fixed homework drop-lowest logic to use percentage scores
  instead of raw points for fair comparison across assignments
  with different max_score values.

## v2.0 (2024-01-30)
- Added late penalty system (5% per day, max 25%).
- Added drop-lowest-homework policy.

## v1.0 (2024-01-15)
- Initial release: basic CSV reader, weighted grade calculation.
