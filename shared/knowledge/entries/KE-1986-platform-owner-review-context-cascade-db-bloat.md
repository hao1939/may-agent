---
id: KE-1986
title: "Platform-Owner-Review Context Cascade: Exponential Event Data Growth Causes DB Bloat"
date: 2026-06-14
author: arc
status: active
tags: [db-size, context-cascade, platform-owner-review, may, events, bloat]
related: [KE-1944]
---

## Context

DB size breached 4.2GB (threshold: 2GB) despite retention policies being
implemented and working (events 7d, sessions 14d, metric_snapshots 14d,
session_digests 14d, workflow_runs 14d, evaluations 30d). Row counts are
reasonable (~527K total rows across all tables). The bloat source is
not row count but row size.

## Claim

The `workflow:platform-owner-review` workflow is creating a **context
cascade**: each session's event data blob includes the full conversation
history from all prior sessions in the workflow run, causing exponential
growth. The last 6 sessions from this workflow show:

| Session | Event data size | Growth factor |
|---------|----------------|---------------|
| s_..._23 | 1.6 MB | — |
| s_..._30 | 4.0 MB | 2.5x |
| s_..._33 | 10.5 MB | 2.6x |
| s_..._35 | 28.3 MB | 2.7x |
| s_..._43 | 78.0 MB | 2.8x |
| s_..._45 | 220.4 MB | 2.8x |

Each session emits 2-3 events (session.start, session.end, session.completed),
tripling the storage impact. Total: **22 oversized events (>1MB each)
consuming 987.6 MB** — nearly 1 GB of the 4.2 GB database.

## Correlation with May Error Spike

All 6 may zero-opCount error sessions in the last hour are from this
workflow. The sessions error with "Agent ended with an empty assistant
turn" or similar, likely because the context prompt exceeds the LLM's
context window or processing capability. The workflow retries, each
retry accumulates more history, and the cycle accelerates.

## Root Cause

The `platform-owner-review` workflow serializes the full conversation
state (including all prior turns from all prior sessions) into the
`data` field of session lifecycle events. This is passed through
`session.start` → LLM → `session.end` → next `session.start`, with
each iteration adding its own turns to the accumulated history.

## Impact

1. **DB size**: 987.6 MB from 22 events (23% of total DB)
2. **May errors**: 22% error rate in the last hour (6/27 sessions)
3. **Event bus load**: Each 220MB event must be serialized, stored,
   and parsed by all event subscribers
4. **Retention ineffective**: Even 7d retention can't help if a single
   workflow run generates 1GB of events in hours

## Remediation Options

1. **Immediate (src/ change, needs Hao):** Cap event `data` field size
   in `db-writer.ts` — truncate or omit conversation history beyond N
   bytes (e.g., 100KB).
2. **Workflow fix (needs Hao):** The `platform-owner-review` workflow
   should not forward full conversation history to subsequent sessions.
   Pass only a summary or the last N turns.
3. **Retention enhancement (db-retention.ts, may lane):** Add a
   size-based retention pass that deletes events where `LENGTH(data)
   > 1000000`, regardless of age.

## Falsifiers

- F1: If the `platform-owner-review` workflow stops running (manually
  killed or no more events trigger it), the 22 oversized events will
  be purged by 7d retention and DB size should drop ~1GB.
- F2: If another workflow starts showing the same pattern, the root
  cause is in the session lifecycle event serialization, not specific
  to platform-owner-review.
