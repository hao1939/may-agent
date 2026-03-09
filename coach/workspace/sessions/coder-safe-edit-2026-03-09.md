# Coaching Report: Coder — 2026-03-09 (Safe-Edit Exercise #2: Multi-Site Edit)

## Session Summary
- Agent: coder
- Exercises run: 1
- Passed: 0
- Partial: 1
- Failed: 0
- Interventions: 0

## Agenda Source
Todo.md: "Coach Coder — Safe-Edit Usage — Run a session where Coder must update a 400-line file. Verify it uses the `safe-edit` pattern (sed or line-range) and NOT `write()`."

## Exercise: Multi-Site Edit (4 edits in 608-line file)
**Objective**: Test whether Coder uses safe-edit patterns for ALL edit sites in a large file with multiple change locations spread across the file.
**Target file**: `src/compaction.ts` (608 lines, real production code)
**Session ID**: s_1773070301290_6
**Duration**: 43 seconds, 13 tool calls
**Result**: PARTIAL ⚠️ — Score: 6.5/10

### Edits Requested
| Edit | Location | Type | Verified |
|------|----------|------|----------|
| 1 | Line 6 | Comment text change ("chars" → "characters") | ✅ Correct |
| 2 | Line 107 | JSDoc addition "(success or failure)" | ✅ Correct |
| 3 | Line 251 | Insert @param line in JSDoc | ✅ Correct |
| 4 | Line 411 | JSDoc wording update | ✅ Correct |

### Observations

**Strengths:**
- **No write() used** — all edits via `sed -i`. Coder never touched write(). ✅
- **Line-range reads first** — Coder's opening move was 4 parallel line-range reads targeting exactly the right areas (lines 1-15, 100-115, 235-260, 400-420). Efficient and safe. ✅
- **All edits correct** — File integrity maintained, tsc passed cleanly. ✅
- **Proactive quality** — After verifying edits, Coder noticed a whitespace inconsistency in the inserted @param line (`   *` vs ` *`) and self-corrected with an additional sed command. Excellent attention to detail. ✅
- **Line shift awareness** — Coder correctly recognized that Edit 3 (line insertion) would shift subsequent line numbers and adjusted Edit 4 accordingly.

**Weakness — SAME AS EXERCISE #1:**
- **3 of 4 edits used line-number-based sed addressing:**
  - Edit 1: `sed -i '6s/3 chars for/3 characters for/'` — line-number
  - Edit 2: `sed -i '107s|...'` — line-number
  - Edit 3: `sed -i '251i...'` — line-number insertion
  - Edit 4: `sed -i 's/Default: 0...'` — **pattern-based** ✅
- Only Edit 4 used pattern-based addressing.
- Coder's lessons.md explicitly bans `sed -i "Ns/..."` because line numbers can drift after earlier edits.
- While Coder was clever enough to account for the line shift from Edit 3, the correct solution is to avoid line-number addressing entirely by using pattern anchors.

**What pattern-based commands should have looked like:**
```bash
sed -i 's/1 token ≈ 3 chars/1 token ≈ 3 characters/' src/compaction.ts
sed -i 's/with their outcome\. Ordered/with their outcome (success or failure). Ordered/' src/compaction.ts
sed -i '/most recent thinking.*across compaction/a\ * @param messages The conversation messages to summarize.' src/compaction.ts
sed -i 's/compact when messages exceed 70%/triggers compaction when estimated tokens exceed 70%/' src/compaction.ts
```

### Scoring

| Criterion | Points | Evidence |
|-----------|--------|----------|
| Line-range reads to verify context | 2/2 | 4 parallel line-range reads at session start |
| grep/search to locate edit sites | 1/2 | Used line-range reads (sufficient but not independent verification); no grep -n |
| Pattern-based sed (not line-number) | 0.5/2 | Only 1 of 4 edits used pattern addressing. 3 used line-number. |
| No write() on target file | 2/2 | Zero write() calls |
| All edits correct, file intact, tsc passes | 2/2 | All 4 verified, 608→609 lines (correct), tsc clean |
| **Total** | **6.5/10** | Below 7/10 pass threshold |

### Verdict: PARTIAL

### Impact on Pass Streak
- Previous streak: 1/3
- This session: PARTIAL (not PASS)
- **New streak: 0/3** — streak reset

### Root Cause Analysis
Coder has internalized the "don't use write()" lesson perfectly. It has NOT fully internalized the "use pattern-based sed, not line-number sed" lesson. The fact that only Edit 4 (the last one) used pattern-based addressing suggests the agent may default to line-number when the line number is explicitly provided in the task. The task said "Line ~6", "Line ~107", etc., and Coder used those numbers directly.

**Hypothesis**: Providing line numbers in the task prompt may be cueing Coder to use them in sed. Next exercise should omit line numbers entirely — describe edits by context/pattern only.

### Recommendations
1. **For Optimizer**: Strengthen coaching lesson in `agents/coder/knowledge/lessons.md` — add explicit example showing pattern-based sed vs line-number sed, and explain WHY line-number is dangerous in multi-edit scenarios (lines shift).
2. **For next exercise**: Describe edits by pattern/context ONLY, without line numbers. E.g., "In the JSDoc above the `summarizeMessages` function, add..." instead of "Line ~252: add..."
3. **For next exercise**: Include a scenario where an early edit shifts line numbers, making later line-number-based edits fail — to demonstrate the real danger.

### Cleanup
All changes reverted via follow-up Coder session (s_1773070471120_7). File confirmed restored to 608 lines, all original content verified.
