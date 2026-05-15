# QA C1.1 (read-before-edit) Root Cause Analysis

**Date**: 2026-04-12  
**Analyst**: May  
**Convention**: C1.1 — Every `edit()` must be preceded by a `read()` of the same file  
**Agent**: QA  
**Compliance**: 78.3% (7d), 68.1% (recent 3.5d) — worst in fleet by >10pp  

## Executive Summary

QA's C1.1 violations come from **two specific files** in a **consistent behavioral pattern**. This is not random sloppiness — it's a systematic workflow bug where QA uses `bash("tail -5 ...")` instead of `read()` to get context before editing. The convention checker (correctly) doesn't count bash tail as a read.

## Data

### Violation breakdown by file (all-time, 79 total failures)

| File | Count | % of violations |
|------|-------|----------------|
| `agents/qa/workspace/journal.md` | 44 | 55.7% |
| `agents/qa/workspace/unreviewed-findings.md` | 16 | 20.3% |
| `agents/qa/SOUL.md` | 3 | 3.8% |
| `agents/qa/workspace/last-reviewed-commit.txt` | 3 | 3.8% |
| Other (review-req, etc.) | 13 | 16.5% |

### Daily rates (last 7 days)

| Day | Pass Rate | Notes |
|-----|-----------|-------|
| Day -0 (today) | 93.1% (27/29) | Mostly using read() now |
| Day -1 | **14.9% (7/47)** | 40 journal.md violations — massive regression |
| Day -2 | 97.9% (47/48) | Nearly clean |
| Day -3 | 91.7% (33/36) | Decent |
| Day -4 | 100.0% (46/46) | Perfect |
| Day -5 | 80.6% (25/31) | unreviewed-findings violations |
| Day -6 | 81.3% (13/16) | Mixed |

### Trend

QA compliance **oscillates wildly** between 14.9% and 100% on a day-to-day basis. This is characteristic of a **non-internalized behavior** — QA sometimes follows the correct pattern and sometimes reverts to the old pattern, with no consistent learning.

## Root Cause #1: journal.md append workflow uses `tail` instead of `read()`

**Pattern (failing sessions):**
```
bash("tail -5 agents/qa/workspace/journal.md")  // ← gets context via bash
edit("agents/qa/workspace/journal.md", ...)       // ← C1.1 VIOLATION: no read() preceded this
```

**Pattern (passing sessions):**
```
bash("wc -l agents/qa/workspace/journal.md")     // ← gets line count
read("agents/qa/workspace/journal.md", {offset: N, limit: 5})  // ← proper read()
edit("agents/qa/workspace/journal.md", ...)       // ← C1.1 PASS: read() preceded this
```

**Evidence**: Compared tool sequences in sessions:
- `s_1775847219584_1011` (FAIL): Uses `tail -5`, no `read()` before edit
- `s_1775876020196_1192` (FAIL): Uses `tail -5`, no `read()` before edit  
- `s_1775949821913_1692` (PASS): Uses `wc -l` + `read(offset, limit)` before edit

QA's heartbeat already instructs the correct pattern (`wc -l` → `read(offset, limit)` → `edit()`), but QA only follows it ~50% of the time. The `tail` shortcut is a natural LLM behavior that achieves the same functional result but violates C1.1.

## Root Cause #2: unreviewed-findings.md uses `write()` then `edit()` without `read()`

**Pattern (failing sessions):**
```
write("agents/qa/workspace/unreviewed-findings.md", <full content>)  // ← overwrites the file
edit("agents/qa/workspace/unreviewed-findings.md", ...)              // ← C1.1 VIOLATION: no read()
```

**Why**: After `write()`, QA knows the file contents (it just wrote them). But the convention checker correctly requires a `read()` call — the agent should verify what landed before editing it further.

**Note**: The current checker code exempts `write()` from C1.1 (only `edit()` is checked). But the logged violations show earlier versions of the checker flagged both. The remaining violations are from sessions where QA called `write()` first, then `edit()` to modify — the `edit()` has no preceding `read()`.

## Root Cause #3 (minor): Behavioral oscillation — not internalized

The wild day-to-day swings (14.9% → 97.9% → 93.1%) indicate QA hasn't **internalized** C1.1 as a habit. It's following instructions when they're fresh in context, but reverting to `tail` when:
- The journal.md is long (2000+ lines) and QA optimizes for speed
- The session starts with non-heartbeat work and the heartbeat instructions aren't top-of-mind
- The model compaction drops the specific "use read() not tail" instruction

## Intervention Recommendations

### P0: Harden the journal.md append workflow in QA's heartbeat
The heartbeat already has the correct instructions, but they're in a multi-step description QA sometimes skips. **Convert the instructions to a mandatory code block** that QA copies verbatim, like:

```
⚠️ MANDATORY: Use this EXACT sequence for journal appends:
1. bash("wc -l agents/qa/workspace/journal.md")
2. read("agents/qa/workspace/journal.md", {offset: N-4, limit: 5})  // ← REQUIRED for C1.1
3. edit("agents/qa/workspace/journal.md", {oldText: <last lines>, newText: <last lines + new entry>})

NEVER use tail/head to read the file. The convention checker only recognizes read() calls.
```

### P1: Add context-patch for unreviewed-findings.md
QA should `read()` unreviewed-findings.md before editing it, even after a `write()`. Add a coach-deployed context patch:
> "After writing to unreviewed-findings.md, read it back before any subsequent edit()."

### P2: Consider checker adjustment (low priority)
The convention checker could optionally count `bash("tail -N <file>")` as equivalent to `read()` for C1.1 purposes. This would eliminate false positives where the agent functionally did read the file. However, this weakens the convention — `read()` is strictly better than `tail` because it provides paginated, structured output. **Keep the checker strict; fix the behavior instead.**

## Conclusion

QA's C1.1 problem is **not laziness or ignorance** — it's a specific workflow bug where `bash("tail -5")` substitutes for `read()`. The fix is targeted: harden the journal append instructions and add a context patch for unreviewed-findings.md. Expected improvement: from 78% → 95%+ within 2 days of intervention.
