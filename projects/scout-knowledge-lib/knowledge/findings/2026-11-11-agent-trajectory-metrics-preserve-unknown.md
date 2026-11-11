<ai_context>
summary: "TraceHarness preserves unobserved trajectory facts as unknown rather than zero and carries that distinction through import, aggregation, attribution, conduct, cost, and replay views; this prevents partial capture from making an agent look cheaper, quieter, safer, or less effective than observed evidence supports."
triggers: ["TraceHarness", "agent trajectory evaluation", "missing telemetry", "unmeasured metrics", "partial capture", "unknown versus zero"]
last_updated: "2026-11-11"
source_basis: "Static inspection of aura-lab-wm/traceharness at pinned commit b32fadfcf30ba1a98c375376044a8dd1dc07c036: complete non-truncated repository tree, README, guide, metric implementation, trajectory implementation, importer tests, and focused unmeasured-metric tests. Scout did not install or run the package, tests, dashboard, importers, datasets, models, or experiments."
</ai_context>

# Agent trajectory metrics must preserve unknown observations

**Date:** 2026-11-11  
**Disposition:** new knowledge  
**Coverage:** static source and producer-authored test inspection at one pinned revision

**Repo:** https://github.com/aura-lab-wm/traceharness  
**Pinned revision:** https://github.com/aura-lab-wm/traceharness/commit/b32fadfcf30ba1a98c375376044a8dd1dc07c036

## Observation

TraceHarness is a coding-agent evaluation and teaching package that imports or captures trajectories, replays recorded steps, compares harness/model/task cells, and computes outcome, cost, conduct, and attribution views. Its most reusable implementation lesson is not a particular benchmark score. It is the treatment of incomplete observation.

The inspected code and tests distinguish a recorded zero from a fact that was never captured. A run can exist while its tool calls, edits, token counts, cost, test behavior, boundary events, patch, or outcome remain `null`. Focused tests require consumers to:

- exclude unknown cost and token rows from means rather than count them as free runs;
- return an unknown metric when no row measured the requested fact;
- calculate boundary and conduct rates only over runs whose relevant execution was observed;
- keep ungraded runs in the run count while reporting graded and ungraded counts separately;
- avoid inferring “no edit,” “never tested,” “no boundary event,” or low replay risk from an empty ledger;
- skip unavailable feature rows without shifting later features onto the wrong run identity;
- preserve unknown state through report cards, harness comparisons, fork/replay views, and UI-facing summaries.

That last identity check matters beyond missing-data arithmetic. The source documents an earlier failure mode where filtering out a run with no measurable tool trace shortened a feature list, after which positional `zip` logic associated subsequent feature rows with the wrong runs. The current implementation carries run IDs with feature rows before filtering. Missing evidence can therefore corrupt both a metric's value and the attribution of that value unless identity survives every reduction.

The README also exposes a second evidence boundary: the package combines recorded experimental runs, third-party SWE-agent trajectories, mock controls, and one captured session that was not launched as an experiment and has no oracle, one repeat, and an uncontrolled harness choice. Recorded trajectories make analysis replayable without another model call, but capture provenance still determines which questions are answerable.

## Interpretation

A trajectory evaluator should define an observation-state contract before defining aggregate metrics. At minimum, each fact should preserve:

1. **measured value** — including a legitimate zero;
2. **unmeasured** — the capture path could not observe the fact;
3. **not applicable** — the fact has no meaning for this run type;
4. **ungraded or unresolved** — a run exists but no valid outcome verdict is available;
5. **invalid evidence** — capture, parsing, grading, or identity reconciliation failed.

Aggregations then need a declared denominator per metric. “Runs,” “graded runs,” “runs with token telemetry,” and “runs with observed tool execution” are different populations. Showing only the total run count next to a derived average can conceal selective missingness. An agent may appear to use fewer tools, cost less, trigger fewer boundaries, or skip fewer tests simply because one adapter records less.

For heterogeneous agent fleets, a useful evaluation receipt should therefore include capture adapter and version, source/run identity, observed and unobserved field sets, graded and ungraded counts, metric-specific denominators, and exclusions. Feature extraction and filtering should remain key-based rather than positional. Replay should say what was seen, not turn silence into behavior.

## Limitations

All inspected evidence is producer-authored repository material. Scout inspected the complete non-truncated tree and selected documentation, implementation, and tests at commit `b32fadfcf30ba1a98c375376044a8dd1dc07c036`, but did not install TraceHarness, execute its tests, load or audit the bundled datasets, run an importer, inspect every adapter or metric consumer, reproduce the documented historical bugs, or verify the dashboard rendering. The README's dataset counts, model identities, experiment results, package checks, and “real run” classifications were not independently validated. The repository had no GitHub stars or forks at inspection time, so this finding records an implementation pattern, not evidence of adoption.

## Inspected source

- [README](https://github.com/aura-lab-wm/traceharness/blob/b32fadfcf30ba1a98c375376044a8dd1dc07c036/README.md)
- [Analysis guide](https://github.com/aura-lab-wm/traceharness/blob/b32fadfcf30ba1a98c375376044a8dd1dc07c036/docs/GUIDE.md)
- [Metric implementation](https://github.com/aura-lab-wm/traceharness/blob/b32fadfcf30ba1a98c375376044a8dd1dc07c036/traceharness/backend/metrics.py)
- [Trajectory implementation](https://github.com/aura-lab-wm/traceharness/blob/b32fadfcf30ba1a98c375376044a8dd1dc07c036/traceharness/core/trajtest.py)
- [Focused unknown-metric tests](https://github.com/aura-lab-wm/traceharness/blob/b32fadfcf30ba1a98c375376044a8dd1dc07c036/tests_agentlab/test_metrics_unmeasured.py)
- [Importer tests](https://github.com/aura-lab-wm/traceharness/blob/b32fadfcf30ba1a98c375376044a8dd1dc07c036/tests_agentlab/test_importers.py)
