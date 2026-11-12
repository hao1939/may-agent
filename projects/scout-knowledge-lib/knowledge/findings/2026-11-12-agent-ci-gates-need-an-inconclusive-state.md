<ai_context>
summary: "reliagate implements repeated-run task reliability, paired comparison, power planning, explicit abstention reporting, and distinct infrastructure failure, but its main CI gate returns success when an observed regression is too underpowered to reach significance; agent gates should preserve inconclusive evidence as a machine-readable state rather than a passing exit code."
triggers: ["reliagate", "agent CI gate", "repeated runs", "statistical power", "McNemar", "pass^k", "inconclusive evaluation", "agent regression testing"]
last_updated: "2026-11-12"
source_basis: "Static inspection of Gjusev/reliagate at pinned commit a721fd35503aacee0d2e2caaba91e018b3103440: complete non-truncated repository tree, README, ROADMAP, data model, metrics, paired comparison, gate, planning and selected producer-authored tests. Scout did not install the package, run its 90 claimed tests, execute an agent evaluation, inspect real benchmark data, or validate the statistical implementation independently."
</ai_context>

# Agent CI gates need an inconclusive state

**Date:** 2026-11-12  
**Disposition:** new knowledge  
**Coverage:** static source and producer-authored test inspection at one pinned revision

**Repo:** https://github.com/Gjusev/reliagate  
**Pinned revision:** https://github.com/Gjusev/reliagate/commit/a721fd35503aacee0d2e2caaba91e018b3103440

## Observation

`reliagate` is a small Python package for treating agent reliability as a repeated-run, task-level inference problem rather than gating on one aggregate score. The inspected revision groups repeated binary trials by task, computes `pass^k` and all-run consistency, compares the same tasks across two versions with paired McNemar tests, reports abstentions, simulates required task counts, and exposes CI exit codes for pass, regression, and infrastructure error.

Several implementation choices are useful:

- comparison requires identical task sets, so unmatched populations fail as an input error rather than silently changing the denominator;
- the paired test counts which tasks gained or lost all-run consistency instead of treating repeated trials as independent observations;
- abstained or infrastructure-error trials remain visible in reports and prevent an all-success consistency claim;
- malformed input and mismatched task sets return exit `3`, distinct from a measured regression at exit `2`;
- the planning module records its Bernoulli and independence assumptions, and its sequential test labels a capped undecided run `continue` with an explicit `INCONCLUSIVE` note.

The main CI gate does not preserve that last distinction. A regression blocks only when its observed drop exceeds the configured margin **and** the paired test is statistically significant. When the drop exceeds the allowed margin but the study is too small or noisy to reject the null, `gate()` sets `decision="pass"` and exit `0`; its prose says the gate passes and advises widening the study. A producer-authored unit test requires this behavior for a two-of-six-task loss. The README separately warns that below roughly ten tasks, “not significant” often means underpowered, and the ROADMAP says the implementation has not yet been validated against real benchmark data.

This produces a machine-policy gap: the human-readable reason preserves uncertainty, but ordinary CI consumes the zero exit code as authorization to continue. Absence of significant evidence for regression is not evidence that the candidate is within the allowed regression margin.

## Interpretation

A reliability gate should separate at least four states:

1. **pass** — the design had adequate power or a declared confidence bound supports the permitted margin;
2. **regression** — evidence crosses the blocking effect and error threshold;
3. **inconclusive** — the observed data cannot establish either acceptable equivalence/non-inferiority or a blocking regression;
4. **invalid** — task identity, coverage, parsing, execution, or other prerequisites failed.

The key design change is not merely another exit code. The gate's pass claim needs a positive evidential rule. For example, require a preregistered task and repeat count from power planning, or use a confidence interval/non-inferiority test whose bound lies inside the tolerated regression margin. If the planned population was not reached, discordant pairs are too sparse, abstention coverage is excessive, or the interval still crosses the margin, return inconclusive and keep publication or deployment policy outside the statistic.

Repeated trials also do not create more independent tasks. The inspected comparison correctly uses the task as the paired inference unit; callers should preserve task-set identity, repeat policy, outcome definition, agent/harness revision, and abstention treatment in the gate receipt. A larger rollout count can characterize per-task consistency, but it does not repair an undersized task population by itself.

For agent runtimes, this distinction is especially important because automation acts on status, not caveat prose. A gate that prints “widen the study before trusting this” while returning success has preserved diagnostic information but lost decision integrity.

## Limitations

All inspected evidence is producer-authored repository material at the project's first public commit. Scout did not install `reliagate`, run its claimed 90 tests, reproduce the combinatorial estimators or p-values, execute the live provider adapter, evaluate any agent, inspect the referenced real trajectories, or compare the design with a statistician-reviewed implementation. The repository explicitly labels version 0.1.0 “mechanism implemented and offline-tested” and not validated against real benchmark data; its first ROADMAP item is a real-data run. This finding therefore evaluates the visible decision contract and implementation structure, not the package's empirical accuracy, adoption, or production fitness.

## Inspected source

- [README](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/README.md)
- [Data model and abstention reporting](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/reliagate/model.py)
- [Paired comparison](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/reliagate/compare.py)
- [CI gate](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/reliagate/gate.py)
- [Power planning and sequential stopping](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/reliagate/planning.py)
- [Gate tests](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/tests/test_gate.py)
- [Planning tests](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/tests/test_planning.py)
- [ROADMAP](https://github.com/Gjusev/reliagate/blob/a721fd35503aacee0d2e2caaba91e018b3103440/ROADMAP.md)
