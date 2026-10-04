# SDK quickstart trial — September 30, 2026

Bob completed the installed-environment walkthrough: review, correction on the
same Task, one guidance edit, activation and a fresh review showing the requested
behavior. This was an informed agent trial with explicit May assistance for the
guarded edit, not a clean-install or naive-reader benchmark.

## Evidence and result

- Bob Task: `may:goal/app_20e0daeb-38cc-4812-aa83-9a43766a5303`, accepted attempt
  `r_1_7886465b-a0d5-4a12-bb91-1bb244f249b9`, finished 05:37:14 UTC.
- Baseline guide/client: `c8ef12d64bcb6a45762ec2bec09551e451225621`.
  Host/SDK source: `de59c8dae911c8a4e39c925d619164128610301a`.
- Original sample Task: `sample:review/app_6a372725-2f40-46a5-966e-c25631bc8dda`.
  Events `6488132` and `6488140` produced accepted attempts
  `r_1_7ebdd8e2-ba80-41ae-a9a5-1a2852f20038` and
  `r_1_b07d5f26-069d-4fd3-9132-c479e2d43d46`. Both remain readable.
  The correction established the 16-reference limit and distinguished omission
  from contradiction; it did not test an over-limit submission.
- Guidance commit: `2822eacf9db6567503f17d628f79d0aa8eb8ce66`.
  Reload request `6488151` links completion `6488152`, with `ok: true` and the
  exact source commit. This activated definitions, not a Host binary.
- Fresh sample Task: `sample:review/app_d0d215c6-37bf-494d-b904-b79f77bdd721`,
  accepted attempt `r_1_d9c9baec-2eea-4c3d-abf3-55e80b70a9bb`.
  Its response ends with the newly required `Untested assumption:` sentence;
  all three cited immutable definition files were readable and hash-matching.

The accepted Bob result links the full report and commands by absolute path and
SHA-256. Report digest:
`5baaa46d19402c9a2e46893a53965746955a9087cd36cd62c9eeeea431f1b044`.
Raw receipts and retained reviewed bytes are in that Task's notes. Follow its
exact accepted result; this summary is not a replacement for execution evidence.

## Small corrections supported by the trial

| Observation | Correction |
| --- | --- |
| Bob's initial Task worktree lacked nested Host source, so the example client failed before connecting | Name the precise source-checkout prerequisite and distinguish source root from App root |
| File evidence appeared under `result.coverage.artifacts`, not always `result.artifacts` | Describe App-owned result layout accurately |
| Editing a cited working file invalidated its old evidence hash | Preserve verified original bytes before mutation using the existing evidence helper; a saved path is insufficient |
| Bob's edit tool refused another agent's identity file | Explain edit authority; Bob used a bounded call to May, who made the authorized edit |
| The fresh reviewer found ambiguous relative paths in the sample README | State their source-root convention and the reference limit |

Source checks passed before activation. The supervisor independently read the
accepted sample and Bob results, report, activation receipts and artifact hashes.
No new Host mechanism was necessary. The fresh review's additional finding and
artifact layout could reflect model variation; only adoption of the requested
final sentence is directly supported by this comparison.

Not covered: external observer waits, cross-App durable caller return,
concurrent corrections, crash/restart, clean installation, unavailable models
or long-term behavior consistency. Reuse the
[App review method](../../alex.app/docs/2b-manual/workflow-authoring.md#reusing-an-app-review)
for those separate questions.
