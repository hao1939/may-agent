---
id: KE-2028
title: "Task Text Stored 6× Per Session — 968 MB (49% of DB) Is Duplicated Task Strings"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, storage-waste, task-duplication, optimization, capacity-planning]
related: [KE-2027, KE-2023, KE-2024, KE-2025]
---

<ai_context>
summary: KE-2027 identified session_digests step>1 task duplication (272 MB). This entry reveals the full scope: the same task text is stored in **six** places per workflow session — sessions.task (253 MB), session_digests step=1 (253 MB), session_digests step>1 (272 MB), workflow_runs.task (190 MB partially overlapping), events.data.task across session.start/session.end/session.completed (544 MB). Total task-related storage: ~1,512 MB across all tables — in a 1,981 MB database. Even conservatively, 968 MB (49%) is pure duplication that could be eliminated by: (1) NULLing task in session_digests step>1 (saves 272 MB, KE-2027 proposal), (2) stripping task from event data JSON after sessions table has it (saves ~544 MB), (3) storing workflow_runs.task as a delta/reference rather than the base prompt repeated. All three are ORDER-010 src/ changes.
triggers: heartbeat DB at 1988/2000 MB (12 MB headroom, minutes to breach), extending KE-2027 investigation
falsifiers:
  - F1: "If events.data.task content differs materially from sessions.task for >5% of sessions, the event copy carries independent information."
  - F2: "If removing task from events breaks event replay or handler processing that needs the task before the session row exists, the duplication is load-bearing."
  - F3: "If db-retention runs a VACUUM and drops the DB below 1800 MB in the next 2h, the duplication is within tolerance and the threshold raise alone suffices."
</ai_context>

## Observation

DB at 1,981 MB (metric reports 1,988) with 2,000 MB threshold — **12 MB headroom, breach imminent**.

Extending KE-2027's investigation beyond session_digests, the task prompt string is stored in **six** locations per workflow session:

| Storage Location | Size (MB) | Rows | Notes |
|-----------------|-----------|------|-------|
| `sessions.task` | 253 | 22,201 | Authoritative copy |
| `session_digests` step=1 `.task` | 253 | 22,221 | Identical to sessions.task (verified: 100% match over 24h) |
| `session_digests` step>1 `.task` | 272 | 23,766 | Identical to step=1 (KE-2027); includes step=2 (253 MB) + step=3+ (19 MB) |
| `workflow_runs.task` | 190 | 40,215 | Partial overlap — contains the base prompt before workflow expansion |
| `events.data` containing `$.task` | 544 | — | Across session.start (76 MB/day), session.end (75 MB/day), session.completed (64 MB/day) |
| **Total task storage** | **1,512** | — | **76% of 1,981 MB DB** |

Even if workflow_runs.task contains different (shorter) content than sessions.task (confirmed: sessions.task averages 14.5 KB larger due to workflow header injection), the remaining five copies are near-identical.

## Authoritative Copy

`sessions.task` is the single source of truth. Every other copy is either:
- **Exact duplicate**: session_digests.task (all steps) = sessions.task (100% match)
- **JSON-embedded duplicate**: events.data.task = sessions.task embedded in event JSON
- **Partial duplicate**: workflow_runs.task ⊂ sessions.task (the base prompt before expansion)

## Savings Potential

| Fix | Saves (MB) | Complexity | Requires |
|-----|-----------|-----------|----------|
| NULL task in session_digests step>1 | ~272 | Low (1-line change) | ORDER-010 |
| NULL task in session_digests step=1 (use sessions.task via JOIN) | ~253 | Medium (audit all digest readers) | ORDER-010 |
| Strip task from event JSON | ~544 | Medium-High (audit all event consumers) | ORDER-010 |
| Reference workflow_runs.task instead of copying | ~150 | High (pipeline change) | ORDER-010 |
| **Conservative total (step>1 only)** | **272** | **Low** | **KE-2027 proposal** |
| **Moderate total (all digest + events)** | **~1,069** | **Medium** | **New proposal** |

## Current Situation

The DB is at 1,988 MB with a 2,000 MB threshold. Growth rate is ~26 MB/h. **Breach will occur within 30 minutes** without intervention.

Three proposals are queued but none approved:
1. P1: NULL task in step>1 digests (saves 272 MB) — proposed this session
2. P1: Raise threshold to 2500 MB (buys ~20h) — proposed 2026-06-17
3. P2: Guard event dedup (reduces guard triggers, not DB size directly)

## Why This Matters Beyond DB Size

The task text duplication is not just a storage problem — it's a throughput multiplier:
- Every new session generates ~6 copies of the task string
- At 4,600 sessions/day × avg 17 KB task × 6 copies = **470 MB/day** of task text written
- This is the largest single contributor to DB growth, exceeding all other columns combined
- The 7-day event retention and 14-day session retention are correctly purging old rows, but the duplication ratio means the steady-state is inflated 6×

## Recommendation

1. **Immediate**: Threshold raise to 2500 MB is the only fix that can land before breach (no src/ change needed — it's a metric config update, but still ORDER-010)
2. **Short-term**: KE-2027 proposal (NULL step>1 task) — saves 272 MB, single-line fix
3. **Medium-term**: Strip task from events data JSON — saves 544 MB but requires consumer audit
4. **Architecture note**: The system should have one authoritative task store (sessions.task) with all other tables referencing sessionId for the task text on read
