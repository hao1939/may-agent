# Request Dedup — Analysis

**Date**: 2026-04-25
**Owner**: optimizer

## Problem Statement

78% of tracked requests (21/27 sample) are duplicates. The `agents` tool has a `force` flag for duplicate detection, but agents routinely send the same notification/fork multiple times across heartbeats.

## Root Causes

1. **Stateless heartbeats**: Agents re-detect the same issue each heartbeat and re-notify without checking if they already reported it
2. **No dedup in notification path**: The `notify` tool may flag duplicates but agents can bypass with `force: true` or the detection may be too lenient
3. **Requests table empty (0 rows)**: The infrastructure tracking DB isn't populating, so there's no history to dedup against

## Evidence

From `events` table:
- 462 `agent.notification` events total
- Multiple inbox items about the same issue (requests.db empty) sent by 6+ different agents over 43h
- The optimizer inbox alone has 12+ pending items, many about the same 2-3 topics

## Proposed Milestones

### M1: Notification Content Hash Dedup
Add a content-hash-based dedup layer. Before inserting a notification event, hash `(owner, source, task_prefix_100chars)` and check against recent (24h) events. Skip if duplicate exists.

### M2: Agent-Side "Already Reported" Check  
Add a utility function agents can call: `hasRecentNotification(target, topicHash)` that checks the events table. Integrate into heartbeat templates.

### M3: Inbox Dedup on Read
When building inbox for heartbeat, collapse duplicate notifications into a single entry with count badge (e.g., "requests.db empty (reported 6x)").

## Impact

- Reduce notification noise by ~70%
- Reduce agent ops wasted processing duplicate inbox items
- Improve signal-to-noise ratio for all agents
