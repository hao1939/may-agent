# Finding: Tool Quality Regression — edit:edit-match-fail & bash:cmd-not-found (2026-04-16 22:30)

**Task**: Investigate edit:edit-match-fail 6→16 (+167%) and bash:cmd-not-found 2→4 (+100%)

## Data (last 24h from failureChains)

### edit:edit-match-fail — 14 total
| Agent | Count | Pattern |
|-------|-------|---------|
| qa | 9 | All editing `agents/qa/workspace/journal.md` — a 5470-line file that changes every 30min |
| tech-lead | 4 | Editing actively-changing files during coding sprints |
| optimizer | 1 | Editing `todo.md` rotation tracker |

### bash:cmd-not-found — 2 in last 12h
| Agent | Count | Pattern |
|-------|-------|---------|
| qa | 2 | Trying to use `python` (not available in this environment) |

## Root Cause Analysis

### edit:edit-match-fail: qa's journal.md (9/14 = 64%)

**Root cause**: qa appends entries to `journal.md` (5470 lines) every ~30min heartbeat. Multiple qa sessions run concurrently or in quick succession, each reading the file then trying to edit it. Between read and edit, another session has already appended, so the `oldText` no longer matches.

This is a **concurrency/file-size problem**, not a behavioral one. The journal grows monotonically and qa edits near the end where content changes most frequently.

**Fix options**:
1. qa should use `write()` to append (or `bash echo >>`) instead of `edit()` for journal entries
2. qa could use a simpler append pattern: `bash -c "echo '...' >> journal.md"`

### edit:edit-match-fail: tech-lead (4/14 = 29%)

**Root cause**: Active coding sprint on frequently-changing files. Expected during heavy development. Self-resolves when sprint ends.

**Verdict**: No action needed.

### bash:cmd-not-found: qa using python (2/2)

**Root cause**: qa attempted `python` to manipulate journal.md text. Python is not available in this environment. qa should use `bun -e` or bash string manipulation instead.

**Verdict**: qa's context.md should note "python is not available."

## Summary

The regression is **concentrated in qa** (11/16 total errors). Two specific patterns:
1. qa editing a huge journal.md file that changes between read and edit (concurrency)
2. qa trying to use python (unavailable tool)

Neither is systemic infrastructure failure. Both are addressable with targeted qa fixes.

## Recommendations

### R1: Add "python is not available" to qa's context.md (can do now)
- **File**: `agents/qa/context.md`
- **Change**: Add line: "python/python3 is not available — use bun -e or bash for scripting"
- **Expected impact**: Eliminate cmd-not-found errors (2→0, -100%)
- **Priority**: HIGH — simple, immediate

### R2: DISPATCH-READY → qa: Switch journal.md appending to bash append
- **What**: Instead of read→edit pattern, qa should append journal entries with `bash -c "echo '...' >> agents/qa/workspace/journal.md"` or use `write()` targeting end of file
- **Where**: qa's heartbeat handler or system prompt where journal writing is instructed
- **Expected impact**: Eliminate 9/14 edit-match-fail errors (~64% reduction)
- **Priority**: MEDIUM — requires understanding qa's journal-writing flow
- **Note**: This requires changes to qa's behavioral instructions, not just context

### R3: NO_ACTION_NEEDED for tech-lead edit failures
- **Justification**: 4 failures during active coding sprint on changing files. Normal development friction. Will self-resolve.
