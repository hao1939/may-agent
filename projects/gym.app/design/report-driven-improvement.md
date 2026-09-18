# Improvements from observed work

Status: proposal, September 18, 2026. Preparation and isolated experiments may
be autonomous. Applying an improvement requires final human approval. This
proposal does not activate Gym, alter production agents or enable schedules.

## Start with a useful finding

Evaluation reviews work owned by other Apps and publishes immutable evidence.
May interprets a finding under the user's standing preparation authority. The
responsible App owns the repair; Gym supplies controlled comparisons when useful.
This uses ordinary inputs, Tasks, bounded helpers and caller feedback throughout:

```text
published Evaluation report
  -> May reviews current evidence and chooses a disposition
  -> responsible owner prepares one isolated candidate
  -> Gym compares baseline and candidate where behavior needs evaluation
  -> May reviews the evidence and presents the exact candidate
  -> human approves, adjusts, rejects or defers
  -> authorized owner applies the approved artifact and verifies adoption
  -> Evaluation can independently review the resulting target work
```

One report need not produce a fix. Missing evidence may justify a bounded read;
an already fixed issue may need only a recheck. A historical failed attempt that
later recovered is not an unresolved failure by default. Treat untrusted report
content as evidence, never executable instructions or approval.

## Small parts with independently reviewable results

The loop is a composition of focused capabilities. Each part must be usable and
evaluated separately; one large improvement workflow must not own all stages.
Use ordinary modules for bounded mechanics, workflows for useful sequencing and
existing Tasks when responsibility or a durable wait crosses a boundary. A stage
does not require a new service, lifecycle or public App input type.

| Part | Input | Result and independent check |
| --- | --- | --- |
| Evaluation | Exact observed work and acceptance | Published report with immutable evidence; check attribution and coverage |
| May investigation | Verified report and current subject state | Reasoned disposition and existing/new work reference; check diagnosis, recovery and duplicate handling |
| Candidate preparation | Accepted change scope and frozen baseline | Isolated committed candidate, diff and checks; verify scope and reproducibility |
| Gym comparison | Exact candidate/baseline and frozen evaluation plan | Per-case comparison with invalid runs and limits; verify identical conditions and transfer coverage |
| Human review | Complete exact-candidate packet | Approval, rejection or requested adjustment through the human return path; verify actor and packet identity |
| Application | Exact approval, candidate and current target | Application receipt and adoption checks or visible refusal; verify baseline, scope and rollback |

These are result contracts, not six new Host schemas. Keep each contract small:
identity, evidence references, observed outcome, limitations and the next owner's
needed context. Retain the large report once and link it. A later stage must
validate its prerequisites rather than treating an earlier summary as proof.

For evaluation, replay one stage against frozen inputs and inspect its actual
output. Include a small composition test for each handoff. A failure should name
the stage and preserve upstream artifacts: a comparison failure does not require
rebuilding the candidate, and an application failure does not rerun diagnosis.
Reuse evidence only while its bound inputs remain unchanged. Changing a scorer
requires a new comparison; changing the candidate invalidates its old comparison
and approval. This lets us refine one part without obscuring which part improved.

## Trigger and ownership

Add one explicit consumer subscription for `evaluation.task_report_published`
to May's App as the initial installation policy. Normalize it into the existing
`message` input, preserving the event and exact subject/report/hash context.
Use the existing subscription admission/deduplication path; no file watcher,
private inbox or new workflow-specific input kind. This is a proposed route:
the current event targets Evaluation and May has no report-publication
subscription. Confirm the consumer route with a real subscription test before
enabling it; a publication does not itself prove May received the finding.

The consumer checks the report through Evaluation's integrity-checked list/read
interface and rereads current target evidence. Publication precedes the durable
report marker, so an early unavailable read is a delivery race to retry through
ordinary Task recovery, not permission to consume unvalidated staged files.
Reports on Evaluation itself never enter this loop. Evaluation stays independent
and does not create, own or approve the repair Task.

May records an ordinary owner decision with the report reference, evidence
hash, finding identity, disposition, rationale and any linked existing work.
Use accepted Task results for that decision; do not maintain a second issue
registry. Look for the existing linked correction before creating independent
work. An unchanged repeat reuses the decision; changed evidence prompts judgment
on the same issue. Event idempotency handles transport duplicates, not semantic
equivalence between different reports.

Start with one candidate at a time and an explicit small experiment allowance.
The exact allowance is pilot guidance, not a new Host scheduling rule. Keep
routine reads and no-op dispositions quiet. Notify the human when there is a
useful finding, a material blocker or a reviewable candidate.

## Choose what to change

