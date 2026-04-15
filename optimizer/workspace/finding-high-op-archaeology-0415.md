# Finding: High-Op Session Archaeology — Apr 15, 2026

**Date**: 2026-04-15 19:31 UTC  
**Analyst**: optimizer (Mode A: Session Archaeology)  
**Period**: Last 6 hours (13:30–19:30 UTC)

## Executive Summary

Four sessions exceeded 100 ops in the last 6h, consuming **522 ops (14.7%)** from only **1.8% of sessions**. The largest — May's 183-op "metrics status" session — was an unbounded human query that ran for 81 minutes before being interrupted. The systemic pattern: **unbounded tasks assigned to long-running sessions produce disproportionate op consumption** without proportionate output.

## System Overview (Last 6h)

| Metric | Value |
|--------|-------|
| Total sessions | 228 |
| Total ops | 3,553 |
| 100+ op sessions | 4 (1.8%) |
| Ops in 100+ bucket | 522 (14.7%) |
| 50-100 op sessions | 7 (3.1%) |
| Ops in 50-100 bucket | 453 (12.7%) |

**Top agent op consumption**: tech-lead 861 (37 sessions, avg 23), bob 749 (35 sessions, avg 21), may 656 (21 sessions, avg 31), coach 544 (27 sessions, avg 20).

## Session-by-Session Analysis

### 1. May 183 ops — "What is the status of metrics system building?" 
**Status**: interrupted (aborted after 81 min)  
**Eval**: q=0.75, eff=0.80, verdict=good  
**Children**: 0 (all work done in one monolithic session)

**Root Cause**: Unbounded human query ("What is the status? Moving forward") with no scope limit. The session had 3 infrastructure retries for empty_response before running 78 turns. It was eventually aborted ("Request was aborted").

**Key issue**: This is a conversational, open-ended human task with no clear termination criteria. 183 ops for a status query is extremely high. The session had no children — all work happened monolithically.

**Waste estimate**: A well-scoped status query should be 20-40 ops. ~140 ops wasted (~$2-4 at typical rates).

### 2. May 128 ops — "Guard Escalation Correction"
**Status**: idle  
**Context**: Human correction about guard implementation  
**Assessment**: Human-driven correction task — the high op count may be justified if significant code changes were needed, but "idle" status suggests the session stalled.

### 3. Tech-lead 108 ops — "Evaluator quality=0.00 Bug (IT-28)"
**Status**: done  
**Eval**: q=0.75, eff=0.80, verdict=good  
**Duration**: 17 min

**Assessment**: P0 bug investigation completing in 17 min with "good" verdict. 108 ops for a cross-system debugging task (evaluator scoring 0.00 across all sessions) is **reasonable**. The evaluator had a scoring bug that required investigating multiple agents, reading eval code, and testing fixes. This is the kind of session that SHOULD use many ops.

### 4. Tech-lead 103 ops — Heartbeat
**Status**: interrupted  
**Eval**: q=0.75, eff=0.80, verdict=good

**Assessment**: Heartbeat sessions shouldn't need 100+ ops. This is likely scope creep during heartbeat — the tech-lead found work to do and kept going instead of delegating.

### 5. Bob 86 ops — Gym Scenario Design
**Status**: done  
**Eval**: q=0.72, eff=0.60, verdict=acceptable  
**Eval issues**: Multiple unresolved failure chains (20 wasted calls), FM-2.6 reasoning-action mismatch, FM-3.3 verification failures

**Assessment**: 86 ops for 2 scenario designs is **bloated**. 20 wasted calls (23%) from failure chains. The low efficiency score (0.60) confirms this. Bob struggled with test failures and criteria validation without driving them to closure.

### 6. Coach 80 ops — Promoted Skill Regression Check
**Status**: interrupted  
**Eval**: q=1.0, eff=0.80, verdict=good

**Assessment**: Regression checking 3 promoted skills with gym runs. 80 ops may be justified if it involved running 3+ gym scenarios and analyzing results. Quality=1.0 suggests valuable output.

## Systemic Patterns

### Pattern 1: Unbounded Human Queries → Runaway Sessions
The May 183-op session is the clearest example. "What is the status of X? Moving forward" has no natural stopping point. The agent kept working because the task had no completion criteria.

**Fix**: Human queries should be time-boxed or op-budgeted. May's task router should decompose "status + moving forward" into (1) a bounded status report (max 30 ops) and (2) specific next actions delegated as separate bounded sessions.

### Pattern 2: Monolithic Sessions vs. Delegation
The 183-op May session had 0 children. All work was done in one session. In contrast, well-structured work delegates subtasks and stays lean.

**Fix**: Sessions exceeding ~50 ops should be flagged for delegation opportunities. May should fork subtasks rather than doing everything inline.

### Pattern 3: Failure Chains Inflate Op Counts
Bob's 86-op session had 20 wasted calls (23%). The first Bob session (68 ops) also had failure chains. Common causes: PATH issues (FM-1.3), schema mismatches (FM-2.6), wrong directory assumptions.

**Fix**: These are known failure modes with known fixes (PATH export, schema checks). The agents should have these patterns in their active recall.

### Pattern 4: Heartbeat Scope Creep
Tech-lead 103-op heartbeat: heartbeats should scan → delegate, not scan → execute. When a heartbeat finds substantial work, it should fork a work session rather than doing it inline.

**Fix**: Heartbeat op budgets should be enforced more aggressively. Current heartbeat budget appears insufficient to prevent scope creep.

## Efficiency Opportunity

| Bucket | Sessions | Ops | % of Total |
|--------|----------|-----|------------|
| Lean (1-30 ops) | 198 (87%) | 1,850 (52%) | Expected |
| Medium (31-50 ops) | 19 (8%) | 728 (20%) | Acceptable |  
| Heavy (51-100 ops) | 7 (3%) | 453 (13%) | Review case-by-case |
| Extreme (100+ ops) | 4 (1.8%) | 522 (15%) | **Intervention target** |

If the 4 extreme sessions were bounded at 60 ops each, that's 522 → 240 ops, saving **282 ops (7.9% of system total)**.

## Recommendations (Priority Order)

1. **Decompose unbounded human queries**: May's task handler should break "status + next steps" into bounded subtasks. Target: <40 ops for status reports.
2. **Heartbeat delegation gate**: When a heartbeat identifies >20 ops of work, it MUST fork rather than execute inline. (Note: this is content guidance within existing heartbeat steps, not structural change — per KE-008).
3. **Bob failure chain reduction**: Ensure Bob has PATH export and schema awareness in active recall to prevent repeated FM-1.3/FM-2.6 chains.
4. **Session budget soft-warnings**: At 60 ops, inject a "budget check" that asks the agent to justify continued work vs. finishing and delegating remaining items.

## Data Sources
- `sessions` table: opCount, status, task, startedAt/endedAt
- `evaluations` table: quality, efficiency, verdict, issues
- `session_digests` table: step-by-step progression for May 183-op session
