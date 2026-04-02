# Finding: 50+ Stale Test Requests Clogging requests.db

**Date**: 2026-03-26T03:11Z
**Severity**: Low (but easy fix)
**Category**: Waste Elimination

## Problem

The requests database has 69 "active" requests, of which ~50 are stale test requests from initial system testing (ages 1000-1350 minutes / 17-22 hours ago):

- ~35 `echo hello` requests to bob
- ~5 `echo testing` requests to bob
- ~5 `echo testing_finish_evidence` requests to bob
- ~3 `echo hello` requests to optimizer
- ~2 `echo hello`/`say hello` to may/optimizer

All are status `CREATED`, from `human`, and will never be picked up because they're test artifacts.

## Impact

1. **hasPendingWork() overhead**: Every heartbeat checks for pending requests. These 50+ stale entries make every skipIfIdle check slower and noisier.
2. **Request scan noise**: Any agent or tool querying `requests(filter:active)` gets 50+ noise entries before real work items.
3. **Dashboard confusion**: The 69 "active" count looks alarming but 72% is stale test data.

## Proposed Fix

Add a `request-cleanup` handler (or extend `audit-requests.ts`) that:
1. Auto-cancels CREATED requests older than 24h that match `echo *` or `say *` patterns
2. Or more conservatively: auto-cancels any CREATED request from `human` older than 48h

This is low priority because the system functions correctly despite the noise. But it's an easy win.

## Workaround

May could manually cancel these via the tracker. Or a one-time DB cleanup script.
