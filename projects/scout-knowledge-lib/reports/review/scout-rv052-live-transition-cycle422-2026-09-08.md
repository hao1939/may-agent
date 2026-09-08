<ai_context>
summary: "Cycle 422 regenerates RV-052 release preparation from current main and exact canonical integration, then proves the two applicable protected Scout overlaps survive a complete transition and rollback in a disposable fixture. The live dirty checkout is unchanged; landing still requires independent review and an immediate boundary gate."
triggers: ["Cycle 422", "RV-052", "dirty overlay", "local-main candidate", "protected checkout", "transition rollback", "release boundary"]
last_updated: "2026-09-08"
source_basis: "Exact canonical source fcd91b1725c6cedb350b3a7ff398f0a91622c085; live main 6237bd7e608de98bb60e27a94ea19b52bf52c838; isolated merge candidate 876222a5ecc56f5ebad98bbbaa411838fa93c1c2; read-only /app status and five path hashes; one goal-owned two-overlap transition and inverse; bounded Cycle 422 XHS observation through 2026-09-08T03:33:16.091Z."
</ai_context>

# Cycle 422: current-boundary RV-052 transition rehearsal

## What was wrong and what changes

Cycle 421 proved that the explicit-retention planner could preserve five
protected paths at old main `803240b27f`, but live main later advanced. The
first Cycle 422 preparation `5ed6252f02` also stopped at reviewer result
`27c7286418`, before the producer integration ledger. Neither object was a
current release candidate.

This checkpoint keeps both objects as history and regenerates a clean merge
from live main and full canonical integration. The applicable overlap set also
changes truthfully: the three ignored Herdr files are absent from both Git
trees, while two divergent Scout files remain candidate paths. A complete
forward and inverse transition now reproduces for that exact candidate in a
new disposable fixture. Nothing writes `/app`.

## Bounded seed reconciliation

The six-hour cadence was due. At `2026-09-08T03:33:09.007Z`, worker UID 1000
observed direct localhost 9222 refuse with curl exit 7 / HTTP 000. The
established effective-UID-0 browser path in root-owned Chrome PID 2136's
network namespace then ran exactly one public `status` and one non-navigating
`saved-status` under Node v22.19.0, ending at `03:33:16.091Z`.

- Explore remained ready with 30 notes and no login wall.
- Saved status remained `ready:false`, HTTP 200, final class `profile`, access
  fingerprint `74a9cdb73d2f8b37e8888154a2f2a67761178f8a6f64cd20e1fc384965cc2e44`,
  target SHA-256
  `e860da46506d774eced62830a670ea284f5150429482f8003c706bc6b006906e`,
  zero attributable items, and empty ID fingerprint
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Byte length changed 103,020→103,435 and body SHA-256 changed from
  `7a5b5602c14ffe53e3874d525084aaa95a62391335ad24e5686c5ecfe685c44b`
  to `ecabd28ff9bd040aedca1d45f9a3d13c0f7ff84f9de2c0fe9ddab4d94bc82abb`.

The byte-only change is response provenance, not collection evidence. Added
and changed identities remain unknown, removals remain `[]`, and all 132
durable seeds remain unavailable. No feed, search, detail, or account-mutating
action ran.

## Exact source and candidate

| Boundary | Exact commit |
| --- | --- |
| Live local main | `6237bd7e608de98bb60e27a94ea19b52bf52c838` |
| Reviewed Cycle 421 source | `6af4d3da01d3a35b3d432db610edbd5f2ddd6e9a` |
| Integrated reviewer result | `27c72864189c3fb95fe31f5fd878826b2881b203` |
| Producer integration ledger / canonical source | `fcd91b1725c6cedb350b3a7ff398f0a91622c085` |
| Superseded pre-ledger candidate | `5ed6252f02c1479fc0111c68978e8cc5ba7677dd` |
| Current isolated merge candidate | `876222a5ecc56f5ebad98bbbaa411838fa93c1c2` |
| Candidate tree | `32180ab8306b52f63172d13f22dccf11c8ce7dbe` |

