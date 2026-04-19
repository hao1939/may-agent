# Optimizer C1.1 (read-before-edit) Root Cause Analysis

**Date**: 2026-04-13  
**Analyst**: May  
**Convention**: C1.1 — Every `edit()` must be preceded by a `read()` of the same file  
**Agent**: Optimizer  
**Compliance**: 80.5% (24h), 76.1% (all-time) — worst in fleet  

## Executive Summary

Optimizer's C1.1 violations are **100% concentrated in two files**: `DELIVERABLES_CHECKLIST.md` (73%) and `todo.md` (27%). The root cause is a **skill-introduced workflow pattern** — the deliverable-checklist skill (deployed Apr 10) teaches optimizer to create a checklist with `write()` then mark items complete with `edit()`, but the optimizer skips the `read()` between these operations. A prior fix (commit `f3f6765c`, Apr 12) added explicit `read()` instructions to the skill text — **it did not work**. 13 violations continued post-fix.

This is the same "instruction non-internalization" pattern seen in QA's C1.1 regression: **skill text instructions are insufficient to change behavior**. The optimizer knows what to do (the skill is clear) but doesn't do it consistently.

## Data

### Violation Breakdown by File (all-time, 189 total failures)

| File | Count | % of violations |
|------|-------|----------------|
| `DELIVERABLES_CHECKLIST.md` (bare path) | 21 | 11.1% |
| `agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md` | 7 | 3.7% |
| **Subtotal: DELIVERABLES_CHECKLIST.md** | **28** | **14.8%** |
| `agents/optimizer/workspace/todo.md` | 14 | 7.4% |
| `/app/agents/optimizer/workspace/todo.md` | 1 | 0.5% |
| **Subtotal: todo.md** | **15** | **7.9%** |
| `agents/optimizer/workspace/journal.md` | 4 | 2.1% |
| Other (workspace findings, src files, etc.) | 142 | 75.1% |

*Note: Historical "Other" violations include many `write()` calls from before the checker excluded `write()`. Recent 48h violations are **100%** DELIVERABLES_CHECKLIST.md + todo.md.*

### Recent 48h Violations — 100% Concentrated

| File | Work Sessions | Heartbeats | Total | % |
|------|--------------|-----------|-------|---|
| DELIVERABLES_CHECKLIST.md | 27 | 9 | **36** | **73%** |
| todo.md | 8 | 5 | **13** | **27%** |
| Other | 0 | 0 | **0** | **0%** |
| **Total** | **35** | **14** | **49** | **100%** |

### Fleet Comparison (24h)

| Agent | Pass Rate | Total Checks |
|-------|-----------|-------------|
| **optimizer** | **80.5%** | 82 |
| coach | 89.7% | 58 |
| bob | 94.3% | 105 |
| may | 95.0% | 40 |
| tech-lead | 96.7% | 61 |
| qa | 100.0% | 29 |
| scout | 100.0% | 30 |

### 7-Day Trend — Regression Starting Apr 11

| Day | Pass Rate | Note |
|-----|-----------|------|
| Day -6 | 100.0% (26/26) | ✅ Perfect |
| Day -5 | 95.0% (57/60) | Good |
| Day -4 | 100.0% (34/34) | ✅ Perfect |
| Day -3 | 100.0% (51/51) | ✅ Perfect |
| Day -2 | 96.8% (30/31) | Good |
| Day -1 | **78.1%** (75/96) | ⚠️ Regression |
| Day 0 | **82.1%** (64/78) | ⚠️ Continued |

The regression aligns with the DELIVERABLES_CHECKLIST skill deployment (Apr 10) and the optimizer's shift to high-frequency forked work sessions.

## Root Cause #1: DELIVERABLES_CHECKLIST.md — write() then edit() without read()

**The Pattern (100% of DELIVERABLES_CHECKLIST.md violations):**
```
write("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md", <full checklist>)
// ... work happens ...
edit("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md", "- [ ] item", "- [x] item ✅")  ← VIOLATION
```

**Why it happens**: The deliverable-checklist skill instructs optimizer to:
1. Create the checklist with `write()` (Step 3)
2. Check off items with `edit()` as work progresses (Step 4)

The skill explicitly says to `read()` before each `edit()` (added in fix `f3f6765c`). But the optimizer:
- Just wrote the file moments ago, so it "knows" the content
- Sees the `read()` as redundant since it authored the file
- The skill's `read()` instruction competes with the optimizer's natural instinct to just edit

**Evidence this is not a checker bug**: The checker correctly normalizes paths and only flags `edit()` (not `write()`). The optimizer genuinely calls `edit()` without any preceding `read()` of that file.

**Prior fix failed**: Commit `f3f6765c` (Apr 12 05:29 UTC) added this to Step 4:
```
read("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md")  ← required before edit
edit(path, "- [ ] Create src/lib/new-module.ts", "- [x] Create src/lib/new-module.ts ✅")
```
Post-fix, 13 more violations occurred in sessions that started after the fix was deployed. **Text instructions in skills don't change behavior.**

### Comparison with QA's C1.1 Root Cause

