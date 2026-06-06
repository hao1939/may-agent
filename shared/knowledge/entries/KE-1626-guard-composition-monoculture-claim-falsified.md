<ai_context>
triggers: guard composition, monoculture, beforeToolCall, uncommitted warnings, guard diversity, guards.md, coherence audit
audience: arc, may, evaluator
lifecycle: active
</ai_context>

# KE-1626 — Guard Composition Monoculture Claim Falsified

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)

## Finding

`shared/may-agent-docs/2a-design/guards.md` (update 2026-07-06) claimed:

> guard composition has collapsed to a single signal — 100% of tool-level
> (`beforeToolCall`) triggers are commit-guard "uncommitted files" warnings

Current data (24h window, 2026-06-06) shows this claim is **false**:

| Signal type | Count | % of tool-level |
|---|---|---|
| uncommitted-files | 934 | 50% |
| SESSION_BASH_CAT | 333 | 18% |
| PATH_HALLUCINATION | 221 | 12% |
| SESSION_READ | 201 | 11% |
| READ_DEDUP | 35 | 2% |
| **Total tool-level** | **1,858** | **100%** |

This is actually much closer to the earlier 2026-06-14 snapshot (49% uncommitted, 18% SESSION_BASH_CAT, 10% PATH_HALLUCINATION, 10% SESSION_READ) than to the claimed monoculture.

Workflow-level guards also fire: `hallucinated-path` (109/day), `read-before-edit` (20/day).

## Root Cause

The 2026-06-06 observation was likely either:
1. A transient state during a period of reduced agent activity (fewer diverse sessions → fewer diverse guards)
2. A measurement error (wrong time window or query)

## Action Taken

Updated `shared/may-agent-docs/2a-design/guards.md` volume note paragraph to reflect current data and note the reversal. The prior monoculture claim is now annotated as falsified.

## Lesson

Guard composition is volatile and shifts with agent activity mix. Point-in-time claims about composition ("100% single type") should include the window size and be marked as snapshots, not durable truths.

## Cross-Reference

- KE-1362: monoculture pattern (original observation)
- KE-1564: composition shift
- KE-1567: uncommitted-files rebound
