# Request Deduplication — Journal

## 2026-07-16 — Project Creation

**Investigation Summary:**

Traced the 78% duplicate request problem to its root cause:

1. **Request tracking DB is non-functional** — `.state/requests.db` and `.state/requests.sqlite` both have no tables. `agents.requests()` fails with "no such table: requests".

2. **Without a working DB**, the dispatch path cannot check for existing identical requests, so every dispatch creates a new entry (or fails silently).

3. **Multiple agents** independently detected the duplicate problem and sent notifications about it — creating a secondary waste pattern where 8-15 notifications per heartbeat cycle were about the same issue.

4. **The system-efficiency project** (now waiting) addressed different issues (May heartbeat cascade, circuit breaker, budget checkpointing). This is a new, distinct problem.

**Next Steps for M1:**
- Find how the requests table is supposed to be initialized (check `src/` for DB schema/migration)
- Determine if this is a missing migration, a path issue, or a code bug
- Fix the initialization so the table exists on startup
### Iteration 2 — 2026-04-28T06:50:50.158Z
**Worker**: `agents.requests()` now works. Let me write the diagnosis + fix documentation and a migration script.
**Reviewer**: CONTINUE — 1. **I believe**: The optimizer already implemented read-side inbox dedup (M1) that collapses duplicates on display, and declared M2/M3 of their own project done/deferred. The actual write-side dispatch and notification dedup guards (our M2 and M3) have NOT been implemented — no idempotency checks exist before fork/notify calls.

2. **I'm uncertain about**: Whether the read-side dedup alone has actually reduced the 78% duplicate rate in practice, or if write-side guards are still needed. I haven't measured current duplicate rates.

3. **I'd change my mind if**: Current duplicate rate measurements show it's already below 10% thanks to read-side dedup alone, making write-side guards unnecessary.

---

**Answering review questions:**
1. **Is the goal closer?** Partially. Read-side dedup reduces *visible* noise but doesn't reduce wasted computation from duplicate dispatches.
2. **What did we learn?** The optimizer already tackled this from the read side. Write-side dedup was explicitly deferred as "low ROI."
3. **Is the current milestone the right next step?** We should measure first before building more.
4. **Are we closing the loop?** Read-side dedup is a symptom fix. Write-side would prevent recurrence.
5. **Is it verified?** No measurement of current duplicate rates post-fix.
6. **What's blocking?** Need current metrics to decide if M2/M3 are still needed.

---

CONTINUE

The optimizer already implemented read-side inbox dedup that collapses duplicates. Before building write-side guards (our M2/M3), we need to measure whether the problem is actually solved. If duplicates are still being *created* at high rates (even if collapsed on display), we proceed with write-side dedup. If the rate is acceptable, we close out.

**(a) Concrete output:** A file `outputs/dedup-measurement.md` containing:
1. Count of total vs unique requests in the last 24h (from events table)
2. Count of total vs unique notifications in the last 24h
3. Current effective duplicate rate
4. Recommendation: proceed with M2/M3 or close project

**(b) What's different:** First attempt. Previous iteration diagnosed; now we measure post-fix impact.

**(c) First step:** Run `SELECT event_type, count(*) as total FROM events WHERE timestamp > datetime('now', '-24 hours') GROUP BY event_type` against the events DB to see current notification volume, then compute duplicate rates using the same normalization logic from `heartbeat-data.ts`.

CONTEXT_UPDATE:
- Optimizer completed read-side inbox dedup in `agents/shared/workflows/heartbeat-data.ts` (loadInbox collapses duplicates via normalization). Write-side dedup was explicitly deferred.
- M1 (Fix Request Tracking DB) is complete. M2/M3 need measurement before implementation.
- Dedup normalization strips priority tags, agent names, timestamps, fractions; groups by event_type + normalized 100-char key.

### Iteration 3 — 2026-04-28T06:54:22.827Z
**Worker**: The data is clear: duplicate rate is already 5.4% (well under 10%), and only 3.9% within 1hr windows. The task-watchdog notifications are the main source, which is expected behavior (recurring alerts). Write-side dedup is not needed.
**Reviewer**: CONTINUE — The data is solid. Duplicate rate is 5.4% (under 10% target), remaining duplicates are intentional watchdog alerts. Both M2 and M3 success metrics are met without write-side guards.

WAITING: All milestones are effectively complete. The measurement proves the goal is met — duplicate rate dropped from 78% to 5.4%, below the 10% threshold. Remaining duplicates are intentional task-watchdog alerts. **M2: Dispatch Dedup Guard** and **M3: Notification Dedup** are unnecessary given current metrics. Awaiting review to close project.

Resume when: Human/May reviews and confirms project closure.

CONTEXT_UPDATE:
- Measurement (2026-04-28): duplicate rate is 5.4% (was 78%), within-1hr duplicates 3.9%. Both below 10% threshold.
- Remaining duplicates are intentional task-watchdog recurring alerts, not bugs.
- M2/M3 write-side dedup guards deemed unnecessary. Read-side dedup sufficient.
- Full measurement report: `outputs/dedup-measurement.md`

### Iteration 4 — 2026-04-28T06:55:59.716Z
**Worker**: 
**Reviewer**: WAITING — All milestones are effectively complete. Measurement confirmed duplicate rate is 5.4% (below 10% target). **M2: Dispatch Dedup Guard** and **M3: Notification Dedup** success metrics are met without additional implementation. Awaiting human review to close project.

Resume when: Human/May confirms project closure.

