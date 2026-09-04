<ai_context>
summary: "Cycle 406 landed exact reviewed merge 803240b27fa4b40373524a1ed42d0b9bee7e890c on local main with protected bytes preserved and exactly 23 intended Scout divergences. A no-renames audit corrects the expected expanded status from 493 to 492 because an R100 pair represented two preflight dirty records. RV-041 and RV-043 are resolved for this landing; RV-044 records the failed first rollback and requires safer future transition tooling."
triggers: ["Scout local-main integration", "dirty overlay preservation", "RV-041", "RV-043", "RV-044", "Cycle 406", "release boundary", "merge diff hygiene"]
last_updated: "2026-09-05"
source_basis: "Protected preflight, guarded transition, recovery, retry, and independent postflight through 2026-09-05T04:50:08+08:00; exact prior main 8554a5718cfa051bf4fb827c974423380614e5a7, canonical 1d25aaadd544e89c74666a888771b4c9b49d4638, landed merge 803240b27fa4b40373524a1ed42d0b9bee7e890c, standing postflight 8bf1a0b1cc0858280d0780202100a7fc649b37ee containing reviewer result 915b8b8c1197eb5b8d60ccf79d9f09c78dd389d9, 295-row manifest, no-renames overlap correction, exact status fingerprints, candidate validation, retained cleanup evidence, and rollback boundary."
</ai_context>

# Cycle 406 local-main integration

## Outcome

The reviewed canonical Scout result first merged conflict-free with local
`main` in a goal-owned isolated worktree. The guarded transition later advanced
local `main` to that exact merge while retaining the human-owned overlay. No
tests, cleanup, stash, hard reset, or bulk formatting ran in protected `/app`.

The original rename-aware 295-path overlap count did not mean 295 unresolved
content conflicts. Its manifest classification is:

- 139 paths are deleted in both the protected checkout and the candidate;
- 133 paths are byte-identical between the protected checkout and candidate;
- the remaining 23 protected blobs are byte-identical to the same retained
  canonical ancestor, `9a5c3f9393ba20dbaf3d17fd0af3f23671f62d1b`, and current canonical history
  is its successor.

The sorted per-path manifest is
[`scout-local-main-overlay-reconciliation-cycle406.tsv`](./scout-local-main-overlay-reconciliation-cycle406.tsv),
295 data rows, SHA-256
`64128f2926354c050c5274f38a58c3de2dc705d29241c041b22237d847f40e87`.
It records each represented protected status, disposition, protected blob
where present, and candidate or ancestor evidence. Postflight review found one
additional overlap hidden by rename detection; the correction appears below.

## Exact source and candidate identity

| Role | Exact identity |
| --- | --- |
| Protected checkout and local `main` before preparation | `8554a5718cfa051bf4fb827c974423380614e5a7` |
| Validated canonical Scout source | `ec9549e90511817b80912bbdc769c677c70129d6` |
| Goal-owned merge candidate | `be902d03fc97da1998ebbb9492cf5393853d91c2` |
| Candidate parents, in order | `8554a5718cfa051bf4fb827c974423380614e5a7`, `ec9549e90511817b80912bbdc769c677c70129d6` |
| Candidate tree | `2767333de80654cd76a9dd4b89374bf15eae6d55` |
| Candidate branch | `codex/g-c1b31972-main-integration-406` |
| Retained protected-blob ancestor | `9a5c3f9393ba20dbaf3d17fd0af3f23671f62d1b` |

The table above records the first candidate, which remains historical and
rejected. The independently accepted regenerated boundary is:

| Role | Exact identity |
| --- | --- |
| Current canonical Scout source | `1d25aaadd544e89c74666a888771b4c9b49d4638` |
| Regenerated merge candidate | `803240b27fa4b40373524a1ed42d0b9bee7e890c` |
| Candidate parents, in order | `8554a5718cfa051bf4fb827c974423380614e5a7`, `1d25aaadd544e89c74666a888771b4c9b49d4638` |
| Candidate tree | `b6864abee20f01e750edd835c9992b9b95f037bf` |

The regenerated candidate changes 435 main-relative paths and is clean.

Both exact parents are ancestors of the historical candidate. That candidate
changes 433 main-relative paths and is clean. A separate goal-owned overlay
probe remains clean at the same candidate after an atomic whole-diff replay
failed closed on already-absent deletions and successor-content conflicts; no
protected bytes were copied or committed there.

## Protected overlay evidence

At `2026-09-04T18:49:57.606Z`, read-only observation found:

| Surface | Records | SHA-256 |
| --- | ---: | --- |
| Default protected `/app` status | 345 | `f4686edb8c74cf540c504fe668ef59c6d55bfe64a4f02a1be9fcc21118347642` |
| Fully expanded protected `/app` status | 765 | `267eb6a6e187c07c7a0f20193c40fc9ed62338463c65d4b6d1e3eabdb1da0537` |
| Fully expanded Scout status | 296 | `7e4d09379a93e60fe584a87f6c40c8b8cc493ae059be289359a40a10bdc26a8a` |
| Candidate/dirty overlap | 295 | `966e8c8825b93bca05ab0c0f28b37a4ce5cfa21429288504a7fd02beb7b1bcff` |

