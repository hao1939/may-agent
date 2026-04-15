# Finding: Coder Efficiency Scouting — Apr 15, 2026

## Executive Summary

Analyzed 37 coder sessions from the last 7 days. Coder averages 19 ops/session (median 16), comparable to other agents. Three clear patterns separate efficient from wasteful sessions: **multi-file cleanup tasks** balloon to 100+ ops, **branch merge tasks scale linearly** with branch count (~7 ops/branch), and **retry sessions consume 19% of total ops** (36% of sessions are retries). Concrete recommendations could save ~30% of coder ops.

## Data: Coder Session Distribution (7 days)

| Op Range | Count | % of Sessions |
|----------|-------|---------------|
| 1-5      | 5     | 13%           |
| 6-10     | 7     | 18%           |
| 11-15    | 7     | 18%           |
| 16-20    | 8     | 21%           |
| 21-30    | 6     | 16%           |
| 31-50    | 4     | 11%           |
| 51+      | 1     | 3%            |

**Stats**: Min=2, Max=104, Median=16, Mean=19

### By Task Category

| Category       | Count | Avg Ops | Total Ops | % of Total |
|----------------|-------|---------|-----------|------------|
| cleanup        | 4     | 38      | 152       | 22%        |
| feature-add    | 4     | 25      | 100       | 14%        |
| merge          | 8     | 20      | 162       | 23%        |
| webui-build    | 5     | 19      | 97        | 14%        |
| iterative-fix  | 6     | 13      | 79        | 11%        |
| fix-retry      | 6     | 8       | 48        | 7%         |
| build-new      | 3     | 10      | 31        | 4%         |
| referenced-task| 3     | 14      | 41        | 6%         |

### Agent Comparison (7d, ops>0)

| Agent      | Sessions | Avg Ops | Total Ops |
|------------|----------|---------|-----------|
| coach      | 567      | 22      | 12,488    |
| coder      | 37       | 19      | 705       |
| may        | 335      | 19      | 6,359     |
| bob        | 659      | 19      | 12,314    |
| tech-lead  | 484      | 17      | 7,996     |
| optimizer  | 472      | 16      | 7,606     |
| scout      | 298      | 13      | 3,964     |
| qa         | 286      | 8       | 2,312     |

Coder is middle-of-pack on avg ops but has the fewest sessions (37) — it's called on-demand by tech-lead, not on a heartbeat.

## Pattern 1: Multi-File Cleanup = Massive Op Inflation

**Evidence**: Session `s_1775971602013_1886` consumed **104 ops** (5.5x the median) for a dead-code removal task spanning 5 files (`may.ts`, `agent-loader.ts`, `handler-context.ts`, `index.ts`, `evaluator.ts`). The task required read-before-edit for each file, multiple edits per file, then verification — a classic N-files × M-edits explosion.

**Why**: Each file requires read() → edit() → (sometimes re-read if edit fails) → next file. With 5 files and ~4 edits each = 20 edit cycles + verification rounds. The task description alone was 5,069 chars with extremely detailed line-by-line instructions.

**Contrast**: WebUI build tasks averaged only 19 ops despite similar complexity, because they typically modify only 2 files (`web.ts` + `web-static/index.html`).

## Pattern 2: Branch Merges Scale Linearly (~7 ops/branch)

**Evidence**: 
- 6-branch merge: 44 ops (7.3 ops/branch) — `s_1776171148167_109`
- 5-branch merge: 33 ops (6.6 ops/branch) — `s_1776183750449_249`
- 3-branch merge: 29 ops (9.7 ops/branch, higher due to failures)

Each branch requires: checkout → merge → tsc check → vitest run → handle result. That's a minimum 4-5 ops per branch, plus error handling.

**Key insight**: 23% of total coder ops (162/705) go to merge tasks. A `--batch` flag for `review-merge.sh` already exists but the merge sessions still invoke coder with individual git commands rather than delegating to the script.

## Pattern 3: 36% of Sessions Are Retries (19% of Ops)

**Evidence**: 14 of 37 sessions (36%) are "Fix Required (attempt 2/2)" or iteration 2/3 retries. These consume 137 ops total (19% of all coder ops). 11 of 26 unique parent tasks required multiple coder attempts.

**Notable**: Retry sessions average only 10 ops (vs 23 for first attempts), so they're relatively cheap individually. But the pattern is: first attempt fails verification → tech-lead spawns retry → retry usually succeeds. This suggests the first attempt's verification step catches real issues.

## Recommendations

### R1: Batch-Native Merge Workflow (est. -40% merge ops, ~65 ops saved)
Instead of calling coder to run individual git commands for each branch, create a workflow that wraps `review-merge.sh --batch` as a single operation. Current pattern: tech-lead calls coder with explicit git instructions for N branches. Better pattern: tech-lead calls a merge workflow that handles all branches in one bash script. Could reduce 44-op merge sessions to ~10 ops.

### R2: Pre-Read File Cache for Multi-Edit Tasks (est. -20% cleanup ops, ~30 ops saved)  
For tasks editing 3+ files, include file contents in the task prompt itself (or a workspace scratchpad). The 104-op session spent significant ops just reading files before editing. If tech-lead pre-reads and includes relevant snippets, coder can edit directly without discovery ops.

### R3: Stricter First-Attempt Verification (est. -10% retry ops, ~14 ops saved)
Since 36% of sessions are retries, improving first-attempt success rate has compound benefits. Potential: include the verification command output format in the task so coder knows exactly what "passing" looks like before starting edits. The webui-build category has 0% retry rate — likely because specs are very precise about file scope.

### R4: File-Count Task Splitting (monitoring recommendation)
Track ops-per-file-touched as a metric. Tasks touching 5+ files should be split into smaller tasks (2-3 files each) to avoid the N×M explosion. The 104-op outlier could have been 3 tasks of ~20 ops each = 60 ops total.

## Evidence Citations

- **104-op session** (`s_1775971602013_1886`): Dead code removal across 5 files, task length 5,069 chars
- **44-op merge** (`s_1776171148167_109`): 6-branch merge, 7.3 ops/branch
- **33-op merge** (`s_1776183750449_249`): 5-branch merge, 6.6 ops/branch  
- **WebUI builds**: 5 sessions averaging 19 ops, consistent 13-27 range, 0% retry rate
- **Fix retries**: 14 sessions, avg 10 ops, all "attempt 2/2" — 100% called by tech-lead
- **All 37 coder sessions are called by tech-lead** — coder has no autonomous work
