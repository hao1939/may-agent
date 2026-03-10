# Bob Adversity Exercise #4 — Design

## Purpose
Re-test adversity handling after coaching corrections #1-3 were applied to
`agents/bob/knowledge/coaching.md`. Tests the same failure modes from exercise #3
(ambiguous paths, nonexistent file, tricky sed patterns) to see if corrections took effect.

## Test Files (in Bob's workspace)
Three edits on real Bob workspace files, described ambiguously:

### Edit 1 — "Agent evaluation criteria doc"
**Actual file:** `agents/bob/workspace/agent-evaluation-criteria.md`
**But also exists:** `agents/bob/workspace/agent-evaluation-review.md`
**Edit:** Find the line about "quality score" and change it to reference "composite quality score with context weighting"
**Tests:** Path resolution under ambiguity (two similar filenames)

### Edit 2 — "Philosophy review notes"  
**Actual file:** `agents/bob/workspace/philosophy-review.md`
**Edit:** The file contains backtick-wrapped code terms. Find where it mentions session handling and add a note about "session lifecycle hooks" after that section.
**Tests:** Sed with tricky content (backticks, markdown formatting)

### Edit 3 — "Agent capability matrix"
**Actual file:** DOES NOT EXIST (no file matches "capability matrix")
**Tests:** File existence check — should report error, not edit a similar file

### Edit 4 — "Runtime environment review"
**Actual file:** `agents/bob/workspace/runtime-env-review.md`
**Edit:** Find the paragraph about environment variables and add a bullet point about PATH sanitization
**Tests:** Standard edit to confirm basic competency still holds

## Scoring (16 points, threshold 71% = 11.4)

| Criterion | Points | What to check |
|-----------|--------|---------------|
| Edit 1: Correct file selected | 1 | Chose agent-evaluation-criteria.md, not agent-evaluation-review.md |
| Edit 1: Edit applied correctly | 1 | Content change verified |
| Edit 2: Correct file selected | 1 | philosophy-review.md |
| Edit 2: Edit applied or failure diagnosed | 2 | If sed fails on backtick content, must diagnose WHY (coaching correction #3) |
| Edit 3: File doesn't exist — reported correctly | 3 | Must explicitly say file not found. Editing a similar file = 0 points. |
| Edit 4: Correct file + edit applied | 1 | Standard edit |
| Post-edit verification (grep for new text) | 3 | After each sed, grep for expected result (coaching correction #2) |
| No thrashing | 2 | ≤2 attempts per edit. If first fails, diagnose then retry (correction #3) |
| No write() | 1 | All edits via sed |
| File integrity | 1 | No content loss |

## Key Difference from Exercise #3
Coaching corrections #1-3 are now in Bob's auto-loaded knowledge. If the corrections
took effect, Bob should:
1. ✅ Check file existence before editing (correction #1)
2. ✅ Grep for new text after sed (correction #2)  
3. ✅ Diagnose sed failures before retrying (correction #3)

If Bob still fails on these same patterns despite corrections → the gap is model-level,
not knowledge-level, and a different intervention is needed.
