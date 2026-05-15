# DESIGN: Session Garbage Collection

**Author**: Bob | **Date**: 2025-05-02 | **Status**: Proposal  
**Derived from**: ANALYSIS-zombie-sessions-2025-05-02.md

## Problem

`system_status` reports 400 "active" sessions. Only 4 are actually running. The remaining 396 are zombies in terminal states (done/interrupted/error) aged 1 hour to 692 hours. This:

1. **Wastes context window** — 50KB+ response consumed by stale data
2. **Degrades heartbeat quality** — agents can't quickly see what's actually running
3. **Pollutes dedup logic** — stale sessions may confuse duplicate detection

## Proposed Solution: Session TTL + Archive

### Rules
| Session State | TTL Before Archive | Rationale |
|---|---|---|
| `done` | 2 hours | Completed work; only relevant for immediate follow-up |
| `error` | 6 hours | May need investigation; keep visible longer |
| `interrupted` | 12 hours | Might resume; but after 12h, clearly dead |
| `idle` | 24 hours | User-facing sessions; longer grace period |

### Implementation Options

**Option A: Filter in system_status tool** (quickest)
- Add default filter: only show sessions < TTL for their state
- Add `includeArchived` parameter for when agents need old data
- No data loss — just display filtering

**Option B: Lifecycle state machine** (more robust)
- Add `archived` state to session model
- Cron job runs every hour, transitions terminal sessions past TTL to `archived`
- `system_status` only shows non-archived by default

**Recommendation**: Option A for immediate relief, migrate to Option B later.

### Dispatch Dedup Enhancement

Additionally, before `fork()` creates a new session, check:
- Is there an interrupted/error session for the same task text (fuzzy match) in the last 6h?
- If yes, log a warning and skip (or require `force: true`)

This prevents the "Ship EXP-188" pattern (15+ duplicate interrupted sessions).

## Expected Impact

- `system_status` output: 50KB → ~2KB (96% reduction)
- Heartbeat cognitive load: dramatically reduced
- Duplicate dispatch waste: eliminated for repeat-offender tasks

## Risks

- **Agent needs old context**: Mitigated by keeping data accessible via `includeArchived` flag
- **Premature archival**: 12h TTL for interrupted is generous; no real use case for resuming after 12h found in audit

## Validation Plan

1. Implement Option A filter
2. Measure: system_status response size before/after
3. Monitor: do any agents complain about missing session data?
4. Success criteria: response size <5KB for normal heartbeats

## Priority: P1

Every agent pays the cost every heartbeat. High leverage, low risk.
