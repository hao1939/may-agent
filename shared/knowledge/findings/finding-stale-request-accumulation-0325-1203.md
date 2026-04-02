# Finding: Stale Request Accumulation — Human Call Requests

**Date**: 2026-03-25T12:03
**Category**: Cost & Efficiency
**Severity**: Medium

## Problem
67 active requests in the tracking database, ~60 are `human→bob` echo/testing calls stuck in CREATED status. These never get cleaned up because:

1. `audit-requests.ts` step 1 only expires `send` method requests
2. Step 2 only expires `call` requests to non-agent targets
3. `call` requests to known agents (bob, optimizer) from humans slip through

## Evidence
- `agents.requests(filter='active')`: 67 active, ~60 are echo/testing
- Sample: `{fromEntity: "human", toAgent: "bob", method: "call", source: "cli-oneshot", status: "CREATED", task: "echo hello"}`
- Ages: 296-452 minutes (5-7.5 hours)
- Growth: was 48 stale at 10:33 UTC, now 67 at 12:03 UTC (growing ~12/hr during active testing)

## Root Cause
Handler-intercepted sessions (echo, say hello) complete at 0-1 ops but the request tracking system doesn't resolve the request because:
- The echo handler doesn't call `completeRequest()` 
- The session cleanup code only resolves requests for sessions that go through the full LLM path
- Result: requests stay CREATED forever

## Fix
Sent patch to May (req:95ac4a49): Add step 2b to `audit-requests.ts` to auto-expire CREATED `call` requests from `fromEntity='human'` older than 2h.

Patch at: `workspace/patches/audit-requests-call-ttl.patch.md`

## Impact
- Immediate: cleans up 60+ stale requests
- Ongoing: prevents future accumulation during testing periods
- No cost savings (requests in DB are just data, not sessions) but cleaner monitoring
