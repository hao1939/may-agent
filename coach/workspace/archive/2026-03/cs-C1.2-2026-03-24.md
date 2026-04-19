# C1.2 — One Read at a Time (Truncation Handling) — 2026-03-24

## Rule
"Truncated reads are fatal. If a read is truncated, use `offset` to get the rest. Never write to a file based on a partial read."

## Method
Searched all recent sessions (last 40) for actual truncation events (`more lines in file` in tool results) and checked whether agents used `offset` to continue reading before acting on truncated content.

## Aggregate Stats (15 sessions with truncation, last 40 sessions)

| Session | Agent | Truncated | Offset Uses | Ratio |
|---------|-------|-----------|-------------|-------|
| s_130 | tech-lead | 2 | 1 | 50% |
| s_128 | optimizer | 1 | 1 | 100% |
| s_123 | optimizer | 2 | 0 | **0%** ❌ |
| s_122 | bob | 1 | 3 | 100%+ |
| s_124 | scout | 2 | 2 | 100% |
| s_120 | coach | 1 | 0 | **0%** |
| s_117 | coach | 3 | 2 | 67% |
| s_118 | scout | 3 | 1 | 33% |
| s_107 | optimizer | 4 | 4 | 100% |
| s_116 | optimizer | 2 | 2 | 100% |
| s_115 | optimizer | 1 | 1 | 100% |
| s_109 | optimizer | 1 | 1 | 100% |
| s_112 | optimizer | 1 | 2 | 100%+ |
| s_102 | coach | 1 | 0 | **0%** |
| s_100 | optimizer | 5 | 1 | **20%** ❌ |
| s_97 | tech-lead | 1 | 1 | 100% |
| s_93 | optimizer | 2 | 2 | 100% |

**Overall**: ~33/36 truncation events had offset follow-up (~92%), but 4 sessions had clear gaps.

## Detailed Violations

### Optimizer s_1774307166415_123 — ❌ FAIL (2/2 skipped)
- **Truncation 1**: Journal read, 240 lines remaining. Agent did NOT use offset; instead ran `head -5` to get just the first line. Then proceeded with partial context.
- **Truncation 2**: Journal re-read, 275 lines remaining. Agent did NOT use offset; immediately **edited** the journal (prepending new entry) without reading the full content. This is exactly the "write to a file based on a partial read" violation.
- **Severity**: HIGH — wrote to truncated file without full read.

### Optimizer s_1774298166528_100 — ⚠️ PARTIAL (1/5 used offset)
- **Truncation 1**: Journal read, 199 lines remaining. No offset. Agent said "Good" and moved on to plan.
- **Truncation 2**: Bob's journal, 336 lines remaining. **Used offset** ✅ — proper follow-up.
- **Truncation 3**: Own journal, 239 lines remaining. No offset. Proceeded to **edit** journal directly. Violation.
- **Truncation 4**: Periodic tasks, 76 lines remaining. No offset. Proceeded to edit.
- **Truncation 5**: Periodic tasks again, 81 lines remaining. No offset. Proceeded to log.
- **Severity**: MEDIUM — 4/5 truncated reads led to edits without full file content.

### Tech-lead s_1774310766759_130 — ⚠️ PARTIAL (1/2)
- Read convention-check.ts (711 lines remaining) and evaluate-sessions.ts (310 lines remaining).
- Agent correctly decided the issue was a binary build problem from the first ~50 lines and didn't need the full file. Reasonable judgment call but technically a gap.
- **Severity**: LOW — read-only analysis, no writes based on truncated content.

### Coach sessions (s_120, s_102) — ⚠️ (0/2)
- Coach sessions had truncated reads of session files (for analysis). No writes followed.
- **Severity**: LOW — read-only, no writes to truncated files.

## Assessment

**Status: ⚠️ (mixed)**

- When the truncated file is being **written to** afterward, this is a real violation (Optimizer s_123 and s_100).
- When the truncated file is being **read for analysis only**, agents often reasonably stop reading once they have enough context (Tech-lead, Coach).
- The **critical distinction** is: truncation before edit/write = violation; truncation before read-only analysis = judgment call.

**Key concern**: The Optimizer has a pattern of reading its journal (truncated), then prepending new entries via `edit()` without ever reading the full file. This works when the edit targets the beginning of the file, but risks oldText mismatch or content loss.

**Compared to prior check (2026-03-20)**: Similar ⚠️ status. Optimizer remains the primary offender. Other agents (TL, Bob, Scout) handle it well. No regressions detected.

## Recommendation
- Optimizer should be coached: when truncated read → edit, always re-read with offset first, especially for journal files.
- Consider: the convention could be nuanced — "never **write** to a file based on a partial read" is the critical part; "read for analysis" partial reads are lower severity.
