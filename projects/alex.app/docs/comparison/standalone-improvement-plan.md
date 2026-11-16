# Standalone improvement trial plan

Status: planned. This plan prepares manual experiments alongside Alex's existing
Host assignment; it does not start another run or change that assignment.

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
  for development evidence.
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
  provide baseline diagnosis entry points. Their current verdicts need validation:
  diagnosis reads status from the wrong location, prescribes changes too early,
  and does not represent every legitimate disposition. Start without candidate
  preparation; the candidate path can remove an existing candidate directory.
- `alex/develop-change` supplies design, implementation, real verification,
  exact-commit review and retained recovery evidence. Its private input is
  `{ verify: [executable, ...arguments] }`; the outcome and acceptance come from
  the explicit Task envelope. It requires a linked Git worktree and ignored state.
- The SDK's `run()` retains traces with explicit `outputRoot` and `traceDir`.
  Deterministic `agentFixtures` let us debug mechanics before live model calls.
- Workflow `ctx.call` can run specialists standalone. A standalone prompt Alex
  currently lacks hosted `agents` and live Task tools, so initially the operator
  invokes stages explicitly, keeping Alex's scope and disposition decisions in
  their inputs and outputs. Do not assume `run("alex")` supplies the full Host loop.
- Gym comparison requires approved truth and matching frozen identities. The
  App comparison wrapper currently supports May/Scout and at least four scenarios.
  Verify target support before choosing it for another role.

Before trusting a behavioral comparison, resolve or demonstrate protection
against the known live-candidate execution problem: Gym retains a snapshot but
can execute the changing live `.lab` candidate. A recorded fingerprint alone is
insufficient. Current role-judgment cases also lack explicit approval metadata;
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
