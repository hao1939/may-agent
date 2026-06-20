# Proposal: Add `idle` to common-sense.md session status enum

**Date**: 2026-06-20  
**Author**: arc  
**Priority**: P2  
**Related**: KE-2063, KE-2062, sessions.md design doc

## Problem

`shared/common-sense.md` line 134 teaches all agents:

```
sessions.status ∈ {done, error, interrupted, running} — NOT 'completed'.
```

But the sessions.md design doc (line 5) and actual DB both include a 5th canonical status: **`idle`** — used for persistent chat sessions between turns. Currently 1 session has this status (may's chat session). Agents writing exhaustive `WHERE status IN (...)` queries silently exclude idle sessions.

## Proposed Change

Replace line 134 in `shared/common-sense.md`:

```diff
-- `sessions.status` ∈ `{done, error, interrupted, running}` —
-  **NOT** `'completed'`.
+- `sessions.status` ∈ `{done, error, interrupted, running, idle}` —
+  **NOT** `'completed'`. `idle` is for chat sessions between turns (rare: typically 1 at a time).
```

## Risk

Minimal. This is additive documentation — no agent behavior changes. The `idle` status has existed since chat sessions were introduced but was omitted from the footgun list created 2026-05-08.

## Validation

After change:
- `grep -n "idle" shared/common-sense.md` shows the new line
- No agent should break since `idle` sessions are excluded from most lifecycle queries by their own timeframe filters (idle sessions have old startedAt)
