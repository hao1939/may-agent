# What Gym is for — expectations and limits

Gym has two purposes. Keep their evidence and claims separate.

| Test kind | Question | Required evidence | What a pass does not prove |
| --- | --- | --- | --- |
| `judgment` | Given this situation, does the agent choose an approach that matches our expectations? | The actual decision, including production result fields such as state, requests, constraints and proposed response; human-reviewed acceptable and unacceptable choices. | That the proposed action was executed, accepted by another owner, or completed successfully. |
| `behavior` | When acting in this situation, does the agent actually do the right thing and respect the boundaries? | Observed actions and results: relevant tool calls/receipts, changed and unchanged files, final durable state, and required completion proof. | Reliability outside the exercised situations, integrations or runtime conditions. |

A decision saying “delegate the work” is judgment evidence. An accepted owner
request and a verified result are behavior evidence. Saying “leave the file
unchanged” is not evidence that it stayed unchanged. Returning a terminal Task
state while saying “this is not finished” is a contradictory decision, not a
pass for good wording.

## Set the expectation before running

For each case, identify:

1. **Situation and intended outcome.** What matters to the user?
2. **Acceptable choices or outcomes.** Allow reasonable alternatives; do not
   require a particular phrase or implementation without a reason.
3. **Forbidden choices or effects.** Include scope, authority, protected data,
   and honest reporting boundaries.
4. **Observable evidence.** What exact decision field, action receipt, file
   comparison or final-state check would establish success? What evidence would
   disprove it? Missing required execution evidence cannot become a pass.
5. **Limits.** What does this fixture not exercise?
6. **Human truth approval.** The scorer implements the expectation; it does not
   decide what the human ought to want. Drafts are diagnostic until approved.

Prefer a representative replay, a paraphrase, and an opposite control. A rule
that fixes one failure by making the agent always refuse or always ask should
fail the control. Keep some new situations separate from candidate tuning.

## Author and report the scope

Set `evaluation_kind: "judgment"` or `"behavior"` in `suite.json`. An inline
case or a directory case's `scenario.json` can override that default. Keep
mixed suites explicit at the case level. New manifests freeze each case's kind,
and reports show judgment, behavior and unclassified coverage. Historical and
unclassified cases do not acquire a kind by inference.

The current named role-judgment, May alignment and May App outcome-management
suites produce decisions; they are **judgment** tests, including decisions using
the production Task-result schema. A production-shaped result alone does not
turn a case into a behavior test. Existing coding/trajectory scenarios are a
source for curating behavior benchmarks, not an automatically approved second
suite. Classify them only after inspecting their scorers and evidence needs.

For Task-result judgment cases, expectations can address original production
fields using the existing `exact` and `one_of` matchers:

```json
{
  "one_of": { "task_result.state": ["waiting", "incomplete"] },
  "exact": { "needs_clarification": false }
}
```

This checks the returned state, not words about the state. Check other relevant
production fields in the same way. Do not silently add expectations to approved
truth: review changes and create a fresh baseline. The unfinished-work state
check in `alex-judgment` is a draft expectation for review.

## Trustworthy evidence, bounded conclusions

- Both sides of a comparison must execute the same retained task, fixture,
  expectations and scorer. Live definitions must not replace frozen inputs.
- Judgment-only workspace checks compare seeded file contents and structure,
  including nested additions, deletions and symbolic-link replacements. They
  allow runner artifacts and adapter-staged identities. They are **not an OS
  sandbox** and cannot establish the absence of external actions or mutations
  that were later undone. Use an enforced capability policy or trajectory
  evidence where that boundary matters.
- Preserve the original environment separately from the final workspace.
  Behavior reviews need what actually happened, not only the starting files
  and a success message. Old runs without that evidence cannot recreate it.
- Runtime/provider/scorer faults are evaluation validity problems, not a third
  Gym purpose and not evidence that the agent's judgment or behavior was bad.
  Tests of recovery become behavior cases when recovery is the intended action.
- Efficiency measurements are secondary observations or explicitly declared
  comparison objectives, not a third kind of agent quality. Missing or malformed
  usage is unknown, not zero; a cheaper wrong outcome is not a quality gain.
- A machine comparison gate is not human approval or statistical confidence.
  Report case count, trials, failures, invalid runs and truth status. Repeated
  matched trials reduce uncertainty; five trials are a practical minimum for
  release comparisons, not proof of general reliability.

Gym provides bounded regression and improvement evidence. It does not certify
an agent as generally aligned, safe or production-reliable. Pair it with
production observation, human review and real outcome verification.
