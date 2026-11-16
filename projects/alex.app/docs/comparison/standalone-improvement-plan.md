# Standalone improvement trial plan

Status: manual execution verified; the first replay and next scope are recorded
in the [first trial](standalone-first-trial-20261116.md). The
[snapshot execution trial](standalone-snapshot-trial-20261116.md) carries the
selected experiment through implementation, repair, verification and disposition.
The [recovery and no-change trial](standalone-recovery-trial-20261116.md) verifies
manual interruption/reuse and live diagnosis boundaries without a runtime patch.
The [Host readiness rehearsal](host-handover-rehearsal-20261116.md) returned an
accepted Alex disposition: synchronize the older active diagnosis and instructions
before broad handover. Ordinary Task admission/closure and separate disposable
Host restart checks passed.
The [activation and hosted diagnosis trial](host-diagnosis-trial-20261116.md)
synchronizes those definitions and completes one real retained-run diagnosis:
Alex rejected unsupported specialist advice and returned an accepted no-change.
Further tuning on representative work and Host handover remain incremental work.
The [diagnosis grounding trial](diagnosis-grounding-trial-20261116.md) completes
one such experiment: Alex adopted a reviewed diagnosis-source repair after paired
retained/synthetic trials, with mixed costs and no runtime activation claim.
The [activation and natural intake follow-up](diagnosis-activation-natural-intake-20261116.md)
activates the reviewed repair, verifies stable Host identity and completes one
finite Alex suitability evaluation of fresh Scout work. Alex selected the arXiv
publication gap as an intake lead. The
[source-root repair trial](diagnosis-source-root-repair-20261116.md) freezes a
transparent two-case natural projection, retains the first hosted insufficient
result, and carries its discovered diagnosis mechanics bug through Alex's bounded
implementation/review cycle and source integration. The
[Alex-owned activation and replay](alex-owned-activation-replay-20261116.md) now
verifies that repair in a fresh hosted Task. Alex detected an old in-flight
procedure binding after activation, and the operator admitted the fresh replay.
The replay returned a qualified Scout guidance proposal; Scout publication and
behavioral transfer remain unverified. Temporary evidence retention, structured
workflow output persistence and manual successor admission remain concrete gaps.
The user's subsequent scope clarification keeps the improvement cycle as the
target. Scout remains retained test evidence; its guidance proposal is deferred
and does not establish a priority to change Scout.
The [cycle evidence handoff trial](cycle-evidence-handoff-trial-20261116.md)
now verifies an externally retained record after Task closure, with one
independent rejection and correction of its field locator/timestamps.
The independent Host assignment completed
without being stopped by the standalone trial.

## Direction and first milestone

