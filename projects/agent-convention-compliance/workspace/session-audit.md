# Session Audit — Convention Compliance from Activity Logs

**Date**: 2026-07-28  
**Method**: Analyzed `activity.jsonl` files across 5 agents  
**Target conventions**: C1.1 (read-before-edit), C1.3 (verify-after-edit), C1.7 (safe patterns), C12.1 (finish protocol)

## Data Availability

| Agent | Total Log Lines | Recent Sessions (last 200 lines) | Completions |
|-------|----------------|----------------------------------|-------------|
| bob | 1,165 | 98 starts / 100 completions | Active |
| amy | 1,233 | 40 starts / 38 completions | Active |
| master | 236 | 77 starts / 75 completions | Active |
| coach | 309 | 70 starts / 60 completions | Active |
| optimizer | 1,227 | 99 starts / 99 completions | Active |

## Limitation

**Activity logs only contain session-level events** (start/done with metadata), not individual tool calls. The `activity.jsonl` format records:
- `event: "start"` with task description
- `event: "done"` with summary, turns count, duration, and files list

**No tool-call-level transcripts are available** in the production logging system. This means we **cannot audit C1.1/C1.3/C1.7/C12.1 from session logs** — only from gym scenarios (which simulate and grade these patterns).

## Observable Proxy Metrics

### File Production Rate
All 371 sampled session completions show `files: []` — meaning the activity log doesn't capture file deliverables (likely a logging gap, not actual zero production).

### Session Duration Distribution (from bob, last 100 completions)
Sessions range from ~10s (simple checks) to ~10min (complex tasks), suggesting real work is happening.

## Recommendations

1. **Add tool-call logging to activity.jsonl** — record each `read()`, `edit()`, `write()`, `bash()` call with timestamps to enable convention auditing
2. **Use gym scenarios as the authoritative compliance measurement** — they're the only source with tool-call-level grading
3. **Consider adding a session replay/transcript feature** for post-hoc auditing

## Convention Compliance Estimates (from gym data only)

Since session logs lack tool-call detail, we rely entirely on gym scenario results:

| Convention | Gym Evidence | Estimated Compliance |
|-----------|-------------|---------------------|
| C1.1 (read-before-edit) | convention-verify-multi-edit: 1/4 passes | **~25%** |
| C1.3 (verify-after-edit) | Maps to C2.3 in gym: 1/10 passes | **~10%** |
| C1.7 (safe patterns) | convention-safe-append: 2/2 passes | **~100%** |
| C12.1 (finish protocol) | convention-promise-report C40.3: 1/2 | **~50%** |
