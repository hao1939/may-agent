# Deterministic cycle evidence implementation trial — 2026-11-16

Alex implemented and integrated a reusable evidence generator/validator, then
verified it through one fresh hosted Task and read its accepted result after
closure. The generated evidence survived removal of the helper's worktree.
This establishes a bounded improvement to evidence integrity and handoff.
Two operator corrections were required during implementation; lower human effort,
lower cost and a fully unattended improvement cycle remain unproved.

## Problem and delivered boundary

The [previous handoff trial](cycle-evidence-handoff-trial-20261116.md) retained its
record successfully but initially accepted an invalid field locator and invented
timestamps. The user then asked Alex to take greater responsibility for delivery.
The assignment required implementation, focused verification, independent review,
safe source integration and a fresh hosted demonstration. Scout remained retained
example evidence and was not an improvement target.

The existing [handoff procedure](standalone-stage.md#hand-off-evidence-from-a-hosted-trial)
now invokes `projects/alex.app/scripts/cycle-evidence.ts` to generate and validate
a record. It samples the clock, verifies supplied artifact hashes, hashes unpinned
invocation inputs, checks every direct evidence link and declared JSON pointer,
and rejects outputs/artifacts inside caller-declared disposable roots. Canonical
paths prevent symlinks from bypassing that boundary. Committed tests use isolated
temporary fixtures.

The caller still supplies substantive fields and disposable roots. Passing
validation establishes the declared evidence mechanics; Alex and its reviewer
still judge completeness, causality, benefit, ownership and cost scope. This is a
CLI step in the documented procedure, not automatic enforcement in every workflow.

## Source, review and integration

| Boundary | Exact identity and outcome |
| --- | --- |
| Initial implementation | `5aec752a6c8c807332271ea673c8b9032e1c62c5`; rejected in Bob review 1 |
| First repair | `15170f706c402805d9490ebc3ee0d6fb4908f045`; rejected in Bob review 2 |
| Reviewed final candidate | `b8615aac18d3e57f76638ac50948671165a09d49`; approved in Bob review 3 |
| Final reviewer | `s_1794822823666_2735670b-caab-4a0a-8cfc-954812c4ed70` |
| Apps-main integration | `a94b27cebda023fc33a4ebbe16c9d5da67e8c581` |
| Concurrent main preserved | `d3dd6ade7d0c893340add7b56c62f7dc988911d9`; guarded merge preserved both histories and unrelated dirty bytes |
| CLI SHA-256 | `abea8a6b6c3b61163871384ad3bb8c5098876fe56a429516ee600dc741da24f5` |

Alex used `develop-change` run `wr_1794822185419_wf44` for design and initial
implementation. Its first verification used a stale shared SDK installation;
the workflow returned incomplete after an invalid implementation judgment.
Alex recovered through the existing specialists, executable checks and exactly
three candidate reviews, retaining ownership through integration and verification.

Bob's first review caught disposable-path and pointerless-link defects. Independent
operator probes also reproduced silent replacement of a supplied expected hash,
inconsistent relative references and nonportable tests. A second operator audit
showed that symlinks could lose accepted evidence at closure; Bob rejected that
candidate too. Both corrections reached the same owning Task. Alex implemented
the repairs; the operator did not edit candidate source.

Candidate and integrated focused checks passed **14/14**, with 42 assertions.
Independent verification bound the files to the final commit and also passed
14/14. Eight separate final-candidate probes passed, including real retained v1
pointer/timestamp rejection, real v2 acceptance, pinned-hash preservation,
relative links, pointerless links and disposable/symlink boundaries. The test
command used the supplied installed-SDK `--tsconfig-override`; Bun emitted an
internal directory warning but exited zero. `check:ci` is undefined, and broad
repository typechecking was not established by this trial.

No definition reload was needed. Active definitions remained
`4ba5f6bec7c3e2ddcb8c81a9888bb806d2003289-definitions-v6`; Host PID 60 and its
`2026-11-16T03:21:12.093Z` start time remained unchanged. Enabled Apps remained
Alex, May and Scout. The 30 frozen historical inputs, corrected session-10 record
and two unrelated tracked dirty files passed independent preservation checks.

## Hosted delivery and observation

| Work | Public identity |
| --- | --- |
| Owning Task | `alex/input/app_0e7d205f-aea2-4cce-ba2e-ae8cbc57d6c0` |
| Admission event | `6726105` |
| Final accepted owner attempt | `r_1_35ae9bac-714f-49a0-a8b9-0143ebe375ac` |
| Final owner session | `s_1794823024609_b8fe1f58-95b0-468d-b991-b15f170e4efc` |
| Sole verification helper | `alex/input/appdep_7f2cac8fb7097e06d7a410fd` |
| Helper accepted attempt | `r_1_0767f0d2-2d7e-4202-8749-e0772b6bcde0` |
| Helper session | `s_1794822894462_df1a7534-f2c8-4524-b52d-e687670677fc` |

Alex admitted the helper through `tasks.apply`, saved its exact request Condition,
and returned waiting while it ran. The Host resumed the owning Task automatically
after the dependency returned. Alex closed the fulfilled helper as creator, read
its accepted result after closure, validated retained bytes and closed its own
assignment. Both Tasks have accepted terminal results. The owner had three
attempts: implementation/wait, acknowledgement of the queued audit inputs, and
the automatic dependency continuation. No operator successor admission was needed.

The helper used integrated commit `a94b27cebd` in a clean fresh worktree, prepared
a separately identified invocation and fixture artifact, and ran the actual CLI's
generate and validate commands. This is a mechanics demonstration, not a fresh
natural-work or Scout behavior comparison. The helper needed zero operator
corrections. Its record SHA-256 is
`2e98f94256be44e7dfcc6f69ff226a301d655c30b24bbd0af6f713a00b49591e`.

Independent post-closure inspection used only the accepted helper result and its
direct files. All seven accepted-result hashes and 12 files in the verification
summary matched; the one linked artifact and all 13 pointer declarations verified.
The record timestamp fell inside the actual helper attempt. The helper worktree
was absent, and all promised files remained outside it. No transcript
reconstruction was needed to recover or validate the result.

## Time, cost and remaining milestone

The wall-clock interval from first owner attempt to final accepted disposition
was **15m 43s**. The helper took **2m 10s**, overlapping the owner.

| Full Task scope, including specialists | Reported model estimate |
| --- | ---: |
| Owning Task, all three attempts and 11 sessions | $10.4234803 |
| Helper Task, one attempt/session | $1.2828 |
| Combined | **$11.7062803** |

These are public Host estimates, not actual billing, and exclude operator and
other external costs. Usage groups/runs were untruncated. The exact-attempt
execution list truncates at six sessions for the first owner attempt; recursive
public specialist-result links recovered all 11 owner sessions. Alex returned
operation counts and unknown billing; the operator collected the available model
estimates after closure. Monetary estimate handoff therefore remains manual.

The supported owner disposition is adoption of this mechanical helper. The next
milestone is to reuse it in an authorized bounded cycle, have Alex deliver the
available full Task estimates, and observe whether integrity repairs can finish
without operator-authored correction instructions. Track corrections, elapsed
time and full cost alongside the outcome. This implementation trial does not
commission another target experiment or establish savings.

## Retained evidence

The external evidence index is
`/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-11/README.md`.
It links the admitted assignment, accepted Tasks, correlated sessions/workflow,
failed and final probes, command receipts, post-closure audit and usage reports.
Alex's promised hosted output is retained under `alex-evidence/hosted-demo/` in
that directory. An operator backup also retains the initial local development
archive; that backup is not an Alex-owned retention improvement claim.
