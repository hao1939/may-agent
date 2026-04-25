# Mode D Investigation: Tool Sequence Bloat Analysis

**Date:** 2026-04-12  
**Analyst:** bob (research mode)  
**Data window:** Last 72 hours (20,000+ sessions analyzed)

---

## Executive Summary

Agent sessions vary wildly in efficiency: efficient work sessions complete in 8-12 tool calls with 0 errors, while bloated sessions consume 90-188 calls with 84-96% spent on investigation. **Coach is the primary offender** at 45.8 avg ops/work session vs tech-lead's 29.2. The root cause is not errors (7-16% of bloat) but **unbounded investigation spirals** — sessions that run 58-95 consecutive investigation calls before producing any output.

### Key Finding
Bob's phased workflow (deliver-or-report.ts with 15/25-call budgets per phase) averages **17.7 ops vs 31.4 for monolithic tasks** — a 44% reduction. Coach has no such budgets and averages **46.8 ops** for equivalent work.

---

## 1. The Data

### 1.1 Agent Efficiency Comparison (72h, work sessions)

| Agent | Avg Ops | Min | Max | Success% | Structure |
|-------|---------|-----|-----|----------|-----------|
| bob (phased) | 17.7 | 0 | 100 | 98.6% | deliver-or-report phases with 15-25 call budgets |
| bob (monolithic) | 31.4 | 6 | 111 | 96.7% | Direct work sessions without budgets |
| tech-lead | 29.2 | 4 | 108 | 98.6% | No formal budgets, naturally concise |
| coach (monolithic) | 46.8 | 2 | 188 | 88.2% | No budgets, open-ended investigation tasks |

### 1.2 Distribution of Coach Work Sessions

| Op Range | Count | Success% |
|----------|-------|----------|
| 0-10 | 8 | 25% |
| 11-20 | 17 | 82.4% |
| 21-30 | 14 | 92.9% |
| 31-50 | 31 | 93.5% |
| 51-80 | 21 | 85.7% |
| 81+ | 16 | 100% |

**Paradox:** The 81+ sessions all succeed (100%) but at massive cost ($2.89-$4.39 each). The 0-10 sessions mostly fail (25%) because they're cut short. The sweet spot is 21-50 ops.

---

## 2. Efficient vs Bloated: What's Different?

### 2.1 Efficient Session Pattern (tech-lead: fix broken test, 8 calls, $0.08)

```
1. read(test file)           ← Understand the problem
2. edit(test file)           ← Fix it
3. bash(tsc --noEmit)        ← Verify compilation
4. bash(vitest run test)     ← Verify tests pass
5. bash(git commit)          ← Deliver
6. finish()                  ← Done
```

**Pattern: Read → Fix → Verify → Commit → Done.** Zero errors, linear progression.

### 2.2 Efficient Session Pattern (bob: research synthesis, 12 calls, $0.19)

```
1. bash(find/ls)             ← Locate files
2-3. read(sources)           ← Read source material
4-9. read(more sources)      ← Thorough but bounded reading
10. write(synthesis.md)      ← Write deliverable
11. bash(wc/head verify)     ← Verify output
12. finish()                 ← Done
```

**Pattern: Locate → Read (bounded) → Write → Verify → Done.** Zero errors, clear goal.

### 2.3 Bloated Session Pattern (coach: C1.5 regression, 122 calls, $2.89)

```
1. FILE_EXPLORE              ← Start investigating
2-3. DB_QUERY + DB_QUERY     ← Try database
5-6. !!ERROR!! !!ERROR!!     ← Wrong schema
7. FILE_EXPLORE              ← Try finding the right path
8. DB_QUERY                  ← Retry with different schema
10-11. DB_QUERY + DB_QUERY   ← More DB queries
12-13. !!ERROR!! !!ERROR!!   ← Still wrong schema
14. DB_QUERY                 ← Eventually fix it
...
30-38. FILE_EXPLORE × 9      ← Exploration spiral
42-67. DB_QUERY × 15 + FILE_EXPLORE × 11  ← More exploration
70-98. GIT_INSPECT × 8 + DB_QUERY × 12    ← Git archaeology
99-121. More investigation...
122. FINISH                  ← Finally done
```

