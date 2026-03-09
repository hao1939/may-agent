# Bob Coaching Report — Sed Discipline Exercise #2

**Date:** 2026-03-25
**Agent:** Bob (gemini3pro)
**Exercise:** Multi-edit sed discipline — 4 pattern-based edits on a 66-line markdown file
**Session:** s_1773086094977_65
**Duration:** 42 seconds
**Tool calls:** 3 (read → 4x sed batched → verification read)

## Context

Bob's recent production session (s_1773083559086_52) scored q=0.2 with 80 wasted calls — severe sed thrashing, toggling the same heading text back and forth, path confusion, no verification. This was a regression from the safe-edit exercise Bob passed on 2026-03-09 (8/10).

This exercise tests whether Bob can execute controlled multi-step document edits without thrashing.

## Task

Edit `agents/coach/workspace/exercises/bob-sed-discipline-test.md` (66 lines) with 4 changes:
1. Change "plain text" → "structured markdown" (section 1.1)
2. Change "updates agent config" → "updates agent knowledge files" (section 2.1)
3. Replace a sentence about token expiry with a longer one (section 3.1)
4. Append a new bullet to the Open Questions list (section 4)

Rules: pattern-based sed only, read-after-write verification, no write().

## Results

| Criterion | Score | Notes |
|-----------|-------|-------|
| Pattern-based sed | 3/3 | All 4 sed commands match text content, not line numbers |
| All edits correct | 2/2 | All 4 edits verified in output file |
| No write() | 1/1 | Zero write() calls |
| Read-after-write verification | 2/2 | Full file read after all edits, confirmed integrity |
| No thrashing | 1/1 | Zero wasted calls, zero retries |
| File integrity | 1/1 | 67 lines (66 + 1 added), all content intact |

**Score: 10/10 — PASS**

## Analysis

### What went right
- **Batched all 4 sed commands** in a single exec call — extremely efficient
- **Pattern matching was precise** — matched full text strings, used `/a` for append
- **Verification was immediate** — read full file after edits, confirmed all 4 changes
- **Zero thrashing** — no repeated/toggled commands, no retries, no path confusion

### Comparison to recent failure (s_1773083559086_52)
The production session that scored q=0.2 had 80 wasted calls with sed thrashing. Key differences:
1. **Task clarity**: This exercise had clear, specific instructions. The production task was more ambiguous ("fix drift issues").
2. **File complexity**: Production task involved multiple files with unclear paths. This exercise: single known file.
3. **Session termination**: Production session ended with token expiry (Gemini API), possibly causing confusion mid-edit.
4. **Root cause classification**: The production failure was likely **Agent (execution discipline under ambiguity) + Infrastructure (token expiry)**. The controlled exercise confirms the sed SKILL is present.

### Key insight
Bob can execute safe-edit discipline perfectly in controlled conditions. The production failure was triggered by:
- Ambiguous file paths (convention file location unclear)
- Token expiry mid-session (API authentication error)
- Complex multi-file task with unclear scope

This matches the Coder coaching pattern: the skill is present, but environmental factors (ambiguity, pressure, errors) cause regression. The coaching approach should focus on **robustness under adversity**, not basic skill training.

## Streak Update
- Previous: 1/3 (safe-edit exercise PASS, 2026-03-09)
- Current: 2/3

## Next Steps
1. Design exercise #3 — **adversity mode**: ambiguous file paths, multi-file edits, one file that doesn't exist (to test error recovery). This tests the exact conditions that caused the production failure.
2. If exercise #3 passes → Bob at 3/3 → graduation candidate.
