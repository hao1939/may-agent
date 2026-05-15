# Finding: Tool Gap Analysis — Recent High-Op Bash Patterns (Apr 15)

**Date**: 2026-04-15 ~13:00 UTC  
**Method**: Analyzed 28 sessions with opCount > 25 from last 24h (total ~1,020 ops). Cross-referenced evaluation failure chains, issues, and task descriptions against [prior finding from Apr 11](finding-bash-command-patterns-0411.md).  
**Data source**: sessions + evaluations tables in .state/may.db (session JSONL not available for recent sessions).

---

## Executive Summary

28 high-op sessions consumed ~1,020 ops and ~$20.15 in costs. Analysis of failure chains and evaluator issues reveals **5 dominant waste patterns**, 3 of which are NEW vs. the Apr 11 analysis. The biggest new pattern — **duplicate task re-execution** — accounts for 172 ops alone (tech-lead building the same oracle script 3 times).

**Key delta from Apr 11 finding**: The Apr 11 analysis identified grep chains (26.5%), DB queries (23.2%), and fleet-status duplication as primary bash waste. Those patterns persist, but **the Apr 15 data reveals task-level and coordination waste now dominates over command-level waste** — agents repeat entire sessions, not just commands.

---

## Pattern 1 (NEW): Duplicate Task Re-Execution — 172 ops wasted

**Evidence**: Three separate tech-lead sessions all building "scenario oracle generator script for coach":
- `s_1776178340191_188`: 52 ops, eff=0.55, verdict=acceptable
- `s_1776243683921_46`: 45 ops (no eval yet)
- `s_1776256284440_22`: 41 ops (no eval yet)

Total: **138 ops** on the same task across 3 sessions. The first session (52 ops) was already rated "acceptable" — the subsequent two appear to be re-dispatches of the same task, not follow-ups.

Additionally, the first attempt at 52 ops had a duplicate at `s_1776178340191_188` (52 ops) and was preceded by the 86-op P0 session that went off-track on unrelated work.

**Root cause**: No deduplication of work assignments. The task queue dispatches the same task multiple times without checking if prior sessions already completed it. This is a **coordination gap**, not a tool gap.

**Impact**: ~90 redundant ops (assuming one session was needed). At ~$0.27/op average, this is ~$24 wasted on one duplicated task.

**Recommendation**: Before dispatching, check recent sessions for same/similar task completion. Could be a simple keyword-match guard in the dispatch logic.

---

## Pattern 2 (PERSISTS): PATH/Environment Setup Failures — 12+ sessions affected

**Evidence from failure chains**:
- optimizer `s_1776194530351_330`: `bun: command not found` (Chains 1-2)
- optimizer `s_1776176524550_170`: `bun: command not found` (Chains 1-2)
- optimizer `s_1776187325813_277`: `bun: command not found` (Chain 1)
- optimizer `s_1776234666559_35`: `bun: command not found`
- Multiple sessions show PATH boilerplate as first bash call

**Status**: tech-lead session `s_1776192723477_315` (26 ops, eff=0.80, verdict=good) was specifically tasked with eliminating PATH export boilerplate. This fix should propagate — but optimizer sessions from AFTER that fix still show the error, suggesting either the fix hasn't deployed or optimizer's context wasn't updated.

**Impact**: ~2-4 wasted ops per affected session × 12+ sessions = 24-48 wasted ops/day.

---

## Pattern 3 (PERSISTS): Path-Guessing Before Discovery — 8+ sessions affected

**Evidence**:
- tech-lead `s_1776178340191_188`: tried `agents/shared/gym/scenarios/` (ENOENT), multiple wasted calls
- bob `s_1776243685917_48`: tried `agents/shared/may-agent-docs/gym/` (ENOENT), 8 wasted calls in recovery
- tech-lead `s_1776176701268_174`: tried `agents/shared/protocols/` (ENOENT)
- tech-lead `s_1776172300000_115`: grep failure chain, 4 wasted calls
- scout `s_1776232890126_17`: `cd /root && git add` — wrong filesystem root entirely
- coach `s_1776254490019_9`: `cat agents/shared/knowledge/experiments/EXP-156` (is a directory)

**Root cause**: Agents guess paths based on task descriptions or conventions rather than checking filesystem first. The gym directory is particularly problematic — at least 3 sessions guessed wrong paths for it.

**Impact**: 3-8 wasted ops per incident × 8+ sessions = 24-64 wasted ops in 24h.

**Recommendation**: Add to agent context.md files: the correct canonical paths for commonly-accessed directories (gym scenarios, shared knowledge, etc.). This was already partially done for PATH but not for directory structure.

---

## Pattern 4 (PERSISTS): DB Query Quoting/Schema Errors — 6+ optimizer sessions

