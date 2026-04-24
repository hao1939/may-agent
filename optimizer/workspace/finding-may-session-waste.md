# Finding: May Session Waste — 36.5% of All Sessions Are Zero-Deliverable May Heartbeats

**Date**: 2026-03-17  
**Severity**: HIGH  
**Status**: Actionable

## Data

| Metric | Value |
|--------|-------|
| May sessions in last 200 | 82 (41%) |
| May sessions with 0 deliverables | 73/82 (89%) |
| Total zero-value May sessions as % of all | 36.5% |
| May sessions total (all time) | 465/1435 (32.4%) |
| May sessions with 0 deliverables (all time) | 430/465 (92.5%) |

## Root Cause

May's heartbeat re-triggers because:

1. **Permanently-unchecked todo items**: May's `todo.md` has 3 unchecked `- [ ]` items from `coach-reflect` (2026-03-19). These are stale tasks that May cannot action alone. The heartbeat infrastructure interprets unchecked items as "remaining work" → re-triggers.

2. **Send-triggered heartbeats**: Every `agents.send()` to May fires `triggerNow()` on May's heartbeat. Other agents frequently send handoffs/briefs to May.

3. **Previous fix insufficient**: Commit `8c8cf0b` (smart reload) reduced timer resets but didn't address the fundamental issue: unchecked todo items causing `hasRemainingWork() → true`.

## Impact

- **36.5% of all system sessions produce zero value** — just May saying "0 dispatchable, 31 BLOCKED on Hao"
- Each May heartbeat consumes ops budget, API tokens, and wall-clock time
- Crowds out potentially useful sessions from other agents

## Proposed Fix (in priority order)

### Fix 1: Mark stale todo items as blocked (immediate, no code change)
Convert the 3 unchecked `- [ ]` items to `- [x] BLOCKED:` or remove them. This stops the re-trigger if `hasRemainingWork()` checks for unchecked items.

### Fix 2: Add session dedup/cooldown for May (code change)
Add a minimum interval between May heartbeat sessions (e.g., 5 min). If May just completed a "0 dispatchable" heartbeat, skip the next trigger.

### Fix 3: Idle skip improvement (code change)  
Enhance the idle heartbeat pre-flight (`848ebf1`) to check not just for pending `send()` but also for whether todo.md has changed since last heartbeat.

## Recommendation

Fix 1 is zero-risk and can be done right now. Notify May to check off or mark blocked the 3 stale items.
