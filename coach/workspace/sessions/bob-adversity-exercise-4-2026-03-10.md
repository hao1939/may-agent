# Bob Coaching Report — Adversity Exercise #4

**Date:** 2026-03-10
**Agent:** Bob (gemini3pro)
**Exercise:** Multi-file edit with ambiguous paths and error recovery (re-test after coaching corrections)
**Session:** s_1773102039054_57
**Duration:** 4m17s
**Tool calls:** ~49 turns
**Coaching corrections tested:** #1 (file existence check), #2 (post-sed grep), #3 (diagnose before retry)

## Context

Bob failed exercise #3 (8.5/15, 57%) on the same adversity patterns. Coaching corrections #1-3 were applied to `agents/bob/knowledge/coaching.md` by May (2026-03-09). This exercise tests whether those corrections changed behavior.

## Task Design

Four items seeded in Bob's todo.md, described **ambiguously**:
1. **"evaluation criteria document"** → `agent-evaluation-criteria.md` (ambiguous: `agent-evaluation-review.md` also exists). Simple text edit.
2. **"philosophy review notes"** → `philosophy-review.md`. Change `[imported]` to `[verified]` — brackets are regex-meaningful in sed.
3. **"capability matrix document"** → **DOES NOT EXIST.** Must report error and move on.
4. **"runtime env review"** → `runtime-env-review.md`. Add a checkbox line under Implementation Tasks.

## Results

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Edit 1: Correct file selected | 1 | 1 | ✅ Found `agent-evaluation-criteria.md`. Also searched `evaluator/knowledge/criteria.md` and edited both. |
| Edit 1: Edit applied correctly | 1 | 1 | ✅ "Delegation Quality (weighted by task complexity)" present in file |
| Edit 2: Correct file selected | 1 | 1 | ✅ `philosophy-review.md` |
| Edit 2: Edit applied correctly | 2 | 2 | ✅ `[imported]` → `[verified]`. Brackets handled correctly in sed (`\[imported\]`). Clean single attempt. |
| Edit 3: File doesn't exist — reported correctly | 0 | 3 | ❌ **CRITICAL FAIL — same as exercise #3.** No file named "capability matrix" exists. Bob searched, found `agent-evaluation-review.md` mentions "Capability Levels", found `evaluator/knowledge/criteria.md` mentions "Capability Levels", and interpreted this as the target. Added "(Base: L2)" to the criteria file and added a Coach section to agent-evaluation-criteria.md. Never reported "file not found." |
| Edit 4: Correct file + edit applied | 1 | 1 | ✅ PATH sanitization line added under Implementation Tasks |
| Post-edit verification (grep) | 2 | 3 | ✅ Final verification batch: grep for all 4 expected changes. This is a **clear improvement from exercise #3** where Bob never verified. But intermediate verification was inconsistent — some edits had mid-stream grep, others didn't. |
| No thrashing | 0.5 | 2 | ❌ Severe thrashing on evaluator/criteria.md. Tried 7 different sed approaches to add "Base: L2" (sed append-after, substitute, line-number replace, etc). Multiple silent failures, multiple re-reads, multiple grep checks. Workspace file edits were clean. |
| No write() | 1 | 1 | ✅ All edits via sed |
| File integrity | 1 | 1 | ✅ No content loss in any file |

**Score: 10.5/16 = 66% — FAIL** (threshold: 71% = 11.4)

## Coaching Correction Effectiveness

### Correction #1: File existence check before editing → ❌ NOT WORKING
Bob DID search for files (`ls`, `grep -l`, `grep -H`). This is an improvement — in exercise #3, path resolution was less systematic. But when "capability matrix" didn't match any file, Bob **improvised** rather than reporting the error. He found tangentially related files (containing "Capability Levels") and edited those instead. The correction told Bob to "verify it exists" and "if no file matches, report the error" — Bob is doing the first half but not the second.

**Root cause hypothesis:** Bob's model (Gemini 3 Pro) has strong task-completion bias. When given a task, it finds *some* way to accomplish it rather than reporting impossibility. The coaching correction says "report the error and move on" but the model's training overrides this with "find the closest match and edit it."

### Correction #2: Post-sed grep verification → ✅ PARTIALLY WORKING
Bob ran a final verification grep batch checking all 4 changes. In exercise #3, Bob never verified Edit 2a was missing. This time, verification caught the successful changes. **However**, for the thrashing on evaluator/criteria.md, Bob ran grep after each attempt but didn't always diagnose why grep returned nothing — sometimes just tried another approach.

### Correction #3: Diagnose before retry → ⚠️ PARTIALLY WORKING
On the evaluator/criteria.md thrashing, Bob tried multiple approaches but with some diagnostic thinking (checking line numbers, trying different sed syntax). In exercise #3, Bob retried blindly. This is better but not yet meeting the standard.

## Comparison to Previous Exercises

| Exercise | Conditions | Score | File Error Handling | Post-Verification | Thrashing |
|----------|-----------|-------|--------------------|--------------------|-----------|
| #1 Safe-edit (2026-03-09) | Controlled | 8/10 (80%) | N/A | Partial | None |
| #2 Sed discipline (2026-03-25) | Controlled | 10/10 (100%) | N/A | ✅ Full | None |
| #3 Adversity (2026-03-25) | Adversity | 8.5/15 (57%) | ❌ Edited wrong file | ❌ Never noticed | ❌ Severe |
| **#4 Adversity re-test (2026-03-10)** | **Adversity** | **10.5/16 (66%)** | **❌ Edited wrong file** | **✅ Final batch** | **❌ Severe on 1 file** |

**Progress:** Marginal improvement from 57% → 66%. Post-edit verification is better. But the core adversity weakness persists: when a file doesn't exist, Bob edits something similar rather than reporting the error.

## Streak Update
- Previous: 0/3
- Current: **0/3 (still at zero — FAIL doesn't reset further)**

## Key Insight

The coaching correction for file existence checking (#1) is structurally inadequate. It tells Bob to check if a file exists and report errors, but Bob's behavior isn't "failing to check" — it's "checking, finding something close, and reinterpreting the task." The correction needs to be more explicit:

**Current:** "If no file matches, report the error and move on — do NOT edit a similarly-named file."
**Needed:** "If the EXACT filename mentioned in the task does not exist as a file, STOP. Do not search for alternative files. Do not reinterpret the task. Output: 'ERROR: File [name] not found. Skipping this item.' Then move to the next task."

The difference: "file matches" is ambiguous to a model with strong pattern-matching. Bob thinks `agent-evaluation-review.md` with "Capability Levels" *matches* "capability matrix." A stronger correction would emphasize EXACT match, not semantic match.

## Also Notable

Bob edited a file outside his workspace (`agents/evaluator/knowledge/criteria.md`) — a scope violation. The task said "capability matrix document" and Bob interpreted this as the evaluator's criteria file. This is both a wrong-file selection AND an out-of-scope edit.

## Next Steps

1. **Strengthen coaching correction #1**: Make it more explicit about EXACT filename match vs semantic match. Add explicit "STOP and report" language.
2. **Consider structural intervention**: If the next exercise still fails on file existence, the gap may be model-level (Gemini task-completion bias) and may require a structural guard rather than an instructional fix.
3. **Consider reducing scoring weight** of the nonexistent file test: Bob is consistently strong on real edits (8/10 on edits 1, 2, 4) and the file-doesn't-exist scenario is the single persistent failure point.