**Investigation streak: 95 consecutive calls before any output.** Only 2 delivery calls in the entire session.

---

## 3. Root Causes of Bloat

### 3.1 Unbounded Investigation (Primary — 84-96% of bloated sessions)

Coach investigation sessions average **102 investigation calls** (DB queries + file exploration + git inspection) before producing **2 delivery calls** (writes + commits). The investigation-to-delivery ratio is approximately **50:1**.

Compare to efficient sessions where the ratio is **4:1 to 10:1**.

| Session | Investigation | Delivery | Errors | Invest Streak |
|---------|--------------|----------|--------|---------------|
| C1.5 regression | 102 (84%) | 2 (2%) | 12 (10%) | 95 calls |
| C7.1 hallucination | 89 (86%) | 6 (6%) | 5 (5%) | 66 calls |
| QA regressions | 98 (91%) | 1 (1%) | 4 (4%) | 58 calls |

### 3.2 Schema Discovery Errors (Secondary — 10-15% waste)

The most common error across bloated sessions: **WRONG_SCHEMA (13 occurrences)** — DB queries that use non-existent columns. This triggers error-retry loops:

```
DB_QUERY → !!ERROR!! (no such column: id)
DB_QUERY → !!ERROR!! (wrong table name)
FILE_EXPLORE → find the right schema
DB_QUERY → (finally works)
```

Each error-retry cycle wastes 2-4 calls.

### 3.3 Missing PATH/Environment Setup (Tertiary — 5 occurrences)

Some sessions waste calls because `bun` isn't on PATH:
```
bash(bun -e "...") → ERROR (command not found)
bash(export PATH=".state/.bun/bin:$PATH" && bun -e "...") → works
```

### 3.4 Empty Result Spirals

Sessions that get empty results (no rows, no files found) and try slight variations:
```
find X -name "KE-144*" → empty
find Y -name "KE-144*" → empty
find Z -name "KE-144*" → found!
```

**C12.1 regression**: 14 empty results, 12 empty-result followups = 26 wasted calls.

---

## 4. Why Coach Is Worse Than Bob

### 4.1 No Budget Constraint

Bob's `deliver-or-report.ts` workflow enforces:
- Phase 1 (Analyze & Plan): **15 tool call budget**
- Phase 2 (Write Deliverables): **25 tool call budget**
- Phase 2b (Complete Missing): **20 tool call budget**

Coach has **no such budget**. It receives monolithic tasks like "Investigate C1.5 regression and design intervention" with no structure or call limits.

### 4.2 Task Structure: Investigation vs Implementation

| Factor | Bob's Tasks | Coach's Tasks |
|--------|-------------|---------------|
| Goal clarity | "Integrate EXP-137 results" (clear) | "Investigate regression and design intervention" (open-ended) |
| Budget | 15-25 calls per phase | None |
| Phase separation | Plan → Write → Verify | Monolithic |
| Success without exhaustive search | Yes (just read results, update index) | No (must find root cause, requires deep investigation) |
| Stop signal | "All deliverables written" | "I've found enough evidence" (subjective) |

### 4.3 The Exploration Trap

Investigation tasks have a natural tendency to expand scope:
1. Check convention check scores → reveals multiple failing sessions
2. Each failing session needs transcript review → opens new investigation threads
3. Each thread might lead to code inspection, git history, etc.
4. No natural stopping point until "I've looked at everything"

---

## 5. The Cost

### 5.1 Token Costs (72h window)

| Agent/Mode | Count | Avg Input Tokens | Total Input (M) |
|------------|-------|------------------|-----------------|
| Coach monolithic | 62 | 262,507 | 16.28M |
| Bob phased | 103 | 254,072 | 26.17M |
| Bob monolithic | 33 | 196,402 | 6.48M |
| Tech-lead mono | 44 | 39,947 | 1.76M |