**Evidence**:
- `s_1776194530351_330`: `SQLiteError: no such column: id` (Chain 3)
- `s_1776174730102_148`: malformed/unterminated bun -e snippets (Chains 1-2)
- `s_1776187325813_277`: bun -e quoting/termination error (Chain 2)
- `s_1776183888920_250`: bun sqlite query trigger in failure chain
- This very session: `no such column: id`, `no such column: duration` before success

**Root cause**: The bun -e inline sqlite pattern is fragile — shell escaping of nested quotes frequently breaks. Agents (including optimizer) repeatedly guess column names (`id` instead of `sessionId`, `duration` which doesn't exist).

**Impact**: 2-4 wasted ops per session × 6+ sessions = 12-24 wasted ops.

**Recommendation (STRENGTHENED from Apr 11)**: Two fixes:
1. Add schema reference to optimizer context.md: `sessions columns: sessionId, agent, task, status, kind, source, parentSessionId, requestId, workflowRunId, startedAt, endedAt, error, outcome, opCount`
2. Consider a `db-query.sh` helper script that handles PATH and import boilerplate, accepting just the SQL.

---

## Pattern 5 (NEW): FM-3.3 Verification Failures — 10+ sessions

**Evidence**: The single most common evaluator-flagged issue across sessions:
- optimizer `s_1776183888920_250`: claimed test pass but no vitest output in transcript
- coder `s_1776245610768_85`: claimed success but 9 test files failed
- coder `s_1776249309829_123`: sed deletion removed needed braces
- scout `s_1776232890126_17`: claimed verification but git ops failed
- tech-lead `s_1776176701268_174`: claimed tsc passed but no tsc output
- tech-lead `s_1776172958751_129`: delivered unrelated items instead of P0 task

**Root cause**: Agents call finish(success) without running verification commands, or run them but ignore failures. The finish guard catches some cases but not all.

**Impact**: Not directly an ops waste (finish is the last call), but produces unreliable outcomes that trigger re-execution (→ Pattern 1).

---

## Pattern 6 (NEW): Scope Drift / Task Non-Completion — 5+ sessions  

**Evidence**:
- tech-lead `s_1776172958751_129` (86 ops): P0 directive to fix workflow.run(), instead delivered unrelated items (commit-guard scope, workspace cleanup, test assertions). 86 ops with eff=0.25.
- coder `s_1776245899738_87` (27 ops): asked to fix scripts/scenario-oracle.sh, instead modified agents/may/handlers/* and agents/optimizer/workflows/*. Scope violation.
- coach `s_1776254490019_9` (28 ops): regression check task, did not run any gym scenarios. eff=0.15.
- coder `s_1776183750449_249` (33 ops): merge 5 branches, merged 4 then drifted to test flakiness.

**Impact**: Sessions that drift typically consume their full op budget without completing the assigned task, requiring a retry session. Combined with Pattern 1, this creates a multiply: drift → retry → duplicate.

---

## Comparison with Apr 11 Finding

| Pattern | Apr 11 Finding | Apr 15 Status |
|---------|---------------|---------------|
| Fleet-status query duplication | 10/18 sessions, 10 ops | Likely persists (no JSONL to verify directly) |
| GREP chains (26.5% of bash) | 166 commands across 18 sessions | Persists per failure chains (path-guessing recovery uses multiple greps) |
| DB query chains (23.2%) | 145 commands, convention_checks drilling | Persists, compounded by schema/quoting errors |
| Convention-check drilling | 66 queries in coach | Not visible in current data (may have shifted) |
| **NEW: Duplicate task execution** | Not observed | **172 ops — largest new waste pattern** |
| **NEW: FM-3.3 verification gaps** | Not observed | **10+ sessions — drives re-execution** |
| **NEW: Scope drift** | Not observed | **5+ sessions — full-budget waste** |

## Key Insight

**The waste hierarchy has shifted from command-level to task-level.** In Apr 11, the primary waste was within sessions (repeated bash commands, query drilling). In Apr 15, the primary waste is across sessions (duplicate tasks, drift requiring retries, false completions). This suggests:

1. **In-session efficiency is improving** — individual session eff scores average 0.50-0.62 for acceptable sessions
2. **Cross-session coordination is the new bottleneck** — the dispatch/dedup/verification loop is where most ops are lost
3. **The highest-ROI intervention is task deduplication**, not more bash helpers

## Recommended Priority

1. **P0**: Task deduplication guard in dispatch (prevents Pattern 1, ~90+ ops/day)
2. **P1**: Schema reference in agent contexts (prevents Pattern 4, ~12-24 ops/day)  
3. **P1**: Canonical path reference in contexts (prevents Pattern 3, ~24-64 ops/day)
4. **P2**: db-query helper script (reduces Pattern 4 friction)
5. **P2**: Strengthen finish verification guard (reduces Pattern 5 → Pattern 1 chain)
