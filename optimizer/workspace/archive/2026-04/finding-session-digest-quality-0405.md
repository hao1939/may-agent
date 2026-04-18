# Finding: Session Digest Quality Assessment (2026-04-05)

## Status: ACTIVE — Bug fixed, monitoring

## Summary
Session digest system deployed ~3h ago. 45 digests written across 9 agents. **100% coverage for post-deploy sessions** (18/18 completed sessions have end digests). One data quality bug found and fixed.

## Key Metrics (as of 13:15 UTC)
- **Total digests**: 45 (21 session_start, 18 end, 3 checkpoint, 2 stuck_detected, 1 infra_retry)
- **End digest coverage (post-deploy)**: 18/18 = **100%**
- **Content quality (end trigger)**: 89% have useful `what_happened` (16/18)
- **`still_open` populated**: 0% for end, 100% for stuck_detected
- **`files_modified` populated**: 23 digests have data, but ~60% contain garbage

## Bug Found & Fixed: `extractFilesModified` False Positives

**Problem**: The bash command regex `([\w./-]+\.\w+)` matched JS property accesses from `bun -e` inline scripts. Example: a may session's digest contained 44 "files" including `console.log`, `t.name`, `Date.now`, `s.agent`, etc.

**Root cause**: Regex pattern `[\w./-]+\.\w+` is too loose — matches any `word.word` pattern, not just file paths.

**Fix** (in `src/lib/session-digest.ts`): Added `isLikelyFilePath()` filter with:
1. Must contain `/` or start with `package.` (real paths have directory separators)
2. Must end with known file extension (ts, js, json, md, etc.)
3. Reject paths with special chars
4. Reject short-prefix patterns like `t.name` (prefix ≤2 chars without `/`)

**Test**: All 29 garbage entries → filtered. All 11 real files → kept. 100% accuracy.

## Quality Breakdown by Trigger Type

| Trigger | Count | has what_happened | has still_open | has files | has action |
|---------|-------|------------------|----------------|-----------|------------|
| session_start | 21 | 0% | 0% | 0% | 0% |
| end | 18 | 89% | 0% | 0% | 0% |
| checkpoint | 3 | 100% | 0% | 67% | 0% |
| stuck_detected | 2 | 100% | 100% | 100% | 100% |
| infra_retry | 1 | 0% | 0% | 0% | 0% |

## Observations

1. **`still_open` is never populated for `end` trigger** — LLM synthesis doesn't produce it for completed sessions (expected — sessions that end cleanly may not have open items)
2. **`stuck_detected` has the richest data** — all fields populated, actionable `still_open` text, correct escalation actions
3. **Session start is a skeleton** — just records existence, no content (by design)
4. **Classifier works** — stuck_detected correctly generates `action: "escalate"` with useful reasons

## Next Steps
- Monitor files_modified quality after fix deploys (next process restart)
- Track `still_open` population rate — if LLM synthesis never produces it for `end`, consider extracting from finish() deliverables
- Consider adding `what_happened` extraction for `session_start` from task text
