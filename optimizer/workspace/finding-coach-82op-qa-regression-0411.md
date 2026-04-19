# Finding: Coach 82-op QA C1.1 Regression Investigation

**Date**: 2026-04-11  
**Session**: `s_1775892334486_1286`  
**Agent**: coach  
**Task**: Investigate C1.1 QA regression and design EXP-133 intervention  
**Ops**: 82 (meta.json) / 104 tool calls (transcript, includes checkpoint/finish retries)  
**Duration**: 13m3s (783 seconds)  
**Productive output**: 1 brief (`brief-qa-c11-regression.md`), 1 git commit attempt (blocked by gitignore)

## Executive Summary

Coach spent 82 ops investigating a QA convention regression that had **already been fixed** 90 minutes before the session started. ~47% of ops were pure waste from two patterns: (1) not knowing the DB schema before querying it, and (2) a 31-op spiral trying to find where convention check results are stored. The investigation itself was solid once the right data was found, but the session demonstrates the **"lost in the filesystem" anti-pattern** at scale.

## Op Breakdown (104 tool calls)

| Phase | Ops | Range | Classification | Notes |
|-------|-----|-------|----------------|-------|
| Initial investigation | 4 | 1–4 | ✅ Productive | Read heartbeat, grep journal refs, 2 DB queries (both fail on schema) |
| DB schema fumbling | 5 | 5–9 | ❌ Waste | 5 DB queries trying to find correct table/column names for convention_checks |
| Finding C1.1 checker code | 13 | 10–22 | ⚠️ Mostly waste | grep/find/ls chains to locate convention-check.ts; read it once productively |
| Convention data hunt | 31 | 23–53 | ❌ Waste | 31 ops trying to find where C1.1 results are stored (DB? JSON? filesystem?) |
| Session transcript analysis | 42 | 54–95 | ✅ Productive | Actually reads QA session transcripts, traces root cause, finds the fix commit |
| Write results + finish | 9 | 96–104 | ✅ Productive | Checkpoint, write brief, attempt git commit, 2× finish (first blocked) |

### Detailed Classification

| Category | Count | % | Examples |
|----------|-------|---|---------|
| **File discovery** (grep/find/ls) | 47 | 45% | Finding convention-check.ts, locating summary.json, searching for session dirs |
| **DB queries** | 19 | 18% | 4 failed (schema errors), 15 succeeded |
| **File reads** (read tool + cat/head/sed) | 18 | 17% | convention-check.ts read **4 times**, heartbeat.md read **2 times** |
| **Session transcript analysis** | 11 | 11% | Productive grep/bun analysis of QA session tool sequences |
| **Git operations** | 5 | 5% | git log, git show (productive), git add/commit (blocked by gitignore) |
| **Write/output** | 1 | 1% | Writing brief-qa-c11-regression.md |
| **Finish/checkpoint** | 3 | 3% | 1 checkpoint + 2 finish attempts |

## Waste Patterns

### Pattern 1: Convention Data Spiral (31 ops, ops 23–53)
The biggest single waste block. Coach knew the convention check existed and could read the code. But spent 31 ops trying to find **where the results are persisted** — trying:
- may.db convention_checks table (wrong column names)
- agents/.state/evaluations/ (doesn't exist)
- .state/convention-checks/summary.json (found eventually at op 32, but couldn't parse)
- .state/convention-checks/ directory listing
- Multiple DB path variations (may.db vs .state/may.db)
- Reading convention-check.ts again to find the write path

**Root cause**: Coach doesn't have a data map of what's stored where. The convention check handler writes to `.state/convention-checks/` AND `.state/may.db` convention_checks table, but coach didn't know the schema or path.

### Pattern 2: Repeated File Reads (6 wasted ops)
- `convention-check.ts` read **4 times** (ops 22, 48, 66, 73) — a 1,000+ line file
- `heartbeat.md` read **2 times** (ops 1, 72)
- `brief-amy-kimi-c11-regression.md` read once (reference, productive)

### Pattern 3: DB Schema Fumbling (4 failed queries)
First 2 DB queries (ops 3–4) failed because coach guessed column names (`created_at` instead of `checkedAt`). Then at op 43, tried again with may.db and still hit schema issues. Finally at op 44, did PRAGMA table_info to discover the schema.

### Pattern 4: Already-Fixed Problem
The QA C1.1 regression was fixed by commit `a3654c7a` at 05:57 UTC. Coach's session started at 07:25 UTC — **90 minutes after the fix**. The investigation was essentially post-mortem archaeology on a resolved issue. The brief is still useful documentation, but the urgency framing consumed more ops than a calm write-up would have.

## Comparison to Known Patterns (finding-coach-session-efficiency-0410.md)

| Pattern | April 10 Finding | This Session | Same? |
|---------|-----------------|--------------|-------|
| File discovery chains | 32.7% of all ops | 45% | ✅ Worse |
| Read-before-understanding | 14.6% reads | 17% (4× convention-check.ts) | ✅ Same pattern |
| Gym run proliferation | Up to 26 runs | 0 (no gym) | N/A — different task type |
| Productivity ratio | 24% avg (top 15) | ~53% (55/104) | Better than avg, worse than best |
| DB schema errors | Not measured | 4 failed queries (21% of DB ops) | 🆕 New pattern |

**New pattern identified**: DB schema ignorance. Coach doesn't have the convention_checks table schema cached in context. Every investigation that touches this table starts with 2-4 failed queries.

## Was gym-batch.sh Used?

No. Zero gym references in the entire transcript. This is expected — the task was a regression investigation, not experiment execution. No gym runs were needed or attempted.

## Structural Fix Opportunities

### 1. Data Map in Coach Context (HIGH IMPACT, EASY)
Add to coach's persistent context:
```
- Convention check results: .state/may.db table convention_checks (columns: sessionId, agent, conventionId, result, details, checkedAt)
- Convention summary: .state/convention-checks/summary.json
```
**Expected savings**: 30+ ops on investigation sessions that touch convention data.

### 2. DB Schema Helper (MEDIUM IMPACT)
A `session-query` style tool or snippet that provides table schemas on demand. Coach already has `session-query` adoption — extending it with convention-check schema queries would prevent the PRAGMA fumbling pattern.

### 3. Regression Investigation Workflow (HIGH IMPACT, MEDIUM EFFORT)
A structured workflow for "investigate convention regression" that:
1. Reads the convention checker code (once)
2. Queries the correct DB table with the correct schema
3. Pulls failing session IDs
4. Analyzes transcripts for root cause
5. Checks git log for recent changes to the affected agent's files
6. Writes a brief

This would compress 82 ops to ~20-25 ops for this class of task.

### 4. Staleness Check on Dispatched Tasks (LOW EFFORT)
Before investigating a regression, check if it's already been fixed:
```
git log --since="2h ago" -- agents/<affected-agent>/
```
If a fix commit exists, the investigation becomes documentation-only (fewer ops needed).

## Verdict

This session is **representative of the known pattern** but with a new DB-schema-fumbling variant. The core issue is identical: coach lacks a mental model of the filesystem and data storage layout, so every investigation starts with 30-50 ops of rediscovery. The fix is **knowledge injection** — giving coach a data map of where things are stored — not behavioral change.

**Cost**: ~$0.50-0.80 (82 ops × claude-opus-4.6)  
**Potential savings with structural fixes**: 50-60% reduction (→ ~30-35 ops for equivalent investigation)