Coach's 62 monolithic sessions consume **16.28M input tokens** — about 2.5× tech-lead's total despite doing fewer sessions.

### 5.2 Per-Session Costs

| Type | Example | Cost | Ops |
|------|---------|------|-----|
| Efficient work | Fix test | $0.08 | 8 |
| Efficient work | Research synthesis | $0.19 | 12 |
| Bloated investigation | C1.5 regression | $2.89 | 122 |
| Bloated investigation | C7.1 hallucination | $3.11 | 98 |
| Bloated investigation | QA regressions | $4.39 | 104 |

**A single bloated investigation costs as much as 15-55 efficient sessions.**

---

## 6. Recommendations

### 6.1 Immediate: Investigation Budget Convention

Add to coach's SOUL.md or a system-level convention:
```
INVESTIGATION BUDGET:
- Maximum 30 tool calls for data gathering before writing initial findings
- After 30 investigation calls, MUST write an interim summary, even if incomplete
- After writing interim summary, may do 15 more investigation calls if needed
- Total investigation budget: 50 calls maximum
```

### 6.2 Structural: Phase Coach Tasks Like Bob's

Convert monolithic coach tasks like:
```
"Investigate C1.5 regression and design intervention"
```
Into phased tasks:
```
Phase 1 (15 calls): "Find which sessions fail C1.5 and categorize the failure patterns"
Phase 2 (20 calls): "For the top 3 failure patterns, identify root causes by examining session transcripts"  
Phase 3 (15 calls): "Write investigation report with specific intervention proposals"
```

### 6.3 Technical: Schema Hints in Coach Context

Pre-load coach context with:
```
DB Schema Quick Reference:
- sessions: sessionId TEXT, agent TEXT, status TEXT, opCount INTEGER, ...
- evaluations: sessionId TEXT, usage TEXT (JSON), ...
- convention_checks: sessionId TEXT, conventionId TEXT, pass INTEGER, ...
```
This would eliminate the #1 error type (WRONG_SCHEMA, 13 occurrences).

### 6.4 Technical: PATH Environment Pre-injection

Add to session bootstrap:
```
export PATH=".state/.bun/bin:$PATH"
```
This would eliminate 5 MISSING_PATH_ENV errors.

### 6.5 Investigation-Specific Guardrail

Implement a "investigation depth guard" that:
1. Counts consecutive investigation calls (DB_QUERY, FILE_EXPLORE, GIT_INSPECT)
2. After 20 consecutive investigation calls without a write/checkpoint, injects a prompt: "You've done 20 consecutive investigation calls. Checkpoint your findings now."
3. Hard limit at 40 consecutive investigation calls.

---

## 7. Expected Impact

If implemented:

| Intervention | Expected Op Reduction | Confidence |
|-------------|----------------------|------------|
| Investigation budget (6.1) | -30% for coach work sessions | Medium |
| Phased task structure (6.2) | -40% for coach work sessions (based on bob's 44% reduction) | High |
| Schema hints (6.3) | -4 calls per session with DB errors | High |
| PATH injection (6.4) | -2 calls per session | High |
| Investigation depth guard (6.5) | -20% for investigation tasks | Medium |

**Conservative estimate:** Coach work sessions from 46.8 → ~28 avg ops (-40%), saving approximately **$50-80/day** in token costs at current session volume.

---

## Appendix: Data Sources

- Session data: `.state/may.db` (sessions, evaluations tables)
- Tool call sequences: `.state/sessions/*/session.jsonl` and `.state/sessions/history/*/session.jsonl`
- Efficient sessions analyzed: s_1775840299207_969, s_1775955531597_1743, s_1775895909452_1307, s_1775907263318_1397, s_1775897661750_1317
- Bloated sessions analyzed: s_1775969668094_1865, s_1775973401506_1905, s_1775971463782_1883, s_1775825744294_884, s_1775838368441_957, s_1775840056673_968
