# Failure Transcript Analysis — Iteration 5 (P5.1)

## Summary

After C3 scorer recalibration to accept `edit()` diff preview as JSON validation, compliance rose from 78% to **82.4%** (42/51 checks passing). Remaining failures fall into 3 categories:

---

## Category 1: No Transcript Available (2 failures)

**Scenarios**: `convention-verify-edit-fewshot`, `convention-verify-edit-verify-wrap`

**Root cause**: The gym runner does not generate `transcript.jsonl` for these scenarios. Both C2.3 and C3 checks fail with "No transcript available."

**Expected**: Transcript should be written to the scenario environment directory.
**Actual**: No transcript file exists after the run.

**Fix proposal**: This is a gym infrastructure bug, not an agent behavior issue. The runner needs to ensure transcript is saved for all scenario types. These 2 failures should be excluded from compliance scoring until the transcript bug is fixed.

---

## Category 2: Multi-Edit Product Failures (4 failures)

**Scenario**: `convention-verify-multi-edit-workflow`

**Failing checks**:
- `database-fields-preserved` — original fields lost during edit
- `cache-fields-preserved` — original fields lost during edit  
- `api-fields-preserved` — original fields lost during edit
- `C2.3:verify-after-edit` — only 1/3 files verified (needs 2/3)

**Root cause**: The agent uses `write()` to replace entire JSON files instead of `edit()` to modify specific values. When it writes, it constructs the JSON from memory and drops fields it doesn't remember.

**Expected tool sequence**:
1. `read()` each config file
2. `edit()` to change only the target field (preserving all other fields)
3. Verify each file after edit

**Actual tool sequence** (typical):
1. `read()` one file
2. `write()` entire file from memory (losing fields)
3. Move to next file without verifying

**Fix proposal**: 
- SOUL.md already says "read before edit" — the issue is using `write()` instead of `edit()` for modifications
- Add to SOUL.md: "⛔ **Prefer edit() over write()**: When modifying existing files, use `edit()` to change only what's needed. Using `write()` to rewrite entire files risks losing fields."

---

## Category 3: C40 Promise-Report Protocol (2 failures)

**Scenario**: `convention-promise-report`

**Failing checks**:
- `C40.1:promise-before-action` — first message doesn't contain planning language
- `C40.3:finish-includes-deliverables` — finish() call missing deliverables array

**C40.1 analysis**: The scorer checks `firstMessageContains(/i will|i'll|plan|steps?:|1\.|here's what/i)`. The agent likely jumps straight to tool calls without a text preamble.

**C40.3 analysis**: The scorer checks that the finish() call's JSON contains both "deliverable" and "analysis" strings. The agent either doesn't call finish() with deliverables or uses different wording.

**Fix proposal**:
- The SOUL.md "Before Starting Work" section already has intent declaration instructions
- This is a model behavior issue — the agent's trained behavior overrides text instructions
- Consider adding a few-shot example in the scenario's system prompt showing the expected pattern

---

## Score Comparison

| Metric | Iteration 4 (78%) | Iteration 5 (82.4%) | Delta |
|--------|-------------------|---------------------|-------|
| Total checks | 51 | 51 | — |
| Passing | 40 | 42 | +2 |
| C3 failures | 4 | 2* | -2 |
| C2.3 failures | 2 | 2 | 0 |
| C40 failures | 2 | 2 | 0 |
| Product failures | 3 | 3 | 0 |

*2 remaining C3 failures are due to missing transcripts (infrastructure bug), not agent behavior.

## Adjusted Score (excluding transcript bugs)

Excluding the 2 checks that fail due to missing transcripts: **42/49 = 85.7%**

## Remaining Improvement Opportunities

1. **Fix transcript generation** for fewshot/verify-wrap scenarios (+2 checks, ~4pp)
2. **Add "prefer edit() over write()"** guidance to reduce product failures in multi-edit (+3 checks, ~6pp)  
3. **C40 promise-report** requires model-level behavior change — lowest ROI for text interventions
