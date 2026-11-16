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
The [deterministic evidence implementation trial](deterministic-cycle-evidence-trial-20261116.md)
then implements and integrates a reusable mechanical helper. Alex owns its
three-round review, guarded integration, fresh hosted demonstration and automatic
post-dependency read-back. Two operator corrections were still required.
The [normal development path trial](normal-development-path-trial-20261116.md)
then completes a bounded repair through the normal workflow, local integration,
definition activation, fresh hosted verification and automatic owner continuation
with zero operator correction messages. Alex delivers available model estimates
with an explicit live-tail cutoff; blocked-result recovery remains unchanged.
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

The north star remains **correct useful delivery, fewer operator corrections,
and acceptable total time/cost**. Alex owns scope and disposition. Use a single
observed bottleneck and a finite hypothesis; improve the process when actual
work exposes a problem. The linked trial reports preserve earlier failed,
rejected, no-change and adopted outcomes.

The [representative Gym reporting delivery](gym-reporting-delivery-trial-20261116.md)
completed an assignment from existing unfinished work. Alex produced candidate
`772d179073e821df68d57fc4c66c220159ffc920`, passed 20 focused tests/178 assertions,
obtained independent exact-candidate review and retained a controlled report replay.
The candidate separates observed quality, resource coverage, run completeness and
recorded controls while preserving current measured usage and release gates.
Independent retained-run replay confirmed that every existing comparison field
remains unchanged and exposed the quality/resource tradeoff explicitly.

The supported disposition is **reviewed candidate; integration deferred**. The
owner Task and addressed request closed, with a durable validated record and a
precise handoff. Concurrent migration edits overlap
`projects/gym/src/loop/types.ts` and `projects/gym/test/loop.test.ts`. The migration
owner must preserve and settle those edits; Alex or the next integration owner
then adapts the retained patch to current source, verifies it and reviews any
conflict resolution before claiming integrated behavior. No candidate source was
applied to main, and no definition reload or hosted helper was necessary.

There were zero operator correction messages after initial admission. Independent
observation, testing, replay and reporting still required operator work. The owner
envelope was 13m 05.579s; the current-cycle model estimate was $13.3094002. Inherited
owner/helper work was separately $34.2608282, not charged again to this cycle.
The final record validated 14 artifacts and 20 pointers. Direct recovery artifacts
are retained outside the owner worktree, which remains available with its unmerged
candidate. Full workflow/session coverage additionally required operator collection.

The [normal development path trial](normal-development-path-trial-20261116.md)
proved retained round recovery across Task results, not a universal cumulative
bound. The representative assignment consumed **seven internal rounds across
three workflow calls**: 1 + 3 + 3. Reentry within the same live owner attempt did
not recover the preceding call's allowance; changing verification argv also
changed the requirement key. Alex's caller counted calls as rounds. Partial
specialist finishes still fail closed, and environment failures triggered repeated
specialist calls on unchanged source. None of those remaining gaps was repaired
by this reporting change.

The next delivery action is to finish the guarded integration after migration.
The next bounded process-repair candidate is cumulative allowance across live
reentry and verification-command changes, with environment failures kept distinct
from source-repair requests. Do not expand unattended intake on a claim that the
three-round assignment bound already works. Retain the useful reporting candidate
and known status/retention limits; add no scheduler or recursive improvement gate.
General reliability gains and lower operating cost remain unproved.

Scout's earlier proposal remains historical provenance, not an experiment target.
Do not change benchmark truth, scorer or historical evidence to manufacture a
better outcome.