The default and fully expanded protected counts each increased by one during
this bounded preparation while the Scout fingerprint and all 295 overlap
identities remained unchanged. That is externally observed non-Scout drift;
this worker does not attribute a cause. The other 470 expanded dirty paths are
not changed by the candidate, so the merge does not replace their content.
Any future landing must repeat the fingerprints at its exact boundary rather
than treating this observation as permanent.

## Validation and retained limitation

Validation ran in the clean goal-owned candidate, not protected `/app`:

- full Scout gate: 296 tests, 1,486 assertions, zero failures;
- syntax, TypeScript, source formatting, and Cycle 405 seed projection pass;
- 101 scoped relative links pass;
- navigation passes 11/14 on v1 and 8/8 on v2;
- broad audit passes 1,540 tracked Scout Markdown documents and 1,741 local
  prose links;
- read-only health returns 30 facts / 16 wakes and remains truncated;
- both exact candidate parents are contained and the candidate worktree is
  clean.

The full main-to-candidate diff still reports 127 trailing-whitespace and
three end-of-file findings, with diagnostic SHA-256
`fe687582176035530533d30eb25892feda28bbc2e53b08df94e2c5dd6dde6dc2`.
This is the previously disclosed inherited merge-diff hygiene limitation, not
a passing diff check. The RV-042 source-claim correction remains integrated;
the hygiene limitation is preserved separately and is not relabelled as an
RV-042 content regression.

## Historical preparation dispositions

At the first preparation boundary, RV-041 remained **high/open** until
independent review accepted the preservation map and a later exact landing
reproduced every protected fingerprint and disposition. Local `main` had not
moved. Historical candidate `283f723fd1` was superseded for landing; that
first replacement candidate contained canonical tip `ec9549e905`.

### Independent landing-safety disposition

Independent review accepts the manifest as preparation but returns **revise**
for landing candidate `be902d03fc97da1998ebbb9492cf5393853d91c2`.
The candidate is clean, has the stated parents and tree, and independently
passes the full Scout gate. It is nevertheless stale: current canonical Scout
tip `577ba279885308c05feb8abf4ff00f949cc82694` is not its ancestor. The
candidate's canonical parent is `ec9549e90511817b80912bbdc769c677c70129d6`,
so it excludes later canonical commits `8d28565893a474e65e975d85a3728696d421fc30`
and `577ba279885308c05feb8abf4ff00f949cc82694`.

The manifest's 23 `retained-canonical-ancestor` rows prove that the protected
files match exact retained ancestor `9a5c3f9393ba20dbaf3d17fd0af3f23671f62d1b`.
They do not prove that a concrete main-landing operation will retain those
older bytes as visible human-owned dirty changes. No landing operation was
performed or authorized. RV-041 therefore remains high/open, and RV-043
records the stale-candidate and untested-preservation boundary.

The resulting gate required a new isolated candidate from exact canonical tip,
a reversible overlay-preserving operation in goal-owned space, pre/post
fingerprints, all 23 retained bytes, and exact-candidate validation.

### Regenerated-candidate independent disposition

Those requirements are now satisfied for exact regenerated candidate
`803240b27fa4b40373524a1ed42d0b9bee7e890c`. Its parents are exact main
`8554a5718cfa051bf4fb827c974423380614e5a7` and exact canonical
`1d25aaadd544e89c74666a888771b4c9b49d4638`; both are ancestors, and every
Scout path in the candidate equals the canonical parent.

Independent validation passes 296 tests / 1,486 assertions, syntax,
TypeScript, formatting, Cycle 405 projection, 101 scoped links, navigation
11/14 and 8/8, a 1,541-document / 1,743-link broad audit, and bounded read-only
health. A separate rename-aware no-write model over all 765 protected records
and 435 diff entries reproduced 295 manifest overlaps: 139
identical deletions and 133 byte matches become clean, exactly 23 retained
ancestor blobs stay visibly modified, and 470 unrelated dirty paths remain
disjoint. Comparing the unchanged worktree bytes back to exact main restores
the original 120 modified / 139 deleted / 36 untracked overlap status.

Disposition: **accept one guarded landing at this exact unchanged boundary.**
Immediately before execution, require the exact main, canonical, candidate,
and protected fingerprints recorded here. Use only the exercised mixed-index
transition; afterward require main HEAD `803240b27f`, exactly the 23 intended
overlap modifications, all unrelated dirty bytes preserved, and the rollback
anchor retained. Stop on any mismatch. Historical `be902d03fc` remains
rejected and RV-043 was resolved for candidate admission. RV-041 remained
high/open until the actual protected transition and postflight evidence passed.

