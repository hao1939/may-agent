# Finding: C12.1 "Regression" is Mostly a Measurement Artifact

**Date**: 2026-04-11  
**Author**: Coach  
**Task**: Investigate C12.1 regression from 100% → 92.3%  
**Verdict**: ~60% measurement artifact, ~35% legitimate edge cases, ~5% real non-compliance

## Summary

C12.1 pass rate on Apr 9-11 is 95.5-99.0%, down from near-100% in late March/early April. Investigation shows the "regression" is primarily caused by two patterns the convention checker doesn't handle:

1. **`export PATH=...` prefix in bash commands** (12/20 failures) — The checker strips `cd <path> &&` but not `export PATH=... &&`. Commands like `export PATH=".state/.bun/bin:$PATH" && ls agents/...` ARE orientation behavior but get flagged.
2. **Task-relevant first reads** (7/20 failures) — Work sessions that read task-specific files (e.g., `src/lib/manager.ts`, `test/auto-pause.test.ts`) rather than generic context files. These are dispatched tasks that already have context from the task description.

Only 1/20 failures is a genuinely non-contextual first action (writing `DELIVERABLES_CHECKLIST.md` before reading anything).

## Data

### Daily Rates (last 2 weeks)
```
2026-04-11 | ███████████████████░  95.5% (213/223, 10 failed)
2026-04-10 | ████████████████████  98.6% (356/361,  5 failed)
2026-04-09 | ████████████████████  99.0% (477/482,  5 failed)
2026-04-08 | ████████████████████  98.8% (338/342,  4 failed)
2026-04-07 | ███████████████████░  96.3% (438/455, 17 failed)
2026-04-06 | ████████████████████  98.2% (161/164,  3 failed)
2026-04-05 | ███████████████████░  97.0% (160/165,  5 failed)
2026-04-04 | ████████████████████  98.5% (133/135,  2 failed)
2026-04-03 | ███████████████████░  95.8% (136/142,  6 failed)
2026-04-02 | ███████████████████░  94.2% (145/154,  9 failed)
```

### Per-Agent (Apr 9-11)
| Agent | Rate | Passed/Total | Failed |
|-------|------|-------------|--------|
| optimizer | 94.7% | 126/133 | 7 |
| coach | 96.0% | 194/202 | 8 |
| tech-lead | 97.8% | 136/139 | 3 |
| bob | 99.2% | 257/259 | 2 |
| may/qa/scout | 100% | 329/329 | 0 |

### Failure Breakdown (Apr 9-11, N=20)

**Category 1: `export PATH` prefix (12/20, 60%)**
These are all bash commands that start with `export PATH=".state/.bun/bin:$PATH" &&` followed by orientation commands (`ls`, `bun -e "... query ..."`). The convention checker's `extractBashCommand` strips `cd <path> &&` but not `export PATH=... &&`.

Examples:
- `export PATH="..." && ls -lt agents/shared/knowledge/experiments/EXP-126/`
- `cd /app && export PATH="..." && bun -e "import {Database}..."`
- `export PATH="..." && bun -e "... query ..."`

**Category 2: Task-relevant first read (7/20, 35%)**
Dispatched WORK SESSION tasks that read the file they were assigned to work on:
- `read(agents/may/handlers/evaluate-sessions.ts)` — task: "Fix gym runner silent failure"
- `read(test/auto-pause.test.ts)` — task: "Fix finish-guard false positives"  
- `read(src/lib/manager.ts)` — task: "Integrate EXP-095 results"
- `read(agents/shared/may-agent-docs/design/anti-confabulation-deployment.md)` — task: "Write design brief"
- `read(agents/bob/workspace/session-lifecycle-bugs.md)` — task: "Merge review branches"

These agents are reading the right file for their task — they just skip generic context files because the task already provides context.

**Category 3: Genuine non-compliance (1/20, 5%)**
- `write(DELIVERABLES_CHECKLIST.md)` before reading anything — optimizer's completeness guard

## Root Cause Analysis

### The `export PATH` issue (lines 854-860 in convention-check.ts)

```typescript
// Current code only strips "cd <path> &&":
const stripped = cmd.trim().replace(/^cd\s+[^\s;]+\s*&&\s*/, "").trim();
if (/^(grep|rg|find|ls|cat|head|tail|git)\b/.test(stripped)) {
```

This misses the extremely common pattern of `export PATH=".state/.bun/bin:$PATH" &&` which agents use to ensure bun is available. The command after the `&&` is what matters.

### The work-session first-read issue

WORK SESSION tasks are dispatched with a specific file to work on. The agent correctly reads that file first. The checker expects generic context files (heartbeat.md, todo.md, etc.) but work sessions don't need those — the task description IS their context.

## Recommendations

### R1: Convention Checker Update (addresses 60% of failures)
Strip `export PATH=...` and `export <VAR>=... &&` prefixes in the bash command parsing, alongside the existing `cd` prefix stripping:

```typescript
const stripped = cmd.trim()
  .replace(/^cd\s+[^\s;]+\s*&&\s*/, "")        // existing
  .replace(/^export\s+\w+=[^\s;]+\s*&&\s*/, "") // new
  .trim();
```

This handles `export PATH="..." && ls ...` → `ls ...` which correctly matches orientation.

Also strip combined prefixes: `cd /app && export PATH=... && ls` → `ls`.

### R2: Allow task-relevant reads for WORK SESSIONs (addresses 35%)
For sessions with `[WORK SESSION]` in the task, the first `read()` of ANY file could be considered valid orientation — the agent is reading the file it was told to work on.

Alternatively, expand `WORKSPACE_PATTERN` to include common project paths (`src/`, `test/`, `scripts/`, `docs/`) for work sessions specifically.

### R3: No agent-level intervention needed
The agents are behaving correctly. This is a checker sensitivity issue, not a behavioral regression.

## Confidence

**HIGH** — every failing session was examined individually. The patterns are consistent and the root cause in the checker code is clear (line 857: only `cd` prefix is stripped, not `export`).

## Estimated Impact
If R1 alone is applied: ~97-98% pass rate → within normal range.
If R1 + R2 applied: ~99%+ pass rate.
