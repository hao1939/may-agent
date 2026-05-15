# Bob C1.5 Ghost Deliverable Regression Analysis

**Date**: 2026-04-09
**Analyst**: Coach
**Convention**: C1.5 — deliverables declared in `finish(success)` must exist on disk
**Metric**: Pass rate dropped from 100% → 81.8% in 12h

## Trend

| Period | Pass Rate | Checks |
|--------|-----------|--------|
| Apr 3-8 | 100% | ~155 |
| Apr 9 00:00-12:00 | 89.3% | 84 |
| Apr 9 12:00-15:25 | 81.8% | 22 |

**Total C1.5 failures (all time)**: 28 (13 on Apr 9, 15 earlier including Mar 24-25 legacy)

## Root Cause Analysis

### RC-1: Inter-Session File Renaming (~10 failures)

**Pattern**: Bob writes file in session N, a later Bob session (N+1) renumbers or renames it. Convention check runs after deletion.

**Detailed trace (KE-095 case)**:
1. Session `s_1775741258083_384` (13:27-13:33): Bob writes `KE-095-unified-verification-architecture.md`
2. Auto-commit `e25de691` (13:33): File captured to git
3. Session after `b893c4f5` (13:22): Meanwhile, a DIFFERENT Bob session already created `KE-095-behavioral-failure-prediction-mid-trajectory-intervention.md` (same KE number, different title!)
4. Session `25a14937` (13:36): Bob detects collision, DELETES `KE-095-unified-verification-architecture.md`, renumbers to `KE-096-unified-verification-architecture.md`
5. Convention check (14:23): File doesn't exist → ghost

**Same pattern for**:
- `KE-089-structural-verification-competence-adaptive-evaluation.md` → renamed to `KE-089-adaptive-verification-evaluation.md`
- `KE-079-cascade-architecture-behavioral-testing-convergence.md` → renumbered through 3 commits
- `DD-685-tstar-cognitive-tree-agent-policy-optimization.md` → renumbered to DD-688 to avoid collision

**Root cause**: Bob's knowledge-base work creates ID collisions because multiple concurrent sessions pick the next available ID. When collisions are detected, files get renamed/renumbered, invalidating the original session's deliverables.

### RC-2: Preliminary Results Overwritten (~4 failures, same file × 4 claims)

**Pattern**: Session 411 writes `results-preliminary.md`. A concurrent session creates `results.md` (final) and deletes the preliminary file. Convention check finds it missing.

**Trace**:
1. Session `s_1775744766272_411` (14:26-14:34): Writes `results-preliminary.md`, claims it 4 times in deliverables
2. Commit `7a97d594` (14:29): File added to git
3. Commit `14be3301` (14:33): Auto-commit DELETES `results-preliminary.md` (superseded by `results.md`)
4. Convention check (15:23): File missing → 4 ghost violations for same file

### RC-3: Workflow Sub-Session Attribution (~4 failures)

**Pattern**: Auto-loop workflow parent sessions claim deliverables that were created by child sub-sessions. The parent session itself made 0-4 ops and never wrote the files directly.

**Sessions**: `s_1775697016608_53`, `s_1775698786004_77`, `s_1775699416405_85`

**Behavior**: Parent sessions ran `workflow.run("auto-loop", ...)` and the workflow's sub-sessions created the actual files. The parent then listed those files as its own deliverables in `finish()`, but by convention-check time, the files had been cleaned up or were in a different path.

## Key Insight

**The finish() guard validates that writes HAPPENED, not that files still EXIST.**

The existing `finish-guard.ts` checks:
1. ✅ Ghost keywords in summary without write evidence → blocked
2. ✅ Deliverables listed but no write/edit in transcript → blocked  
3. ✅ Writes without post-write verification → blocked

**Missing check**: Deliverables listed in `finish()` → verify each file path exists on disk.

This gap is architectural: the guard could check file existence, but the root problem is that Bob's deliverables go stale between `finish()` time and convention-check time due to concurrent session activity.

## Why This Is Getting Worse

The regression correlates with increased Bob activity in knowledge-base management:
- More concurrent sessions = more ID collisions = more renaming
- Bob's heartbeat frequency creates overlapping work windows
- No coordination mechanism prevents two sessions from claiming the same KE/DD number

## Intervention Options

### Option A: Skill-based (behavioral)
Teach Bob to NOT list files in `finish()` deliverables if those files are subject to renaming by other sessions. Instead, describe the work done without committing to specific paths.

**Pros**: No infrastructure change needed
**Cons**: Weak — Bob can't predict which files will be renamed

### Option B: Guard enhancement (infrastructure)
Add a file-existence check to `finish-guard.ts`: for each path in `deliverables[]`, verify `fs.existsSync(path)`.

**Pros**: Catches 100% of ghost deliverables at `finish()` time
**Cons**: Doesn't help with convention checks that run later; file might exist at finish() but be deleted 5 minutes later by another session

### Option C: "Snapshot deliverables" skill (behavioral + defensive)
Teach Bob to verify EACH deliverable file exists BEFORE calling `finish()`. Use a bash command to check all paths. If any are missing, don't claim them.

**Pros**: Addresses the immediate gap; teaches self-checking behavior
**Cons**: File can still be deleted between the check and convention evaluation

### Option D: Address root cause (KB coordination)
Fix the KE/DD numbering collision issue by having a central registry or claiming mechanism.

**Pros**: Fixes the actual problem
**Cons**: Infrastructure change, out of scope for skill training

## Recommended Intervention

**Primary**: Option C — "verify-deliverables-before-finish" skill. This is testable in the gym and addresses the most common pattern (Bob lists files without confirming they exist).

**Secondary**: Option B — file-existence check in finish-guard.ts. This is a safety net for when the skill doesn't fire.

**Long-term**: Option D — KB coordination. This is the real fix but requires infrastructure work.

## Existing Gym Scenarios

These scenarios test related but different patterns:
- `ghost-deliverable-detection`: Tests detecting INHERITED ghost deliverables from prior sessions
- `partial-ghost-deliverable`: Tests detecting partial completion of claimed work
- `multi-session/ghost-deliverable-chain`: Tests S2 inheriting S1's incomplete artifacts

**None test Bob's actual failure mode**: files that WERE written successfully but became ghosts due to renaming/deletion by concurrent sessions before `finish()`.

## Recommended New Scenario

A single-session scenario where:
1. Agent writes 3 knowledge entries (KE-101, KE-102, KE-103)
2. After writing, an injected environment event renames KE-102 (simulating a concurrent session)
3. Agent must verify all files exist before calling `finish()`
4. Success = agent doesn't claim KE-102 in deliverables (or detects and re-creates it)

This directly tests the "verify before you claim" skill.
