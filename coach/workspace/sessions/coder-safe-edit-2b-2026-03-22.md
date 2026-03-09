# Coaching Report: Coder — 2026-03-22 (Safe-Edit Exercise #2b: Pattern-Only Prompts)

## Session Summary
- Agent: coder
- Exercises run: 1
- Passed: 1
- Partial: 0
- Failed: 0
- Interventions: 0

## Agenda Source
Todo.md: "Coach Coder — Exercise 2b (pattern-only prompts) — Re-run multi-site edit but describe edits by context/pattern ONLY, no line numbers."

## Exercise: Pattern-Only Multi-Site Edit (4 edits in 285-line file)
**Objective**: Test whether Coder uses pattern-based sed when the task prompt contains NO line numbers. This tests the hypothesis from Exercise #2 that line numbers in the prompt cue line-number-based sed.
**Target file**: `src/handoff.ts` (285 lines, real production code)
**Session ID**: s_1773071717540_9
**Duration**: 40 seconds, 7 tool calls
**Result**: PASS ✅ — Score: 9/10

### Edits Requested (all described by context, zero line numbers)
| Edit | Description | Verified |
|------|-------------|----------|
| 1 | MAX_RESPONSE_LENGTH JSDoc: add "(last assistant message)" | ✅ Correct |
| 2 | HandoffOptions.includeErrors JSDoc: add "from failed tool calls" | ✅ Correct |
| 3 | extractErrors JSDoc: "the first few errors" → "up to MAX_ERRORS errors" | ✅ Correct |
| 4 | summarizeForHandoff status line: prepend session ID | ✅ Correct |

### Observations

**Strengths:**
- **All 4 edits used pattern-based sed** ✅✅✅✅ — Zero line-number addressing!
  - Edit 1: `sed -i "s|the agent's final response text in the handoff summary|...|"` — pattern
  - Edit 2: `sed -i 's|Include error summaries\. Default: true\.|...|'` — pattern
  - Edit 3: `sed -i 's|Captures the first few errors that occurred during the session|...|'` — pattern
  - Edit 4: `sed -i 's#\*\*Status:\*\* ${data\.status}...#...|...'` — pattern (switched to # delimiter to avoid | conflict)
- **No write() used** — all edits via sed. ✅
- **Full file read first** — Coder read the entire file to understand context before editing. ✅
- **All edits correct** — tsc --noEmit passed cleanly. ✅
- **Delimiter awareness** — When Edit 4 had a `|` in the replacement text that conflicted with the `|` delimiter, Coder switched to `#` as delimiter. Shows understanding of sed mechanics.
- **Self-recovery** — First attempt failed (pipe character conflict). Coder diagnosed the error and fixed the command on second try.
- **Verification** — Used grep -n to confirm all 4 changes, then tsc --noEmit.

**No weaknesses observed in this exercise.**

### Scoring

| Criterion | Points | Evidence |
|-----------|--------|----------|
| Full file read to verify context | 2/2 | Read entire file before editing |
| Pattern-based sed (not line-number) | 2/2 | All 4 edits used pattern addressing |
| No write() on target file | 2/2 | Zero write() calls |
| All edits correct, file intact, tsc passes | 2/2 | All 4 verified, tsc clean |
| Error handling / resilience | 1/2 | Recovered from delimiter conflict, but needed 2 attempts |
| **Total** | **9/10** | Above 7/10 pass threshold |

### Verdict: PASS ✅

### Impact on Pass Streak
- Previous streak: 0/3 (reset after PARTIAL on exercise #2)
- This session: PASS
- **New streak: 1/3**

### Hypothesis Confirmed ✅
**Exercise #2 hypothesis**: "Providing line numbers in the task prompt may be cueing Coder to use them in sed."

**Result**: Confirmed. When the exact same type of exercise (multi-site JSDoc edits in a production file) was described without any line numbers, Coder used pattern-based sed for **all 4 edits**. In Exercise #2, where line numbers were given ("Line ~6", "Line ~107", etc.), Coder used line-number sed for **3 of 4 edits**.

This means:
1. Coder HAS internalized the pattern-based sed skill (it can do it)
2. Coder defaults to line-number sed when line numbers are prominently available in context
3. The fix is partly environmental (don't give line numbers) and partly agent training (prefer patterns even when line numbers are available)

### Recommendations
1. **For Optimizer**: Add to Coder's lessons.md — "Even when line numbers are visible in context, prefer pattern-based sed. Line numbers can drift after multi-site edits."
2. **Next exercise (2c)**: Test the harder case — provide line numbers in the prompt BUT instruct Coder to use patterns. This tests whether the lesson is truly internalized vs just environmental.
3. Coder is on track for graduation if exercise 2c passes.

### File Reverted
All changes to `src/handoff.ts` were reverted by a follow-up Coder session (s_1773071814575_10). File is back to original state.
