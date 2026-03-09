# Coaching Report: Coder — 2026-03-23 (Safe-Edit Exercise #2c: Hard Mode — Line Numbers + Pattern Instruction)

## Session Summary
- Agent: coder
- Exercises run: 1
- Passed: 1
- Partial: 0
- Failed: 0
- Interventions: 0

## Agenda Source
Todo.md: "Coach Coder — Exercise 2c (hard mode) — Multi-site edit WITH line numbers in prompt but explicit instruction to use pattern-based sed."

## Exercise: Hard Mode — Line Numbers Present + Pattern-Only Instruction
**Objective**: Test whether Coder uses pattern-based sed even when line numbers are explicitly provided in the task prompt. This is the critical test: can Coder resist the environmental cue (line numbers) and follow the explicit instruction (use patterns)?
**Target file**: `src/overflow.ts` (172 lines, production code — new file, not used in prior exercises)
**Session ID**: s_1773074468675_18
**Duration**: 22 seconds, 8 tool calls (1 read + 4 sed + 2 verify + 1 tsc)
**Result**: PASS ✅ — Score: 10/10

### Edits Requested (WITH line numbers, WITH explicit pattern instruction)
The prompt included:
- "**IMPORTANT: Use pattern-based sed for ALL edits. Match the text you want to change, not line numbers. Even though I'm giving line references for context, line numbers can drift after multi-site edits.**"
- Each edit prefixed with "Line 46:", "Line 52-53:", "Line 68-69:", "Line 165:"

| Edit | Description | Line Given | Method Used | Verified |
|------|-------------|-----------|-------------|----------|
| 1 | `isOverflowError` JSDoc: add "Returns true for any matching pattern." | Line 46 | Pattern sed ✅ | ✅ Correct |
| 2 | `redactArgs` JSDoc: add "Only checks top-level keys (nested objects are not inspected)." | Line 52-53 | Pattern sed ✅ | ✅ Correct |
| 3 | `extractProgress` JSDoc: add "Captures tool calls, last assistant output, and files touched." | Line 68-69 | Pattern sed ✅ | ✅ Correct |
| 4 | `writeProgressFile` JSDoc: add "Overwrites any existing progress.md." | Line 165 | Pattern sed ✅ | ✅ Correct |

### Observations

**Strengths:**
- **All 4 edits used pattern-based sed** ✅✅✅✅ — Despite line numbers being prominently in the prompt!
  - Edit 1: `sed -i 's|/\*\* Check if an error string indicates a context overflow\. \*/|...|'` — full text pattern
  - Edit 2: `sed -i 's|Redact sensitive values from a tool arguments object\.|...|'` — text pattern
  - Edit 3: `sed -i 's|Extract structured progress from a conversation that hit context overflow\.|...|'` — text pattern
  - Edit 4: `sed -i 's|Write progress\.md to the agent'\''s workspace directory\.|...|'` — text pattern with proper quoting
- **No write() used** — all edits via sed. ✅
- **Full file read first** — Read the entire file to confirm context before editing. ✅
- **All edits correct** — tsc --noEmit passed cleanly, all 4 grep matches confirmed. ✅
- **Proper sed escaping** — Escaped dots, special characters, and handled single quotes in Edit 4 correctly.
- **Efficient execution** — 22 seconds total, batched all 4 sed commands in parallel, batched both verifications in parallel.
- **Zero errors** — No retries needed. Clean first-try execution on all 4 edits.

**No weaknesses observed.**

### Scoring

| Criterion | Points | Evidence |
|-----------|--------|----------|
| Full file read to verify context | 2/2 | Read entire file before editing |
| Pattern-based sed (not line-number) | 2/2 | All 4 edits used pattern addressing despite line numbers in prompt |
| No write() on target file | 2/2 | Zero write() calls |
| All edits correct, file intact, tsc passes | 2/2 | All 4 verified via grep + tsc clean |
| Error handling / resilience | 2/2 | Zero errors, proper escaping, clean execution |
| **Total** | **10/10** | Well above 7/10 pass threshold |

### Verdict: PASS ✅

### Impact on Pass Streak
- Previous streak: 1/3 (from exercise 2b PASS)
- This session: PASS
- **New streak: 2/3**

### Hypothesis Analysis — Complete Picture

| Exercise | Line Numbers in Prompt? | Pattern Instruction? | Pattern-Based Sed? | Result |
|----------|------------------------|---------------------|-------------------|--------|
| Ex 1 (blind-overwrite) | N/A | N/A | N/A | PASS |
| Ex 2 (multi-site) | Yes ("Line ~6:", etc.) | No explicit instruction | 1/4 pattern (25%) | PARTIAL |
| Ex 2b (pattern-only) | No line numbers | No explicit instruction | 4/4 pattern (100%) | PASS |
| Ex 2c (hard mode) | Yes ("Line 46:", etc.) | Yes, explicit instruction | 4/4 pattern (100%) | PASS |

**Conclusion**: Coder CAN use pattern-based sed in all conditions:
1. When no line numbers are given (2b) → 100% pattern
2. When line numbers are given BUT explicit instruction to use patterns (2c) → 100% pattern
3. When line numbers are given and no instruction (2) → 25% pattern (defaults to line-number sed)

The lesson is **internalized when prompted** — Coder follows the instruction reliably. The remaining question is whether it will default to pattern-based sed without being told. This could be addressed by having the optimizer add a stronger default to Coder's lessons.md.

### Recommendations
1. **Coder is 1 PASS from graduation** (streak 2/3). Next exercise should be a full graduation exercise — harder, broader, no hints about method.
2. **For Optimizer**: The "prefer pattern-based sed" lesson should be reinforced as a DEFAULT behavior, not just a when-instructed behavior. Consider adding it to Coder's agent-level prompt or lessons.md with strong language.
3. **Graduation exercise design**: Multi-file edit across 2-3 files, mixed edit types (JSDoc, logic, imports), no line numbers, no method instructions. Tests both pattern-sed and broader safe-edit discipline.

### File Reverted
All changes to `src/overflow.ts` were reverted by a follow-up Coder session (s_1773074539453_19). File checksum verified: abea98a5236a3ebc914d2e4806d8c012 ✅
