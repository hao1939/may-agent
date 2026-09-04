<ai_context>
summary: "Cycle 406 local-main preparation has a sound 295-path reconciliation manifest and a clean validated candidate, but candidate be902d03fc97da1998ebbb9492cf5393853d91c2 was built from canonical ec9549e90511817b80912bbdc769c677c70129d6 and does not contain current canonical tip 577ba279885308c05feb8abf4ff00f949cc82694. Independent review accepts the preparation evidence and two bounded worktree removals but blocks landing until a current-tip candidate and a tested 23-path overlay-preservation operation are reviewed."
triggers: ["Scout local-main integration", "dirty overlay preservation", "RV-041", "Cycle 406", "release boundary", "merge diff hygiene"]
last_updated: "2026-09-05"
source_basis: "Read-only protected-checkout observations through 2026-09-05T04:11:44+08:00; exact main, canonical, merge, tree, status, overlap, blob, ancestor, worktree-registry, and retained-commit identities; a mechanically verified 295-row path manifest; independent full validation on both the isolated merge candidate and exact current canonical tip."
</ai_context>

# Cycle 406 isolated local-main preparation

## Outcome

The current canonical Scout result merges conflict-free with current local
`main` in a goal-owned isolated worktree. The merge is retained only as a
candidate: protected `/app` was not edited, cleaned, tested, stashed, reset, or
moved, and local `main` remains at its original commit.

The earlier 295-path overlap count did not mean 295 unresolved content
conflicts. Exact current classification is:

- 139 paths are deleted in both the protected checkout and the candidate;
- 133 paths are byte-identical between the protected checkout and candidate;
- the remaining 23 protected blobs are byte-identical to the same retained
  canonical ancestor, `9a5c3f9393ba20dbaf3d17fd0af3f23671f62d1b`, and current canonical history
  is its successor.

The complete sorted per-path result is
[`scout-local-main-overlay-reconciliation-cycle406.tsv`](./scout-local-main-overlay-reconciliation-cycle406.tsv),
295 data rows, SHA-256
`64128f2926354c050c5274f38a58c3de2dc705d29241c041b22237d847f40e87`.
It records each protected status, disposition, protected blob where present,
and the candidate or ancestor evidence. This advances RV-041 from an
undifferentiated collision count to a reproducible preservation map, but does
not close RV-041 or authorize moving main.

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

Both exact parents are ancestors of the candidate. The candidate changes 433
main-relative paths and is clean. A separate goal-owned overlay probe remains
clean at the same candidate after an atomic whole-diff replay failed closed on
already-absent deletions and successor-content conflicts; no protected bytes
were copied or committed there.

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

## Disposition and rollback

RV-041 remains **high/open** until independent review accepts this preservation
map and the exact landing boundary either has a clean protected checkout or
reproduces every protected fingerprint and disposition without new drift.
Local `main` has not moved. Historical candidate `283f723fd1` remains
superseded for landing; this current candidate contains exact canonical tip
`ec9549e905` instead.

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

Before landing, build a new isolated candidate from exact current canonical
tip, specify and test a reversible overlay-preserving operation in goal-owned
space, verify pre/post protected fingerprints and all 23 retained bytes, and
rerun exact-candidate validation. Stop on any drift. Rollback of this review
disposition is one ordinary revert of its reviewer commit; rollback of any
future landed merge must revert that exact merge without cleaning or replacing
the protected overlay.

Because the candidate is not landed, rollback is to retain both source commits
and remove the isolated candidate worktree/branch only after no active or saved
goal references them. If a reviewed merge is eventually landed, rollback is
an ordinary mainline revert of that exact merge commit; it must not discard or
clean the protected overlay.

## Release-maintenance inventory and cleanup

The release-boundary inventory found seven goal-owned checkouts before
cleanup. Two detached checkouts were clean, unreferenced by every current goal
JSON, and already contained in both standing and candidate history:

| Removed checkout | Exact retained commit | Before |
| --- | --- | ---: |
| `g-c1b31972-cycle231-baseline` | `c19307f9237a95ed822c6734bcf1fad4c831928b` | 219 MB |
| `g-c1b31972-cycle384-validate-pjMOnG` | `83a35e8e0f66c46f3e1c66a54132991ba311cf14` | 220 MB |

Only those two clean worktree checkouts were removed. No commit or branch was
deleted; both exact commits remain objects and ancestors of standing
`8d28565893a474e65e975d85a3728696d421fc30` and candidate `be902d03fc`.
The operation reclaimed approximately 439 MB.

Five goal-owned checkouts remain at approximately 1.1 GB total. Historical
candidate `283f723fd1`, current candidate `be902d03fc`, its clean overlay
probe, and the standing worktree remain because they support this active
release boundary. Detached baseline `ec317f8456` remains because two goal
records still reference its exact commit. Protected `/app` and every peer
worktree were excluded from cleanup.

## Next release boundary

Independent review should verify the exact candidate, the 295-row manifest,
the 23 ancestor-blob claims, and the externally changed non-Scout status
fingerprint. Do not move local `main` from this preparation alone. After review,
repeat the protected fingerprints immediately before any landing; if they
differ, update the map and stop rather than inferring preservation.