| Dimension | QA | Optimizer |
|-----------|-----|----------|
| Violation files | journal.md (56%), unreviewed-findings.md (20%) | DELIVERABLES_CHECKLIST.md (73%), todo.md (27%) |
| Behavioral pattern | `bash tail` substitutes for `read()` | `write()` then `edit()` without `read()` |
| Root cause | Agent uses a shortcut (tail) that bypasses read() | Agent skips "redundant" read after write |
| Prior fix worked? | Partially (oscillating) | No (13 violations continued) |
| Common thread | **Skill/heartbeat text insufficient** | **Skill text insufficient** |

## Root Cause #2: todo.md — Heartbeat edits without reading

**The Pattern:**
```
// Heartbeat Step 1: SOMETIMES reads todo.md
read("agents/optimizer/workspace/todo.md")  ← sometimes done, sometimes skipped

// Heartbeat Step 3-4: edits todo.md to note what was forked
edit("agents/optimizer/workspace/todo.md", ...)  ← VIOLATION when Step 1 read was skipped
```

**Why it happens**: The heartbeat says to `read("agents/optimizer/workspace/todo.md")` in Step 1, but this is one of several items in the OBSERVE step. When the optimizer decides quickly (e.g., 3-op heartbeat), it may skip the todo read and jump straight to forking + editing. The `read()` in Step 1 is treated as optional context-gathering, not a mandatory precondition for later edits.

**Also in work sessions**: 8 work session todo.md violations — these occur when forked sessions edit todo.md at the end (to note dispatch) without reading it first.

## Root Cause #3: Text instructions don't change behavior (meta-pattern)

This is the third time we've observed this pattern:
1. **QA journal.md** — heartbeat had correct instructions, QA followed them ~50% of the time
2. **QA unreviewed-findings.md** — same pattern
3. **Optimizer DELIVERABLES_CHECKLIST.md** — skill has explicit read() instruction with code example, optimizer ignores it

**Lesson (confirmed)**: Adding text to skills/heartbeats is necessary but insufficient for C1.1 compliance. The behavior requires **structural enforcement** — either a production guard, a workflow step, or a template that bakes in the read() call.

## Intervention Recommendations

### P0: Add read() to the DELIVERABLES_CHECKLIST.md write-edit pattern in the skill

The current skill shows the read+edit as separate calls. **Convert to a mandatory composite pattern:**

**Current (broken) — two separate steps:**
```
read("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md")  ← required before edit
edit(path, "- [ ] item", "- [x] item ✅")
```

**Proposed — single mandatory block with STOP marker:**
```
⚠️ MANDATORY SEQUENCE — NEVER skip the read():
1. read("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md")
2. edit("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md", "- [ ] item", "- [x] item ✅")
DO NOT edit DELIVERABLES_CHECKLIST.md without step 1.
```

*However, based on evidence from QA's identical situation, this text change alone will NOT be sufficient.*

### P1: Consider a production guard (infrastructure enforcement)

A lightweight pre-edit check that:
- Intercepts `edit()` calls
- Checks if the file has been `read()` in the current session
- If not, injects a `read()` before proceeding

This would be the equivalent of the QA recommendation for "context-patch" enforcement — moving compliance from LLM judgment to infrastructure.

**Tradeoff**: This adds latency (one extra tool call per unchecked edit) but guarantees 100% compliance. The real question is whether C1.1 violations on checklist files matter enough to justify infrastructure changes.

### P2: Simplify the checklist workflow to avoid edit() entirely

Instead of `write()` then multiple `edit()` calls, the optimizer could:
1. `write()` the initial checklist
2. `write()` the updated checklist (full replacement) each time an item is checked off

This eliminates the need for `read()` before `edit()` since `write()` is exempt from C1.1. However, this loses the precision of `edit()` (targeted changes vs full-file rewrites).

### P3: Fix todo.md pattern in heartbeat

The heartbeat already says to read todo.md in Step 1. The fix is to make the todo.md read **mandatory and visible**:

Add to Step 1:
```
⚠️ REQUIRED: If you plan to edit todo.md later, you MUST read it here.
3. `read("agents/optimizer/workspace/todo.md")` — ALWAYS do this (C1.1 requires it before any edit)
```

But again — text changes have a poor track record for this type of issue.

## Conclusion

Optimizer's C1.1 problem is **a skill-introduced regression**. The DELIVERABLES_CHECKLIST skill (Apr 10) created a new write→edit workflow that the optimizer executes without the intervening read(). The skill already has explicit read() instructions (added Apr 12) but they don't work — **same as QA's pattern**.

**Expected impact of text-only intervention**: Marginal (5-10pp improvement based on QA's experience). 

**Expected impact of infrastructure guard**: 100% compliance (if implemented).

**Recommendation**: Deploy text fix (P0+P3) as immediate mitigation while evaluating infrastructure guard (P1) for permanent fix. Track 48h post-text-fix compliance to confirm the pattern holds.

---

*Cross-reference: [QA C1.1 Root Cause Analysis](qa-c1.1-root-cause.md) — same meta-pattern, different files.*

[SIG: 1776058040:optimizer-c1.1-analysis]