The current candidate's parents are live main first and full canonical source
second. The merge is conflict-free and its worktree is clean. It changes 32
main-relative paths with rename detection disabled.

## Fresh live no-write gate

Read-only `/app` observation before planning recorded:

| Surface | Records | Sorted status SHA-256 |
| --- | ---: | --- |
| Default status | 76 | `7f5d6f5252cd84bf48a9d531cfe4567fe20b50a1a75073d2d6f92d2805f2ca6d` |
| Expanded untracked status | 4,393 | `71cd339bb834cb47f35813e639e81e961a4c7e1637f01e1da4ac9b0bf4d38549` |
| Scout-only expanded status | 23 | `b9d6fb9c05a1b4c68e6348237512084d212d17c4fd7821b9838f374eca7a12c5` |

The index was clean. The two applicable retained paths were:

| Path | Worktree SHA-256 |
| --- | --- |
| `projects/scout-knowledge-lib.app/package.json` | `d15c253f6fd4fd5dd7516e8b184bcbfd14d6b999ade0a2ff11d55d77b82b2ded` |
| `projects/scout-knowledge-lib/knowledge/INDEX.md` | `487a560c2b60d69f6bae27b55c0a15b352ae1a60e8b7f25599940e2e9decf2f2` |

The three earlier Herdr paths remain present only as ignored working files;
they are absent from both live-main and candidate trees. Supplying their old
retention declarations therefore fails closed as unused rather than silently
expanding authority.

With exactly the two applicable declarations, the live no-write plan reports:

- 32 candidate paths;
- two retained overlaps and zero overlaps becoming clean;
- 30 clean materializations;
- nine rollback restores and 21 rollback removals;
- 4,391 unrelated dirty records; and
- expected live postflight status count 4,393.

This calculation reads `/app`; it does not execute the transition there.

## Isolated forward and inverse

A new goal-owned detached fixture began at exact live main. It copied only the
two protected Scout bytes. Its two-record sorted status SHA-256 was
`51d890af61a84a3b2847fd2023fe1a4496ea970affc690fc65214ae2a4f60c0a`.

The planner's 30 clean materializations were checked out from the candidate,
then a mixed reset advanced HEAD and index. Postflight had:

- exact HEAD `876222a5ecc56f5ebad98bbbaa411838fa93c1c2`;
- a clean index;
- exactly the same two modified paths;
- the same two protected SHA-256 values; and
- the same two-record status fingerprint.

The inverse restored the nine old-tree paths, removed the 21 exact candidate
additions, and mixed-reset to live main. It reproduced exact HEAD, clean index,
the complete preflight status bytes, status fingerprint, and both protected
hashes. The fixture remains retained at that restored boundary for review.

## Validation, disposition, and rollback

The clean merge candidate passes syntax, TypeScript, formatting, Cycle 420
seed projection, 113 scoped links, navigation 11/14 + 8/8 + 14/14, and 316
tests / 1,564 assertions. Its broad audit passes 1,551 tracked Markdown
documents / 1,796 local links, whitespace is clean, and read-only health at
the candidate commit clock reports 26 facts / 16 wakes with `truncated:true`.
The canonical documentation checkpoint must rerun its own current-tip gate
after commit.

RV-052 remains **high/open and release-blocking** until independent review
accepts this exact candidate and the real boundary immediately before landing
still matches. Any landing must rerun the no-write plan, verify every retained
hash and full status fingerprint, execute only the reviewed materialization
set, and prove postflight. This checkpoint authorizes no local-main movement,
compaction, or cleanup.

The merge candidate has not changed local main, so rollback of preparation is
no repository transition. If the canonical evidence checkpoint must be
removed, ordinarily revert only its producer commit. Preserve the candidate
branch and fixture until their independent disposition is durable.

## Ranked next work

1. Obtain independent review of the exact Cycle 422 evidence and candidate.
2. If accepted and the live boundary is unchanged, run the required immediate
   gate before any local-main transition; otherwise regenerate from the new
   exact boundary.
3. After the release decision, return to RV-004's missing protected
   query→rank→selection→later-outcome join; RV-034 remains behind the external
   runtime boundary.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
