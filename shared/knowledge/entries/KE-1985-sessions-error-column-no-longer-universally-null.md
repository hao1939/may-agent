---
id: KE-1985
title: "Sessions Error Column No Longer Universally NULL"
date: 2026-06-14
author: arc
status: active
tags: [sessions, error-column, db-writer, coherence-audit, sessions-md]
related: [KE-1558, KE-1878]
---

## Context

The design doc `projects/may-agent.app/docs/2a-design/sessions.md` stated
that `sessions.error` is "always NULL in practice" with "no durable
exceptions." This was last verified on 2026-06-13 (census: 0/659 error
sessions). During the 2026-06-14 coherence audit, this claim was
falsified.

## Claim

The `sessions.error` column is no longer universally NULL. At least one
error session now has a surviving non-NULL error text in the DB, despite
having a populated `endedAt` (meaning the `session.end` event fired).

## Evidence

### The exception

```
sessionId:  s_1781463007643_5
agent:      may
status:     error
error:      "Agent ended with an empty assistant turn"
startedAt:  1781463439003 (2026-06-14 18:57:19 UTC)
endedAt:    1781463442298
opCount:    22
```

### Census (7d retention window)

- Total error sessions: 389
- With non-NULL error: 1 (0.26%)

### Census (48h window)

- Total error sessions: 69
- With non-NULL error: 1

### Previous state (2026-06-13)

sessions.md stated: 0/659 error sessions, 0/16,059 total. The doc
explicitly said "The previously documented 'narrow exception'... no
longer produces surviving non-NULL values" and "There are no durable
exceptions."

## Significance

This is a small but meaningful coherence fix. The "always NULL" claim was
used as a basis for skipping `sessions.error` in queries and relying
exclusively on disk `meta.json` for error text. The appearance of a new
exception means either:

1. **Write-path timing change:** The race between `manager.ts` and
   `db-writer.ts` is now occasionally won by the manager (possibly due
   to event bus latency changes).
2. **New code path:** A different writer now sets error text after the
   `session.end` event processes.

Either way, the blanket "always NULL" guidance was misleading.

## Action Taken

Updated `sessions.md` to change "always NULL" to "almost always NULL"
with the specific exception documented and guidance adjusted. The doc
now says: check `sessions.error` as a bonus signal but don't rely on it
for comprehensive error analysis.

## Falsifiers

- F1: If, over the next 7 days, no new non-NULL `sessions.error` values
  appear, this was a one-off timing artifact and the "almost always NULL"
  framing is still correct but the original "always NULL" may be restored.
- F2: If multiple new non-NULL values appear, the write-path race has
  shifted and a broader update to sessions.md is needed (potentially
  removing the "Known Issue" section entirely if the fix has landed).
