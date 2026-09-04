# Scout Herdr landing reconciliation — 2026-09-01

## Outcome

The Scout owner's active maintenance state previously existed only as 296
uncommitted paths, so the accepted Herdr enablement and library-health
operation could not safely become the base for follow-up repairs. This landing
branch first preserves that state as a standalone prerequisite revision, then
merges both accepted tips without writing to or committing from the owner
checkout. The result gives reviewers one local, reversible branch in which the
owner content and Herdr history remain separately attributable.

## Revisions and scope

- Starting revision: `386b445c236e4609cd8870d22cc773cc4641fec8`
- Landing branch: `codex/g-12af568e-scout-landing`
- Owner-state prerequisite: `9a5c3f9393ba20dbaf3d17fd0af3f23671f62d1b`
- Accepted enablement tip: `204d9a37e34c7ee3af479b137af3800e0b969109`
- Enablement merge: `f96c14185d`
- Accepted health-operation tip: `2fac591b01e6aafea12b9fe07209105bf34d5f5d`
- Health-operation merge: `a4bd94133e`

The prerequisite contains exactly the 296 Git-visible Scout paths from the
owner checkout: 120 modified tracked paths, 140 tracked deletions, and 36
previously untracked files. Its commit message identifies the snapshot as a
mechanical preservation and does not claim authorship of the content.

## Preservation proof

The snapshot was constructed in the goal-owned worktree from a binary tracked
diff and a tar stream of Git-visible untracked files. Before the prerequisite
commit, the source and isolated snapshot had the same status count and these
same fingerprints:

| Surface                            | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| NUL-delimited porcelain-v2 status  | `a430d0c9f6572009793273d453d67220ba6a5f6c6e4198d43de4628684322f7e` |
| Binary diff from starting revision | `e720d072e886a1a6e9be9d3cdd1fc29393fd76c63bfc61f44e1497ee06441da8` |
| Untracked-file tar stream          | `93519ea9be489283329e37136d7db481f9e946d59ec753156e414eebec18a76a` |

After the isolated commit, the source checkout still had the same HEAD, the
same 296-path status, and all three same fingerprints. This proves the capture
did not clean, reset, stash, stage, overwrite, or otherwise change the owner's
Scout checkout.

## Reconciliation decisions

Both accepted tips descend from the same reviewed enablement chain. The
enablement tip was merged first; the health-operation tip was merged second so
Git retained the common enablement history once and added each accepted
operation record as its own parent.

No textual conflict occurred. The owner snapshot remains authoritative for
its existing `package.json`, `library-health.ts`, and
`library-health.test.ts` content. The accepted enablement assets add the
read-only command, its tests, TypeScript coverage, portable pilot contract, and
operator documentation. The health-operation tip adds its historical report
and two generated follow-up contracts. No owner file was replaced with an
accepted branch version, and no accepted asset was dropped.

The historical operation report remains unchanged as evidence of what that
worker observed. The living operator guide and generated contracts now point
forward to this preserved lineage instead of treating owner preservation as
pending.

## Follow-up revision gate

The future-date and unsourced-index workers must start from an explicit
revision descended from all of these commits:

```sh
git merge-base --is-ancestor 9a5c3f9393ba20dbaf3d17fd0af3f23671f62d1b <start-revision>
git merge-base --is-ancestor 204d9a37e34c7ee3af479b137af3800e0b969109 <start-revision>
git merge-base --is-ancestor 2fac591b01e6aafea12b9fe07209105bf34d5f5d <start-revision>
```

Each command must exit zero. The worker then creates its own branch and
worktree at that exact revision; it must not use, edit, or validate against the
dirty `/app` checkout. This gate proves the follow-up begins with the preserved
owner state, the read-only health tooling, and the operation contracts.

## Validation and review

From the goal-owned app directory, `bun run check` passed. It bundled all 10
syntax-check modules, TypeScript reported no diagnostics, tracked source
formatting matched, and all 71 application tests passed with 189 expectations
and zero failures. Those 71 include the 14 focused `library-health.ts` and
read-only-command tests.

The broader landing check also passed:

```sh
bun x prettier --check README.md docs/herdr-supervisor.md \
  docs/verification/herdr-library-health-pilot-2026-09-01.md \
  docs/verification/herdr-library-health-operation-2026-09-01.md \
  docs/verification/scout-herdr-landing-2026-09-01.md \
  herdr/goals/*.goal.json scripts/library-health-readonly.ts \
  scripts/library-health-readonly.test.ts
```

All three goal contracts passed a portable validation equivalent to Herdr's
`validateGoalContract`: only the five v1 fields were present, the schema was
`herdr.goal/v1`, the objective was non-empty, all list entries were non-empty
strings, and acceptance was non-empty. `git diff --check` and the three
prerequisite ancestry checks also passed.

The direct read-only command was:

```sh
bun scripts/library-health-readonly.ts \
  --app-dir "$PWD" \
  --project-dir "$PWD/../scout-knowledge-lib"
```

At `2026-09-01T09:42:45.826Z` it reported the exact goal-owned roots, 24 facts,
16 wake signals, and `truncated: true`. The facts were 13 future-date signals,
10 oversized-note signals, and the 222-entry unsourced backlog. The truncation
is limited to first-packet wake signals: a clean landing worktree has no prior
observer state, and the workflow bounds new wake signals at 16. It does not
invalidate the two already generated bounded follow-up contracts, but this run
must not be represented as a complete absence check for other fact kinds.

`.state` was absent before and after the read-only command. The NUL-delimited
scoped status fingerprint was unchanged before and after at
`43cd5fd7965db9b20810d2665f8ebe8a79d9550400b06d10b45de7511b1ab9a5`;
that fingerprint covers the then-uncommitted reconciliation record itself and
proves the command introduced no additional path change. The full validation
is rerun after the reconciliation commit so the handoff evidence matches the
final candidate revision.

The branch is intentionally local. No push, pull request, shared-branch merge,
production action, credential action, or external-service mutation is part of
this landing. The 24 reported health facts remain for bounded follow-up; the
landing does not repair them. Reviewers should inspect the prerequisite
separately, confirm the two accepted tips are ancestors, review this goal's
documentation/contract delta, and fast-forward only from a clean review
worktree.
