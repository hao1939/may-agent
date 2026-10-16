# Truncated linked-Task review identity — independent review

Status: source review complete; no A-specific correctness finding. Not integrated
into Apps main or activated. Broader repository type checking has the same two
SDK errors on the unchanged baseline and the candidate.

## Scope

Reviewed `f67d832008d0321f657440452e2e02a9fe19e805` and the selector regression
from `e80f3ae20b62090c8404b1fcc2a08d43a802014a`, isolated on Apps main
`0c0bd5f49d018692470d1b49cdac96ddb427c87e`.

The review branch is `review/alex-review-identity-20261017`. It contains only
proposal A and its connected selector regression; the completion-guidance work
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
- `bun run typecheck` reports two errors in the paired SDK's `task-contract.ts`
  at lines 494 and 596: `progress` narrowing and a reconcile-admission return type.
  Running it on unchanged Apps main produced identical diagnostics. This review
  does not claim a passing whole-repository type check or repair those separate
  baseline issues.

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
