<ai_context>
summary: "The independently accepted Cycle 426 candidate was applied once through the reviewed fail-closed overlay plan. The protected checkout reached the exact candidate with its clean index, complete status stream, Scout fingerprint, and two protected bytes preserved. RV-052 remains high/open until independent postflight review; cleanup and compaction remain blocked."
triggers: ["RV-052", "local-main transition", "dirty overlay", "protected checkout", "postflight", "rollback", "release boundary"]
last_updated: "2026-09-08"
source_basis: "Reviewer source/result 8b20b38fbe3510028130a1108dedaad3883c88fc..28c797a0218d863405b5a60a6d622db325af23aa at patch ID 450b330c70683cafbd7124d06d7e303e78f595f7; protected base 6237bd7e608de98bb60e27a94ea19b52bf52c838; exact candidate 584395df7c2c25f5737eb4a392dc8c75d2852b53; immediate fail-closed plan and exact before/after status and protected-byte evidence."
</ai_context>

# RV-052 live postflight: the reviewed overlay transition preserves the checkout

## What changed

Independent review accepted exact canonical source
`8b20b38fbe3510028130a1108dedaad3883c88fc` and exact candidate
`584395df7c2c25f5737eb4a392dc8c75d2852b53` for one guarded transition.
Reviewer result `28c797a0218d863405b5a60a6d622db325af23aa` is its direct child,
has stable patch ID `450b330c70683cafbd7124d06d7e303e78f595f7`, and was integrated
literally before the transition.

This was a release postflight, not a new research cycle. It made no XHS,
public-source, or account request and adds no research or behavior claim.

## Exact boundary and admission

The protected checkout was on branch `chore/may-agent-hygiene` at exact base
`6237bd7e608de98bb60e27a94ea19b52bf52c838`. Candidate
`584395df7c2c25f5737eb4a392dc8c75d2852b53` has that base as first parent,
Cycle 425 canonical `ed7de4d92950c1daa8b5829531079928ff592cc5` as second parent,
and tree `aee432c4fe174159ec389f151cf652607d9d646f`.

The immediate no-write gate at `2026-09-08T12:23:52Z` proved:

| Invariant | Exact result |
| --- | --- |
| HEAD / index | exact base; clean index |
| Candidate diff | 38 paths; no rename inference |
| Retained overlaps | exactly two; both explicit and SHA-256-bound |
| Clean materializations | 36 |
| Emitted inverse | restore nine base paths; remove 27 candidate additions |
| Unrelated dirty records | 5,677 |
| Expected postflight records | 5,679 |

Five unrelated expanded records had appeared since the reviewer's 5,674-row
observation. They did not intersect the 38 candidate paths. The fail-closed
planner still reproduced the exact base, candidate, clean index, two retained
overlaps, 36 materializations, and 9/27 inverse, so unrelated growth did not
invalidate admission.

The complete preflight fingerprints were:

| Surface | Records | Sorted status SHA-256 |
| --- | ---: | --- |
| Default | 77 | `141a84e8d780b676ae1de27b0070b938c6e2041682783f0c3785369de1f40572` |
| Expanded, no renames | 5,679 | `88d2b60b6c248bad80efe09b7bec0f8dd8146ec9a24acbfcb24f54764d4e0355` |
| Scout-only expanded | 23 | `b9d6fb9c05a1b4c68e6348237512084d212d17c4fd7821b9838f374eca7a12c5` |

The retained paths were:

| Path | Worktree SHA-256 |
| --- | --- |
| `projects/scout-knowledge-lib.app/package.json` | `d15c253f6fd4fd5dd7516e8b184bcbfd14d6b999ade0a2ff11d55d77b82b2ded` |
| `projects/scout-knowledge-lib/knowledge/INDEX.md` | `487a560c2b60d69f6bae27b55c0a15b352ae1a60e8b7f25599940e2e9decf2f2` |

## Exact postflight

Only the planner's enumerated 36 clean paths were materialized, followed by
the reviewed mixed reset. Postflight proved:

- exact HEAD `584395df7c2c25f5737eb4a392dc8c75d2852b53`;
- clean index;
- byte identity between all 36 materialized paths and the candidate;
- byte-identical default, expanded, and Scout-only status streams at the
  three fingerprints above; and
- both retained worktree hashes unchanged.

No cleanup, compaction, stash, deletion of unrelated work, or second landing
was performed. The transition does not claim that candidate `584395df7c`
contains later documentation-only canonical commits `8b20b38fbe` or
`28c797a021`.

## Disposition and rollback

RV-052 remains **high/open pending independent review of this actual
postflight**. The observed transition satisfies the producer-side release
criterion at this exact boundary; it does not generalize to a later base,
candidate, protected hash, or status stream.

Immediate local rollback, if required before any later protected write, is
the already exercised inverse: restore the nine base-tree paths, remove only
the 27 exact candidate additions, then mixed-reset to
`6237bd7e608de98bb60e27a94ea19b52bf52c838` and require the exact 77 / 5,679 /
23 fingerprints and two hashes above. Canonical rollback first reverts the
postflight ledger commit, then ordinarily reverts reviewer `28c797a021`; it
does not itself move the protected checkout.

## Validation and next boundary

The candidate passed independent validation at 321 tests / 1,632 assertions,
121 scoped links, navigation 11/14 + 8/8 + 14/14, and 1,555 documents / 1,804
broad links. The final canonical postflight tree separately passes syntax,
TypeScript, formatting, Cycle 422 projection, 124 scoped links, navigation
11/14 + 8/8 + 14/14, and 321 tests / 1,632 assertions. Its broad audit passes
1,557 Markdown documents / 1,808 local links; read-only health reports 26
facts / 16 wakes with `truncated:true`; `git diff --check` passes. These gates
validate repository consistency and preservation accounting, not behavior or
future-boundary safety.

The next release action is independent review of this exact postflight and
canonical ledger result. Until then, do not move the protected checkout again,
compact, clean, or delete retained branches/worktrees. RV-004/RV-034 remain
high/open and RV-036/RV-038 medium/open.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
