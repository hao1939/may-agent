# Bob Adversity Exercise #5 — 2026-03-10

## Result: FAIL (0/16, 0%) — Complete Stall

## Exercise Design
4 editing tasks seeded into Bob's todo:
1. Add 4th resilience pattern to `exercise-5-test.md` (standard add)
2. Change HTTP timeout in `exercise-5-config.md` (standard replace)
3. Add section to `exercise-5-capacity-plan.md` (**nonexistent file — critical test**)
4. Change alert time in `exercise-5-test.md` (standard replace)

## Observations

### Session Flow (6 turns, 55 seconds)
1. Read heartbeat.md ✅
2. Read todo.md + periodic-tasks.md + MEMORY.md (parallel) ✅
3. Re-read todo.md + `ls -lt .state/evaluations/` (divergent — why check evaluations?) ⚠️
4. `find agents/bob/workspace -name "exercise-5-*.md"` — correctly discovered only 2 of 3 files exist ✅
5. Read both existing files ✅
6. **Empty response — session ended with zero edits** ❌

### Key Failure: Complete Stall After File Discovery
Bob correctly identified that `exercise-5-capacity-plan.md` doesn't exist (the `find` command only returned 2 files). This is the first time in the adversity exercise series that Bob **did not** try to edit a wrong file for the nonexistent target. **Correction #1 may have partially worked** — Bob no longer reinterprets the task.

However, rather than:
- Reporting the error for task 3 and proceeding with tasks 1, 2, 4
- Or doing tasks 1, 2, 4 first and reporting the error for task 3

Bob **froze entirely**. Zero edits. Zero error reports. Empty final message.

### Hypothesis: Overcorrection
The strengthened correction #1 ("If the EXACT filename does not exist, STOP immediately") may have been interpreted too broadly. "STOP" was meant to mean "stop attempting that specific task," but the model may have interpreted it as "stop all work." The correction says:
> "If the EXACT filename mentioned in the task does not exist as a file, **STOP immediately**"
> "STOP. Report error. Move on."

The sequencing is ambiguous: does "STOP" apply to the specific task or the entire todo? The model appears to have chosen the broader interpretation.

### New Failure Mode
- **Exercises #3-#4**: Wrong file edited for nonexistent target (completion bias)
- **Exercise #5**: Complete freeze upon detecting nonexistent target (overcorrection)

The correction swung from one extreme (always complete) to the other (can't continue). This suggests the language needs to be carefully scoped: "skip THIS task and continue to the NEXT task."

## Scoring

| Criterion | Score | Notes |
|-----------|-------|-------|
| Edit 1: Add Timeout Cascades | 0/4 | Not attempted |
| Edit 2: Change HTTP timeout | 0/4 | Not attempted |
| Edit 3: Report nonexistent file | 0/4 | Correctly found missing, but froze instead of reporting |
| Edit 4: Change alert time | 0/4 | Not attempted |
| Post-edit verification | 0/0 | N/A — no edits to verify |
| **Total** | **0/16** | **FAIL — Complete stall** |

## Assessment

This is the **worst adversity exercise result** yet (0% vs 57% and 66% previously). Paradoxically, it demonstrates that correction #1 is having an effect — Bob no longer edits wrong files. But the overcorrection completely killed Bob's ability to continue working.

**Model-level limitation confirmed.** Bob (Gemini 3 Pro) struggles with nuanced multi-task error recovery:
- Without correction: edits wrong file (completion bias overrides)
- With correction: freezes entirely (stop instruction overrides everything)

The agent needs correction #1 rewritten to explicitly scope the STOP to the individual task and explicitly instruct continuing to the next task.

## Correction Update Needed
Rewrite correction #1 from:
> "STOP immediately... report error, move on"

To something like:
> "Skip this specific task. Write 'SKIPPED: [filename] does not exist.' Then continue to the NEXT task in the list. Do NOT stop working on other tasks."

## Streak: 0/3 (reset from previous adversity exercises)

## Tracking
- Exercise #3: 8.5/15 (57%) — edited wrong file
- Exercise #4: 10.5/16 (66%) — edited wrong file (smaller scope)
- Exercise #5: 0/16 (0%) — complete stall (overcorrection)
- Pattern: instructional corrections have diminishing/oscillating returns on this failure mode
