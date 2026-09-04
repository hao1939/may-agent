<ai_context>
summary: "Cycle 408 exercises the rename-safe overlay planner in a disposable repository. A matched naive mixed reset leaves two avoidable dirty paths; planner-selected clean materialization plus distinct restore/remove rollback reaches the expected postflight and exactly reproduces preflight without touching protected /app."
triggers: ["Cycle 408", "RV-044", "local-main overlay planner", "mixed-index transition", "rename-safe rollback", "dirty checkout preservation"]
last_updated: "2026-09-05"
source_basis: "Exact accepted standing source 3d92dd6ea61d608b5eefb55bfa9415e992f23af4; goal-owned disposable Git repositories created by local-main-overlay-plan.test.ts; bounded no-request XHS reconciliation at 2026-09-04T21:18:59.936Z; protected /app observed read-only at accepted main 803240b27fa4b40373524a1ed42d0b9bee7e890c."
</ai_context>

# Cycle 408 overlay-planner isolated transition

## Outcome

The read-only planner had passed classification tests but had not driven a
forward/rollback transition. This checkpoint adds one end-to-end disposable
fixture. It proves that the planner's no-renames overlap and clean-path sets can
drive the tested mixed-index transition and exactly restore its preflight. It
also preserves a matched failure mode: changing HEAD/index without
materializing the preflight-clean candidate paths leaves avoidable drift.

No command in this cycle changed, tested, cleaned, reset, or staged protected
`/app` or a peer worktree. Local main remains
`803240b27fa4b40373524a1ed42d0b9bee7e890c`.

## Seed-first and lane boundary

Cycle 408 started from exact clean accepted standing source
`3d92dd6ea61d608b5eefb55bfa9415e992f23af4`. At
`2026-09-04T21:18:59.936Z`, the last XHS observation through
`2026-09-04T17:12:00.404Z` remained inside its six-hour cadence. No trigger
fired, so this reconciliation issued zero XHS requests: additions and changes
remain unknown, observed removals are `[]`, and all 132 durable identities
remain unavailable. No account state changed.

GitHub, arXiv, and Reddit also received zero requests. Their last useful
evidence, access limits, and revision/content triggers remain unchanged.
`RV-004` is high/open at the missing protected query-to-decision-to-outcome
join, and `RV-034` is high/open at the external runtime boundary. RV-044 was
the highest-value accessible item because its completion criterion was a
fresh, isolated planner-driven transition.

## Matched fixture and observed result

The disposable repository contains all decision-relevant classes in one
fixture:

- both sides of a content-identical rename;
- a candidate deletion already absent in the overlay;
- a candidate-identical dirty overlap that should become clean;
- a human-divergent overlap that must remain visible;
- one clean tracked path requiring rollback restore;
- one clean candidate addition requiring rollback removal; and
- one unrelated dirty path whose bytes must remain unchanged.

The exact planner result is seven candidate paths, six preflight status
records, five overlaps, one unrelated dirty path, four overlaps that become
clean, one retained overlap, one rollback restore, one rollback removal, and
two expected postflight records. Existing focused cases continue to reject a
staged index and a candidate read through a symlinked parent.

The matched naive baseline runs `git reset --mixed <candidate>` without the
planner's clean materialization. It produces four records: the intended
human-divergent and unrelated modifications plus an absent candidate addition
and the base version of a candidate-modified clean file. Resetting back to the
base reproduces all six preflight records exactly.

The planner-driven path materializes only its two `cleanMaterialization`
paths, advances HEAD/index with the same mixed reset, and produces exactly the
two expected dirty records. Both human byte strings remain exact. Rollback
then restores only the planner's `restore` path, removes only its `remove`
path, resets HEAD/index to base, and reproduces the complete preflight status
byte-for-byte.

## Safety invariants and uncertainty

The exercised operation depends on these invariants:

1. HEAD equals the planner's exact base and the index is clean.
2. Candidate paths are enumerated with rename detection disabled.
3. Every dirty candidate path is classified by current bytes against the
   candidate; only preflight-clean paths may be materialized.
4. Human-divergent and unrelated dirty bytes remain untouched.
5. Rollback restores base-tracked paths and removes base-absent additions as
   separate sets before returning HEAD/index to base.
6. Exact preflight status must reproduce after rollback.

Confidence is high for the synthetic regular-file topology and the observed
naive-baseline contrast. It remains low for crash atomicity, concurrent writes,
submodules, unusual filesystem semantics, and an unreviewed future candidate.
This result does not authorize local-main movement or imply research or user
outcomes. Every future protected transition still needs a fresh candidate,
exact fingerprints, independent review, object/byte guards, and an explicit
safe release boundary.

## Provenance and integration ledger

| Item | Disposition |
| --- | --- |
| Reviewer ledger source `cfea84eca8a9a91eabc54f6959edd33ce368c8a4` → result `3d92dd6ea61d608b5eefb55bfa9415e992f23af4` | **Integrated exactly.** The result is the clean Cycle 408 source and contains Cycle 407 `c77597de6c`, planner `d83ab7ec90`, reconciliation merge `4e2f73507f`, and cursor `cfea84eca8`. Rollback is one ordinary revert of `3d92dd6ea6`. |
| Cycle 408 producer source `3d92dd6ea61d608b5eefb55bfa9415e992f23af4` → material result `ff9b60a4bcafb993836d861444a4f7980900d436` | **Committed and exact-tip validated; independent review pending.** The implementation is one regression fixture plus this report and the compact topic-map link; it changes no production transition code. |
| RV-044 | **Producer criterion met; review pending.** Keep it medium/open until independent review accepts the exact committed fixture and validation. |
| RV-004 / RV-034 | **Unchanged: high/open.** This repository-preservation evidence supplies no Scout outcome join and no external runtime repair. |

Rollback of this batch is reverse-order ordinary reverts: first this validation
record, then `ff9b60a4bcafb993836d861444a4f7980900d436`. That removes only
the regression and its evidence; it does not move local main or alter the
already integrated planner.

## Validation and next ranked work

On exact material commit `ff9b60a4bcafb993836d861444a4f7980900d436`:

- the focused overlay suite passes six tests / 26 assertions;
- the full Scout gate passes 302 tests / 1,512 assertions, syntax, TypeScript,
  formatting, Cycle 405 projection, 102 scoped links, and navigation 11/14 and
  8/8;
- the broad audit passes 1,542 tracked Markdown documents / 1,744 local links;
- read-only health reports 34 facts / 16 wakes with `truncated:true`;
- accepted Cycle 407 `c77597de6c`, planner `d83ab7ec90`, reconciliation
  `4e2f73507f`, accepted cursor `cfea84eca8`, and ledger `3d92dd6ea6` are all
  ancestors;
- the standing worktree and runtime state are clean; and
- read-only protected `/app` remains main `803240b27f`, with default 72 /
  `c7398ad6…8de0`, expanded 492 / `f27a4816…a63c`, and Scout 23 /
  `b9d6fb9c…a12c` status records/fingerprints.

No further local-main movement is permitted before independent review and a
new declared safe release boundary. After the scheduled XHS boundary
`2026-09-04T23:12:00.404Z`, reconcile once and re-rank: pursue RV-004 if a
protected outcome join becomes accessible, otherwise RV-034 if authorized
runtime evidence changes, otherwise the highest substantive retained primary,
contradiction, reproducibility, retrieval, or synthesis gap.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
