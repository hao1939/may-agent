# Frozen comparison service

Gym accepts ordinary `goal` Tasks, and its agent selects `compare-candidate` when behavior evidence is needed. The workflow's private operation input names the request id, `agent` (`may` or `scout`), absolute frozen baseline/candidate artifact paths, their ids and tree fingerprints, the baseline comparison objective, benchmark, scorer and framework revisions, model, unique scenario ids, trials, whole-minute scenario timeout and total allowance. Explicit artifact references allow a Gym attempt to consume a frozen candidate retained by a separate May or Scout Task without assuming a shared worktree.

The focused `compare-candidate` workflow verifies all frozen input identities before model work, invokes the standalone Gym `src/loop/cli.ts verify` entrypoint from the granted Gym project root, writes only beneath the granted output root, and retains argv, cwd, timestamps, exit status, bounded stdout/stderr and all requested and observed identities. It rehashes baseline and candidate after the run and accepts only the trusted single run path beneath its output state. It holds rather than supports a candidate on command failure, timeout, cancellation, changed artifacts, baseline/candidate/agent/benchmark/scorer/framework/model drift, invalid trials, unapproved truth, regression or no demonstrated benefit under the frozen objective. Missing timing evidence keeps the timing objective unknown and the candidate on hold, while any available quality evidence remains visible. Cancellation terminates the complete subprocess group. The scenario set must include at least incident, paraphrase, opposite-control and unrelated-transfer cases. Transfer answers remain outside candidate preparation.

## Declared benefit and independent observations

The assigning owner declares an objective before baseline execution. The private
workflow input uses the standalone runner's shared `ComparisonObjective` contract:

```json
{ "objective": { "metric": "duration_ms", "min_reduction_percent": 20 } }
```

An omitted objective means `{ "metric": "quality" }`, preserving existing callers.
Quality requires at least one per-scenario increase in passing trials. Duration
requires a strictly lower sum of `duration_ms` across the complete matched trial
grid, meeting the declared percentage reduction. The percentage must be greater
than zero and at most 100. Both objectives retain approved truth, valid complete
runs, frozen execution identities and no per-scenario drop in passing trials.

The baseline manifest and `inputs/comparison-objective.json` record the objective
before the first execution; the input fingerprint includes it. Verification
inherits it. The App checks that its requested objective matches the baseline,
returned manifest and comparison. Changing the metric or threshold requires a
new baseline. Historical missing objectives mean quality, and historical reports
remain readable; existing provenance requirements still govern reuse.

The receipt and Markdown report show quality counts, timing totals and coverage
per scenario and overall. `improved` continues to mean quality improvement;
`objective_met` independently records true, false or null (unknown). A missing,
negative or nonfinite timing value makes that side's total unknown. A zero
baseline cannot support a percentage reduction. The comparison retains the
quality findings: missing timing does not erase a known quality regression, and
missing timing alone does not invalidate a supported quality objective.

A duration objective measures observed execution time, including the scenario's
agent phases and their orchestration, before final scoring. It does not measure
billing, isolated model latency, optimization spend or complete benchmark wall
clock. The total is over all selected trials, including valid behavioral
failures; the report exposes per-case differences and failures. A supported
objective does not certify that the absolute quality is acceptable or that
faster failures are valuable. May owns that judgment and the review of value,
maintenance cost and the simpler alternative. Application still requires human
approval of the exact candidate.

Use repeated matched cases and stable load to judge timing variability. The
threshold is an acceptance target, not a statistical confidence guarantee. Keep
successful cases, opposite controls and unrelated work in the comparison. Extra
measurement is guidance driven by the uncertainty relevant to the decision, not
a new automated experiment scheduler. Model calls, tokens and money remain
future objectives until the runner supplies complete, consistently defined
measurements; absent values are not estimated from transcript length.

The output is a content-addressed comparison receipt. It is evidence only: no approval, merge, apply, deploy, benchmark-truth mutation or model training occurs here.

Legacy autonomous campaign sources are archived outside active agent discovery. The App has no schedules, approval-event subscription, metric trigger or improve action. On first activation, an operator must use public Task reads to inventory unfinished Gym Tasks, wait/cancel with explicit authority as appropriate, and verify no old workflow session remains active before reloading. Retained old Tasks whose `improve-agent` binding is absent must remain visible in attention; never restore the workflow merely to drain them. This source change does not mutate retained state.
