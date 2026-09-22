# Recovery trial report — current evidence first

**Date:** 2026-09-22

**Host:** `20049916b79d2ba2d2265edf5eeb605ff0e59c05` (merged PR #226)

**Decision:** keep existing Host recovery mechanics. The current model-authored helper repair restored one unfamiliar-code failure; earlier prepared alternatives and operation guards are prerequisites only. No Host/runtime change or deployment is justified.

## Current requirement: unfamiliar broken-code recovery

Hao corrected the scope: prepared method B and an experiment-author operation guard
are **mechanical prerequisites, not proof of unknown-failure recovery**. The new
`unknown-code-trial-1` demonstrates one small unfamiliar-code repair by the tested
model, with two disclosed harness corrections. It does not establish unattended
reliability or coverage of every installed Task. No recovery runtime change follows.

### Actual owner behavior and original outcome

An authored `deliver-order` workflow launched a fresh Bun helper. The helper treated
the domain contract's SKU-keyed catalog object as an array and failed before writing
its delivery document. The caller saw only an ordinary generic execution error and
a record path; the initial prompt contained neither fault nor repair. Ordinary
subprocess stderr, source, order and contract were discoverable.

The real installed-May-profile `gpt-5.6-sol` owner read Task/contract, workspace
README, order, command record and helper source; used `edit` to change the catalog
lookup; and ran an independently calculated scratch probe. The complete source
diff is accounted for by that one model tool call. The author did **not** repair the
tested helper. The owner requested `tasks.update` with unchanged input. Despite its
claim to have “requeued/revised” work, that call did not change the specification or
generation. The harness drove ordinary retry of **effect-child generation 1** with
its unchanged **deliver-order** selection, and production workflow settlement
accepted `{orderId:"order-715",totalCents:1373,lineCount:2}`. The exact original input
became done. The final owner read both accepted Task evidence and actual output,
returned verified delivery, and retained the independent audit wait. A fresh second
order through the same repaired workflow settled with `{orderId:"order-716",
totalCents:1000,lineCount:1}`. This control checks worker behavior, not healthy-owner
judgment.

### Evidence and exact identity

Durable root (not the disposable worktree):
`/app/.state/review-pilots/apps-health-20260922/repair/unknown-code-trial-1/`.

- `receipt.json`: `b0933d579c833eb8f8659c322fdb99afba823aef1c084f0be3f8a256b5181aa0`.
- `verification.json`: `ca6e02d04ec2cacfafb2f37e17e4eae2247488753bf612e3cbfb253967c0b8a3`; source checker `verify-unknown-failure.ts` passes ten grouped assertions without model calls.
- `source-before.ts`: `898715f20cffd97c86223bcfe2081e097004a52f9e0e5027a60ae0f26a65a4e3`; `source-after.ts`: `a611a81f52b0fe4d855160e651304522de60309281c0cfe20d8e72c79166a58f`.
- `first-failure.json`: `dac2259f357363a4499aad69055700a1580165affe577eae14797a8092c99723`; first failed attempt `r_1_ae74fbcd-0988-4619-8606-4fff0a8c05c1`, workflow run `wr_1790061133288_9vq8`, no accepted result.
- Exact caller input `appdep_055b9dd038f7b8ac802680c3`; successful original workflow `wr_1790061165599_w4ab`, attempt `r_1_436ee147-2e38-4cca-9ab0-7e7899a5475d`; control workflow `wr_1790061233132_fb6f`.
- Model sessions `s_1790061133373_b0a9f7fe-7854-49cd-936d-6ba9307bbe3f` and `s_1790061214105_32fefd88-8c62-488e-aaa1-7fded34225dd` under `runtime-p8Qp1T/state/sessions/`; exact prompts `owner-prompt-1.txt`, `continuation-owner-prompt-1.txt`, `system-prompt.txt`; JSONL preserves tool results and cost records.
- Independent supervisor verification: `/app/.state/review-pilots/apps-health-20260922/repair/unknown-code-independent-verification.json`, hash `3d5d24e1a95d556a1671f671cac11ccf985f04ad3dc8ad4c972417fae156b544`. It checked actual isolated SQLite state, transcripts and 57 hashes with no mismatches.

Two paid model sessions used 6 and 3 assistant messages, 162,831 aggregate reported
tokens (including cached context), reported cost **0.2663878** in provider cost units.
Configured limit: two invocations, 240 seconds each, fallback disabled; command default
30 seconds. First failure through completed healthy control took **99,937 ms**, including
manual harness repair/continuation. No human supplied diagnosis or source patch.

### Harness failures, interventions and remaining limits

Both nonzero runs are retained rather than rewritten as clean passes:

1. `initial-receipt.json`: after the successful source repair and original workflow
   settlement, the harness wrongly applied its initial-context leakage assertion to
   the second prompt containing the owner's *own learned diagnosis*. It blocked that
   provider invocation. The author corrected the check to initial context only and
   resumed the **same isolated store**, leaving source, Task and outcome untouched.
2. `continuation-receipt.json`: final model verification and healthy control succeeded,
   then the task-count oracle expected four rows. Actual count was three because
   `root` is a group, not a Task. Corrected assertion and `--audit-retained` checked the
   existing results without another workflow or model execution. Final receipt is
   this audit's snapshot, not a claim that either earlier command exited successfully.

These are experiment-harness failures, not model or production recovery failures.
The final provider did attempt an out-of-workspace read of installed May evaluator
feedback because of its role prompt; it was unavailable. No author diagnosis was
read there. Coding tools were ordinary production tools, instruction-scoped rather
than OS-sandboxed. Initial delegation was seeded; reconciliation/result projection
were manually invoked. This is not automatic scheduling or production activation
proof. The domain defect was small and source/logs were accessible; degraded evidence,
unavailable owners and arbitrary novel failures remain unproved. Existing optional
Evaluation ongoing-failure review already supplies another reasoning route; this
trial does not establish its installed coverage and justifies no new monitor.

### Review and checks

Tech-lead's independent critique is retained at
`/app/.state/review-pilots/apps-health-20260922/repair/UNKNOWN-CODE-TRIAL-REVIEW.md`.
It accepts the bounded restoration and requires the no-op update, timing and
harness-intervention corrections recorded above. The initial prompt separation
check uses known sentinels; independent prompt/transcript review, not that simple
assertion alone, supports the separation claim.

- Exact evidence verifier: ten grouped checks passed; no new model calls.
- Bun build of the harness with external dependencies: passed (syntax/bundling check).
- Repository `bun run typecheck`: passed before and after changes; its configured
  include set does not typecheck this experiment, so this is not full experiment typing.
- `bun scripts/check-may-design-integrity.ts`: zero errors and warnings.
- `bun run check:may-design`: **blocked after integrity passed**, because this Apps
  worktree lacks the independent Host import
  `projects/may-agent/packages/sdk/src/task-contract.ts` needed by design examples.
  The remaining combined checks are not claimed as passes.
- `git diff --check`: passed. No CI, merge, installation or deployment is claimed.

## Prior mechanical prerequisites (not unknown-failure success)

| Case | Actual result | Meaning |
| --- | --- | --- |
| Failure before effect (`trial-2`) | One failed method-A workflow returned no accepted result; the blocked report retained exact attempt/run identity. The real owner revised the same child to method B, which produced one effect. A second owner attempt considered the returned evidence. The unrelated audit Condition survived. | Prepared-alternative owner path only, not unfamiliar-code repair. It exercises production admission, execution, settlement, caller return and authorized same-Task revision. Seeded initial delegation and manual reconciliation are disclosed seams, so this is not automatic-scheduling proof. |
| Acknowledgment loss, unguarded (`ack-lost-baseline-3`) | Method A wrote one marker and threw. The owner successfully read that marker before revising the same child to method B; it did not retire the dependency wait. Method B appended a second marker. The child remained pending/failed and the original input remained handling. | Real duplicate. Better discovery did not make an unsafe operation safe. |
| Acknowledgment loss, guarded (`ack-lost-candidate-1`) | Method A created one marker and threw. The owner selected method B before reading the marker. Method B used exclusive create, found the marker, verified exact expected bytes, and returned `reused:true`; the same child converged, the exact original input became done, and the final owner read the effect. Count stayed one. | Operation guard prevented duplication even though pre-replay owner judgment did not improve. This is not evidence of improved agent diagnosis. |
| Healthy control | Fresh method B produced one marker in both acknowledgment-loss runs. | Worker-operation control only; it does not test healthy owner judgment or daemon scheduling. |
| Automatic retry audit | A separate Host test ran two attempts of the same generation and verified the existing effect on retry with one effect and no owner/model intervention. | Separate scheduler/settlement evidence, not a property of this manually dispatched harness. |

## Exact evidence

Raw run directories are retained locally and ignored by Git.

- Before-effect receipt: `runs/trial-2/receipt.json`, SHA-256 `22a8287f79ff84516faaa87c347843654d05443c6c0265cda6563b2337fd1da4`; model sessions `s_1790058461880_7a3289ad-6ec0-43cc-93a2-0e7983d2c7ad` and `s_1790058482452_1fe89dea-c7bd-4ee1-a866-1c7215aa7828`.
- Unguarded acknowledgment-loss receipt: `runs/ack-lost-baseline-3/receipt.json`, SHA-256 `3b44e01b39e2b3154b11105f9e0f2e6fb9205904b30ac6cc196258d3d0cf1c80`; session transcript SHA-256 `b397e53209d913477ad672d7b1261328a4bcdbcb74b3833b05a43c3a10ba0a37`.
- Guarded acknowledgment-loss receipt: `runs/ack-lost-candidate-1/receipt.json`, SHA-256 `8c35a8080900b81e31ed8352f84ab6c31ec3559004f4f36b72262626f4824822`; pre-decision transcript SHA-256 `ac65b40a68adae349578678117951ce3d4b829927e770844a09e8df2cfc106da`, final-consideration transcript SHA-256 `c97e05af02bbf799b5fb7f2b368584410c61cf990143305fdaa11d8be89a97c8`, accepted method-B run SHA-256 `43b8900be90746c6ab843fd0346cdf2086d144c07c9b7259a4f9d164c4d25b43`.
- Independent comparison of both retained stores, 25 evidence hashes, successful reads and before/after timing: `/app/.state/review-pilots/apps-health-20260922/repair/recovery-comparison-independent-verification.json`, SHA-256 `55cdcaee14e915300cb30199ba7e5aed7bd5c97c325b9e2220a4cccca4a8bb5d`.
- Independent operation verification: `/app/.state/review-pilots/apps-health-20260922/repair/recovery-effect-guard-verification.json`, SHA-256 `7e5e769e3afc53d73cccea16d01d4b060a6e2e2a653a9ee46004da79abb1ddd3`.
- Separate automatic retry audit: `/app/.state/review-pilots/apps-health-20260922/repair/recovery-scheduled-effect-trial-3.log`, SHA-256 `a831d03719b37aa959269aeb8b9944d009d592e3868ffb8fad30962ca4876471`, test-only audit commit `c68613cd` in `/app/.state/worktrees/recovery-evidence-audit-20260922`. This focused audit is evidence, not a PR-ready or shipped runtime change.
- Independent implementation audit: `/app/.state/review-pilots/apps-health-20260922/repair/RECOVERY-IMPLEMENTATION-AUDIT.md`, SHA-256 `0e31912704fc72cd4f64af0c9059ca82cbbd9d273026f95d889005e9a6417fd3`.
- Independent acknowledgment-loss review: `/app/.state/review-pilots/apps-health-20260922/repair/RECOVERY-ACK-LOSS-REVIEW.md`, SHA-256 `734d8c27d1514ad4a05989e411e5a13c36759f9cc22198b14138fa56effaf7b5`.
- Tech-lead critique: session `s_1790059373132_d151eb5f-bd2f-4c92-82ea-5d0fc22afcaa`; it independently checked receipts, workflow records, prompts and transcripts and required the oracle and claims corrected below.

All unsuccessful attempts are retained: `smoke-1`, `smoke-2`, and `trial-1` did not invoke the model because the harness had not installed/driven the ingress boundary; `trial-3` was interrupted; `ack-lost-1` and `ack-lost-may-1` had unrealistic source discovery. In `ack-lost-baseline-2`, the owner read the effect and retired only its dependency Condition; a later method-A execution duplicated the effect, after which an incorrect harness assertion failed. That differs from baseline-3's method-A-to-B revision. These are harness/profile errors or preliminary evidence, not hidden Host failures; the observed duplicates are unsafe fixture-operation behavior.

## Independent review corrections

The first receipt implementation looked for tool results inside assistant content. Session JSONL actually records them as top-level `role:"toolResult"` messages correlated by `toolCallId`. Retained transcripts establish that baseline-3 read the marker before its update; candidate-1 did not read it before choosing method B but did read it in the final owner attempt. The harness now records those two observations separately. Historical receipts remain immutable and their stale `ownerInspectedEffect:false` fields must not be used.

The current harness also records the same-child generation-2 revision, unchanged creator, method-A to method-B selection, exact final input status, and observed `reused:true` result separately from the environment flag. This corrects proof claims without rerunning the model merely to rewrite evidence.

## Boundaries and limits

Production code used: App input admission; dependency admission from a fenced owner claim; installed Task claim/reconciliation/settlement; workflow execution and retained run evidence; failure report and exact caller projection; creator-authorized same-Task update; real provider call; and ordinary `read`, bound `tasks`, and `finish` tools.

Disclosed seams: the business effect and method bodies are fixtures; initial delegation is seeded rather than model-selected; exact reconciliations and saved-result recovery are manually invoked rather than daemon-scheduled; the healthy control has no owner judgment. The installed-May runs use the installed common-sense and role prompt, but the standalone manager explicitly supplies a reduced `read/tasks/finish` tool set.

The guard uses `openSync(path, "wx")` plus an exact expected-content reread in a temporary, single-host filesystem namespace. Direct checks show it rejects empty, wrong, duplicate, and inaccessible existing evidence without writing. It does not prove fsync durability, remote-provider atomicity, distributed concurrency, or universal exactly-once behavior. A provider-specific stable idempotency identity or current-state verification remains necessary for real external effects.

No live Task, production database, service, credential, schedule, deployment, or original recovery Task was changed by the experiment.
