<ai_context>
summary: "Cycle 421 turns RV-052's five-path release block into an explicit fail-closed retention contract and exercises the exact transition and rollback in a disposable worktree. Local main remains unchanged and landing still requires independent review plus a fresh boundary check."
triggers: ["RV-052", "local-main overlay", "ignored files", "dirty checkout", "preservation", "rollback", "release boundary"]
last_updated: "2026-09-07"
source_basis: "Exact canonical source a6d4b26e621859af48c2cf04c45fbe5f47ff8a21; planner material 43e09580786f27a65a9bf5ca700df4cf8337293e; isolated base 803240b27fa4b40373524a1ed42d0b9bee7e890c; five read-only protected-worktree SHA-256 observations; one matched fail-closed baseline; one exact-candidate transition and rollback in a goal-owned disposable worktree."
</ai_context>

# Cycle 421: explicit RV-052 overlay retention

## What was wrong

The Cycle 420 reviewer accepted the research but found that release preparation
did not cover five divergent protected paths. Two Scout files were visible as
tracked modifications, while three candidate-added Herdr files already existed
as ignored files in `/app`. Ordinary porcelain status omitted the ignored
files, so the v1 planner correctly stopped at
`status omitted changed candidate path`. That stop prevented overwrite, but it
provided no bounded way to declare and verify an intentional retain decision.

The isolated replay also exposed a separate implementation limit: reading the
1,547,151-byte topic-map blob exceeded the subprocess helper's default output
buffer and returned an empty Git error. This was a planner transport failure,
not repository corruption or protected-checkout drift.

## What changed

Material commit `43e09580786f27a65a9bf5ca700df4cf8337293e`
adds repeated `--retain-worktree <path>=<sha256>` declarations. Once any such
declaration is supplied, every divergent candidate overlap must be named. The
planner rejects unsafe or duplicate paths, malformed digests, byte drift,
candidate-identical declarations, unused declarations, and any undeclared
divergent overlap. A status-hidden but byte-matched path is surfaced as
`ignored-protected`; no path is written by planning. Git output is capped at
64 MiB so current large knowledge artifacts remain readable without making the
operation unbounded.

Focused tests cover the earlier default fail-closed path, omitted tracked
retention, digest drift, exact tracked-plus-ignored admission, and a candidate
blob larger than the former subprocess default. They pass 8 tests / 35
assertions.

## Bounded seed and queue reconciliation

This was a release-safety batch, not a new source investigation. It reused the
accepted Cycle 420 observation through `2026-09-06T02:05:21.407Z` and made zero
Xiaohongshu or public-source requests. Added and changed seed identities remain
unknown, observed removals remain `[]`, and all 132 durable identities remain
unavailable at the profile-class login wall. RV-052 outranked another research
question because it blocked safe canonical integration while RV-004/RV-034
still require inaccessible outcome or runtime evidence.

## Exact isolated exercise

A new goal-owned disposable worktree started at landed main
`803240b27fa4b40373524a1ed42d0b9bee7e890c`. Only the five observed `/app`
bytes were copied into it; `/app` itself remained read-only. The two tracked
Scout paths appeared as modified and the three Herdr paths appeared only under
`--ignored`. The unchanged planner invocation reproduced the expected failure
on `projects/herdr-supervisor/README.md`.

The explicit run against exact candidate
`43e09580786f27a65a9bf5ca700df4cf8337293e` produced 48 candidate paths, 5
retained overlaps, 43 clean materializations, 10 rollback restores, and 33
rollback removals. The exercised mixed-index transition left exactly five
modified paths and preserved these SHA-256 values:

| Protected path | Retained worktree SHA-256 |
| --- | --- |
| `projects/scout-knowledge-lib.app/package.json` | `d15c253f6fd4fd5dd7516e8b184bcbfd14d6b999ade0a2ff11d55d77b82b2ded` |
| `projects/scout-knowledge-lib/knowledge/INDEX.md` | `487a560c2b60d69f6bae27b55c0a15b352ae1a60e8b7f25599940e2e9decf2f2` |
| `projects/herdr-supervisor/README.md` | `8692a100a1dc822de5be04ffc1a2e311903d731851692865db0e7e89e9ef6565` |
| `projects/herdr-supervisor/docs/research.md` | `8436de82c8d2e8c0d84be3d5a6b18b32baf483b2629f48abbd47fc51a2151de0` |
| `projects/herdr-supervisor/package.json` | `925211986dea3b006d5f7e44c249aa898f86464297a646e30c4edcb33250a488` |

The inverse transition restored exact HEAD `803240b27fa`, the complete default
and ignored status byte streams, and all five hashes. The disposable fixture
was retained at that restored boundary for independent inspection.

The complete checkpoint tree passes syntax, TypeScript, formatting, Cycle 420
projection, 113 scoped links, navigation 11/14 + 8/8 + 14/14, and 316 tests /
1,564 assertions. The broad audit covers 1,551 tracked Markdown documents and
1,796 local links with zero errors. Read-only health at the material commit
clock reports 26 facts / 16 wakes with `truncated:true`; whitespace is clean.

## Disposition and limits

RV-052 is **mitigated by an isolated exact-candidate rehearsal but remains
high/open pending independent review and a fresh release-boundary replay**.
This result does not authorize local-main movement, compaction, cleanup, or a
claim that future `/app` bytes will remain unchanged. A future release must
recompute all protected hashes, require a clean index, obtain an exact plan for
the then-current canonical tip, exercise the reviewed transition, and verify
the full before/after fingerprints. Roll back the material change with one
ordinary revert of `43e0958078`; the isolated transition itself was already
reversed.

## Supervision

- Goal: Continuously turn Scout Knowledge Library's collected seeds, unresolved topic-map questions, and newly discovered evidence into the highest-value validated knowledge improvements, keeping the library and living topic map useful, current, traceable, and safely integrated into local main at reviewed release boundaries until the human explicitly stops or replaces this goal.
- Goal ID: "g_c1b31972-1674-47cb-96d8-c797d768010d"
- Worker: "goal-a2acd0ab0579d04f3d163e5db9a"
- Codex session: "01a05c5f-cb03-7760-9c42-893d669f7762"
- Pane: "w1:p6C"