Keep the [improvement mandate](../2a-design/practice-learning-loop.md#improvement-direction-and-alexs-mandate)
stable: reliable user outcomes, less human correction, and acceptable total time
and operating cost. Alex owns the bottleneck, bounded hypothesis and disposition.
The operator controls manual execution and helps inspect failures. Gym supplies
comparison evidence, Bob judges independently, and tech-lead implements.

The first milestone is **one inspectable, trustworthy cycle**, ending in adoption,
revision, rejection, no-change or insufficient evidence. A passing benchmark or
completed report alone does not meet it. Record the achieved boundary: local
verified candidate, integration, activation and fresh behavior are separate facts.

```text
saved work evidence
  -> Alex: diagnose and choose one hypothesis
  -> prepare an isolated candidate
  -> executable checks and independent review
  -> Gym comparison when the claim requires behavioral evidence
  -> Alex: judge benefit, cost, uncertainty and next action
  -> verify subsequent behavior when the change is applied
```

## Working alongside the Host

- Leave Alex's existing Host Task running. Standalone trials have their own run
  IDs, Git branches and output folders; they do not resubmit the same Host goal.
- Put linked Git worktrees outside `/app`, following the root layout convention.
  Pin the Apps commit, SDK revision/artifact and relevant external repository
  revisions. Execute tools in the isolated worktree, using its ignored `.state/`
  for development evidence. Before a disposable hosted Task worktree closes,
  retain promised evidence outside that worktree or reference the durable public
  records. Ignored local files alone do not survive clean Task-workspace removal.
- Copy or reference immutable Host evidence as input. Preserve its Task, attempt
  and candidate identity; a standalone result is not a Host-accepted result.
- Keep trial candidates and outputs separate from shared `.lab`, benchmark truth
  and active Host worktrees. Never reseed or remove another run's candidate.
- Compare findings when useful. If both tracks address the same defect, inspect
  and reuse the existing candidate, with fresh checks against its exact revision.
  Apply integration and activation through the existing authorized delivery path.

## Follow these milestones

| Milestone | Work | Done when |
| --- | --- | --- |
| 1. Reproducible manual execution | Make a thin entry point over the SDK's existing standalone `run()`. Accept a target, explicit Task input, isolated working directory, retained output directory and finite execution allowance. Capture source identities and trace/session paths. Start with deterministic agent fixtures. | One selected stage runs without the Host, retains its evidence, and exposes failures and cancellation clearly. |
| 2. Trustworthy diagnosis | Replay one saved Gym failure. Have Alex separate behavior, execution, truth/scorer and missing-evidence causes; select one hypothesis, intended benefit and rejection condition. | The diagnosis cites actual trial evidence and can choose no-change or insufficient evidence. |
| 3. One complete experiment | Use the selected existing procedure to prepare a candidate. Run appropriate real checks and Bob's review. Compare behavior only with trustworthy frozen inputs. Alex records the supported disposition. | The chain from problem to decision is inspectable, with exact candidate identity, costs and remaining work. |
| 4. Tune from observed friction | Replay a successful case, a rejected or inconclusive case, and an interrupted case. Change one process weakness at a time and compare with the previous procedure. | Decisions are supported, failures identify a useful repair, and unchanged valid work can be reused after interruption. |
| 5. Host-driven execution | Let an ordinary Host Task invoke the proven stages with the same input and evidence contracts. Observe one controlled execution and recovery before expanding intake. | Host execution preserves the standalone evidence and decision quality, and scheduling/recovery work without hidden manual steps. |

These are milestones, not deadlines. Finish the first cycle before expanding
daily intake, adding more targets or introducing further orchestration.

## Existing capabilities and current limits

Reuse the existing implementations:

- `alex/diagnose-improvement` and `bun run gym diagnose <baseline-run-dir> --json`
  provide baseline diagnosis entry points. The reused Host repair reads actual
  result status and supports no-change/insufficient-evidence dispositions. The
  first live replay still exposed unsupported source/causal assumptions; inspect
  proposals against actual source and truth evidence. Start without candidate
  preparation; the candidate path can remove an existing candidate directory.
- `alex/develop-change` supplies design, implementation, real verification,
  exact-commit review and retained recovery evidence. Its private input is
  `{ verify: [executable, ...arguments] }`; the outcome and acceptance come from
  the explicit Task envelope. It requires a linked Git worktree and ignored state.
- The SDK's `run()` retains traces with explicit `outputRoot` and `traceDir`.
  Deterministic `agentFixtures` let us debug mechanics before live model calls.
  The [manual stage runner](standalone-stage.md) now exposes these capabilities
  through saved invocation inputs and receipts.
- Workflow `ctx.call` can run specialists standalone. A standalone prompt Alex
  currently lacks hosted `agents` and live Task tools, so initially the operator
  invokes stages explicitly, keeping Alex's scope and disposition decisions in
  their inputs and outputs. Do not assume `run("alex")` supplies the full Host loop.
- Gym comparison requires approved truth and matching frozen identities. The
  App comparison wrapper currently supports May/Scout and at least four scenarios.
  Verify target support before choosing it for another role.

Before trusting a behavioral comparison, resolve or demonstrate protection
against candidate input drift. The snapshot trial repairs live `.lab` resolution
and verifies retained bytes before/after execution; linked candidate files must
be materialized. A recorded fingerprint alone is insufficient. Current
role-judgment cases still lack explicit approval metadata;
use existing approved truth or obtain real adjudication, never invent approvals.
Deterministic checks can establish a narrower mechanics claim while these gaps
remain, with that limitation recorded.

## Evidence to inspect after each stage

Use one folder per experiment, with separate subdirectories for invocations.
Keep a short index linking the original inputs, source revisions, agent session
trails, candidate diff, command receipts, comparison trials and final decision.
Record elapsed time, available token/cost evidence, and manual interventions;
mark unavailable costs as unknown. Keep failed and inconclusive runs visible.

Before another invocation, inspect its prerequisite evidence. Reuse completed
work only while its bound inputs remain valid: changed candidates need fresh
verification/review, and changed truth, scorer or objective needs a fresh
comparison baseline. Reusing an unchanged candidate does not require repeating
diagnosis.

For each cycle, answer:

1. What user problem did Alex select, and what evidence supports the cause?
2. What changed, and did the intended benefit occur without material regressions?
3. What time, operating cost and human correction did the cycle require?
4. What decision is justified, what remains uncertain, and who owns the next action?

Improve the process only when one of these answers exposes a concrete problem.
Keep automated repair/review within the existing three-round candidate limit;
retain unresolved tradeoffs for Alex's judgment rather than adding recursive gates.

## First working session

1. Create the isolated worktree and evidence folder; record the pinned revisions.
2. Exercise the existing standalone development fixture to check mechanics:

   ```bash
   bun test ./projects/alex.app/agents/alex/workflows/develop-change.test.ts \
     --test-name-pattern 'standalone run\(\) supplies the Task envelope'
   ```

3. Prepare the thin stage entry point, then save one recorded failure's immutable
   inputs. Include actual `result.json` status, not just manifest summaries.
4. Ask standalone Alex for a bounded diagnosis and experiment proposal. Inspect
   whether the known diagnosis/status gap is the smallest useful first target;
   Alex may select a better-supported bottleneck.
5. Execute only that experiment through the selected checks and review. Save
   Alex's disposition and identify the next milestone from what the run taught us.

Success in this session is a reproducible start and one justified experiment
scope. Live experiments, a completed cycle and Host handover each require their
own later evidence.

## Current next milestone

Manual execution, snapshot integrity, interruption/reuse, definition synchronization
and one hosted diagnosis with accepted owner disposition are recorded. Alex then
scoped a diagnosis-grounding repair and adopted its reviewed source after paired
trials: unsupported Scout/tech-lead recommendations were declined, and a synthetic
explicit defect remained actionable. Inspection cost increased on the failed-score
cases; the healthy usage-only case avoided a model call. No general cost saving,
human-correction reduction or fresh natural-work benefit is established.

The grounding repair is active. The subsequent fresh-work diagnosis exposed a
separate hosted source-root bug: App/domain projectRoot differs from the Task
repository root. Alex's reviewed source correction is integrated, with 30 focused
tests and 11 independent mechanics probes passing. The original insufficient
result remains intact. Independent review rejected the first candidate; two
operator updates were needed. This is progress in inspectability and repair, with
no demonstrated reduction in human correction or cost.

The source-root correction is now active and verified by a fresh ordinary hosted
diagnosis on the unchanged two-case projection. The activation Task independently
identified its stale callable snapshot; the operator admitted the successor. Both
closed with accepted results, without in-attempt correction. This is a manually
observed handoff, not unattended ownership of the complete improvement cycle.

The current target is the Alex/Gym improvement cycle itself. The user clarified that
Scout is a retained test case, not an established source of recurring user
trouble. Preserve Alex's Scout guidance hypothesis as a deferred suggestion;
an actionable diagnosis alone does not establish its priority or commission a
Scout experiment.

Start with the observed evidence/handoff failure: ignored Task files disappeared
at clean closure, forcing manual reconstruction from public raw session lines.
Alex owns the smallest change to the existing recording practice. Exercise it on
the completed activation/replay evidence and retain one compact cycle record at
an explicit location outside the disposable Task worktree. No fresh Scout
diagnosis, research or behavioral change is needed for this mechanics experiment.

The record must make these facts inspectable:

- Agreed objective, scope and hypothesis, including the deferred Scout lead.
- Exact input, source and executed workflow identities, with old and repaired
  invocations kept distinct.
- Task/attempt/session/workflow references and the evidence actually supporting
  each result; retained artifact paths must resolve and match their hashes.
- Alex's supported decision, limits and next owner/action.
- Available elapsed time, full Task cost estimates and manual interventions,
  with partial cost scopes and unknown values explicit.

Accept this experiment only after the new Task closes and an independent reader
can recover those facts from the record and its direct evidence links without
searching transcripts or relying on the removed Task directory. Use existing
public accepted results, workflow/session reads and exact raw-line access where
needed. This tests one evidence-retention and handoff improvement; it does not
prove unattended execution, better target behavior or lower model cost. Do not
add a scheduler, dashboard or generic receipt framework for this single case.

The [handoff trial](cycle-evidence-handoff-trial-20261116.md) has now exercised
this boundary. Its first record survived Task removal but independent review
rejected an invalid JSON pointer and hardcoded future timestamps. Alex's retained
revision passed post-closure hash, pointer, identity, cost-scope and frozen-input
checks. The two finite attempts report a combined $1.7027728 model estimate,
separate from the historical cycle costs they record. One operator rejection and
correction admission were required; reduced effort or cost is not established.

Use the verified recording practice in the next authorized bounded cycle,
following the [manual handoff guide](standalone-stage.md#hand-off-evidence-from-a-hosted-trial).
Keep its post-closure inspection and output retention with the operator until
ordinary hosted execution proves those responsibilities. Workflow structured
result persistence remains a concrete gap, with public raw-line recovery as the
existing fallback. No further source repair or target experiment is commissioned
by completing this handoff trial.

The projection's executable checks are newly derived from real evidence; original
finishes remain success, human labels remain unreviewed and unavailable usage
stays unknown. The two Tasks' combined reported model estimate is $3.0511248,
excluding operator costs and unknown billing. Workflow result persistence and
manual successor admission remain gaps. Do not modify semantic truth or broaden
intake to bypass those limits.

For the earlier retained Scout semantic-score case, no-change and the specific
human truth judgment remain separate. Disposable Host restart checks passed;
automatic development-checkpoint restoration and a full unattended development/
recovery cycle remain unverified. Keep integration, activation and subsequent
behavior as separate milestones.
