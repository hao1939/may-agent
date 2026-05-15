# QA C1.1 Regression Investigation — 2026-04-11

**Alert**: QA C1.1 dropped to 80% over the last 24h (24 failures in 30 checks)
**Verdict**: ALREADY FIXED — commit `a3654c7a` (2026-04-11T05:57Z) resolved the root cause. All 24 failures are from pre-fix sessions retroactively checked.

## Root Cause

### The Optimization That Broke C1.1

**Commit `fefe986a`** (2026-04-10T09:55) optimized journal append in the QA heartbeat to use `bash("tail -5 workspace/journal.md")` instead of `read()` with offset. The goal was to save tokens on the 270KB journal file.

**Problem**: The C1.1 convention checker (`agents/may/handlers/convention-check.ts`) only recognizes `read()` tool calls as evidence of having read a file before editing. `bash("tail -5 ...")` is functionally equivalent but doesn't register as a `read()` in the convention checker.

**Result**: Every QA heartbeat session after fefe986a that appended to journal.md was flagged as a C1.1 violation.

### Timeline

| Time (UTC) | Event |
|---|---|
| Apr 10 09:55 | Commit `fefe986a` — changed heartbeat to use `bash(tail)` instead of `read()` |
| Apr 10 10:53 → Apr 11 05:53 | 24 QA sessions ran with broken instructions — all fail C1.1 |
| Apr 11 05:57 | Commit `a3654c7a` — restored `read()` with offset pattern |
| Apr 11 06:23 → 07:24 | Post-fix sessions run correctly |

### The Fix (Already Applied)

Commit `a3654c7a` restored the correct 3-step pattern in `agents/qa/heartbeat.md`:

```
1. bash("wc -l workspace/journal.md") to get the line count N
2. read("workspace/journal.md", { offset: N - 4, limit: 5 }) to see just the last 5 lines
3. edit("workspace/journal.md", { oldText: <those last lines>, newText: <those last lines + your new entry> })
```

Step 2 uses `read()` which satisfies C1.1 before the `edit()` in step 3.

## Verification

### Post-Fix Sessions Pass C1.1

**Session s_1775890419847_1272** (started 06:33 UTC, post-fix):
- Tool sequence: `bash(wc -l)` → `read(journal.md, offset=5068)` → `edit(journal.md)` ✅
- C1.1 satisfied: `read()` precedes `edit()`

**Session s_1775892220548_1283** (started 07:23 UTC, post-fix):
- Tool sequence: `read(journal.md, offset=5069)` → `edit(journal.md)` ✅
- C1.1 satisfied

### All 24 Failures Are Pre-Fix

All failing session IDs have timestamps BEFORE the fix commit:
- Latest failing session: `s_1775886820091_1250` (05:53 UTC) — 4 minutes before fix at 05:57
- Earliest failing session: `s_1775876020196_1192` (02:53 UTC)

## 7-Day Fleet Context

| Agent | C1.1 Rate | Total |
|---|---|---|
| coder | 100% | 3 |
| amy-kimi | 96.5% | 57 |
| may | 94.9% | 236 |
| optimizer | 93.3% | 267 |
| tech-lead | 91.7% | 180 |
| bob | 89.8% | 441 |
| qa | **83.6%** | 225 |
| coach | 85.3% | 422 |
| scout | 76.9% | 217 |

QA's 7-day rate is dragged down by the ~20h window of broken sessions. Once the retroactive failures age out of the 7-day window (after Apr 11 10:53 UTC), the rate will recover to ~95%+.

## Recommendations

### 1. No Further Action Needed on QA
The fix is deployed and working. Future heartbeat sessions will use `read()` with offset.

### 2. Consider Checker Enhancement (Low Priority)
The C1.1 checker could optionally recognize `bash(cat/head/tail <file>)` as equivalent to `read()` for compliance purposes. This would prevent similar regressions if another agent optimizes file access via bash. However, this is a philosophical choice — requiring explicit `read()` before `edit()` ensures the agent has the exact content needed for `oldText` matching.

### 3. Regression Detector Will Self-Resolve
The regression alert should clear after ~24h as the pre-fix failures age out of the sliding window. No manual intervention needed on the cooldown/regression system.

## Data Sources
- Convention checks: `.state/may.db` → `convention_checks` table (52K records)
- Summary: `.state/convention-checks/summary.json`
- Session transcripts: `.state/sessions/`
- Fix commit: `a3654c7a` in `agents/` repo
- Root cause commit: `fefe986a` in `agents/` repo