Integrate the reviewer documentation only after landing `803240b27f` while
standing remains `1d25aaadd5`; integrating it first would change canonical and
stale the approved candidate. Local main has not moved at this review point.

### Guarded landing postflight

Local `main` moved from exact `8554a5718cfa051bf4fb827c974423380614e5a7`
to reviewed merge `803240b27fa4b40373524a1ed42d0b9bee7e890c` while standing
remained at canonical parent `1d25aaadd544e89c74666a888771b4c9b49d4638`.
Standing then fast-forwarded to reviewer result
`915b8b8c1197eb5b8d60ccf79d9f09c78dd389d9`, stable patch ID
`940c67c59d572e019af61cc19b392ef509e71a31`, and recorded producer postflight
`8bf1a0b1cc0858280d0780202100a7fc649b37ee`.

The first attempt was not fail-closed. It rejected an expected 493-record
postflight count, restored HEAD to old main, then failed because candidate-added
paths do not exist in the old tree. That left 140 candidate paths in the
worktree. Recovery verified each current object against the candidate, restored
77 old-main paths, removed 63 candidate additions, and reproduced the exact
preflight fingerprints: 345 default records at `f4686edb…7642`, 765 expanded
records at `267eb6a6…da0537`, and 296 Scout records at `7e4d0937…26a8`.

The retry reached the reviewed merge with no staged changes. Independent
postflight observation gives:

| Surface | Records | SHA-256 |
| --- | ---: | --- |
| Default protected `/app` status | 72 | `c7398ad64fbba064834eb06096e3bbaa1c80d95a6364af17cb0c34d01c198de0` |
| Fully expanded protected `/app` status | 492 | `f27a48163e515c0234e51fe4943ef20ab4e676d93d6fe9cca7048eae4a6a63c0` |
| Fully expanded Scout status | 23 | `b9d6fb9c05a1b4c68e6348237512084d212d17c4fd7821b9838f374eca7a12c5` |

All 295 manifest rows reproduce overlay digest
`16ba67ccbcbdba88d8501aae872550f537717091be646a41a35ee73dfe551025`,
and all 23 ancestor-version rows remain visible modifications. The 492 count
is correct: rename-aware diff collapsed already-deleted
`2026-06-25-hn-scan-151.md` and untracked candidate-identical
`2026-06-25-escapability-hierarchy.md` into one `R100` pair. A no-renames diff
has 436 candidate paths and 296 true preflight overlaps, so the expected result
is `765 - 296 + 23 = 492`. The old source remains absent; old-main source,
candidate destination, and protected destination all share blob
`4bd4c72519c8c5f4ee45e83851abc847b80c956b`.

Disposition: **accept the exact landed result; revise future transition
tooling.** RV-041 and RV-043 are resolved for this landing. RV-044 remains
medium/open because the first rollback left residue and the manifest was
rename-sensitive. Any later transition must disable rename collapsing, model
both sides, preclassify additions, and exercise the exact 77-restore/63-remove
rollback form in isolated space. Rollback now must return to old main using
those object-guarded sets and reproduce all three preflight fingerprints;
never clean, stash, checkout, or hard-reset the protected overlay.

## Release-maintenance inventory and cleanup

The release-boundary inventory found seven goal-owned checkouts before
cleanup. Two detached checkouts were clean, unreferenced by every current goal
JSON, and already contained in both standing and candidate history:

| Removed checkout | Exact retained commit | Before |
| --- | --- | ---: |
| `g-c1b31972-cycle231-baseline` | `c19307f9237a95ed822c6734bcf1fad4c831928b` | 219 MB |
| `g-c1b31972-cycle384-validate-pjMOnG` | `83a35e8e0f66c46f3e1c66a54132991ba311cf14` | 220 MB |

Only those two clean worktree checkouts were removed. No commit or branch was
deleted; both exact commits remain objects and ancestors of current standing
`8bf1a0b1cc0858280d0780202100a7fc649b37ee` and landed main `803240b27f`.
The operation reclaimed approximately 439 MB.

Five goal-owned checkouts remain at approximately 1.1 GB total. Historical
candidates `283f723fd1` and `be902d03fc`, the clean overlay probe, the landed
candidate checkout, and the standing worktree remain because they support this active
release boundary. Detached baseline `ec317f8456` remains because two goal
records still reference its exact commit. Protected `/app` and every peer
worktree were excluded from cleanup.

## Next release boundary

Local `main` now contains exact reviewed canonical parent `1d25aaadd5` through
merge `803240b27f`. The next release candidate must start from that exact main,
include the then-current canonical tip, model diffs with renames disabled, and
repeat protected preflight plus an addition-safe rollback exercise. Historical
candidates `283f723fd1` and `be902d03fc` remain superseded for landing.