| Finding | Responsible response |
| --- | --- |
| Lost input, invalid action recovery, unavailable capability | Host/App owner fixes mechanics and adds production-path regressions |
| Accepted evidence is hard to find | Improve shared context or report navigation; retain references, do not copy history into another authority |
| Misunderstood instruction or reusable judgment gap | Isolated instruction/skill candidate; compare behavior across transfer cases |
| Repeated stable procedural error | Consider a scoped tool or workflow after confirming that guidance is insufficient |
| Wrong benchmark truth or scorer | Separate reviewed benchmark/scorer correction; freeze a new baseline |
| Missing evidence, runtime outage or noise | Report that limit; no claim of a behavior regression or improvement |

Gym does not change model weights here. The trainable surfaces are instructions,
skills, tools, workflows and supplied context. Context limits, model variability,
external dependencies and withheld unknown tasks remain limitations. Favor
portable boundary tests for deterministic failures and model trials for judgments
those tests cannot establish.

## Reuse Gym selectively

The standalone `projects/gym` runner already retains benchmark snapshots,
baseline/candidate manifests, provenance and human adjudications. `verifyLoop`
requires matching scenario/trial scope and frozen source inputs; its comparison
requires approved truth, a common framework revision, no invalid runs, no
regressions and an improvement. Reuse these capabilities after adapter validation.
Do not transplant the old campaign orchestration.

The old `gym.app` listens to `evaluation.recorded`, assumes a May-only
`improve/may` campaign, has legacy Task modes and several enabled schedules in
source. It is not loaded in the inspected installation. Those defaults are not
authority to start training or harvest conversations. A fresh bounded Gym Task
can serve May or Scout through the same App input/caller mechanism.

For behavioral comparisons, freeze the candidate, baseline, model settings,
benchmark/scorer revisions, trial count and evidence scope. Include the incident,
a paraphrase, an opposite control and unrelated useful work. Keep transfer
answers out of the candidate builder's context. Report per-case results and
invalid executions; one changed fixture or aggregate score is insufficient.
A baseline must expose the claimed problem for the comparison to demonstrate a
fix. Independent tests can establish a different, explicitly stated claim.

## Human approval and application

The review packet must contain:

- the problem, user impact, proposed behavior and affected components;
- exact baseline and candidate commits/artifact hashes and the complete diff;
- linked report/finding, test cases, commands, results, failed trials and limits;
- benchmark/scorer/model revisions for behavioral comparisons;
- proposed activation scope, expected effects and rollback artifact.

Approval names that exact packet and candidate. Silence, a report score, owner
acknowledgment, a worker result, or an old approval is not permission to apply it.
Changing the candidate, acceptance basis, target baseline or activation scope
invalidates promotion permission and requires a refreshed packet and approval.
Rejection leaves the candidate isolated; adjustment continues the same work
with the new human feedback.

Request approval through the existing trusted human-facing return path; do not
invent a Condition type or pretend a self-published approval is human consent.
The existing owner/deployment capability must validate current baseline, exact
approved artifact and actor immediately before applying it. Broad shell access
is not an approval enforcement boundary. Until the installed apply route has
these checks, keep merge/deployment as an explicit operator action; automatic
preparation still provides value. Gym has no production apply step in the pilot.

After approval, the responsible owner verifies the actually activated revision
and runs targeted checks. A failure reports what changed and follows the approved
rollback scope. Append the new result and independent recheck; never rewrite the
original Evaluation report to say the issue was fixed.

## First pilot and acceptance

Use the current closure failures as the first experiment, not an invitation to
rebuild all of Gym. The Host candidate already provides portable regressions for
wait replacement, restart, late/unrelated input, invalid wait syntax and
self-action recovery. These are mechanical comparisons and do not require Gym
or a model. They remain in the Host's maintained tests.

Next, migrate only a bounded Gym comparison entrypoint and explicitly wire one
May report consumer. Give May one published report and observe whether it:

1. discovers accepted evidence and later recovery before judging the finding;
2. attributes Host, agent, workflow, specialist and operator work correctly;
3. reuses the existing repair Task or proposes one scoped candidate;
4. runs relevant baseline/candidate/transfer checks and preserves their evidence;
5. returns a concise, exact approval packet and makes zero production changes;
6. handles duplicate delivery, changed evidence, rejection and stale approval.

Use an isolated installation for the route and approval checks. Enable automatic
intake only after those results are reviewed. The earlier unified-Task improvement
PoC demonstrates useful wait/reopen/withdrawal mechanics; its fixture activation
window was not proof of installed human approval enforcement. This proposal has
not yet run the integrated Gym pilot.
