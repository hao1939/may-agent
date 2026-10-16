# Evaluation judgment contract and Host rollout — October 17

The Host deployment is verified. The first Proposal B App slice aligns new
Task/metric judgments with one schema and admission helper; source checks pass.
App activation is recorded separately below once confirmed.

## Host deployment

The authorized local deployment installed merged Host main
`b86592b088a1183bb22c8619faaea6f6e7f9baaf`, including #373 (optional finish
fields), #371/#372 (observer delivery and receipt expiry), #370 (serving-path
contention) and #368 (confirmed startup recovery). GitHub run `38932716493`
passed Quality and Container on this exact revision before deployment.

The ordinary standalone deploy command ran from an external immutable worktree
with correlation `host-latest-b86592b08-20261017`. Its receipt is:

`/app/projects/may-agent/.state/deploy-receipts/host-latest-b86592b08-20261017.json`

The receipt settled `succeeded` at 2026-10-17 00:36:48 Asia/Shanghai, with
`health: healthy`, `duplicateDeploy: false` and matching requested/loaded SHA-256
`e310297d7155e12e8f9f1a89d8d7d5778155a617ca910da7a5b4140c7311e341`.
Independent reads verified the binary version, artifact hash, SDK link, three
running Host services, HTTP readiness and control-socket App registry.
Proposal A's active App source stayed at `fc40aaec90bffcd7023a57a7d13dcaa48f5ffae4`.
App task-count snapshots were unchanged, with zero running Tasks before/after.
No task controls, model routes or schedules were changed.

## App correction

`lib/evaluation-judgment.ts` owns the schema and new-output admission used by
both Task and metric review. It rejects blank required text, invalid supplied
arrays, unsupported fields and malformed follow-up decisions without trimming,
filtering, truncating or converting the original result. Findings/verification
may be omitted when unavailable; omission remains absent in retained JSON.
Disposition, summary, responsibility, delivery and follow-up remain required.
Missing evidence is not proof of health or of a completed verification.

The shared follow-up reader now checks its advertised schema too. This also
removes a Unicode length disagreement between schema validation and the old
UTF-16-length check. Existing historical interpretation and immutable report
publication remain in place; the new-output schema is not applied to history.
Evaluator and DeepSeek guidance share the same definition, acknowledge Host
#373's optional outer diagnostics and describe correction in the same execution.

## Verification

- 154 focused tests, 1,052 assertions: judgment admission, Task review, metric
  review, selection, retained report reading and publication retries.
- 56 consumer tests, 259 assertions: Alex/May App intake, downstream report
  handling and structured-result envelopes.
- Five paired trials used the real Host runner/finish validator and serialized
  App schema with synthetic responses. A valid report with omitted optional
  evidence completed in one reply. Blank summary, blank follow-up, wrong-type
  evidence object and extra-property reports each corrected in a second reply
  within one invocation. No external model/provider calls were made.
- Root TypeScript and a targeted ESNext/strict-null workflow type check passed.
  The targeted configuration initially inherited ES2022, which does not support
  existing import attributes; correcting that test configuration resolved it.
- `check:may-design` passed with the existing unclassified-root-`reports` warning.
- App artifact compatibility passed against the newly installed SDK, including
  all four source definitions (the sample App remains inactive).
- Connected regressions verify malformed new output is not published, absent
  optional evidence survives publication retry, saved bytes remain unchanged,
  and each retry reuses the original judgment without another agent call.

## Remaining scope and observation

This is the App schema/admission slice, not completion of every Proposal B item.
Host tool conversion and oversized rejection feedback remain separate work.
A direct probe on deployed Host source showed original `summary: 42` rejected by
App admission but converted by model-tool validation to `summary: "42"` and then
accepted. Checking converted values cannot prove original-value parity. No Host
validator change is included here. Broader ordinary-agent interpretation,
pre-admission/setup recovery and audit trials also remain in the common design.

Observe the first 50 naturally due DeepSeek reviews after App activation: record
first-finish acceptance, corrections, useful outcomes, token categories and
unknown prices. Inspect ten resulting judgments against supplied evidence,
including adverse and insufficient-evidence cases. No synthetic production
reviews or new schedule should fill the sample. Live savings are unmeasured.
Segment Proposal A's observation at the Host and B rollout times; do not attribute
an aggregate before/after change solely to A.

Private rollout receipts, paired-runner probes and check logs are retained under
`/home/hao/workspace-worktrees/may-token-review-20261016/`.
