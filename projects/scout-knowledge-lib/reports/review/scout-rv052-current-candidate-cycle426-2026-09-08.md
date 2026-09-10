<ai_context>
summary: "Cycle 426 regenerates RV-052 release preparation from live main and exact Cycle 425 canonical, then exercises the 38-path plan and rollback in a new disposable fixture. The evidence is current and reversible, but local-main movement remains blocked pending independent review and an immediate live gate."
triggers: ["Cycle 426", "RV-052", "local-main candidate", "dirty overlay", "rollback", "release boundary"]
last_updated: "2026-09-08"
source_basis: "Canonical ed7de4d92950c1daa8b5829531079928ff592cc5; live main 6237bd7e608de98bb60e27a94ea19b52bf52c838; isolated candidate 584395df7c2c25f5737eb4a392dc8c75d2852b53, tree aee432c4fe174159ec389f151cf652607d9d646f; read-only live status and two retained hashes; one goal-owned forward/rollback fixture."
</ai_context>

# Cycle 426: current RV-052 candidate preserves the live overlay in isolation

## What was wrong and what changes

Cycle 422's candidate ended at canonical `fcd91b1725` and omitted later
canonical work. It remained useful historical evidence but could not support a
current release decision.

This checkpoint regenerates the merge from unchanged live main and exact Cycle
425 canonical. A fresh read-only plan and a new disposable transition both
preserve the two applicable Scout overlaps. This is preparation, not permission
to move local main: independent review and an immediate live admission gate are
still required.

## Seed and scope boundary

At `2026-09-08T04:57:22Z`, Cycle 422's direct XHS observation was about 84
minutes old and remained inside the six-hour cadence. No XHS or other public
source request ran. Additions and changes remain unknown, removals remain `[]`,
and all 132 durable seeds remain unavailable rather than removed.

RV-052 was the highest-value accessible release gap. This batch performs no
new research, compaction, cleanup, or local-main movement.

## Exact candidate

| Boundary | Exact identity |
| --- | --- |
| Live local main | `6237bd7e608de98bb60e27a94ea19b52bf52c838` |
| Canonical Cycle 425 | `ed7de4d92950c1daa8b5829531079928ff592cc5` |
| Isolated merge candidate | `584395df7c2c25f5737eb4a392dc8c75d2852b53` |
| Candidate tree | `aee432c4fe174159ec389f151cf652607d9d646f` |

The candidate's parents are exactly live main first and canonical second. The
merge is conflict-free and its goal-owned worktree is clean.

## Fresh live no-write gate

Read-only `/app` inspection found exact live main, a clean index, and unchanged
status surfaces:

| Surface | Records | Sorted status SHA-256 |
| --- | ---: | --- |
| Default | 76 | `7f5d6f5252cd84bf48a9d531cfe4567fe20b50a1a75073d2d6f92d2805f2ca6d` |
| Expanded | 4,393 | `71cd339bb834cb47f35813e639e81e961a4c7e1637f01e1da4ac9b0bf4d38549` |
| Scout-only expanded | 23 | `b9d6fb9c05a1b4c68e6348237512084d212d17c4fd7821b9838f374eca7a12c5` |

The retained worktree bytes remain:

| Path | SHA-256 |
| --- | --- |
| `projects/scout-knowledge-lib.app/package.json` | `d15c253f6fd4fd5dd7516e8b184bcbfd14d6b999ade0a2ff11d55d77b82b2ded` |
| `projects/scout-knowledge-lib/knowledge/INDEX.md` | `487a560c2b60d69f6bae27b55c0a15b352ae1a60e8b7f25599940e2e9decf2f2` |

The planner reports 38 no-rename candidate paths, two explicitly retained
overlaps, 36 clean materializations, nine rollback restores, 27 rollback
removals, 4,391 unrelated dirty records, and an expected postflight count of
4,393. It reads `/app` but executes nothing there.

## Disposable forward and rollback

A newly created goal-owned fixture began at exact live main and copied only the
two protected bytes. Its two-record status SHA-256 was
`51d890af61a84a3b2847fd2023fe1a4496ea970affc690fc65214ae2a4f60c0a`.

The exercised forward transition reached exact candidate `584395df7c`, kept a
clean index, retained exactly the same two modified paths, and reproduced both
hashes and the two-record status fingerprint. The inverse restored nine base
paths, removed 27 exact candidate additions, and returned to exact main
`6237bd7e60` with a clean index, byte-identical preflight status, and both
protected hashes unchanged.

## Validation, disposition, and rollback

The candidate passes syntax, TypeScript, formatting, Cycle 422 seed projection,
121 scoped links, navigation 11/14 + 8/8 + 14/14, and 321 tests / 1,632
assertions. Its broad audit passes 1,555 Markdown documents / 1,804 local
links; read-only health reports 26 facts / 16 wakes with truncation; merge diff
checking passes.

RV-052 is mitigated by current isolated evidence but remains **high/open and
release-blocking**. Independent review must accept the exact candidate and this
transition evidence. Immediately before any real landing, the live main,
status fingerprints, retained hashes, canonical ancestry, and no-write plan
must all be recomputed and match. Nothing here authorizes compaction or cleanup.

Rollback of preparation is no local-main operation because main did not move.
If this report must be removed, ordinarily revert only its canonical checkpoint
commit. Preserve the candidate and fixture until independent disposition is
durable.

## Ranked next work

1. Independently review Cycle 425 canonical and candidate `584395df7c`.
2. If accepted, rerun the immediate live admission gate and only then consider
   the exact exercised transition.
3. If the boundary drifts or review revises it, regenerate rather than reusing
   this candidate. RV-004 and RV-034 remain high/open; RV-036 and RV-038 remain
   medium/open.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
