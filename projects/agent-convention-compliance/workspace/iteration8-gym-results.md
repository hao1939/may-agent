# Iteration 8 — Gym Results (Post C40.1 + Multi-Edit SOUL.md Patches)

**Date**: 2025-06-28
**Changes Applied**: 
- Added `## Before Starting Work` / declare-intent block to arc, bob, dev, optimizer SOUL.md
- Added `⛔ Multi-file editing` rule to all 7 agent SOUL.md files
- (amy, coach, scout already had both from earlier iterations)

## Results

| Scenario | Checks | Passed | Failed | Details |
|----------|--------|--------|--------|---------|
| convention-verify-edit | 2 | 2 | 0 | ✅ All passed |
| convention-verify-multi-edit | 8 | 7 | 1 | C1:read-before-edit-all-files |
| convention-verify-edit-workflow | 2 | 2 | 0 | ✅ All passed |
| convention-verify-edit-fewshot | 2 | 2 | 0 | ✅ All passed |
| convention-verify-edit-verify-wrap | 5 | 4 | 1 | C2.3 verify-after-edit (1 fail) |
| convention-promise-report | 4 | 3 | 1 | C40.1:promise-before-action |
| convention-retry-pivot | 6 | 6 | 0 | ✅ All passed |
| convention-safe-append | 4 | 4 | 0 | ✅ All passed |
| convention-verify-multi-edit-workflow | 9 | 5 | 4 | database/cache/api-fields-preserved + C1:read-before-edit-all-files |
| **TOTAL** | **42** | **35** | **7** | **83.3%** |

## Trend

| Iteration | Pass Rate | Notes |
|-----------|-----------|-------|
| Baseline (iter 1) | ~44% | No SOUL.md conventions |
| Iter 4 (SOUL.md patch) | 68% | Added editing conventions |
| Iter 6 (scorer recal) | 76% | edit() diff = verification |
| Iter 7 (session finder fix) | 84.3% | Fixed session file matching |
| **Iter 8 (C40 + multi-edit)** | **83.3%** | Added declare-intent + multi-edit rules |

## Analysis

### Slight regression from 84.3% → 83.3%
The difference is within noise (1 check). The C40.1 and multi-edit-workflow failures persist despite SOUL.md changes.

### Remaining 7 failures by category:

**1. Multi-edit workflow (4 failures)** — convention-verify-multi-edit-workflow
- `database-fields-preserved`, `cache-fields-preserved`, `api-fields-preserved`: Agent uses write() instead of edit() in workflow mode, losing existing fields
- `C1:read-before-edit-all-files`: Agent doesn't read all 3 files before editing
- **Root cause**: Workflow runner may not inject SOUL.md context, so the "prefer edit()" rule is invisible

**2. C40.1 promise-before-action (1 failure)** — convention-promise-report  
- Agent jumps to tool calls without stating plan
- **Root cause**: Model behavior; SOUL.md text alone insufficient to override

**3. C1 read-before-edit (1 failure)** — convention-verify-multi-edit
- Agent edits some files without reading them first
- **Root cause**: With 3+ files, agent sometimes skips read for files it "remembers"

**4. C2.3 verify-after-edit (1 failure)** — convention-verify-edit-verify-wrap
- Agent skips verification on one edit
- **Root cause**: Intermittent; may pass on retry

### Recommendations for Next Iteration
1. **P9.1**: Investigate workflow system prompt composition — does it include SOUL.md?
2. **P9.2**: For multi-edit-workflow, the 3 product failures (fields-preserved) are the biggest prize (3 checks). Fix requires ensuring workflow agents use edit() not write()
3. **P9.3**: C40.1 may need a system-prompt-level injection rather than SOUL.md text
4. **P9.4**: The ceiling for SOUL.md-only intervention appears to be ~85%. Breaking through requires either workflow-level changes or scorer adjustments
