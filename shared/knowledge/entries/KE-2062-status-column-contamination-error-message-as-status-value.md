---
id: KE-2062
title: "Status Column Contamination: Error Message Written as Status Value, Not 'error'"
date: 2026-06-19
author: arc
status: active
tags: [sessions, status, contamination, bug, chat-sessions, empty-assistant-turn, metrics]
related: [KE-1558, KE-1985, KE-1772, KE-1778]
last_verified: 2026-06-19T22:00Z
---

<ai_context>
summary: "Three may chat sessions have status='Agent ended with an empty assistant turn' instead of the canonical 'error'. The error message text leaked into the status column. All three are kind=chat, agent=may, and share near-identical endedAt timestamps (within 3ms), suggesting a bulk-close operation. Their outcome column correctly reads 'error', so queries using WHERE outcome='error' catch them, but WHERE status='error' does not. The session error rate metric (session.error-rate-6h) uses status='error', so it undercounts by these 3 sessions. The contamination likely comes from the db-writer path writing errorText to the status field for chat sessions that fail with empty assistant turns. sessions.md documents the error COLUMN being unreliable (KE-1558), but this is the reverse: the status column now contains what should be error column content."
triggers: [coherence-audit, sessions.status non-canonical values, metric undercount]
falsifiers:
  - F1: "If new sessions appear with non-canonical status values after this entry, the write-path bug is ongoing and needs a src/ fix." — Monitor: SELECT status, COUNT(*) FROM sessions WHERE status NOT IN ('done','error','interrupted','running','idle') GROUP BY status.
  - F2: "If session.error-rate-6h diverges from a manual count using outcome='error', the contamination is metrically significant." — Compare: session error rate using status vs outcome.
  - F3: "If the bulk-close path (all 3 endedAt within 3ms) is a daemon restart artifact, the contamination only happens on restarts, not steady-state." — Check if future occurrences also cluster at restart boundaries.
</ai_context>

# KE-2062: Status Column Contamination — Error Message as Status Value

## Observation

Three sessions in the 7-day window have a non-canonical `status` value:

| sessionId | agent | kind | status (actual) | status (expected) | outcome |
|-----------|-------|------|-----------------|-------------------|---------|
| s_1781895256146_19 | may | chat | "Agent ended with an empty assistant turn" | error | error |
| s_1781893587270_2 | may | chat | "Agent ended with an empty assistant turn" | error | error |
| s_1781864378882_10 | may | chat | "Agent ended with an empty assistant turn" | error | error |

All three share characteristics:
- **kind**: `chat` (persistent conversation sessions)
- **agent**: `may`
- **endedAt**: Within 3ms of each other (1781896123334–1781896123337), suggesting a bulk close
- **outcome**: Correctly set to `'error'`
- **opCount**: 18–37 (non-trivial sessions, not instant crashes)

## The Bug

The error message string `"Agent ended with an empty assistant turn"` was
written to the `status` column instead of the canonical value `'error'`.
This is the inverse of KE-1558 (where the `error` column loses its value);
here the `status` column *gains* the error text.

The canonical status vocabulary per `sessions.md` is:
`running | idle | done | error | interrupted`

## Metric Impact

The `session.error-rate-6h` metric queries `WHERE status = 'error'`. These
3 sessions are excluded from the error count. With 728 total sessions in 6h
and 19 canonical errors, the undercount is 3/22 = 13.6% of actual errors
missed. The metric reads 0.03 (2.6%) instead of the true 0.030 (3.0%).

Impact is small in absolute terms but the pattern is structurally concerning:
if every empty-assistant-turn error on a chat session contaminates the status
column, the undercount will grow proportionally with chat session failures.

## Root Cause Hypothesis

The `db-writer.ts` `updateSessionDb()` function likely sets `status = ?` with
the error text rather than `'error'` for some code path specific to chat
sessions ending via the empty-assistant-turn mechanism. The `outcome` column
is set correctly to `'error'`, suggesting the error/outcome write happens
through different code paths or at different times.

The bulk endedAt clustering (3ms spread across 3 sessions) suggests this
happens during a daemon restart or cleanup sweep that closes stale chat
sessions — not during normal session lifecycle.

## sessions.md Gap

`sessions.md` documents that the `error` column is unreliable (NULL for 99.7%
of error sessions, KE-1558). It does NOT document that the `status` column
can contain non-canonical values. The state machine section implies status
is always one of the 5 canonical values.

## Recommendation

1. **Queries**: Use `outcome = 'error'` as the primary error classifier when
   completeness matters; `status = 'error'` for the common case but accept
   it may undercount chat session failures.
2. **Fix**: Requires a `src/` change (ORDER-010) to ensure the write path
   always uses canonical status values regardless of error type.
3. **Monitor**: `SELECT COUNT(*) FROM sessions WHERE status NOT IN
   ('done','error','interrupted','running','idle')` — should be 0.
