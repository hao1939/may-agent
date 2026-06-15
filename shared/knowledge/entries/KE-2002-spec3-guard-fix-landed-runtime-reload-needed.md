---
id: KE-2002
title: "KE-2000 Spec 3 Guard Fix Landed — Runtime Reload Needed for Effect"
date: 2026-06-15
author: arc
status: active
tags: [guard-system, commit-guard, spec-3, runtime-deploy, noise-floor, verification]
related: [KE-2000, KE-1999, KE-1998, KE-1996, KE-2001]
---

<ai_context>
summary: Dev implemented KE-2000 Spec 3 (guard noise scoping) in commit 48cfe5a8 at 06:55Z. The fix changes commit-guard.ts to return undefined (silent pass-through) instead of emitting a warning when no session-owned files are dirty. However, the runtime loads from /app/projects/may-agent/bundle/may-agent (PID 308939, started Jun14), not live from src/. Guard triggers are still at ~290/hr with the old reason text ("Uncommitted files exist in the app repo, but none match..."). The fix will only take effect after the next runtime build+restart. The 24h guard metric (4621, threshold 4500) will remain breached until old triggers roll out AND new code is live. Separately, the KE-2001 work-queue fix (commit 4a5fd5e9e) unblocked dev — dev went from 95.7% quick-exit (avg 8.3 ops) to producing a 35-op session implementing Spec 3 within 30 minutes of the fix.
triggers: spec 3 landed, guard fix deployed but not live, runtime reload, commit-guard noise, work queue unblock
</ai_context>

## What Happened

### KE-2001 fix unblocked dev (✅ confirmed)
- Arc's previous session (commit 4a5fd5e9e, ~06:24Z) moved two approved
  P1 items from the Proposed section to the Approved section in work-queue.md
- Dev picked up KE-2000 Spec 3 immediately (session s_1781506346283_150,
  35 ops, done) and implemented it (commit 48cfe5a8, 06:55Z)
- Dev's avg opCount jumped from 8.3 (24h) to 35 for this session — the
  work-queue placement fix was indeed the sole blocker

### Spec 3 fix committed but not live (⚠️ pending restart)
- **Commit:** `48cfe5a8` in may-agent repo, 2026-06-15 06:55:22Z
- **Change:** `commit-guard.ts` line 256 — when `ownedFileLines.length === 0`,
  return `undefined` instead of `{ block: false, reason: "..." }`
- **Expected effect:** Eliminate ~95% of beforeToolCall guard triggers
- **Current state:** Runtime PID 308939 still loads the old bundle. Guard
  triggers continue at ~290/hr with the old reason text.

## Verification Plan

- **F1:** After runtime restart, guard.triggered-count-24h should drop
  below 2000 within 24h. If it doesn't, the fix is not working.
  Window: 48h after restart.
- **F2:** If guard triggers after restart are >50% of pre-fix rate (>145/hr),
  the non-commit-guard triggers are significant and Spec 3 alone is
  insufficient. Check within 2h of restart.

## Work Queue Status

| Item | Status |
|------|--------|
| KE-2000 Spec 3 (guard noise scoping) | Code committed (48cfe5a8), awaiting runtime reload |
| KE-2000 Spec 2 (quick-exit eval exemption) | Not started |
| Size-based event retention | Not started |

## System Snapshot (06:55Z post-fix commit)

| Metric | Value | Note |
|--------|-------|------|
| guard.triggered-count-24h | 4621 | Above threshold 4500; will decay after runtime reload |
| beforeToolCall triggers/hr | ~290 | Still old code; expect <50/hr after reload |
| session.resume_failed (last 2h) | 0 | Down from 602/day (KE-1997) — improvement |
| dev avg ops (24h) | 8.9 | Includes 132 quick-exit sessions; improving |
| session.error-rate-6h | 0.0825 | Healthy (threshold 0.3) |
| DB size | 1147 MB | Below 1200 target, above prior 988 MB |
