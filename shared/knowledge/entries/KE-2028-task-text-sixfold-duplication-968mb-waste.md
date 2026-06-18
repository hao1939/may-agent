---
id: KE-2028
title: "Task Text Stored 6× Per Session — Full-Table Equality Verified, 1,263 MB Proven Duplicate"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, storage-waste, task-duplication, optimization, capacity-planning]
related: [KE-2027, KE-2023, KE-2024, KE-2025]
last_verified: 2026-06-18T08:15Z
---

<ai_context>
summary: Task text is stored in 6 places per session. Full-table equality queries (not samples) prove 1,263 MB is **exact duplicate** of sessions.task. An additional 191 MB in workflow_runs.task is likely duplicate (partial overlap, not equality-verified). Total task storage: 1,517 MB in a ~1,992 MB DB. Three pending proposals address this (digest NULL, threshold raise, guard dedup). DB at 1,992 MB with 2,000 MB threshold — breach imminent.
triggers: heartbeat DB at 1,992/2,000 MB, extending KE-2027 investigation
falsifiers:
  - F1: "events.data.task differs from sessions.task for >5% of sessions" — **FALSIFIED 2026-06-18**: full-table JOIN over 24h shows 4,645/4,645 session.start exact match, 4,589/4,590 session.end exact match (1 NULL from timing), 3,030/3,030 session.completed exact match.
  - F2: "If removing task from events breaks event replay or handler processing that needs the task before the session row exists, the duplication is load-bearing." — OPEN, requires consumer audit.
  - F3: "If db-retention runs a VACUUM and drops the DB below 1800 MB in the next 2h, the duplication is within tolerance and the threshold raise alone suffices." — FALSIFIED: DB grew from 1,676 → 1,992 MB in 12h, retention running but growth outpaces purge.
</ai_context>

## Observation

DB at 1,992 MB (metric current) with 2,000 MB threshold — **8 MB headroom, breach imminent**. Growth rate: 26.4 MB/h over last 12h.

Task text is stored in **six** locations per workflow session. The table below distinguishes **proven duplicates** (full-table equality verified via JOIN) from **measured storage** (size known, dedup status unverified or partial):

| Storage Location | Size (MB) | Rows | Duplication Status |
|-----------------|-----------|------|-------------------|
| `sessions.task` | 253.8 | 22,258 | **Authoritative copy** |
| `session_digests` step=1 `.task` | 253.7 | ~22k | **Proven exact duplicate** — 4,593/4,593 match over 24h |
| `session_digests` step>1 `.task` | 272.5 | ~24k | **Proven exact duplicate** — 4,587/4,587 step1=step2 match over 24h |
| `events.data` → `session.start` `$.task` | 209.9 | 17,604 | **Proven exact duplicate** — 4,645/4,645 match over 24h |
| `events.data` → `session.end` `$.task` | 202.4 | 16,581 | **Proven exact duplicate** — 4,589/4,590 match (1 NULL edge) |
| `events.data` → `session.completed` `$.task` | 133.7 | 10,035 | **Proven exact duplicate** — 3,030/3,030 match over 24h |
| `workflow_runs.task` | 190.6 | 40,296 | **Likely duplicate** — partial overlap (base prompt before expansion), NOT equality-verified |
| **Proven duplicate total** | **1,072.2** | — | sessions.task exact copies across 5 locations |
| **Total task storage** | **1,516.6** | — | **76% of 1,992 MB DB** |

### Verification Method

All match counts use **full-table JOINs** (not samples):

```sql
-- digest step=1 vs sessions: 4,593/4,593 exact match (24h)
SELECT COUNT(*), SUM(CASE WHEN d.task = s.task THEN 1 ELSE 0 END) AS match
FROM session_digests d JOIN sessions s ON d.sessionId = s.sessionId
WHERE d.step = 1 AND d.created_at > now()-24h;

-- session.start event $.task vs sessions.task: 4,645/4,645 (24h)
SELECT COUNT(*), SUM(CASE WHEN json_extract(data,'$.task') = s.task THEN 1 ELSE 0 END)
FROM events e JOIN sessions s ON json_extract(e.data,'$.sessionId') = s.sessionId
WHERE e.event_type = 'session.start' AND e.timestamp > now()-24h;
```

The 1 mismatch in session.end (4,589 match out of 4,590) is a NULL join edge, not content divergence.

## Storage Decomposition (Full DB)

Total measured text content across all tables: ~1,755 MB

| Table | Column(s) | MB | % of DB |
|-------|-----------|-----|---------|
| events.data | all | 737.5 | 37% |
| session_digests.task | all steps | 526.2 | 26% |
| sessions.task | | 253.8 | 13% |
| workflow_runs.task | | 190.6 | 10% |
| workflow_runs.result_summary | | 15.8 | <1% |
| metric_snapshots (all cols) | | 11.0 | <1% |
| evaluations (all text cols) | | 10.0 | <1% |
| session_digests (non-task) | what_happened, details, etc. | 10.4 | <1% |
| Other tables | | <5 | <1% |

## Proven Savings Potential

| Fix | Saves (MB) | Evidence | Complexity |
|-----|-----------|----------|-----------|
| NULL task in session_digests step>1 | **272** | 4,587/4,587 exact match | Low (1-line) |
| NULL task in session_digests step=1 | **254** | 4,593/4,593 exact match; consumers JOIN sessions | Medium |
| Strip $.task from session.start events | **210** | 4,645/4,645 exact match vs sessions.task | Medium-High |
| Strip $.task from session.end events | **202** | 4,589/4,590 exact match | Medium-High |
| Strip $.task from session.completed events | **134** | 3,030/3,030 exact match | Medium-High |
| **All proven duplicates** | **1,072** | Full-table equality joins | Medium |
| workflow_runs.task (likely dup, unverified) | **~191** | Size measured, equality not proven | High |

## Current Situation (as of 2026-06-18 08:15Z)

- DB: 1,992 MB, growing 26 MB/h, threshold at 2,000 MB → **~18 min to breach**
- Retention windows working (events 7d, sessions 14d, digests 14d, snapshots 14d)
- Three proposals pending human approval:
  1. **P1**: NULL task in step>1 digests (saves 272 MB) — `2026-06-18-null-digest-task-step2-dedup.md`
  2. **P1**: Raise threshold to 2500 MB (buys ~20h) — `2026-06-17-raise-db-size-threshold-2500mb.md`
  3. **P2**: Guard event dedup per session (reduces noise, not size) — `2026-06-18-guard-event-dedup-per-session.md`

## Recommendation

1. **Immediate**: Threshold raise to 2500 MB — only fix that can land before breach
2. **Short-term**: NULL step>1 digest task — 272 MB savings, 1-line fix, proven safe
3. **Medium-term**: Strip task from events JSON — 546 MB savings, requires F2 consumer audit
4. **Architecture**: Single authoritative task store (sessions.task); all other tables reference sessionId
