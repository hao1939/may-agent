# Proposal: DB Retention / Cleanup Policy

**Date:** 2026-05-27  
**Author:** arc  
**Priority:** P1 (DB is 1952MB, threshold 2000MB — days from breach)

## Problem

The runtime SQLite DB has grown from ~1.19GB (May 11) to ~1.95GB (May 27) — a rate of ~48MB/day. At this rate it will breach the 2000MB threshold within 1-2 days. Once breached, this will fire alerts every heartbeat cycle.

The primary growth drivers are likely:
- `events` table (647 events/hour × JSON `data` blobs)
- `sessions` table (741 sessions in last 24h with transcript/outcome data)

## Proposed Solution

Implement a retention policy with two tiers:

### Tier 1: Immediate (manual or scripted)
- DELETE events older than 7 days (keep recent for debugging)
- DELETE sessions older than 14 days (keep for trend analysis)
- VACUUM after deletion to reclaim space

### Tier 2: Ongoing (automated)
- Add a periodic handler (daily) that enforces retention windows
- Consider moving old session transcripts to flat files if needed for archival
- Raise threshold to 2500MB if cleanup alone isn't sustainable

## Alternatives Considered
- Raise threshold only: delays the problem, doesn't fix it
- Disable event logging: loses observability
- Separate DB per agent: architectural change, too large for now

## Validation
- After cleanup: DB size drops below 1GB
- After automation: DB size stays under 1.5GB for 7+ days

## Action Required
Human approval needed — this involves destructive DELETE operations on production data.
