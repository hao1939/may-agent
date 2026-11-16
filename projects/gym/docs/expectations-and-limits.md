# What Gym is for — expectations and limits

Gym has two purposes. Keep their evidence and claims separate. Each case belongs
to one purpose benchmark and lives in that benchmark's folder; choose the agent
for each run. See [cases, benchmarks and agents](cases-benchmarks-and-agents.md).

| Test kind | Question | Required evidence | What a pass does not prove |
| --- | --- | --- | --- |
| `judgment` | Given this situation, does the agent choose an approach that matches our expectations? | The actual decision, including production result fields such as state, requests, constraints and proposed response; human-reviewed acceptable and unacceptable choices. | That the proposed action was executed, accepted by another owner, or completed successfully. |
| `behavior` | When acting in this situation, does the agent actually do the right thing and respect the boundaries? | Observed actions and results: relevant tool calls/receipts, changed and unchanged files, final durable state, and required completion proof. | Reliability outside the exercised situations, integrations or runtime conditions. |

A decision saying “delegate the work” is judgment evidence. An accepted owner
request and a verified result are behavior evidence. Saying “leave the file
unchanged” is not evidence that it stayed unchanged. Reporting the assigned
repair fulfilled while admitting its required implementation is missing is a
contradictory decision, not a pass for good wording. But a useful helper
contribution can be finished while the broader repair is unfinished. Define what
this result owes: a contribution or the whole outcome. Its result state does not
by itself close a durable Task; closure belongs to an authorized owner/App policy.

## Set the expectation before running

For each case, identify:

1. **Situation and intended outcome.** What matters to the user?
2. **Acceptable choices or outcomes.** Allow reasonable alternatives; do not
   require a particular phrase, command spelling, word count or implementation
   without a reason. Judge verification by trustworthy execution evidence; send
   unfamiliar methods for review rather than automatically calling them wrong.
3. **Forbidden choices or effects.** Include scope, authority, protected data,
   and honest reporting boundaries.
4. **Observable evidence.** What exact decision field, action receipt, file
   comparison or final-state check would establish success? What evidence would
   disprove it? Missing required execution evidence cannot become a pass.
5. **Limits.** What does this fixture not exercise?
6. **Human approval of the expected answers.** The scorer implements the expectation; it does not
   decide what the human ought to want. Drafts are diagnostic until approved.
   Approval of a design direction does not approve later rewritten case answers.

Prefer a real incident, a reworded example, and a situation where a different
choice is right. A rule that fixes one failure by making the agent always refuse
or always ask should fail that last example. Keep some new situations separate from candidate tuning.

## Author and report the scope

Set `evaluation_kind: "judgment"` or `"behavior"` in `suite.json`. An inline
case or a directory case's `case.json` can override that default. Keep
mixed benchmarks explicit at the case level. New manifests freeze each case's kind,
and reports show judgment, behavior and unclassified coverage. Historical and
unclassified cases do not acquire a kind by inference.

Seven active purpose benchmarks produce decisions; they are **judgment** tests,
including decisions using the production Task-result schema. A production-shaped
result alone does not turn a case into a behavior test. `verified-code-work` is
the first draft behavior slice, checking actual local repairs, verification and
scope. See [`../benchmarks/CORE.md`](../benchmarks/CORE.md) for its evidence,
limits and six paired judgment expectations. Archived coding/trajectory cases
remain material for further curation, not automatically approved coverage.
Classify them only after inspecting their scorers and evidence needs.

For Task-result judgment cases, expectations can address original production
fields using the existing `exact` and `one_of` matchers:

```json
{
  "one_of": { "task_result.state": ["waiting", "incomplete"] },
  "exact": { "needs_clarification": false }
}
```

`task_result.state` checks the returned production field, not words about state.
By contrast, `needs_clarification` can be a projection from prose. In semantic
cases that inferred value is advisory: a request for missing material is not
necessarily missing intent. The meaning-based judges decide; an explicitly
supplied structured flag still has a hard check. Check other real production
fields directly where possible. Do not silently add expected answers to approved
cases: review changes and create a fresh baseline. The unfinished-work state
check is part of the explicitly approved `outcome-completion` measurement (now v4);
that approval does not extend to other draft cases or establish a model result.

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
  When a copied workspace is rescored, resolve recorded paths using the original
  workspace identity retained by the runner, not a root guessed from the transcript.
- Distinguish an actual test run from a syntax check, printed success text, or a
  command whose completion status is missing. Do not infer arbitrary JavaScript's
  meaning from assertion-shaped words. Send unsupported methods for human review
  instead of treating them as established verification or automatic agent failures.
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
