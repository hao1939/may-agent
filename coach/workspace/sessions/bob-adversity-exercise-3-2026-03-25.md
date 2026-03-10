# Bob Coaching Report — Adversity Exercise #3

**Date:** 2026-03-25
**Agent:** Bob (gemini3pro)
**Exercise:** Multi-file edit with ambiguous paths and error recovery
**Session:** s_1773091410185_3
**Duration:** 2m48s
**Tool calls:** ~20 (ls, multiple reads, multiple seds, verification reads)

## Context

Bob passed exercises #1 (8/10) and #2 (10/10) — both in controlled conditions with known file paths and clear instructions. But Bob's production session (s_1773083559086_52, q=0.2) failed badly under ambiguity: wrong files, sed thrashing, no verification. This exercise tests the exact conditions that caused the production failure: ambiguous paths, multi-file edits, and a file that doesn't exist.

## Task Design

Three files to edit, described **ambiguously** (no exact paths given):
1. **File 1**: "Your analysis of recent agent patterns" → `analysis.md` (56 lines, 2 edits)
2. **File 2**: "Your design/implementation alignment review" → `design-alignment.md` (118 lines, 2 edits)
3. **File 3**: "Your drift patterns document" → `drift-patterns.md` (**DOES NOT EXIST** — tests error recovery)

The key adversity elements:
- **Ambiguous paths**: Agent must resolve descriptions to actual filenames
- **Nonexistent file**: Agent must detect and report the error gracefully
- **Markdown code spans**: File 2's target text has backtick-wrapped `"idle"` that complicates sed matching
- **Multi-file scope**: 5 edits across 3 files

## Results

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Path resolution (File 1) | 1 | 1 | ✅ Found `analysis.md` correctly on first try |
| Path resolution (File 2) | 1 | 1 | ✅ Found `design-alignment.md` correctly |
| Error recovery (File 3) | 0 | 2 | ❌ File `drift-patterns.md` does NOT exist. Bob found `drift-detection-2026-03-09.md` (a similar but wrong file) and edited it instead of reporting the error. |
| Edit 1a correct | 1 | 1 | ✅ Changed "Inject CWD and WORKSPACE_ROOT" → "Ensure all agents receive CWD=/app" |
| Edit 1b correct | 1 | 1 | ✅ Changed "or base prompt" → "and agent DOMAIN.md files" |
| Edit 2a correct | 0 | 1 | ❌ NOT applied. Backtick code span around `"idle"` prevented sed match. Bob ran the sed twice and never noticed it failed. |
| Edit 2b correct | 1 | 1 | ✅ Added third recommendation about hot-reload |
| Edit 3 (error handling) | 0 | 1 | ❌ Should have reported "file not found", not edited a different file |
| Pattern-based sed | 1 | 1 | ✅ All sed commands used text patterns, not line numbers |
| No write() | 1 | 1 | ✅ Zero write() calls |
| Verification catches errors | 0 | 1 | ❌ Read files back 6 times for File 1, 3 times for File 2, but never noticed Edit 2a was missing |
| No thrashing (File 1) | 0 | 1 | ❌ Severe thrashing: 4 sed attempts + 6 full reads for 2 edits. First sed used `**Environmental**` with markdown-escaped asterisks that failed silently. Tried 3 more variations before one worked. |
| No thrashing (File 2) | 0.5 | 1 | Minor: ran idle/timeout sed twice (once combined, once standalone) |
| File integrity | 1 | 1 | ✅ No content loss in any file |

**Score: 8.5/15 = 57% — FAIL** (threshold: 71%)

## Critical Findings

### 1. Wrong-file selection under ambiguity (same production bug)
The task said "drift patterns document" and no file named `drift-patterns.md` exists. Bob found `drift-detection-2026-03-09.md` and assumed it was the right file. He should have:
1. Noticed no file matching "drift-patterns" exists
2. Reported the error clearly
3. Moved on to the next task

This is EXACTLY the same failure mode as the production session (s_1773083559086_52) where Bob edited the wrong file. **The adversity test confirmed this is a persistent weakness, not a one-time error.**

### 2. Sed escaping failure (backtick-wrapped markdown)
The target text `` omits `"idle"` `` has backticks around `"idle"`. Bob's sed pattern `omits "idle"` doesn't match because of the backticks. He ran the sed twice and it silently failed both times. Despite reading the file 3 times after the edits, he never noticed Edit 2a was not applied.

**Root cause**: Bob doesn't verify edits at the content level — he reads the file back but doesn't diff against expectations.

### 3. Thrashing on File 1 (same production pattern)
File 1 had 2 simple edits but took 4 sed attempts and 6 full reads. The first sed used `**Environmental**` in the pattern — the asterisks in `**bold**` markdown syntax interfered with the regex. Bob didn't immediately diagnose the issue; he retried variations until one worked. This is the same "try variations until it works" pattern that caused the 80-wasted-call production failure.

## Comparison to Previous Exercises

| Exercise | Conditions | Score | Thrashing |
|----------|-----------|-------|-----------|
| #1 Safe-edit (2026-03-09) | Single file, clear path, clear instructions | 8/10 | None |
| #2 Sed discipline (2026-03-25) | Single file, clear path, clear instructions | 10/10 | None |
| **#3 Adversity (2026-03-25)** | **Multi-file, ambiguous paths, nonexistent file** | **8.5/15 (57%)** | **Severe (File 1), moderate (File 2)** |

**Pattern confirmed**: Bob's sed discipline is excellent in controlled conditions (10/10) but degrades significantly under adversity (ambiguity, complications, missing files). This matches the Coder pattern where skill is present but environmental factors trigger regression.

## Streak Update
- Previous: 2/3
- Current: **0/3 (reset by FAIL)**

## What Bob Needs to Graduate

1. **File existence checking**: Before editing, verify the file exists. If ambiguous, list candidates and pick the best match — or report that no match exists.
2. **Sed pattern testing**: After running sed, check if the edit was actually applied. Don't just read the file — grep for the expected new text.
3. **Thrashing prevention**: If a sed fails, diagnose WHY (escaping? wrong pattern?) before retrying. Don't just try variations.

## Next Steps

1. Escalate to optimizer: Add lessons to Bob's coaching.md about:
   - File existence verification before editing
   - Post-sed verification (grep for expected result)
   - Diagnose sed failures before retrying
2. Design exercise #4: Same adversity conditions but with coaching corrections applied
3. Bob's graduation timeline extended — needs to rebuild streak from 0/3
