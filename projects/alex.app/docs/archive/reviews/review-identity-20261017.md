# Truncated linked-Task review identity — independent review

Status: integrated into Apps main and activated in the local `/app` runtime at
2026-10-17 00:19:04 Asia/Shanghai. No A-specific correctness finding. Focused
tests, design checks and the root TypeScript check pass.

## Scope

Reviewed `f67d832008d0321f657440452e2e02a9fe19e805` and the selector regression
from `e80f3ae20b62090c8404b1fcc2a08d43a802014a`, isolated on Apps main
`0c0bd5f49d018692470d1b49cdac96ddb427c87e`.

The review branch is `review/alex-review-identity-20261017`. It contains
proposal A, its connected selector regression and a separate root TypeScript
configuration correction described below. The completion-guidance implementation
on the author's original branch is excluded from this review.

## Conclusion

The change omits only the top-level diagnostic `bytes` field from truncated
linked-Task entries when computing review identity. It retains the original
packet and diagnostics, linked identities, availability, supplied detail and
artifact integrity metadata. Existing accepted-report and staged-publication
reuse remain the execution paths. No new cache, queue, schedule or Host change
is introduced.

The producer currently emits only Task identities, truncation status and omitted
payload size for these entries, so the normalization matches the intended narrow
boundary. It does not claim that the omitted content is unchanged or reviewed.

## Verification

- Replayed all eight captured size-only repeat pairs through the actual baseline
  and candidate hash functions. Baseline hashes matched the original records and
  differed within each pair; all candidate pairs matched. Original packets and
  diagnostics remained unchanged. No model was invoked by this replay.
- All 120 focused tests passed, with 811 assertions, across public evidence,
  pinned evidence, Task review and selector tests.
- Connected workflow coverage performs one initial judgment and zero additional
  calls for size-only growth. Selector coverage reuses a retained report without
  changing its bytes, then selects the subject when linked identity changes.
- Existing checks for meaningful evidence, availability, review boundaries,
  immutable report recovery after failed publication and legacy-report readability
  passed in the same focused run.
- `bun run check:may-design` passed, including design examples and canonical App
  checks. The pre-existing unclassified `reports` warning remains. The first
  attempt lacked a paired Host documentation path in the isolated checkout;
  providing the paired checkout resolved that setup failure.
- The original root `bun run typecheck` reported two errors in the paired SDK's
  `task-contract.ts` at lines 494 and 596: `progress` narrowing and a
  reconcile-admission return type. Unchanged Apps main produced identical
  diagnostics. Enabling `strictNullChecks` restores the SDK's required union
  narrowing; both the command-line experiment and the ordinary root check after
  the configuration change pass. This separate tooling correction changes no SDK
  source or runtime behavior. The root check covers its configured shared-code
  entrypoints, not every App workflow; the optional final-runtime gate was not run.

The focused command is:

```sh
EVALUATION_AUTO_REVIEW_REVIEWER=evaluator bun test \
  ./projects/alex.app/agents/evaluator/workflows/lib/public-task-evidence.test.ts \
  ./projects/alex.app/agents/evaluator/workflows/lib/pinned-task-evidence.test.ts \
  ./projects/alex.app/agents/evaluator/workflows/task-outcome-review.test.ts \
  ./projects/alex.app/agents/evaluator/workflows/task-outcome-selector.test.ts
```

The explicit reviewer setting keeps test fixtures independent of installation
configuration. A paired SDK and ordinary dependencies are required; test data
and reports use local synthetic fixtures, not running Tasks or providers.

## Integration and measurement

Integrate A independently through the existing owner work. Preserve historical
hashes and reports; a subject may need one transition review under the existing
allowance. Activation and verification of the loaded revision remain separate.
Keep model and cadence stable, then measure naturally occurring review reuse and
coverage over 24 hours. These source checks establish the corrected identity and
reuse behavior, not measured production savings.


## Local activation and observation boundary

- Activated source: `fc40aaec90bffcd7023a57a7d13dcaa48f5ffae4`.
- Operator reload request `6675953` linked to successful completion `6675955`;
  the completion reports `ok: true` and the exact source commit.
- The active release manifest and new admission worker name that same revision.
  The loaded hash implementation matches the reviewed source byte for byte.
- All eight historical pairs also passed replay against the previous and newly
  activated release modules, with zero model calls.
- Reload retained three Apps. Before and after snapshots each showed zero running
  Tasks; no Task resume/cancel, schedule, model, Host binary or SDK change was made.
  Already-merged documentation and manual guidance accompanied A in the release;
  A is its only executable App change from the previous active revision.
- Root TypeScript configuration was corrected in a separate tooling commit.
  Unrelated untracked shared-checkout work was preserved.

Use the 24-hour observation window from 2026-10-17 00:19:04 to 2026-10-18
00:19:04 Asia/Shanghai. Inspect naturally occurring review attempts and retained
reports; do not commission model calls to fill the sample. Check for size-only
re-reviews, successful report reuse, continued selection on meaningful evidence
or review-boundary changes, and the number of newly reviewed subjects. Separate
Task reviews from metric reviews and model invocations from code-only selector
attempts. Count transition reviews separately because historical hashes remain
immutable. Report uncached input, cached input/writes and output separately;
provider-unpriced usage is not free. Compare with the retained audit cohort while
accounting for workload and any later rollout. If no qualifying size-only
opportunity occurs, report insufficient live evidence rather than a savings rate.

The source tests and activation checks pass; production token savings have not
yet been measured. The rollout evidence, original usage cohort and repeat-pair
replay remain under
`/home/hao/workspace-worktrees/may-token-review-20261016/`.
