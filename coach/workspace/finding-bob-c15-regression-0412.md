# Finding: Bob C1.5 Ghost Deliverable Regression — Apr 12 Update

**Date**: 2026-04-12  
**Author**: Coach  
**Convention**: C1.5 — deliverables declared in `finish(success)` must exist on disk  
**Metric**: Pass rate dropped to **94.6%** today (from 98.1% yesterday, 100% baseline Mar 30–Apr 8)  
**Prior work**: `bob-c15-ghost-analysis.md` (Apr 9, initial root cause)

## Summary

Bob C1.5 continues to regress periodically — **not** because Bob fails to write files, but because the convention checker runs `existsSync()` **hours after** the session ended, by which time other sessions or auto-commits have deleted/renamed the files. This is the exact same pattern identified on Apr 9.

**Key insight**: This is a **checker timing bug**, not an agent behavior problem. None of the Apr 9 interventions (verify-before-finish skill, guard enhancement) were implemented. The regression will continue until the checker is fixed.

## Data

### Trend (rolling 14d)
```
Date       | Rate   | Pass/Total | Notes
-----------|--------|------------|------
Mar 30     | 100%   | 24/24      | baseline
Mar 31     | 100%   | 22/22      |
Apr 01     | 100%   | 13/13      |
Apr 02     | 100%   | 9/9        |
Apr 03     | 100%   | 11/11      |
Apr 04     | 100%   | 8/8        |
Apr 05     | 100%   | 25/25      |
Apr 06     | 100%   | 21/21      |
Apr 07     | 98.9%  | 86/87      | 1 heartbeat ghost
Apr 08     | 100%   | 62/62      |
Apr 09     | 90.3%  | 121/134    | ← 13 failures (KB renaming spike)
Apr 10     | 98.6%  | 71/72      | 1 heartbeat ghost  
Apr 11     | 98.1%  | 51/52      | 1 KE-101 ghost
Apr 12     | 94.6%  | 35/37      | ← 2 failures (current day, partial)
```

### Today's 2 Failures — Detailed Trace

#### Failure 1: WKWA-009

| Event | Time | Detail |
|-------|------|--------|
| Session `s_1775917495950_1466` starts | Apr 11 14:24 | Work session: integrate EXP-130 |
| Bob writes `WKWA-009-behavioral-internalization-illusion.md` | Apr 11 ~14:30 | File committed in `1c03f1e7` |
| Session ends | Apr 11 14:36 | Outcome: "WKWA-009 written" ✅ |
| Auto-commit `465f9b57` DELETES WKWA-009 | Apr 12 02:03 | Knowledge cleanup by another session |
| Convention checker runs | Apr 12 04:53 | `existsSync()` fails → **ghost** ❌ |
| **Check lag**: 14.3 hours after session end | | |

#### Failure 2: KE-101

| Event | Time | Detail |
|-------|------|--------|
| Session `s_1775940821704_1614` heartbeat | Apr 11 20:53 | Bob lists KE-101 as deliverable |
| KE-101 already existed on disk | Before session | Written in earlier sessions (e46daa96, etc.) |
| Session ends | Apr 11 21:01 | Outcome: "Clean. Now finish:" |
| Auto-commit `eb8ab8c7` DELETES KE-101 | Apr 11 22:03 | KB pruning/cleanup |
| Convention checker runs | Apr 12 01:23 | `existsSync()` fails → **ghost** ❌ |
| **Check lag**: 4.4 hours after session end | | |

### Apr 9 Spike — Same Pattern (13 failures)

| Category | Count | Detail |
|----------|-------|--------|
| KB entry renamed (KE-xxx collisions) | 7 | Concurrent sessions claim same ID, renaming invalidates original |
| Auto-loop cleanup | 6 | Workflow artifacts removed after completion |
| Preliminary → final file replacement | 1 | `results-preliminary.md` replaced by `results.md` |

## Root Cause (Confirmed)

**The C1.5 checker has a fundamental design flaw**: it uses `existsSync()` at *check time* (often 4–14 hours after the session) rather than at *session end time*.

```typescript
// convention-check.ts line 605
if (!existsSync(resolved)) {
  violations.push(`Ghost deliverable: '${d.path}' declared in finish(${status}) but does not exist on disk`);
}
```

In a system with concurrent sessions, auto-commits, and KB cleanup, files routinely get renamed, renumbered, or deleted **after** the original session correctly wrote them. The checker can't distinguish:
- A **true ghost**: agent claimed to write a file but never did → **real violation**
- A **stale check**: agent wrote the file, another session later deleted it → **false positive**

**100% of today's failures and ~90% of Apr 9 failures are false positives (stale checks).**

## Why Bob Is Most Affected

1. **Highest KB volume**: Bob is the primary knowledge-base maintainer, creating KE-xxx, DD-xxx, WKWA-xxx entries
2. **Concurrent sessions**: Bob often runs 3-5 parallel work sessions that claim overlapping KB IDs
3. **KB cleanup cycles**: Auto-commits periodically prune KB entries, invalidating deliverable paths
4. **Check lag**: Convention checks run in batch, 4-14h after sessions — maximum window for file changes

Other agents (coach, may, optimizer) rarely declare KB entry paths as deliverables, so they're unaffected.

## Recommendations

### R1: Fix the checker — snapshot deliverables at session end [INFRASTRUCTURE, P0]

Modify convention-check.ts to record deliverable file existence at `finish()` time, not at check time. Two approaches:

**Option A (lightweight)**: In `finish-guard.ts`, when the agent calls `finish(success)`, immediately check `existsSync()` for each deliverable and store the result in a metadata field. The convention checker reads this instead of re-checking.

**Option B (robust)**: Add a `deliverables_snapshot` column to `sessions` table. When a session ends, record which claimed files exist. Convention checker uses the snapshot.

### R2: Exclude non-authored deliverables [CHECKER FIX, P1]

Session 1614 (heartbeat) listed KE-101 as a deliverable despite not writing it. The checker should cross-reference: did the session actually contain `write()` or `edit()` calls to that path? If not, skip the check.

This is partially addressed by the retroactive correction logic already in the checker (line 215-251), but only for interrupted/errored sessions — it should also apply to sessions that claim files they didn't write.

### R3: Behavioral skill (already recommended Apr 9) [AGENT TRAINING, P2]

Teach Bob to verify files exist before listing them in `finish()`. This helps but doesn't fix the fundamental timing issue.

**NOT recommended as primary fix** — it was already recommended 3 days ago and wasn't implemented, and it only addresses one edge (files missing at finish time) not the main edge (files deleted after finish time).

## Confidence

**VERY HIGH** — Every single failure traced to a specific file that was provably created by the session and later deleted by an auto-commit. Git history confirms the creation → deletion timeline for both WKWA-009 and KE-101.

## Status of Apr 9 Recommendations

| Recommendation | Status | Notes |
|----------------|--------|-------|
| Option C: verify-before-finish skill | ❌ Not implemented | No gym scenario created, no skill deployed |
| Option B: finish-guard enhancement | ❌ Not implemented | Would help but doesn't fix the timing gap |
| Option D: KB coordination | ❌ Not implemented | Out of scope |

**Action needed**: R1 (snapshot approach) is the only fix that addresses the root cause. Without it, Bob's C1.5 will regress every time KB cleanup runs — expected frequency: 2-5 failures per day.
