# Recovery trial report — current evidence first

**Date:** 2026-09-22

**Host:** `20049916b79d2ba2d2265edf5eeb605ff0e59c05` (merged PR #226)

## Current: caller-less Evaluation → May recovery trial

**Requirement:** determine whether an original system-sourced workflow with **no waiting
App caller** reaches real Evaluation judgment and May consideration, and whether the
same work is restored without author-driven advancement. Apps baseline
`c146591de42913b1fcc2e3042c898fe5b4710829`; Host remains the revision above.

**Observed: one bounded automatic restoration; no missing runtime connection demonstrated.**
The original `recovery/original-order`, input `original-input`, was admitted once with
source `{kind:"system",id:"callerless-original"}` and creator `{appId:"recovery"}`.
Its first failure produced persisted event **13**, accepted by the actual Evaluation
`task-incomplete-review` inbox subscription. Production `task-outcome-review` read the
isolated public socket through real `app.task.get`/`task.get` services, consumed the
ordinary initial allowance, and invoked the real installed-profile evaluator. It read
the generic execution record, helper, order, contract and failed run; it diagnosed the
deterministic mismatch without editing source. The workflow wrote/read back an immutable
report and published event **20**, accepted by May's existing cross-App subscription.

May's real Conversation agent chose `evaluation-report-intake`, supplying that exact
publication. Intake verified hashes and returned **stale** after a second natural
workflow failure. May rechecked current source/receipt/Task, correctly retained the
material concern, made the sole one-line source edit, and verified a scratch output.
It did not rewrite the Task, choose an alternative workflow or execute the delivery
workflow manually. Its accepted consideration (event **45**) honestly said the original
was still pending. On slot release, the existing queued retry executed the repaired
helper; generation **1**, workflow **deliver-order**, and original specification stayed
unchanged. Event **53** settled the original/input and the independently checked actual
output was `{orderId:"order-715",totalCents:1373,lineCount:2}`. There was one original
output, no duplicate or replacement business Task, and no author intervention after
admission. No later May verification of final success was observed or required to make
the operation happen; do not represent May's pre-retry result as final acceptance.

The second failure (event **30**) also automatically reached Evaluation. Its actual
allowance declined a second semantic call; event **37** retained the exact review as
**waiting**, with its ordinary next allowance boundary. This remaining review is not
silently closed by the restored operation. The evaluator's claim that retry timing was
not represented was too broad: public history supplied retrying while the full persisted
event contained `retryAt`; the model did not read event 13 itself. Its directly verified
source defect and May's current-evidence check, not that coverage claim, support repair.

### Exact evidence index

Durable root: `/app/.state/review-pilots/apps-health-20260922/repair/callerless-trial-1/`.

| Evidence | SHA-256 / identity |
| --- | --- |
| `receipt.json` | `f8da27165ef68a03f975a76c098ec74fbbff12edd16642a8f98f9c9f6e2556a1` |
| `harness-executed.ts` | `405117e58e4445fb49563788f4f46965550457dc33f27ff5359097d3d13b4494` |
| `runtime-snapshot.json` (discovered schema, full isolated rows) | `ad62b9633e1713eea6b04661a37550c522b2483663984df848a3a89089f3fea4` |
| `evidence-manifest.json` (6,127 hashes verified) | `255d328e827db226c87c11e9128487869bf97e35ee12b9eb164bf01a18368ee9` |
| `../callerless-trial-1-verification.json` | `56a8b3835ce63d3abc07496cba9f219845d84c16a7f2cf56a6777873c5ecb4a1` |
| Published report JSON / Markdown | `f92b0dd1ff741c49dd4090ad9157fb5cd479ec20d4c07d160214eb33ee58ff46` / `0f97571e8705438426176762fe00197c04536473a0620574272cd545cc8a01c4` |

First failed attempt `r_1_bd792432-d325-49db-8c8f-710a7390c915`, run
`wr_1790063838578_d0lq`; second failed attempt `r_1_86f49fd1-b159-4e72-a677-fbfbffeba54a`,
run `wr_1790063881029_79nf`; successful original attempt
`r_1_36798b45-61e5-47f8-b5a8-dd64e60f8dfe`. Exact runs, queue profiles, admission items,
May/Evaluation attempts, wakes and reports are in `runtime-snapshot.json` and
`runtime-TUCSfx/state/`. Intake run: `wr_1790063891002_do6m`.

Sessions under that state root's `sessions/`:
- evaluator `s_1790063838761_662f3026-93c5-4985-a27c-2b607497fceb`, transcript hash
  `fb3f8409bafaf65874a8bbbe7b5f023fad5b0150095317059552868f3fd2758a`;
- May `s_1790063881251_8ab60f6c-741b-447c-aa8c-b19b6de8d3f2`, transcript hash
  `6a1601c9f380718a5e43c0c6f69b1fcdb4f01ba9c1b950777e6e55c9d8c4e64b`.

**Cost/time:** 2 actual model invocations of allowed 6; 331,725 aggregate reported tokens
including cached context; reported cost **0.5301164** (evaluator 0.1965396, May 0.3335768).
Receipt elapsed **94,807 ms** through runtime drain; console elapsed **95,626 ms** includes
artifact hashing. Observation ceiling 480 seconds; each invocation timeout 90 seconds;
fallback disabled. Six Task workflow executions plus May's intake workflow; seven Task
attempts total. No live allowance reset or configured allowance override: fresh isolated
report root, default one semantic call per 86,400,000-ms interval. All unrelated schedules
and May's unrelated GitHub observer were disabled.

### Controls, preflight, prompt separation and limits

The healthy worker control was admitted first, with an **empty order**, using the same
unmodified helper/verifier. It returned `{orderId:"control-empty",totalCents:0,lineCount:0}`
and did not enter Evaluation. This controls healthy worker plumbing, not nonempty-order
behavior or healthy-model judgment. The final nonempty original output proves repaired
behavior separately. Earlier successful caller trial evidence below is preserved, not rerun.

Three no-paid preflights are retained in the parent evidence directory. Preflight 1
failed before runtime because the copied App lacked `shared/tools`; preflight 2 stopped
at the production observer-context guard; these were harness setup defects, not product
findings. Preflight 3 completed control/failure/admission/public reads and the real
allowance, then intentionally blocked the evaluator-call boundary. It used its own
isolated store; no paid decision or production allowance was consumed. Supervisor
pre-run feedback fixed prompt checking, the observation race and shared-root composition
before the only paid run. Natural evidence and learned diagnosis are not author leakage.

The retained `prompt-1.json`, `prompt-2.json`, system prompts, source snapshots and actual
successful reads establish separation: author oracle/manifests and prescribed repair
were absent from initial tested context; May received Evaluation's learned finding.
Author evidence sits outside the permitted workspace. Tools are **instruction-scoped,
not OS-sandboxed**. Evaluator attempted an absolute live-profile feedback read (ENOENT);
May's read-only `git status` traversed an enclosing `/app/.state` repository and exposed
unrelated tracked path names. No live DB/App or external action was used and no model
wrote outside authorized source/scratch. These are isolation limits, not clean sandbox
proof. Subsequent harness hardening should not be attributed retroactively to this run.

Host modules run in one process with one capacity slot, not the full daemon/worker-process
isolation. Apps and installed role files are copied into temporary storage; May's Git
workspace is replaced with local workspace. Explicit production tools are
`read/bash/edit/write/tasks/workflow/finish`; other installed tools are absent. May's
interactive workflow tool has fixture runtime/read/paths but not the complete dynamically
bound Task emitter/reconciliation context; exact intake and direct Task reads succeeded,
so this does not establish all alternate workflow branches. The source authority permits
only fixture repair and scratch probes, never real application. Fresh subprocess activation
and the small known fixture are not arbitrary-code reliability, concurrent multi-slot
behavior, Evaluation self-failure coverage, or silent-output diagnosis.

### Independent review, checks, and closeout provenance

Independent evidence review is retained at
`/app/.state/review-pilots/apps-health-20260922/repair/CALLERLESS-TRIAL-REVIEW.md`
(SHA-256 `8a2b4c32e07e3c3385704e0108d7f7285d270dc73acd0458fe3999f2a52a263d`).
Its separate compact verification is
`/app/.state/review-pilots/apps-health-20260922/repair/callerless-independent-verification.json`
(SHA-256 `8dbe8f780c4c037c0b2446e3fee058ca4e458dd47f8781e0ed564393b457ff1f`).
The first closeout tech-lead review is retained in session
`s_1790064618067_ab7bd1fd-be33-4a70-89bc-8bb834733ab1`; it found three documentation and
verifier robustness corrections, all applied before commit, and no runtime/hygiene change
or unrelated-wait claim. Its result is `/app/.state/sessions/s_1790064618067_ab7bd1fd-be33-4a70-89bc-8bb834733ab1/result.json`
(SHA-256 `a33d2a9f53fdaccd19087cf48d40cdf6e7d81a7261623b327fcaba3b10c5297b`).

Closeout checks reran the read-only verifier without a model or workflow and confirmed all
6,127 hashes plus the exact event/attempt/output/cost/timing relationships. TypeScript
bundling of `run-callerless-trial.ts`, Python bytecode compilation of the verifier,
repository TypeScript typecheck, `git diff --check`, and May design-integrity checks passed.
The broader `check:may-design` wrapper could not run its examples stage because this Apps
checkout does not contain `projects/may-agent/packages/sdk/src/task-contract.ts`; this is a
checkout composition limitation, not a passed check or trial finding.

The successful isolated run itself was complete before the predecessor closeout was
interrupted. `/app/.state/review-pilots/apps-health-20260922/repair/HYGIENE-CANCELLATION-FINDING.md`
(SHA-256 `808ce91ba64e8d69e74cc6447cefa36d50124c5ade9804f72c0efbc4a466c0ca`)
records that later, external hygiene error. This recovery handoff preserves the cancelled
predecessor and its evidence; it does not reopen or replace the original business Task,
repeat the experiment, or make the cancellation part of the successful trial chain.

**Decision:** keep current Host/App recovery behavior. There is no demonstrated missing
connection justifying a source correction or regression beyond the retained evidence
verifier. Optional isolation hardening is a harness matter. This source/documentation
integration is not a live recovery deployment. No CI, activation, deployment, service
restart, Telegram or live-state mutation is claimed.

## Prior current requirement: automatic caller recovery

Verify automatic unfamiliar-code restoration through the installed controller/scheduler
and normal persisted event/inbox/lifecycle composition. Prior manually advanced restoration
remains valid bounded evidence, not proof of that chain.

## Automatic composition trial — supervisor correction

The corrected harness must admit original work once, then stop orchestrating recovery.
It uses the actual Host controller/scheduler and `startAppInboxRuntime`, including a
persisted event writer. No direct harness reconciliation, Condition/result recovery,
or synthetic failure/success wake may advance execution after startup. Seeded initial
delegation remains a separately disclosed setup seam. The original Task/workflow,
independent audit wait, fresh subprocess activation, unknown-code model authorship
and healthy worker control remain required.

**Observed result: one bounded automatic restoration.** The first workflow failed
before output/result, the production lifecycle returned its report to the original
caller, and the actual owner investigated and made the sole helper edit. The existing
scheduler queued retry at `1790062433253`, one millisecond after its persisted due
time, while the owner held the fixture's single capacity slot. It waited **39,406 ms**
in the normal queue, then the same `effect-child`, generation **1**, workflow
`deliver-order` succeeded in a fresh subprocess. The original input became done;
natural success feedback woke the owner, which read the accepted child, document and
execution record. The owner retained `unrelated-audit`; its final phase remains
`waiting`, not falsely closed. A fresh-order worker control then completed.

The owner's unchanged `tasks.update` did not revise the specification/generation or
cause the already-queued retry, despite its prose claiming reawakening. One source
repair accounts for the complete before/after diff. The model read the generic failure
record, source via ordinary `bash`, workspace contract and order, then tested only a
scratch output. No author diagnosis, patch or alternate method was in its initial
assembled prompt. Both sessions attempted the installed role's out-of-workspace
feedback read; both returned ENOENT. Ordinary tools are instruction-scoped, not an OS
sandbox.

### Exact automatic evidence

Durable root:
`/app/.state/review-pilots/apps-health-20260922/repair/automatic-unknown-code-trial-1/`.

- `receipt.json`: `5b196553c05e46ad517842f091cef15d2fc08674a0a3e626dad20ddfa1f097fc`.
- `harness-executed.ts`: `8e7216a01782441d1612e75a0aa4f288e09a483657ecac07af7a57dbf842a33b`
  (Apps base `415c2b150dcb0e9789d796e09d096786fd02fad5` plus the retained harness diff).
- `verification.json`: `59c48dc6b8bee4e615ffb6529bfa4d467c003e8cefad06e77d7ee8f2e180d046`;
  the retained verifier passes ten grouped checks without model/workflow execution.
- `lifecycle-events.json`: `ba2e01a088a77cc0b1e24f6ad213f475c2f4882b9a1584add80c9f64d464f680`.
  Persisted reconciliation events 7/22 represent child failure/success; exact blocked/done
  feedback events **8/23** were accepted by `app-runtime:events:task:recovery/owner`.
  Final owner/control reconciliations are events 28/37. Some broadcast reconciliation
  facts retain pending delivery labels; exact accepted caller events and settled results,
  not those labels alone, prove the route.
- Original input `appdep_15dfd0f7d72fc605e7ef0011`; failure attempt
  `r_1_45348db1-7769-45a7-958a-a74aa1053dcf`, run `wr_1790062432953_jz2i`;
  accepted retry `r_1_ed6179bc-0afe-45e9-b33b-7701333bd1d1`, run
  `wr_1790062472677_qts2`; control run `wr_1790062490595_5n0q`.
- Owner attempts `r_1_4f4063a3-19f1-4bb8-afbd-cabf3527ed7f` and
  `r_1_042d3136-8e53-489c-bbd6-4946f3455b86`; sessions
  `s_1790062433049_d113a44f-f0a2-4671-aa05-88476a67f634` and
  `s_1790062472767_19347692-c27a-41ac-b131-f050747e2296` under
  `runtime-aVVMKW/state/sessions/`. Exact prompts and first failure/subprocess
  records are retained alongside before/after source, waits, events and manifests.
- Independent reviewer checker/output:
  `/app/.state/review-pilots/apps-health-20260922/repair/automatic-recovery-independent-check.py`
  and `automatic-recovery-independent-verification.json` in that same parent directory;
  verification hash `7b29338c07551f987d3ec6ca965774aef3ef6c795bc0b29f095c46df3ef1829c`.
  It verified **56 retained hashes without mismatch**, exact caller/attempt linkage,
  unchanged spec, one model edit, final successful owner reads, both outputs and
  unchanged independent wait. No new model/workflow call was used for this audit.

**Cost/time:** two actual owner invocations (limit four), 180,116 aggregate reported
tokens including cached context, reported provider cost **0.2101278**; **57,764 ms**
from setup through control. Limits were 300 seconds overall and 60 seconds per owner
invocation, fallback disabled. Three workflow executions, three Tasks, two inputs,
one actual original delivery and one distinct control delivery; no duplicate effect.
No paid rerun or post-start author intervention advanced recovery.

### Seams, oracle corrections and judgment

Initial delegation was seeded synchronously through production fenced admission and
settlement before asynchronous execution, not chosen by the model. The trial composes
Host modules in one isolated process rather than launching the installed daemon. It
uses one capacity slot, which kept workflow retry behind the owner investigation;
multiple-slot retry races are unproved. The business operation and order are fixtures,
source activation is a fresh helper subprocess, and healthy control proves worker
behavior rather than healthy owner judgment. This does not establish production
activation, restart/crash recovery, caller-less/unavailable-owner coverage, degraded
evidence behavior, arbitrary novel-failure competence or a reliability rate.

The one run completed before supervisor oracle feedback was applied. Its original
harness wrongly required output absence after owner repair and used call count plus
non-running state as final-consideration shorthand; neither produced a false failure
in this run. Retained accepted owner result/transcripts independently establish actual
success consideration and workflow output provenance. The source is now hardened to
remove the race-prone absence assertion, inspect structural accepted consideration
without prescribing a free-form model result schema, stop/drain runtime, and export
the executed harness and persisted lifecycle receipts before final hashing. Those post-run harness corrections were not a model
rerun and do not retroactively change the executed source hash. The original event
listener snapshot ended before all trailing lifecycle callbacks; persisted event
records and workflow/Task receipts, not that partial snapshot alone, own final facts.

**Decision:** keep existing Host mechanics; no first missing Host boundary or Host
candidate was demonstrated. This is automatic restoration in one bounded isolated
composition, not universal unattended recovery. Safe unresolved escalation, harness
failure and model failure remain distinct possible results, none observed as the final
outcome here. Earlier failed/manual runs remain retained below.

### Caller-less and silent-output route limits

The separate route audit identifies existing, reachable alternatives, not another
recovery controller. `evaluation.app/app.ts` maps external `incomplete`/`retrying`
`project.task.reconciled` events to ongoing assessments when automatic review is
enabled; that mapping does not require an App caller. The selector also considers
open and completed external Tasks, so a plausible but wrong successful result can
be sampled for outcome assessment. Published reviews enter May through
`evaluationTaskReportInput`. Allowance, capacity, successful review/publication,
semantic judgment and May follow-through remain prerequisites, not guarantees.

The supervisor's public readback `recovery-evaluation-selector-current.json` in the
durable parent evidence directory proves recent live selector activity at 07:26,
07:31 and 07:36 UTC (latest attempt `r_5_2ee073a7-1c62-4091-b371-0c43347c122d`,
event `6403859`). It does not prove a selected assessment finished or caught a silent
defect. Evaluation deliberately excludes its own Tasks; its `owner-review` selects
agent `evaluator` with `codex-goal`, not the legacy `evaluator-heartbeat` file. No
universal self-failure/caller-less/unavailable-owner return is established. The current
trial cannot prove silent-wrong-output diagnosis because the workflow independently
checks output before declaring success. No extra paid trial or speculative fix follows.

### Current verification and review

- Retained automatic verifier: ten grouped checks pass; reviewer checker confirms
  56 hashes and exact effects. Supervisor independently inspected read-only isolated
  SQLite plus both transcripts (`automatic-code-independent-verification.json`, hash
  `42533e2b991180ad1552cb4d8613c5c0d19aa6f5ec56ab7a7714d2593683a626`).
- Host baseline: **82 passed, zero failed**, 791 assertions across controller,
  recovery and conversation-runtime tests; log `automatic-recovery-host-baseline.log`
  hash `43493a3912ee8e739294ec8a228ce9d6515b6526ad7db7250a6d2ba250046c62`.
- Apps typecheck and design integrity pass (zero design errors/warnings). Both current
  experiment files bundle. The configured Apps typecheck excludes this experiment;
  bundling is not full type checking or a new paid behavioral trial.
- Full `bun run check:may-design` passed after temporarily linking this worktree's
  ignored `projects/may-agent` prerequisite to the frozen Host checkout; the link was
  removed afterward. The current success log is
  `automatic-recovery-final-design-check.log`, hash
  `a0667d09e9414dd6087f6688052b2a45f0d4357d9bae7717714ec971640fcab4`
  (integrity: zero errors/warnings; SDK/control examples pass; canonical Apps: zero
  errors). The earlier
  `automatic-recovery-design-check.log` is retained as the failed setup attempt; it
  records a missing worktree prerequisite, not a remaining source defect. No CI, PR,
  merge or deployment is claimed.
- Tech-lead final critique `AUTOMATIC-RECOVERY-FINAL-REVIEW.md` in the durable parent
  directory preserves its original NOT READY finding and subsequent **READY** judgment.
  The free-form owner result schema was removed from both prospective harness and
  verifier. Final verification is structural feedback/attempt/Condition evidence plus
  actual transcript/output review; no mandatory model diagnosis/report schema was added.
  Review hash: `15ef4d7d30d3a701aa46c832224b38f36c7982ad85c1f7ccb3dbf382e1a33e75`.

## Earlier manually advanced unfamiliar broken-code recovery

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
