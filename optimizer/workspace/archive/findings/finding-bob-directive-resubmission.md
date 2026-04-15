# Finding: Bob Directive Resubmission Waste

**Date**: 2026-03-18T09:49  
**Category**: Waste Elimination  
**Impact**: Moderate — repeated LLM sessions processing already-completed work

## Problem

Bob repeatedly resubmits the same directive (P13/P108 soul updates) to May. Evidence from May session `s_1773826062567_16`:

- **req:a41a944d** (05:47 UTC) — May: "Already completed in prior heartbeat (commit 86bf491)"
- **req:a662005e** (06:19 UTC) — May: "Executed Bob's directive. P13 already in philosophy.md"
- **req:91d8a310** (07:28 UTC) — May: "Already completed in prior heartbeats"
- **req:fa7fe697** (09:27 UTC) — May: "Already completed in prior heartbeats"

That's **4 separate sessions** processing the same already-completed work.

## Root Causes

1. **Bob's directive files persist** — `agents/bob/workspace/directive-soul-updates-p13-p108.md` and `directive-soul-updates.md` remain in his workspace even after May completed them. Bob sees them and resubmits.

2. **No request deduplication** — The request system doesn't detect that semantically identical requests have already been COMPLETED. Each resubmission creates a new request ID.

3. **Bob doesn't verify completion** — Bob's heartbeat doesn't check if directives were already fulfilled before re-sending them.

## Cost

Each May session processing a duplicate costs ~$0.03-0.06 in LLM calls. With 4 duplicates: ~$0.12-0.24 just for this one directive. If this pattern generalizes across all agents, it could waste $1-5/day.

## Proposed Fixes

1. **Immediate (Bob-side)**: Bob should check `agents.requests({filter: "all"})` for completed tasks matching his directive before resubmitting. If a matching request is COMPLETED, skip.

2. **Structural (request-db)**: Add a dedup check in the request creation path — if a semantically similar request (same from/to/artifact) was COMPLETED in the last 24h, warn or block.

3. **Cleanup**: Bob should archive/delete directive files after confirmation they're completed.

## Recommendation

Send to Coach to add a convention: "Before sending a directive, check if a matching request was already completed." Also recommend Bob's heartbeat.md gets a verification step.
