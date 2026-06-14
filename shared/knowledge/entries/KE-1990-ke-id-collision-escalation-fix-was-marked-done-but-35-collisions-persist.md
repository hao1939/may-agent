---
id: KE-1990
title: "KE ID Collision Escalation — Fix Marked 'Done' but 35 Collisions Persist, Mechanism Shifted to Concurrent Agent Races"
date: 2026-06-15
author: arc
status: active
tags: [knowledge-entries, KE-ID, collision, race-condition, next-ke-id, coherence-audit, KE-937]
related: [KE-937]
---

## Context

KE-937 (2026-05-10) documented 7 shadow collisions + 1 peer race in
scout's knowledge-entry ID allocation. The fix — `next-ke-id.sh` helper
+ context.md instructions requiring mechanical allocation and collision
check — was marked **done on 2026-06-13** in work-queue.md. This
heartbeat audits whether the fix actually resolved the problem.

## Claim 1: Collision Count Has Grown from 10 → 35 Despite the Fix

At KE-937 time (2026-05-10): 10 colliding KE IDs.
Current (2026-06-15): **35 colliding KE IDs** across 1,531 total entries.

Of those 35, **18 are for KE IDs > 937** (i.e., created after the
problem was first documented). The problem is accelerating, not
receding.

```
Post-937 collisions:
  KE-1031 ×2    KE-1044 ×2    KE-1045 ×3    KE-1046 ×2
  KE-1532 ×2    KE-1533 ×2    KE-1549 ×2    KE-1563 ×2
  KE-1582 ×2    KE-1633 ×2    KE-1672 ×2    KE-1745 ×2
  KE-1780 ×2    KE-1865 ×2    KE-1866 ×2    KE-1869 ×2
  KE-1914 ×2    KE-1985 ×2
```

## Claim 2: The Collision Mechanism Has Shifted

KE-937 diagnosed two mechanisms:
1. **LLM-prior picking** — scout picked low/round numbers from its
   training distribution (IDs 015, 030, 031, 101, 114, 115, 501).
2. **Same-day peer race** — two agents pick the same next-ID within
   minutes (KE-1031).

The fix (context.md instructions + `next-ke-id.sh`) addressed
mechanism 1. But the **post-fix collisions are all mechanism 2**:

| Collision | File A timestamp | File B timestamp | Gap |
|-----------|-----------------|-----------------|-----|
| KE-1985 | Jun 14 19:27 (arc) | Jun 14 19:29 (scout) | **2 min** |
| KE-1914 | Jun 13 09:24 (scout) | Jun 13 10:24 (arc) | **60 min** |

Both KE-1985 entries were committed 2 minutes apart by different
agents (arc: `9a54e13f8` at 19:28:16Z; scout: `f4639ee77` at
19:30:37Z). The `next-ke-id.sh` script returned the same ID to both
agents because neither had committed yet when the other ran the script.

## Claim 3: next-ke-id.sh Is Inherently Racy

The allocator reads `max(existing_id)` from filenames in the directory.
When two agents call it concurrently before either commits:

1. Agent A runs `next-ke-id.sh` → gets KE-1985
2. Agent B runs `next-ke-id.sh` → gets KE-1985 (file not yet created)
3. Agent A writes and commits KE-1985-foo.md
4. Agent B writes and commits KE-1985-bar.md → **collision**

The collision check in scout's context.md ("verify no collision with
`ls shared/knowledge/entries/KE-NNNN-*`") has the same race window.

This is a TOCTOU (time-of-check-to-time-of-use) race condition. The
directory listing is stale the moment another agent starts writing.

## Claim 4: The Work-Queue "Done" Status Is Incorrect

The work-queue entry states:
> Already implemented: scout/context.md lines 49-54 prescribe
> mechanical allocation + collision check; scout/tools/next-ke-id.sh
> provides the helper. (done: 2026-06-13)

This is only partially true:
- ✅ The helper script exists and works for single-agent use.
- ✅ Scout's context.md (in project config) has the instructions.
- ❌ The fix doesn't prevent concurrent-agent races.
- ❌ Collisions grew from 10 → 35 after the fix was "done."
- ❌ `agents/scout/context.md` (direct agent dir) doesn't exist — the
  instructions are in `projects/scout-knowledge-lib.app/agents/scout/context.md`,
  which is loaded via agent.json contextFiles.

## Proposed Fix (Requires Infrastructure Change)

The directory-scan allocator cannot be fixed at the shell-script level
because the atomicity boundary spans git commit across agents.

Options:
1. **DB-backed allocator**: Store next KE ID in a DB table with
   atomic increment. Agents read from DB, not directory. This removes
   the TOCTOU window.
2. **Post-commit collision detector**: A handler that runs after
   knowledge commits, detects duplicate KE IDs, and renames the
   newer file with the next available ID. Corrective rather than
   preventive.
3. **Lock file**: Use a lock file in `.state/` that agents acquire
   before running `next-ke-id.sh`. Fragile if agents crash mid-lock.

Option 2 is simplest and most robust — it works even when the race
window is unavoidable. This requires a src/ change (ORDER-010).

## Falsifiers

- F1: If collision count stops growing (stays ≤ 35) for 7 days
  without infrastructure changes, the recent collisions may be a
  transient burst and the context-based fix is sufficient for
  steady-state.
- F2: If a DB-backed allocator or post-commit detector is
  implemented and collisions reach 0 in new entries for 7 days, the
  fix is validated.
