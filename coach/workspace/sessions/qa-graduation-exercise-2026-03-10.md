# QA Graduation Exercise — 2026-03-10

**Agent:** QA (GPT-5.2)
**Session:** s_1773116111186_107
**Duration:** 41s, 12 turns
**Result:** PASS (13.5/16, 84%)
**Milestone:** 🎓 QA GRADUATES — 3rd agent graduation

## Exercise Design

Multi-file event processing service review (graduation-level):
- 3 files: EventEmitter (105 lines, clean), EventProcessor (123 lines, 2 bugs), EventStore (133 lines, clean)
- No bug hints in source code
- No "use sed" instruction — tests default edit behavior
- Requires: multi-file triage, bug detection without hints, surgical fixes, tsc verification

### Planted Bugs
1. **event-processor.ts line 54**: Priority sort `b.priority - a.priority` (descending) but comment says "1 = highest" — should be `a.priority - b.priority`
2. **event-processor.ts line 60**: Off-by-one `i <= batch.length` — accesses undefined element

## Scoring

| Criterion | Score | Notes |
|-----------|-------|-------|
| Multi-file review | 2/2 | Read all 3 files in parallel |
| Bug #1: Priority sort | 2/2 | Found and fixed correctly |
| Bug #2: Off-by-one | 2/2 | Found and fixed correctly |
| Clean file identification | 2/2 | event-emitter.ts correctly left untouched |
| Edit method (sed) | 2/2 | Used sed after apply_patch failed. No write(). NOT prompted to use sed. |
| Post-fix verification | 2/2 | Re-read file, then ran tsc |
| tsc | 1/1 | Ran tsc, found TS2802 config errors in event-store, fixed them |
| vitest | 1/1 | Ran vitest, correctly identified failure as pre-existing/unrelated |
| Verdict calibration | 2/2 | CONDITIONAL — appropriate |
| False positive: retry threshold | -1 | Changed `< maxRetries` to `<= maxRetries` — debatable, not a planted bug |
| False positive: peek sort | -0.5 | Changed peek sort direction — defensible but not planted |
| **Total** | **13.5/16** | **84% — PASS** |

## Key Findings

### sed Usage Internalized
The task did NOT include "use sed" — a critical graduation gate. QA's behavior:
1. First attempted apply_patch (GPT-5.2 native tool)
2. apply_patch not available → fell back to sed
3. Zero write() calls across entire session
4. All 5 sed commands were pattern-based and correct

This confirms sed-for-surgical-fixes is the default behavior, not just a prompted response.

### Multi-File Triage
QA read all 3 files in a single parallel tool call, then correctly identified:
- event-emitter.ts: clean (no changes needed)
- event-processor.ts: 2 real bugs + 2 additional changes
- event-store.ts: tsc config issue (not a logic bug, but real compilation error)

### False Positive Analysis
QA made 2 changes beyond the planted bugs:
1. **Retry threshold** (`< maxRetries` → `<= maxRetries`): With maxRetries=3, original allows retries 0,1,2 (3 attempts). QA's change allows 0,1,2,3 (4 attempts). This is a judgment call — original behavior is defensible. Minor over-diagnosis.
2. **Peek sort direction**: Changed to match processBatch sort. The original descending sort in peek() could be intentional (different view). But consistency argument is valid.

Neither false positive caused harm — both changes are defensible and don't break functionality.

### Verdict Calibration
CONDITIONAL verdict for pre-existing unrelated test failure (task-cache LRU eviction). This is correct discipline — consistent with all 4 previous passing exercises.

## Graduation Assessment

### Streak: 4/4 (exercises #1, #3, #4, graduation)
- Exercise #1 (rate-limiter): PASS 12/12 — sed used on non-truncated file
- Exercise #3 (connection-pool): PASS 12/12 — sed used, clean execution
- Exercise #4 (task-scheduler): PASS 14/14 — sed used, no hint dependency
- Graduation (event-processing): PASS 13.5/16 — multi-file, no sed prompt, false positives minor

### Competencies Demonstrated
- **L1**: Bug detection, surgical fixes, independent verification — all ceiling
- **L2**: Multi-file triage, self-directed review, ambiguity handling (clean vs buggy files)
- **Edit discipline**: sed as default (not prompted), no write() for surgical fixes
- **Verdict calibration**: Consistently correct across all exercises
- **Tool usage**: Parallel reads, independent tsc + vitest, efficient sessions

### Known Limitations
- Minor over-diagnosis tendency (2 false positives in graduation)
- apply_patch as first choice (falls back to sed correctly, but wastes one tool call)

### Graduation Decision
**🎓 QA GRADUATES** — 3rd agent (after Coder, Scout). 4/4 streak, multi-file competency proven, sed internalized without prompting, verdict calibration excellent. False positive tendency is minor and doesn't cause harm.
