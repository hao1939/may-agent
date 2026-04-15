# Finding: Tool Gap Analysis — Fresh 6h Bash Pattern Scan (Apr 14 PM)

**Date**: 2026-04-14 ~17:22 UTC  
**Analyst**: Optimizer (Mode B)  
**Window**: Last 6h (11:22–17:22 UTC)  
**Method**: Queried 47 sessions (opCount >10) from .state/may.db, cross-referenced with session.jsonl from history/ archives, analyzed 239K+ historical bash commands for pattern validation.

---

## Executive Summary

**47 sessions** with >10 ops ran in the last 6h, totaling **~1,370 ops**. Session logs from this exact window were already cleaned up (no receipts.jsonl), so I analyzed the 4 most recent high-op sessions with preserved history logs that overlap or are recent enough to represent current behavior.

**The single highest-value pattern NOT yet addressed by existing tools is:**

### 🏆 Pattern: PATH Export Boilerplate — 18,980 wasted ops (8% of ALL bash calls)

Every agent prefixes bash calls with `export PATH=".state/.bun/bin:$PATH"` because `bun` isn't on PATH by default. This isn't a tool gap — it's a **framework-level environment bug** that wastes 8% of all bash operations across the entire system.

---

## Evidence

### Quantitative (across 239,657 bash calls in history)

| Metric | Value |
|--------|-------|
| Total bash calls analyzed | 239,657 |
| PATH export calls | 18,980 (7.9%) |
| Sessions with PATH exports | 2,352 |
| Worst session | s_1775516539038_111: 148/148 bash = **100% PATH exports** |
| Top 10 worst sessions avg | 104 PATH exports per session |

### Specific to last 6h window

| Session | Agent | Ops | PATH exports | % of bash |
|---------|-------|-----|-------------|-----------|
| s_1776126397964_486 | tech-lead | 163 bash | 68 | 37% |
| s_1776159729124_0 | may | 593 bash | 21 | 3% |

### Why this isn't addressed by existing tools

- `code-search.ts` — replaces grep chains ✅ (already deployed, used in 2 sessions today)
- `session-query.ts` — replaces session archaeology ✅ (exists but barely used — 0 mentions in 24h digests)  
- `batch-merge.sh` — replaces manual git merge loops ✅ (built and deployed)
- `scenario-oracle.sh` — replaces hand-computed test oracles ✅ (built by tech-lead today, 2 sessions)
- **PATH export → NOT ADDRESSED** by any existing tool

### Fix

**Not a tool — a framework config change.** Add `PATH=".state/.bun/bin:${PATH}"` to the environment that launches agent sessions. This is a 1-line fix in whatever spawns the bash subprocess (likely `src/lib/workflow-tool.ts` or the bash tool definition).

**Estimated savings**: 18,980 / total_sessions ≈ **~8 ops per session saved** for heavy-bash sessions, or ~2 ops avg across all sessions. At current volume (~350 sessions/day), that's **~700 saved ops/day**.

---

## Other Patterns Found (Already Documented)

### Pattern 2: Context-Window File Re-Reading (CONFIRMED, UNSOLVED)

One implementation session (s_1776158541712_115, tech-lead guards-v2) read the same 7 files **30-34 times each** — 254 of 273 bash calls were `cat` of the same files. The session re-read `src/lib/workflow.ts` 34 times, `src/lib/workflow-tool.ts` 34 times, etc.

In the 48h window: **24 sessions had >5 repeated file reads, totaling 600 wasted ops.** The worst session had 281 repeated reads.

| Rank | Session | Repeated Reads | Top File |
|------|---------|---------------|----------|
| 1 | s_1776158541712_115 | 281 | 40x src/lib/workflow.ts |
| 2 | s_1776159729124_0 | 90 | 15x improvement-queue.md |
| 3 | s_1776174784898_152 | 43 | 16x todo.md |
| 4 | s_1776126397964_486 | 23 | 8x evaluate-task.test.ts |

**Root cause**: Agents use `cat` in bash instead of `read()` tool, and context windows don't persist file contents between turns in long sessions. This is partially a judgment issue (use `read` not `cat`) and partially a framework issue (long sessions lose context).

**Status**: Not fixable with a tool. Would require either:
- A session-level file cache (complex)
- A behavioral intervention ("use read() not cat, and don't re-read unchanged files")
- Reducing session length so context windows don't overflow

### Pattern 3: Session Archaeology Still Manual (CONFIRMED)

`session-query.ts` exists and works, but 0 agents used it in the last 24h for session analysis. My own optimizer session (s_1776169082223_80, 88 ops) did manual DB queries instead of using the tool.

**Status**: Tool exists, adoption is zero. Not a gap — a **discovery/push problem** (aligns with KE-026: agents can't self-serve from reference materials).

### Pattern 4: Merge Operations (CONFIRMED, PARTIALLY FIXED)

`batch-merge.sh` exists. Coder sessions (s_1776171148167_109 at 44 ops, s_1776183750449_249 at 33 ops) used `review-merge.sh --batch` in the last 6h. This pattern is now partially addressed. Remaining waste: conflict resolution still requires manual intervention.

---

## Last 6h Session Category Breakdown

| Category | Sessions | Total Ops | Avg Ops | Notes |
|----------|----------|-----------|---------|-------|
| coach-env (heartbeat) | 10 | 230 | 23 | Coach heartbeats hitting 23 avg |
| merge | 6 | 220 | 37 | Down from 60+ with batch-merge.sh |
| work-session | 9 | 207 | 23 | Normal range |
| heartbeat/cron | 4 | 175 | 44 | One 43-op common-sense-verify outlier |
| investigate | 3 | 130 | 43 | Phase 1 investigate cycles |
| execute-fix | 3 | 91 | 30 | Phase 2 execute cycles |
| other | 11 | 279 | 25 | Mixed tasks |
| directive/fix | 1 | 38 | 38 | Emergency fixes |

---

## Concrete Recommendation

### Priority 1: Fix PATH in framework (1-line change, ~700 ops/day saved)

Find where bash commands are spawned and add `.state/.bun/bin` to PATH. Every agent context file says "bun is at .state/.bun/bin/bun — add to PATH" which means every bash call pays the tax.

**Files to check**: `src/lib/workflow-tool.ts`, or wherever the bash tool `env` is configured.

### Priority 2: Push session-query.ts adoption (0 new code, behavioral change)

Add to agent context.md files: "Use `bun scripts/session-query.ts --agent X --since 6h` instead of manual DB queries for session archaeology."

### Priority 3: Investigate context-window re-read mitigation (research needed)

The 600 wasted ops in 48h from re-reading files is significant but the fix is unclear. Possible approaches:
- Instrument the read/bash tool to warn on repeated reads of same file
- Add a "working files" cache that persists key file contents in the session prompt

---

## Cross-Reference with Previous Findings

| Pattern | First Found | Current Status | This Finding |
|---------|------------|----------------|-------------|
| PATH export waste | 0410 (mentioned) | **NOT FIXED** | Quantified: 18,980 ops = 8% of all bash |
| Batch merge | 0410 | **FIXED** (batch-merge.sh) | ✅ Confirmed working |
| Scenario oracle | 0414 (earlier) | **FIXED** (scenario-oracle.sh) | ✅ Built today |
| Session archaeology | 0410 | **TOOL EXISTS** (session-query.ts) | ❌ Zero adoption |
| Context re-reading | 0414 (earlier, mentioned) | **NOT FIXED** | Quantified: 600 ops/48h |
| Code search chains | 0410 | **FIXED** (code-search.ts/sh) | ✅ Used in 2+ sessions |
