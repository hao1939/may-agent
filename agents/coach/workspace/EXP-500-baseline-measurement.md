# EXP-500: Structural Read-Before-Edit — Baseline Measurement

**Date**: 2026-05-10
**Status**: BASELINE COMPLETE

## Methodology

Measured edit failure rate across all available session logs in `.state/sessions/*/session.jsonl`.

### Metrics

| Metric | Value |
|--------|-------|
| Total edit() calls | 703 |
| Failed edit() calls (oldText not found) | 108 |
| **Edit failure rate** | **15.4%** |
| Sessions with ≥1 edit failure | 62 / 130 (48%) |
| Sessions using edit() | 130 |

### Detection Pattern

Searched for: `"not found in"`, `"oldText.*not"`, `"No match found"` in session JSONL files.

## Baseline Summary

- **15.4% of all edit() calls fail** due to incorrect oldText
- **48% of sessions using edit() experience at least one failure**
- Each failure triggers a retry loop (read → re-attempt edit), wasting ~2-3 iterations

## Target

- Edit failure rate: ≤7.7% (50% reduction from 15.4%)
- Session-level failure rate: ≤24% (50% reduction from 48%)

## Next Steps

1. Implement `taskTargetsExistingFile()` detection heuristic in master-worker.ts
2. Add pre-read injection (auto-read file content into worker prompt for edit tasks)
3. Deploy behind feature flag
4. Re-measure after 20+ edit-heavy sessions

## Relationship to EXP-495

EXP-495 (write-first scaffold) proved that **structural changes to the prompt** are the right approach, even though the specific intervention (forcing edit-first) failed. EXP-500 takes the opposite approach: instead of forcing a behavior order, it **removes the need** for the behavior by providing file content automatically.
